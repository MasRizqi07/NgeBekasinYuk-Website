import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { generateInternalId } from "@/domain/id";
import {
  LISTING_STATUS,
  OFFER_EXPIRY_MS,
  isPriceOfferExpired,
} from "@/domain/listing/listingStatus";
import {
  CounterOfferSchema,
  CreateOfferSchema,
} from "@/lib/validations";
import {
  ChatDomainError,
  chatOfferSelect,
  mapMessageToDto,
  mapOfferToDto,
} from "@/domain/chat/chatDto";
import type { ChatViewer } from "@/domain/chat/chatService";

function formatIdrPlain(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export async function createOffer(
  viewer: ChatViewer,
  conversationId: string,
  rawBody: unknown
) {
  const parsed = CreateOfferSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ChatDomainError(
      400,
      "VALIDATION_ERROR",
      "Nominal Penawaran Tidak Valid",
      parsed.error.issues[0]?.message || "Nominal penawaran tidak valid."
    );
  }

  const amount = parsed.data.amount;

  try {
    return await prisma.$transaction(async (tx) => {
      const convo = await tx.conversation.findUnique({
        where: { id: conversationId },
        include: {
          listing: {
            select: { id: true, price: true, status: true, canNego: true },
          },
        },
      });

      if (!convo) {
        throw new ChatDomainError(
          404,
          "CONVERSATION_NOT_FOUND",
          "Percakapan Tidak Ditemukan",
          "Percakapan tidak ditemukan."
        );
      }

      if (convo.buyerId !== viewer.id && convo.sellerId !== viewer.id) {
        throw new ChatDomainError(
          403,
          "FORBIDDEN",
          "Akses Ditolak",
          "Anda bukan peserta dalam percakapan ini."
        );
      }

      if (convo.buyerId !== viewer.id) {
        throw new ChatDomainError(
          403,
          "ONLY_BUYER_CAN_OFFER",
          "Tindakan Tidak Diizinkan",
          "Hanya pembeli yang dapat mengajukan penawaran harga baru."
        );
      }

      if (convo.listing.status !== LISTING_STATUS.ACTIVE) {
        throw new ChatDomainError(
          422,
          "LISTING_NOT_ACTIVE",
          "Iklan Tidak Aktif",
          "Barang sudah tidak tersedia untuk negosiasi harga."
        );
      }

      if (!convo.listing.canNego) {
        throw new ChatDomainError(
          422,
          "NEGO_NOT_ENABLED",
          "Negosiasi Nonaktif",
          "Penjual menetapkan harga pas (tidak bisa nego) untuk barang ini."
        );
      }

      if (amount <= 0 || amount > convo.listing.price) {
        throw new ChatDomainError(
          422,
          "OFFER_INVALID_AMOUNT",
          "Nominal Penawaran Tidak Valid",
          "Nominal penawaran harus lebih dari Rp 0 dan tidak melebihi harga iklan."
        );
      }

      // Lazily expire stale PENDING offers in this conversation before uniqueness check
      await tx.priceOffer.updateMany({
        where: {
          conversationId: convo.id,
          status: "PENDING",
          expiresAt: { lt: new Date() },
        },
        data: { status: "EXPIRED" },
      });

      const activePending = await tx.priceOffer.findFirst({
        where: {
          conversationId: convo.id,
          status: "PENDING",
        },
        select: { id: true },
      });

      if (activePending) {
        throw new ChatDomainError(
          409,
          "PENDING_OFFER_EXISTS",
          "Penawaran Masih Menunggu",
          "Masih ada penawaran harga aktif yang menunggu tanggapan penjual."
        );
      }

      const offerId = generateInternalId("off");
      const expiresAt = new Date(Date.now() + OFFER_EXPIRY_MS);

      const createdOffer = await tx.priceOffer.create({
        data: {
          id: offerId,
          conversationId: convo.id,
          senderId: viewer.id,
          offerPrice: amount,
          status: "PENDING",
          expiresAt,
        },
        select: chatOfferSelect,
      });

      const summaryText = `Mengajukan penawaran harga ${formatIdrPlain(amount)}`;
      const msg = await tx.chatMessage.create({
        data: {
          id: generateInternalId("msg"),
          conversationId: convo.id,
          senderId: viewer.id,
          senderName: viewer.name,
          text: summaryText,
          offerId: createdOffer.id,
          isRead: false,
        },
        select: {
          id: true,
          senderId: true,
          senderName: true,
          text: true,
          imageUrl: true,
          offerId: true,
          isRead: true,
          createdAt: true,
          offer: { select: chatOfferSelect },
        },
      });

      await tx.conversation.update({
        where: { id: convo.id },
        data: {
          lastMessage: `[Nego] ${summaryText}`.slice(0, 140),
          lastTimestamp: msg.createdAt,
        },
      });

      const meta = {
        listingId: convo.listingId,
        buyerId: convo.buyerId,
        sellerId: convo.sellerId,
        listingPrice: convo.listing.price,
      };

      return {
        offer: mapOfferToDto(createdOffer, meta),
        message: mapMessageToDto(msg, meta),
      };
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ChatDomainError(
        409,
        "PENDING_OFFER_EXISTS",
        "Penawaran Masih Menunggu",
        "Masih ada penawaran harga aktif yang menunggu tanggapan penjual."
      );
    }
    throw err;
  }
}

export async function respondToOffer(
  viewer: ChatViewer,
  conversationId: string,
  offerId: string,
  action: "accept" | "reject" | "counter",
  rawBody?: unknown
) {
  let counterPrice: number | undefined;
  if (action === "counter") {
    const parsed = CounterOfferSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ChatDomainError(
        400,
        "VALIDATION_ERROR",
        "Harga Tanding Tidak Valid",
        parsed.error.issues[0]?.message || "Harga tanding tidak valid."
      );
    }
    counterPrice = parsed.data.amount;
  }

  // Persist lazy expiry before entering the atomic CAS transition
  await prisma.priceOffer.updateMany({
    where: {
      id: offerId,
      conversationId,
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  return prisma.$transaction(async (tx) => {
    const convo = await tx.conversation.findUnique({
      where: { id: conversationId },
      include: {
        listing: {
          select: { id: true, price: true, status: true },
        },
      },
    });

    if (!convo) {
      throw new ChatDomainError(
        404,
        "CONVERSATION_NOT_FOUND",
        "Percakapan Tidak Ditemukan",
        "Percakapan tidak ditemukan."
      );
    }

    if (convo.buyerId !== viewer.id && convo.sellerId !== viewer.id) {
      throw new ChatDomainError(
        403,
        "FORBIDDEN",
        "Akses Ditolak",
        "Anda bukan peserta dalam percakapan ini."
      );
    }

    if (convo.sellerId !== viewer.id) {
      throw new ChatDomainError(
        403,
        "ONLY_SELLER_CAN_RESPOND",
        "Tindakan Tidak Diizinkan",
        "Hanya penjual yang dapat menyetujui, menolak, atau menawar balik penawaran."
      );
    }

    const offer = await tx.priceOffer.findFirst({
      where: { id: offerId, conversationId },
      select: chatOfferSelect,
    });

    if (!offer) {
      throw new ChatDomainError(
        404,
        "OFFER_NOT_FOUND",
        "Penawaran Tidak Ditemukan",
        "Penawaran harga tidak ditemukan dalam percakapan ini."
      );
    }

    if (isPriceOfferExpired(offer)) {
      throw new ChatDomainError(
        422,
        "OFFER_EXPIRED",
        "Penawaran Kadaluwarsa",
        "Masa berlaku penawaran harga ini telah berakhir."
      );
    }

    if (offer.status !== "PENDING") {
      throw new ChatDomainError(
        409,
        "OFFER_STATUS_CHANGED",
        "Status Penawaran Berubah",
        "Penawaran ini sudah ditanggapi atau tidak lagi berstatus PENDING."
      );
    }

    if (
      (action === "accept" || action === "counter") &&
      convo.listing.status !== LISTING_STATUS.ACTIVE
    ) {
      throw new ChatDomainError(
        422,
        "LISTING_NOT_ACTIVE",
        "Iklan Tidak Aktif",
        "Barang sudah terjual atau sedang dalam pesanan aktif."
      );
    }

    if (action === "counter" && counterPrice! > convo.listing.price) {
      throw new ChatDomainError(
        422,
        "OFFER_INVALID_AMOUNT",
        "Harga Tanding Melebihi Harga Iklan",
        "Harga tanding tidak boleh melebihi harga iklan saat ini."
      );
    }

    const nextStatus =
      action === "accept"
        ? "ACCEPTED"
        : action === "reject"
        ? "REJECTED"
        : "COUNTERED";

    const casResult = await tx.priceOffer.updateMany({
      where: {
        id: offer.id,
        conversationId: convo.id,
        status: "PENDING",
      },
      data: {
        status: nextStatus,
        ...(action === "counter" ? { counterPrice } : {}),
      },
    });

    if (casResult.count !== 1) {
      throw new ChatDomainError(
        409,
        "OFFER_STATUS_CHANGED",
        "Status Penawaran Berubah",
        "Penawaran ini telah diubah oleh permintaan lain."
      );
    }

    const updatedOffer = await tx.priceOffer.findUniqueOrThrow({
      where: { id: offer.id },
      select: chatOfferSelect,
    });

    const summaryText =
      action === "accept"
        ? `Penawaran ${formatIdrPlain(offer.offerPrice)} disetujui penjual.`
        : action === "reject"
        ? `Penawaran ${formatIdrPlain(offer.offerPrice)} ditolak penjual.`
        : `Penjual mengajukan harga tanding ${formatIdrPlain(counterPrice!)}.`;

    const msg = await tx.chatMessage.create({
      data: {
        id: generateInternalId("msg"),
        conversationId: convo.id,
        senderId: viewer.id,
        senderName: viewer.name,
        text: summaryText,
        offerId: updatedOffer.id,
        isRead: false,
      },
      select: {
        id: true,
        senderId: true,
        senderName: true,
        text: true,
        imageUrl: true,
        offerId: true,
        isRead: true,
        createdAt: true,
        offer: { select: chatOfferSelect },
      },
    });

    await tx.conversation.update({
      where: { id: convo.id },
      data: {
        lastMessage: summaryText.slice(0, 140),
        lastTimestamp: msg.createdAt,
      },
    });

    const meta = {
      listingId: convo.listingId,
      buyerId: convo.buyerId,
      sellerId: convo.sellerId,
      listingPrice: convo.listing.price,
    };

    return {
      offer: mapOfferToDto(updatedOffer, meta),
      message: mapMessageToDto(msg, meta),
    };
  });
}
