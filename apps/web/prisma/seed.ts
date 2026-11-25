import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertSeedEnvironmentIsSafe } from "./seedSafety";

// Immediate guard at module evaluation before any connections or setup:
assertSeedEnvironmentIsSafe();

const prisma = new PrismaClient();

async function main() {
  assertSeedEnvironmentIsSafe();

  const { encryptSensitiveSecret } = await import("../src/lib/security/encryption");

  // WARNING: Default demo PIN "123456" is for local development and CI testing ONLY.
  // It is NEVER permitted in production environments. Production seed execution is blocked above.
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
          bio: "Spesialis Apple & Audio Bekas Garansi Resmi. Original & Teruji.",
        },
      },
      wallet: {
        create: {
          id: "wallet-seller-dimas",
          activeBalance: 2450000, // From completed Sony WH-1000XM4
          heldBalance: 7500000,   // In inspection (iPad Air 5 escrow fixture)
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

  const sellerRian = await prisma.user.create({
    data: {
      id: "usr-seller-rian",
      email: "rian@ngebekasinyuk.id",
      name: "Rian Gadget Surabaya",
      phone: "+6281333445566",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuARVSFYfBWVyVsZWQluSJcL8sMPOSmnE8mGkR5BrhkwbubbuXak0j5WwkwOo1JjgKnpaf1S7WJRcRm1ZicytLS3wpBG9CPYS6LiOOXaybKow8Ho4_EogUn5YXqk4IUoQo8UdYN600NliLjnIDlOjB89sEfXd_98btgCRMHw7HE1wvgfQtQkXwX7m6c2tCpX9IqBNbnhP4Nb57GCNuHtQ2ESg9gUjeUIvzWs7RV27u5YUKcspnWFxF1e",
      role: "SELLER",
      hashedPassword: hashedSellerPw,
      hashedPin: hashedPin,
      isVerified: true,
      sellerProfile: {
        create: {
          storeName: "Rian Gadget Surabaya",
          storeSlug: "rian-gadget-surabaya",
          city: "Surabaya",
          rating: 4.9,
          totalSales: 94,
          reputationBadge: "TOP_RATED",
          bio: "Kamera, ThinkPad, dan konsol teruji QC mandiri.",
        },
      },
      wallet: {
        create: {
          id: "wallet-seller-rian",
          activeBalance: 0,
          heldBalance: 0,
        },
      },
    },
  });

  const sellerAppleholic = await prisma.user.create({
    data: {
      id: "usr-seller-appleholic",
      email: "appleholic@ngebekasinyuk.id",
      name: "Appleholic Store Jakarta",
      phone: "+6281555667788",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuARVSFYfBWVyVsZWQluSJcL8sMPOSmnE8mGkR5BrhkwbubbuXak0j5WwkwOo1JjgKnpaf1S7WJRcRm1ZicytLS3wpBG9CPYS6LiOOXaybKow8Ho4_EogUn5YXqk4IUoQo8UdYN600NliLjnIDlOjB89sEfXd_98btgCRMHw7HE1wvgfQtQkXwX7m6c2tCpX9IqBNbnhP4Nb57GCNuHtQ2ESg9gUjeUIvzWs7RV27u5YUKcspnWFxF1e",
      role: "SELLER",
      hashedPassword: hashedSellerPw,
      hashedPin: hashedPin,
      isVerified: true,
      sellerProfile: {
        create: {
          storeName: "Appleholic Store Jakarta",
          storeSlug: "appleholic-store-jakarta",
          city: "Jakarta Selatan",
          rating: 5.0,
          totalSales: 165,
          reputationBadge: "TOP_RATED",
          bio: "Kurasi produk Apple second resmi iBox/Digimap.",
        },
      },
      wallet: {
        create: {
          id: "wallet-seller-appleholic",
          activeBalance: 0,
          heldBalance: 0,
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

  const baseTime = Date.now();

  // 2. Create Product Listings (Single seed source covering all UI catalog items + order fixtures)
  await prisma.productListing.create({
    data: {
      id: "prod-sony-a7iii",
      slug: "sony-a7-iii-body-only-sc-4xxx",
      title: "Sony A7 III Body Only - SC 4xxx Mulus Dus Lengkap",
      description:
        "Dijual kamera Sony A7 III kesayangan pemakaian hobi pribadi. Shutter Count baru 4.120 jepretan (sangat minim, umur sensor masih panjang). Sensor bersih tanpa debu mikro/jamur, karet handgrip rapat.",
      price: 12800000,
      originalPrice: 13500000,
      category: "camera",
      categoryLabel: "Kamera",
      brand: "Sony",
      model: "ILCE-7M3",
      condition: "LIKE_NEW",
      canNego: true,
      minNegoPrice: 12000000,
      status: "ACTIVE",
      sellerId: sellerRian.id,
      viewsCount: 249,
      favoritesCount: 38,
      createdAt: new Date(baseTime - 7200000),
      images: {
        create: [
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBA9eU2ewnWRCf9Qto6GOxaOS5X8o-02N4RqCpowftk7HpYZ_uYsPQNcN97v4sr4MJfr95_S4fVUvl9q-rBghLePBKSczep7xPDx_JKdKpoeM7Lyf0yAn7Iooah63Jn2if8IUDjfHczoXbNpUY3h9xrpGA-i0uqFo6J4t0cqGiWZD3PIqT1xQNYNOh0rH_DgLS1dZ-x-VFnpFMUNWV9yKfNyLePCfnQZXHna6dkqEWvPuzEw_ah9Vgr",
            isPrimary: true,
            sortOrder: 1,
          },
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDJWMeK1Ph2zTUSxHLsMHXOVwJ0dsiVqZnZintraxtqMMDrQrOuJQWK0HXe8_UnQx-tirVqsoqqS6xCARvWDvARUnQYoP5GFtS5DEYRLfsnEXoF90oyqu5AYHduuYqD16r92550myGVgV1Ta8M_xaZZLjcaItLOCv9MuMWQ3JqCA2N9ytpgy0-xHGZqFcKmvGZOpJI7-DnrTVKjVonur27t8zjHo30R13YY7I48e-2eXbJN9mw56it4",
            isPrimary: false,
            sortOrder: 2,
          },
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAhvM3DxYqJXa0NQAozFqVxVPSNPy7kTq9CUtMVHdNvHEw0xKdi1XssnuJZg4CUB-FnyCx4vr2k1sPXd6lvdPGm-ctwvT8QwCZeWiu7WHsi2EJvjUtN5ZsEpe4nMG5cN2BZimdKmVbxiKibuc_lAABzsykz0eH0LbLnUfY3Jz4XXGnfwS8Q9zpKKZMdg4PvBjtyWNNnpVrkUe3Qccym_vPoffDI0X0I0O_hWYd7piKSf3T-WPgrP0M_",
            isPrimary: false,
            sortOrder: 3,
          },
        ],
      },
    },
  });

  await prisma.productListing.create({
    data: {
      id: "prod-ipad-air5",
      slug: "ipad-air-5-64gb-wifi-starlight",
      title: "iPad Air 5 64GB WiFi Starlight - Garansi iBox On",
      description:
        "Kondisi unit 98% like new, battery health 96% cycle count 84, fullset original iBox beserta nota pembelian. Layar mulus terpasang tempered glass, iCloud aman siap reset.",
      price: 7500000,
      originalPrice: 8200000,
      category: "laptop",
      categoryLabel: "Tablet & iPad",
      brand: "Apple",
      model: "iPad Air 5th Gen (M1)",
      condition: "LIKE_NEW",
      canNego: true,
      minNegoPrice: 7000000,
      status: "ACTIVE",
      sellerId: seller.id,
      viewsCount: 412,
      favoritesCount: 76,
      createdAt: new Date(baseTime - 14400000),
      images: {
        create: [
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBSoZCjbay2vGyuL9c5V0UuS6ISwubNTs8UxDSQ3Xy8XNOiTohn8FkRTnn0bifNv1Y6Pkt-UtUzUwYeYbPdrIWn-YFaenC0ZI9evxtIQeyfcdDjMBpJE6o3fE21Z6pVJCIV2ki2FPpIAq_t3hJB6M-qFQUSfsUoEYznHD6Ev9G2mfo1pBtPdxzPcszriZdm8MqsmdXwXsd5lACzUJLH7keI9djL1_K6IXMoo5gCo8hizXKsoStJjm1h",
            isPrimary: true,
            sortOrder: 1,
          },
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAlbpPzbHjOZiSoCv0_U4dYHqpJufGFpLVzrWBf2mmxd9iPP2XTgW5n376JZNxhO8hzgVfHzccltMxBeKKp7WBb6bypX2yY1yQEoaZz-cXWc75yNPUuS1A6Cz_me5Jr9LcsjFQIm5GCHAxFCbBXkVYn94veaZmlz0Rhx7hXnZktF2iCyKPKeubQz89fYKNU1077usOkwXqdGbT5V2VpQTtYI4V9tKCOrR8FJw8hIxNYjy6n-byCdVA9",
            isPrimary: false,
            sortOrder: 2,
          },
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCjgviysQIAwDZiQ0XoEZvodqrHaDDPNayXxcGbwgx608LfwIXqUxS_WII7yj6enbMiQmCzrkAxvmRfSGkB8CDpuk_U716Nz41oHEWJJWsW-w_cnfNJZcuKmrtGQLQRZvR8edDK3huf4AZHPk4xaRAzUdRJI5OgTpKTXRZPPYqtiSVQz8cEztEGIteVkgS0qPcesQhpA-2Tv_29kxSrXpn1ZH4EJrO-I5jfZuiS1afjn1rSH8mPis_c",
            isPrimary: false,
            sortOrder: 3,
          },
        ],
      },
    },
  });

  await prisma.productListing.create({
    data: {
      id: "prod-macbook-m1",
      slug: "macbook-air-m1-256gb-space-grey",
      title: "MacBook Air M1 256GB Space Grey - Fullset Like New 99%",
      description:
        "MacBook Air M1 warna Space Grey kondisi mulus terawat. Battery health 94% Cycle Count 68. Keyboard empuk, trackpad responsif, TrueTone aktif.",
      price: 8450000,
      originalPrice: 9200000,
      category: "laptop",
      categoryLabel: "Laptop",
      brand: "Apple",
      model: "MacBook Air M1 2020",
      condition: "LIKE_NEW",
      canNego: false,
      status: "ACTIVE",
      sellerId: sellerAppleholic.id,
      viewsCount: 680,
      favoritesCount: 110,
      createdAt: new Date(baseTime - 36000000),
      images: {
        create: [
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuB5AGlNW65v3aI0R4CrWZx64XEhcC9SCu6VYiQ7tk34hxG3vTLqNi6esOWfrCtIVWrFBhKvjo-mUPlTy1ytbnrP5B4jx3SfpmVpA0b9YJOUjDo-m92ptsOn4f-Q0fAOgkw4AwSG3hayF3hpXcawQOC9S59fm-bHYie6x-K3ctgzgNWMlrtH3ZDPWp8AZJCFCtnFMVcuXIRIVCAdyd6L0q40Lork3L5D_wKDNemifKRwMTJia9bCOGK6",
            isPrimary: true,
            sortOrder: 1,
          },
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBkWG7Sz_sUpraniQ69WX24MQTgqzorNsedCM66Z-sAMVmJbe_erxsIGGuTRROnbNvph-GsH2BZ7rnMOL7FSTITdrGVQo8_U6GEm6QBSHAF1q7pSumvADjrnkgttEQ6UKQNOypMwiGv3NlE_6tw9gMw-V-d8otWmEQRmrBw-LyTETWOdynPL-0hvHzF4RC-z_2q3ATU_A85QDbaqBhFXkP5kgeO-LiWi0f1SIilqhPyllSbhDkIpeRD",
            isPrimary: false,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  await prisma.productListing.create({
    data: {
      id: "prod-iphone-13pro",
      slug: "apple-iphone-13-pro-128gb-sierra-blue",
      title: "Apple iPhone 13 Pro 128GB Sierra Blue - iBox BH 88%",
      description:
        "iPhone 13 Pro 128GB Sierra Blue resmi Indonesia PA/A iBox. Layar ProMotion 120Hz mulus tanpa goresan, True Tone dan Face ID aktif normal. Battery health original 88%.",
      price: 9800000,
      originalPrice: 10500000,
      category: "smartphone",
      categoryLabel: "Smartphone",
      brand: "Apple",
      model: "iPhone 13 Pro",
      condition: "NORMAL_USE",
      canNego: true,
      minNegoPrice: 9200000,
      status: "ACTIVE",
      sellerId: sellerAppleholic.id,
      viewsCount: 890,
      favoritesCount: 145,
      createdAt: new Date(baseTime - 43200000),
      images: {
        create: [
          {
            url: "https://lh3.googleusercontent.com/aida-public/AB6AXuC-gWe99LzGnxTQdFSIA-zhynswki8_TgVepWWogk0dPr-cudyQwj_NeYD-28WilZwCMljHSMh_ypaxQ65sE14s01j4VVB4uYTPZzmyNu6lNxnWarYrNtyt6pPLHg4MLmL7CRMfCxzN4XNfHyu243hI6vjXKIFuZXuYgt7U-oQTSr-NpJUyB48xtXdcf8HwVjHTwtrb3cWx2FLen3dfPplDmzV8P4EjxorMDCD4vnY_nZpn5qnIVfIR",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await prisma.productListing.create({
    data: {
      id: "prod-thinkpad-x1",
      slug: "lenovo-thinkpad-x1-carbon-gen-9-i7",
      title: "Lenovo ThinkPad X1 Carbon Gen 9 Core i7 16GB 512GB",
      description:
        "Laptop bisnis flagship body carbon fiber mulus tanpa baret. Intel Core i7-1165G7 Gen 11, RAM 16GB LPDDR4x, SSD NVMe 512GB, sensor fingerprint aktif.",
      price: 11200000,
      originalPrice: 12500000,
      category: "laptop",
      categoryLabel: "Laptop",
      brand: "Lenovo",
      model: "ThinkPad X1 Carbon Gen 9",
      condition: "LIKE_NEW",
      canNego: true,
      minNegoPrice: 10500000,
      status: "ACTIVE",
      sellerId: sellerRian.id,
      viewsCount: 190,
      favoritesCount: 42,
      createdAt: new Date(baseTime - 86400000),
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await prisma.productListing.create({
    data: {
      id: "prod-rtx-3070ti",
      slug: "asus-tuf-gaming-geforce-rtx-3070-ti-8gb",
      title: "ASUS TUF Gaming GeForce RTX 3070 Ti 8GB GDDR6X",
      description:
        "VGA bekas pemakaian gaming pribadi, bukan bekas mining. Segel baut utuh belum pernah bongkar/repaste. Suhu FurMark adem 67C, tanpa coil whine.",
      price: 5800000,
      originalPrice: 6500000,
      category: "pc-gaming",
      categoryLabel: "PC Gaming",
      brand: "ASUS",
      model: "TUF-RTX3070TI-O8G-GAMING",
      condition: "NORMAL_USE",
      canNego: true,
      minNegoPrice: 5400000,
      status: "ACTIVE",
      sellerId: seller.id,
      viewsCount: 350,
      favoritesCount: 82,
      createdAt: new Date(baseTime - 129600000),
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&auto=format&fit=crop&q=80",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await prisma.productListing.create({
    data: {
      id: "prod-switch-oled",
      slug: "nintendo-switch-oled-white-fullset",
      title: "Nintendo Switch OLED White Fullset Box - Mulus Siap Main",
      description:
        "Nintendo Switch OLED putih tangan pertama, layar OLED 7 inch bebas burn-in sudah terpasang tempered glass. Joy-Con kencang tanpa drift, kelengkapan fullset original.",
      price: 3650000,
      originalPrice: 4000000,
      category: "console",
      categoryLabel: "Konsol",
      brand: "Nintendo",
      model: "Switch OLED White",
      condition: "LIKE_NEW",
      canNego: true,
      minNegoPrice: 3400000,
      status: "ACTIVE",
      sellerId: sellerRian.id,
      viewsCount: 512,
      favoritesCount: 95,
      createdAt: new Date(baseTime - 172800000),
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800&auto=format&fit=crop&q=80",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await prisma.productListing.create({
    data: {
      id: "prod-airpods-pro2",
      slug: "apple-airpods-pro-gen-2-type-c",
      title: "Apple AirPods Pro Gen 2 USB-C - Garansi iBox Aktif",
      description:
        "AirPods Pro Gen 2 USB-C resmi iBox masih bergaransi aktif. Active Noise Cancellation dan Transparency Mode berfungsi baik, eartips cadangan XS/S/L lengkap.",
      price: 2450000,
      originalPrice: 3200000,
      category: "audio",
      categoryLabel: "Audio",
      brand: "Apple",
      model: "AirPods Pro 2 (USB-C)",
      condition: "LIKE_NEW",
      canNego: false,
      status: "ACTIVE",
      sellerId: sellerAppleholic.id,
      viewsCount: 620,
      favoritesCount: 130,
      createdAt: new Date(baseTime - 259200000),
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&auto=format&fit=crop&q=80",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  const listingIpadInspecting = await prisma.productListing.create({
    data: {
      id: "list-ipad-air5-inspecting",
      slug: "ipad-air-5-64gb-wifi-starlight-escrow",
      title: "iPad Air 5 64GB WiFi Starlight - Unit Inspeksi Escrow",
      description: "Unit iPad Air 5 dalam masa inspeksi pembeli dengan perlindungan escrow platform.",
      price: 7500000,
      originalPrice: 8200000,
      category: "laptop",
      categoryLabel: "Tablet & iPad",
      brand: "Apple",
      model: "iPad Air 5th Gen (M1)",
      condition: "LIKE_NEW",
      canNego: false,
      status: "RESERVED",
      sellerId: seller.id,
      createdAt: new Date(baseTime - 300000000),
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
      createdAt: new Date(baseTime - 400000000),
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
      createdAt: new Date(baseTime - 500000000),
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
  // Order 1: INSPECTING (dedicated reserved iPad Air 5 listing so prod-ipad-air5 remains buyable)
  const inspectionStart = new Date();
  const inspectionEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2x24h

  const orderInspecting = await prisma.order.create({
    data: {
      id: "ord-inspecting-1",
      orderNumber: "ORD-2026-8D71X2",
      buyerId: buyer.id,
      sellerId: seller.id,
      listingId: listingIpadInspecting.id,
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
  console.log(`   Users created: 6 (Buyer: ${buyer.email}, Sellers: ${seller.email}, ${sellerRian.email}, ${sellerAppleholic.email}, Admins: ${admin.email})`);
  console.log("   Listings created: 11 (8 ACTIVE, 2 RESERVED, 1 SOLD)");
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
