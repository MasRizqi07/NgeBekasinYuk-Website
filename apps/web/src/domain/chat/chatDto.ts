import {
  getCategoryLabel,
  getConditionDisplay,
} from "@/domain/listing/listingMetadata";
import {
  isPriceOfferExpired,
  type ListingStatus,
} from "@/domain/listing/listingStatus";
import type {
  ChatMessage,
  Conversation,
  Offer,
  OfferStatus,
  ProductListing,
  SellerProfile,
  TechCondition,
} from "@/types";

export class ChatDomainError extends Error {
  status: number;
  code: string;
  title: string;

  constructor(status: number, code: string, title: string, message: string) {
    super(message);
    this.name = "ChatDomainError";
    this.status = status;
    this.code = code;
    this.title = title;
  }
}

export interface TimeIdCursor {
  t: Date;
  id: string;
}

export function encodeTimeIdCursor(t: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ t: t.toISOString(), id }),
    "utf8"
  ).toString("base64url");
}

export function decodeTimeIdCursor(raw?: string | null): TimeIdCursor | null {
  if (!raw || raw.trim().length === 0) return null;
  try {
    const jsonStr = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(jsonStr) as { t?: unknown; id?: unknown };
    if (typeof parsed.t !== "string" || typeof parsed.id !== "string" || !parsed.id) {
      return null;
    }
    const parsedDate = new Date(parsed.t);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }
    return { t: parsedDate, id: parsed.id };
  } catch {
    return null;
  }
}

export const chatParticipantSelect = {
  id: true,
  name: true,
  avatar: true,
  isVerified: true,
  createdAt: true,
  sellerProfile: {
    select: {
      storeName: true,
      city: true,
      rating: true,
      totalSales: true,
    },
  },
} as const;

export const chatListingSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  price: true,
  originalPrice: true,
  category: true,
  categoryLabel: true,
  brand: true,
  model: true,
  condition: true,
  canNego: true,
  status: true,
  sellerId: true,
  viewsCount: true,
  favoritesCount: true,
  createdAt: true,
  updatedAt: true,
  seller: {
    select: chatParticipantSelect,
  },
  images: {
    select: {
      url: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

export const chatOfferSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  offerPrice: true,
  counterPrice: true,
  status: true,
  expiresAt: true,
  consumedAt: true,
  createdAt: true,
} as const;

export interface RawChatParticipant {
  id: string;
  name: string;
  avatar: string | null;
  isVerified: boolean;
  createdAt: Date;
  sellerProfile: {
    storeName: string | null;
    city: string;
    rating: number;
    totalSales: number;
  } | null;
}

export interface RawChatListing {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number | null;
  category: string;
  categoryLabel: string;
  brand: string;
  model: string;
  condition: string;
  canNego: boolean;
  status: string;
  sellerId: string;
  viewsCount: number;
  favoritesCount: number;
  createdAt: Date;
  updatedAt: Date;
  seller: RawChatParticipant;
  images: Array<{ url: string }>;
}

export interface RawChatOffer {
  id: string;
  conversationId: string;
  senderId: string;
  offerPrice: number;
  counterPrice: number | null;
  status: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface RawChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  imageUrl: string | null;
  offerId: string | null;
  isRead: boolean;
  createdAt: Date;
  offer: RawChatOffer | null;
}

export interface RawConversationRow {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  lastMessage: string | null;
  lastTimestamp: Date;
  buyer: RawChatParticipant;
  seller: RawChatParticipant;
  listing: RawChatListing;
  offers: RawChatOffer[];
  messages: RawChatMessage[];
}

function buildPublicParticipantDto(user: RawChatParticipant): SellerProfile {
  const rating = user.sellerProfile?.rating ?? 5.0;
  const totalSales = user.sellerProfile?.totalSales ?? 0;
  const city = user.sellerProfile?.city || "Jakarta Selatan";

  return {
    id: user.id,
    name: user.sellerProfile?.storeName || user.name,
    avatar: user.avatar || "/assets/products/ipad-mini-unboxing.png",
    verifiedKYC: Boolean(user.isVerified),
    isVerified: Boolean(user.isVerified),
    isOnline: true,
    trustScore: Math.min(100, Math.round(rating * 20)),
    rating,
    reviewCount: totalSales,
    location: city,
    city,
    joinedDate: user.createdAt.toISOString(),
    responseTime: "± 10 menit",
    successTransactions: totalSales,
  };
}

function buildPublicChatListingDto(row: RawChatListing): ProductListing {
  const conditionMeta = getConditionDisplay(row.condition);
  const resolvedCategoryLabel =
    row.categoryLabel || getCategoryLabel(row.category);
  const seller = buildPublicParticipantDto(row.seller);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    price: row.price,
    ...(row.originalPrice != null ? { originalPrice: row.originalPrice } : {}),
    category: row.category as ProductListing["category"],
    categoryLabel: resolvedCategoryLabel,
    brand: row.brand,
    model: row.model,
    condition: row.condition as TechCondition,
    conditionLabel: conditionMeta.label,
    conditionScore: conditionMeta.score,
    canNego: row.canNego,
    status: row.status as ListingStatus,
    sellerId: row.sellerId,
    images: row.images.map((img) => img.url),
    location: seller.city,
    city: seller.city,
    description: row.description,
    specifications: {
      Merek: row.brand,
      Model: row.model,
      Kategori: resolvedCategoryLabel,
      Kondisi: conditionMeta.label,
    },
    completeness: ["Unit Utama", "Kemasan Aman Escrow"],
    diagnosticPassed: Boolean(row.seller.isVerified),
    diagnosticTool: row.seller.isVerified
      ? "Verified Seller Check"
      : undefined,
    seller,
    createdAt: row.createdAt.toISOString(),
    viewsCount: row.viewsCount,
    favoritesCount: row.favoritesCount,
    isSold: row.status === "SOLD",
  };
}

export function mapOfferToDto(
  offer: RawChatOffer,
  meta: {
    listingId: string;
    buyerId: string;
    sellerId: string;
    listingPrice: number;
  }
): Offer {
  const effectiveStatus: OfferStatus = isPriceOfferExpired(offer)
    ? "EXPIRED"
    : (offer.status as OfferStatus);

  const discountPercent =
    meta.listingPrice > 0
      ? Math.max(
          0,
          Math.round(
            ((meta.listingPrice - offer.offerPrice) / meta.listingPrice) * 100
          )
        )
      : 0;

  return {
    id: offer.id,
    conversationId: offer.conversationId,
    listingId: meta.listingId,
    buyerId: meta.buyerId,
    sellerId: meta.sellerId,
    senderId: offer.senderId,
    originalPrice: meta.listingPrice,
    offerPrice: offer.offerPrice,
    counterPrice: offer.counterPrice ?? undefined,
    discountPercent,
    status: effectiveStatus,
    expiresAt: offer.expiresAt.toISOString(),
    consumedAt: offer.consumedAt ? offer.consumedAt.toISOString() : undefined,
    createdAt: offer.createdAt.toISOString(),
    checkoutWindowExpiresAt: offer.expiresAt.toISOString(),
  };
}

export function mapMessageToDto(
  msg: RawChatMessage,
  meta: {
    listingId: string;
    buyerId: string;
    sellerId: string;
    listingPrice: number;
  }
): ChatMessage {
  return {
    id: msg.id,
    senderId: msg.senderId,
    senderName: msg.senderName,
    text: msg.text,
    timestamp: msg.createdAt.toISOString(),
    ...(msg.imageUrl ? { imageUrl: msg.imageUrl } : {}),
    isRead: msg.isRead,
    ...(msg.offer ? { offer: mapOfferToDto(msg.offer, meta) } : {}),
  };
}

export function mapConversationToDto(
  row: RawConversationRow,
  viewerId: string,
  unreadCount: number
): Conversation {
  const listingDto = buildPublicChatListingDto(row.listing);
  const counterpartUser =
    viewerId === row.buyerId ? row.seller : row.buyer;
  const offerMeta = {
    listingId: row.listingId,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    listingPrice: row.listing.price,
  };

  return {
    id: row.id,
    listingId: row.listingId,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    listing: listingDto,
    counterpart: buildPublicParticipantDto(counterpartUser),
    lastMessage: row.lastMessage ?? "",
    lastTimestamp: row.lastTimestamp.toISOString(),
    unreadCount,
    offers: row.offers.map((o) => mapOfferToDto(o, offerMeta)),
    messages: row.messages.map((m) => mapMessageToDto(m, offerMeta)),
  };
}
