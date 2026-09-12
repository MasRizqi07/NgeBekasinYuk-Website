import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptSensitiveSecret } from "../src/lib/security/encryption";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting deterministic database seeding for NgeBekasinYuk...");

  // Clean existing records in reverse dependency order
  await prisma.adminStepUpGrant.deleteMany();
  await prisma.disputeMessage.deleteMany();
  await prisma.disputeEvidence.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.escrowLedgerEntry.deleteMany();
  await prisma.escrowAccount.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.order.deleteMany();
  await prisma.priceOffer.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.productListing.deleteMany();
  await prisma.walletLedgerEntry.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.kycVerification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();

  const hashedBuyerPw = await bcrypt.hash("Password123!", 10);
  const hashedSellerPw = await bcrypt.hash("Password123!", 10);
  const hashedAdminPw = await bcrypt.hash("AdminSecret2026!", 10);
  const hashedPin = await bcrypt.hash("123456", 10);

  // 1. Create Users
  const buyer = await prisma.user.create({
    data: {
      id: "usr-buyer-budi",
      email: "buyer@ngebekasinyuk.id",
      name: "Budi Pratama",
      phone: "+6281234567890",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      role: "BUYER",
      hashedPassword: hashedBuyerPw,
      hashedPin: hashedPin,
      isVerified: true,
      bankAccounts: {
        create: {
          id: "bank-buyer-1",
          bankCode: "BCA",
          bankName: "Bank Central Asia",
          accountNumber: "8820192837",
          accountHolder: "Budi Pratama",
          isDefault: true,
        },
      },
    },
  });

  const seller = await prisma.user.create({
    data: {
      id: "usr-seller-dimas",
      email: "seller@ngebekasinyuk.id",
      name: "Dimas Aditya",
      phone: "+6281987654321",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuARVSFYfBWVyVsZWQluSJcL8sMPOSmnE8mGkR5BrhkwbubbuXak0j5WwkwOo1JjgKnpaf1S7WJRcRm1ZicytLS3wpBG9CPYS6LiOOXaybKow8Ho4_EogUn5YXqk4IUoQo8UdYN600NliLjnIDlOjB89sEfXd_98btgCRMHw7HE1wvgfQtQkXwX7m6c2tCpX9IqBNbnhP4Nb57GCNuHtQ2ESg9gUjeUIvzWs7RV27u5YUKcspnWFxF1e",
      role: "SELLER",
      hashedPassword: hashedSellerPw,
      hashedPin: hashedPin,
      isVerified: true,
      sellerProfile: {
        create: {
          storeName: "Dimas Gadget Store",
          storeSlug: "dimas-gadget",
          city: "Jakarta Barat",
          rating: 4.9,
          totalSales: 48,
          reputationBadge: "TOP_RATED",
          bio: "Spesialis Apple & Audio Bekas Garansi Resmi. 100% Original & Teruji.",
        },
      },
      wallet: {
        create: {
          id: "wallet-seller-dimas",
          activeBalance: 2450000, // From completed Sony WH-1000XM4
          heldBalance: 7500000,   // In inspection (iPad Air 5)
        },
      },
      bankAccounts: {
        create: {
          id: "bank-seller-1",
          bankCode: "BCA",
          bankName: "Bank Central Asia",
          accountNumber: "5221982731",
          accountHolder: "Dimas Aditya",
          isDefault: true,
        },
      },
    },
  });

  const encryptedAdminTotp = encryptSensitiveSecret("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP");

  const admin = await prisma.user.create({
    data: {
      id: "usr-admin-ngebekasin",
      email: "admin@ngebekasinyuk.id",
      name: "Admin NgeBekasinYuk",
      phone: "+6281122334455",
      role: "ADMIN",
      hashedPassword: hashedAdminPw,
      isVerified: true,
      accountStatus: "ACTIVE",
      totpSecretCiphertext: encryptedAdminTotp.ciphertext,
      totpSecretIv: encryptedAdminTotp.iv,
      totpSecretTag: encryptedAdminTotp.tag,
      totpSecretKeyVersion: encryptedAdminTotp.keyVersion,
      isTotpEnrolled: true,
      sessionVersion: 1,
    },
  });

  await prisma.user.create({
    data: {
      id: "usr-admin-sarah",
      email: "sarah.admin@ngebekasinyuk.id",
      name: "Sarah Lestari",
      phone: "+6281199887766",
      role: "ADMIN",
      hashedPassword: hashedAdminPw,
      isVerified: true,
      accountStatus: "ACTIVE",
      totpSecretCiphertext: encryptedAdminTotp.ciphertext,
      totpSecretIv: encryptedAdminTotp.iv,
      totpSecretTag: encryptedAdminTotp.tag,
      totpSecretKeyVersion: encryptedAdminTotp.keyVersion,
      isTotpEnrolled: true,
      sessionVersion: 1,
    },
  });

  // 2. Create Product Listings
  const listingIpad = await prisma.productListing.create({
    data: {
      id: "list-ipad-air-5",
      slug: "ipad-air-5-64gb-wifi-starlight",
      title: "iPad Air 5 64GB WiFi Starlight - Garansi iBox On",
      description: "Kondisi unit 98% like new, batere health 96%, fullset original iBox. Layar no baret, body mulus terawat.",
      price: 7500000,
      originalPrice: 8200000,
      category: "laptop",
      categoryLabel: "Tablet & iPad",
      brand: "Apple",
      model: "iPad Air 5th Gen (M1)",
      condition: "LIKE_NEW",
      canNego: true,
      minNegoPrice: 7000000,
      status: "RESERVED",
      sellerId: seller.id,
      images: {
        create: [
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCjgviysQIAwDZiQ0XoEZvodqrHaDDPNayXxcGbwgx608LfwIXqUxS_WII7yj6enbMiQmCzrkAxvmRfSGkB8CDpuk_U716Nz41oHEWJJWsW-w_cnfNJZcuKmrtGQLQRZvR8edDK3huf4AZHPk4xaRAzUdRJI5OgTpKTXRZPPYqtiSVQz8cEztEGIteVkgS0qPcesQhpA-2Tv_29kxSrXpn1ZH4EJrO-I5jfZuiS1afjn1rSH8mPis_c",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  const listingSony = await prisma.productListing.create({
    data: {
      id: "list-sony-wh1000xm4",
      slug: "sony-wh1000xm4-wireless-noise-cancelling",
      title: "Sony WH-1000XM4 Wireless Noise Cancelling Black",
      description: "ANC luar biasa, pad masih empuk dan higienis. Lengkap dengan case, kabel audio, dan adapter pesawat.",
      price: 2450000,
      originalPrice: 3100000,
      category: "audio",
      categoryLabel: "Audio / TWS",
      brand: "Sony",
      model: "WH-1000XM4",
      condition: "VERY_GOOD",
      canNego: false,
      status: "SOLD",
      sellerId: seller.id,
      images: {
        create: [
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDF_e7V1i_YwW6-e41p0oQhE7xN4_s_n6eP3_9mPj4rGkQ5zC8x8b2A1",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  const listingIphone = await prisma.productListing.create({
    data: {
      id: "list-iphone-13-pro",
      slug: "iphone-13-pro-128gb-sierra-blue",
      title: "iPhone 13 Pro 128GB Sierra Blue Mulus No Minus",
      description: "Fullset original, 3uTools hijau semua, FaceID on, TrueTone on. iCloud aman bebas reset.",
      price: 9800000,
      originalPrice: 10500000,
      category: "smartphone",
      categoryLabel: "Smartphone",
      brand: "Apple",
      model: "iPhone 13 Pro",
      condition: "LIKE_NEW",
      canNego: true,
      status: "RESERVED",
      sellerId: seller.id,
      images: {
        create: [
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBA9eU2ewnWRCf9Qto6GOxaOS5X8o-02N4RqCpowftk7HpYZ_uYsPQNcN97v4sr4MJfr95_S4fVUvl9q-rBghLePBKSczep7xPDx_JKdKpoeM7Lyf0yAn7Iooah63Jn2if8IUDjfHczoXbNpUY3h9xrpGA-i0uqFo6J4t0cqGiWZD3PIqT1xQNYNOh0rH_DgLS1dZ-x-VFnpFMUNWV9yKfNyLePCfnQZXHna6dkqEWvPuzEw_ah9Vgr",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  // 3. Create Orders & Escrows
  // Order 1: INSPECTING (iPad Air 5)
  const inspectionStart = new Date();
  const inspectionEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2x24h

  const orderInspecting = await prisma.order.create({
    data: {
      id: "ord-inspecting-1",
      orderNumber: "ORD-2026-8D71X2",
      buyerId: buyer.id,
      sellerId: seller.id,
      listingId: listingIpad.id,
      itemPrice: 7500000,
      shippingFee: 25000,
      escrowFee: 0,
      totalAmount: 7525000,
      status: "INSPECTING",
      shippingCourier: "J&T Express",
      shippingService: "Reguler",
      shippingAirwayBill: "JT92817264810",
      shippingAddress: "Jl. Sudirman Kav 28 No. 4B, Karet Tengsin, Tanah Abang, Jakarta Pusat",
      paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      shippedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      deliveredAt: inspectionStart,
      inspectionStartedAt: inspectionStart,
      inspectionExpiresAt: inspectionEnd,
      statusHistory: {
        create: [
          {
            fromStatus: "PENDING_PAYMENT",
            toStatus: "FUNDED",
            actorId: buyer.id,
            actorRole: "BUYER",
            reason: "Pembayaran VA BCA berhasil diverifikasi oleh sistem escrow",
          },
          {
            fromStatus: "FUNDED",
            toStatus: "SHIPPED",
            actorId: seller.id,
            actorRole: "SELLER",
            reason: "Paket diserahkan ke kurir J&T Express dengan resi JT92817264810",
          },
          {
            fromStatus: "SHIPPED",
            toStatus: "INSPECTING",
            actorId: "system",
            actorRole: "SYSTEM",
            reason: "Paket terkonfirmasi diterima pembeli. Masa uji 2x24 jam dimulai.",
          },
        ],
      },
      escrowAccount: {
        create: {
          id: "escrow-ord-1",
          amount: 7525000,
          status: "HELD",
          idempotencyKey: "ESC-IDEMP-8D71X2",
          ledgerEntries: {
            create: [
              {
                type: "DEPOSIT",
                direction: "CREDIT",
                amount: 7525000,
                previousBalance: 0,
                newBalance: 7525000,
                referenceId: "PAY-BCA-8D71X2",
                idempotencyKey: "ESC-LEDGER-DEP-8D71X2",
                notes: "Deposit pembayaran order oleh pembeli Budi Pratama",
              },
            ],
          },
        },
      },
    },
  });

  // Order 2: COMPLETED (Sony WH-1000XM4)
  const orderCompleted = await prisma.order.create({
    data: {
      id: "ord-completed-2",
      orderNumber: "ORD-2026-3F99A1",
      buyerId: buyer.id,
      sellerId: seller.id,
      listingId: listingSony.id,
      itemPrice: 2450000,
      shippingFee: 20000,
      escrowFee: 0,
      totalAmount: 2470000,
      status: "COMPLETED",
      shippingCourier: "SiCepat",
      shippingService: "BEST",
      shippingAirwayBill: "SC00192847192",
      shippingAddress: "Jl. Sudirman Kav 28 No. 4B, Karet Tengsin, Tanah Abang, Jakarta Pusat",
      paidAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      shippedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      inspectionStartedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      escrowAccount: {
        create: {
          id: "escrow-ord-2",
          amount: 2470000,
          status: "RELEASED",
          isReleased: true,
          releasedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          idempotencyKey: "ESC-IDEMP-3F99A1",
          ledgerEntries: {
            create: [
              {
                type: "DEPOSIT",
                direction: "CREDIT",
                amount: 2470000,
                previousBalance: 0,
                newBalance: 2470000,
                referenceId: "PAY-BCA-3F99A1",
                idempotencyKey: "ESC-LEDGER-DEP-3F99A1",
                notes: "Deposit pembayaran order",
              },
              {
                type: "RELEASE_SELLER",
                direction: "DEBIT",
                amount: 2450000,
                previousBalance: 2470000,
                newBalance: 20000,
                referenceId: "ORD-2026-3F99A1",
                idempotencyKey: "ESC-LEDGER-REL-3F99A1",
                notes: "Pelepasan dana escrow ke dompet penjual setelah konfirmasi terima unit",
              },
            ],
          },
        },
      },
    },
  });

  // Record wallet ledger entry for the completed order
  await prisma.walletLedgerEntry.create({
    data: {
      id: "wle-rel-3f99a1",
      walletId: "wallet-seller-dimas",
      type: "ESCROW_RELEASE",
      direction: "CREDIT",
      amount: 2450000,
      balanceAfter: 2450000,
      referenceType: "ORDER",
      referenceId: orderCompleted.id,
      idempotencyKey: "WLE-IDEMP-REL-3F99A1",
      description: "Hasil penjualan Sony WH-1000XM4 (Order #ORD-2026-3F99A1)",
    },
  });

  // Order 3: DISPUTED (iPhone 13 Pro)
  const orderDisputed = await prisma.order.create({
    data: {
      id: "ord-disputed-3",
      orderNumber: "ORD-2026-7B12C8",
      buyerId: buyer.id,
      sellerId: seller.id,
      listingId: listingIphone.id,
      itemPrice: 9800000,
      shippingFee: 30000,
      escrowFee: 0,
      totalAmount: 9830000,
      status: "DISPUTED",
      shippingCourier: "J&T Express",
      shippingService: "Reguler",
      shippingAirwayBill: "JT88291048291",
      shippingAddress: "Jl. Sudirman Kav 28 No. 4B, Karet Tengsin, Tanah Abang, Jakarta Pusat",
      paidAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      shippedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      inspectionStartedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      escrowAccount: {
        create: {
          id: "escrow-ord-3",
          amount: 9830000,
          status: "FROZEN_DISPUTE",
          idempotencyKey: "ESC-IDEMP-7B12C8",
          ledgerEntries: {
            create: [
              {
                type: "DEPOSIT",
                direction: "CREDIT",
                amount: 9830000,
                previousBalance: 0,
                newBalance: 9830000,
                referenceId: "PAY-BCA-7B12C8",
                idempotencyKey: "ESC-LEDGER-DEP-7B12C8",
                notes: "Deposit pembayaran order iPhone 13 Pro",
              },
            ],
          },
        },
      },
      dispute: {
        create: {
          id: "DSP-2026-88421",
          disputeNumber: "DSP-2026-88421",
          reason: "DAMAGED_IN_TRANSIT",
          description: "Layar retak halus di pojok kanan atas saat unboxing, tidak sesuai deskripsi mulus no minus.",
          status: "UNDER_REVIEW",
          evidences: {
            create: [
              {
                uploadedBy: buyer.id,
                uploaderRole: "BUYER",
                fileUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDF_e7V1i_YwW6-e41p0oQhE7xN4_s_n6eP3_9mPj4rGkQ5zC8x8b2A1",
                fileType: "image/jpeg",
                fileSize: 1048576,
                description: "Foto unboxing memperlihatkan retakan pada layar",
              },
            ],
          },
          messages: {
            create: [
              {
                senderId: buyer.id,
                senderName: "Budi Pratama",
                senderRole: "BUYER",
                message: "Halo admin dan seller, paket saya buka tadi pagi dan ada retak halus di layar. Padahal packing kayu utuh.",
              },
              {
                senderId: seller.id,
                senderName: "Dimas Aditya",
                senderRole: "SELLER",
                message: "Halo kak Budi, unit sebelum dikirim sudah saya foto dan tes normal di gerai J&T. Mohon tim admin review rekaman video packing saya.",
              },
            ],
          },
        },
      },
    },
  });

  // 4. Create Security Audit Log
  await prisma.auditLog.create({
    data: {
      action: "ESCROW_RELEASE",
      targetType: "EscrowAccount",
      targetId: "escrow-ord-2",
      details: JSON.stringify({
        orderNumber: "ORD-2026-3F99A1",
        amount: 2450000,
        recipient: "usr-seller-dimas",
        status: "SUCCESS",
        idempotencyKey: "ESC-LEDGER-REL-3F99A1",
      }),
    },
  });

  console.log("✅ Database seeding complete!");
  console.log(`   Users created: 3 (Buyer: ${buyer.email}, Seller: ${seller.email}, Admin: ${admin.email})`);
  console.log(`   Listings created: 3`);
  console.log(`   Orders seeded: 3 (Inspecting: ${orderInspecting.orderNumber}, Completed: ${orderCompleted.orderNumber}, Disputed: ${orderDisputed.orderNumber})`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
