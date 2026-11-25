import type {
  Conversation,
  DisputeTicket,
  ProductListing,
  SellerProfile,
  UserProfile,
} from "../types";

// Chat & dispute placeholder fixtures pending Phases 11–12 API migration.
// Catalog listings & sellers have been removed in Phase 10 (served by PostgreSQL).
const CHAT_PLACEHOLDER_SELLER_DIMAS: SellerProfile = {
  id: "usr-seller-dimas",
  name: "Dimas Aditya",
  avatar:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDCivYuQ1MnI7E6IupkVnB2wrdi0vZ4YEqyfTr2wFr4MaU5RbTNlZzKVLbY6mnGyFdyqX-FE0kVC8460WUMwZyEOE01o5wSIHm3BdBSMqOjiBicUzktSCRECCcm2fWwTgogLXVM-99usmt9_HZNnuqFofyCqzv1LkgmjmvKk2Re4EOV47Tt6eB8QeKSc4O8deh_Azmrwnk9_SF-A9p2wOHZXQYFmgiCIq8iIFvrTwvp_pdGJYaJOef8",
  verifiedKYC: true,
  trustScore: 98,
  rating: 4.9,
  reviewCount: 52,
  location: "Jakarta Barat",
  city: "Jakarta Barat",
  joinedDate: "Maret 2023",
  responseTime: "< 5 menit",
  successTransactions: 48,
};

const CHAT_PLACEHOLDER_SELLER_RIAN: SellerProfile = {
  id: "usr-seller-rian",
  name: "Rian Gadget Surabaya",
  avatar:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuARVSFYfBWVyVsZWQluSJcL8sMPOSmnE8mGkR5BrhkwbubbuXak0j5WwkwOo1JjgKnpaf1S7WJRcRm1ZicytLS3wpBG9CPYS6LiOOXaybKow8Ho4_EogUn5YXqk4IUoQo8UdYN600NliLjnIDlOjB89sEfXd_98btgCRMHw7HE1wvgfQtQkXwX7m6c2tCpX9IqBNbnhP4Nb57GCNuHtQ2ESg9gUjeUIvzWs7RV27u5YUKcspnWFxF1e",
  verifiedKYC: true,
  trustScore: 96,
  rating: 4.9,
  reviewCount: 89,
  location: "Surabaya",
  city: "Surabaya",
  joinedDate: "Januari 2022",
  responseTime: "< 15 menit",
  successTransactions: 94,
};

const CHAT_PLACEHOLDER_IPAD: ProductListing = {
  id: "prod-ipad-air5",
  slug: "ipad-air-5-64gb-wifi-starlight",
  title: "iPad Air 5 M1 64GB WiFi Only Starlight - iBox Fullset + Pencil",
  price: 7500000,
  category: "smartphone",
  categoryLabel: "Smartphone & Tablet",
  brand: "Apple",
  model: "iPad Air 5 M1",
  condition: "LIKE_NEW",
  conditionLabel: "Seperti Baru (99%)",
  conditionScore: 99,
  canNego: true,
  images: ["/assets/products/ipad-mini-unboxing.png"],
  location: "Jakarta Selatan",
  city: "Jakarta Selatan",
  description: "Unit iPad Air 5 M1 terverifikasi.",
  specifications: { Merek: "Apple", Model: "iPad Air 5" },
  completeness: ["Unit Utama", "Box Original"],
  diagnosticPassed: true,
  seller: CHAT_PLACEHOLDER_SELLER_DIMAS,
  createdAt: "2026-09-10T09:00:00.000Z",
  viewsCount: 210,
  favoritesCount: 18,
};

const CHAT_PLACEHOLDER_SONY: ProductListing = {
  id: "prod-sony-a7iii",
  slug: "sony-a7-iii-mirrorless-shutter-count-4xxx",
  title: "Sony Alpha A7 III Body Only - Shutter Count 4.xxx Like New",
  price: 18500000,
  category: "camera",
  categoryLabel: "Kamera & Lensa",
  brand: "Sony",
  model: "Alpha A7 III",
  condition: "LIKE_NEW",
  conditionLabel: "Seperti Baru (99%)",
  conditionScore: 99,
  canNego: true,
  images: [
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80",
  ],
  location: "Surabaya",
  city: "Surabaya",
  description: "Sony A7 III siap pakai.",
  specifications: { Merek: "Sony", Model: "Alpha A7 III" },
  completeness: ["Body Only", "Baterai NP-FZ100"],
  diagnosticPassed: true,
  seller: CHAT_PLACEHOLDER_SELLER_RIAN,
  createdAt: "2026-09-10T08:00:00.000Z",
  viewsCount: 342,
  favoritesCount: 24,
};

export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: "convo-dimas-ipad",
    listingId: "prod-ipad-air5",
    listing: CHAT_PLACEHOLDER_IPAD,
    counterpart: CHAT_PLACEHOLDER_SELLER_DIMAS,
    lastMessage:
      "Harga penawarannya sudah saya acc ya kak! Siap di-packing bubble wrap tebal.",
    lastTimestamp: new Date(Date.now() - 120000).toISOString(),
    unreadCount: 1,
    messages: [
      {
        id: "msg-1",
        senderId: "user-budi",
        senderName: "Budi Pratama",
        text: "Halo mas Dimas, iPad Air 5-nya masih ada? Baterai health di 3uTools berapa persen ya? Charger bawaan 20W masih lengkap?",
        timestamp: "14:21",
        isRead: true,
      },
      {
        id: "msg-2",
        senderId: "seller-dimas",
        senderName: "Dimas Aditya",
        text: "Halo kak! Masih ready banget. BH 96% cycle count 84 wajar. Dus, kabel Type-C asli & adaptor 20W lengkap ada nota pembelian iBox juga. Layar terpasang tempered glass dari hari pertama.",
        timestamp: "14:22",
        isRead: true,
      },
      {
        id: "msg-3",
        senderId: "user-budi",
        senderName: "Budi Pratama",
        text: "Keren mas. Kalau saya tawar Rp 6.900.000 via Rekber Escrow langsung saya checkout sekarang, gimana?",
        timestamp: "14:23",
        isRead: true,
        offer: {
          id: "offer-1",
          listingId: "prod-ipad-air5",
          buyerId: "user-budi",
          sellerId: "seller-dimas",
          originalPrice: 7500000,
          offerPrice: 6900000,
          discountPercent: 8,
          status: "ACCEPTED",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          checkoutWindowExpiresAt: new Date(Date.now() + 7200000).toISOString(),
        },
      },
      {
        id: "msg-4",
        senderId: "seller-dimas",
        senderName: "Dimas Aditya",
        text: "Harga penawarannya sudah saya acc ya kak! Siap di-packing bubble wrap tebal + kardus pelindung double. Silakan di-checkout via rekber.",
        timestamp: "14:26",
        isRead: false,
      },
    ],
  },
  {
    id: "convo-rian-sony",
    listingId: "prod-sony-a7iii",
    listing: CHAT_PLACEHOLDER_SONY,
    counterpart: CHAT_PLACEHOLDER_SELLER_RIAN,
    lastMessage: "Bisa kak, silakan diajukan penawarannya di fitur Nego ya.",
    lastTimestamp: new Date(Date.now() - 3600000).toISOString(),
    unreadCount: 0,
    messages: [
      {
        id: "msg-s1",
        senderId: "user-budi",
        senderName: "Budi Pratama",
        text: "Malam mas Rian, Sony A7 III sensornya bebas jamur ya? Boleh nego tipis nggak?",
        timestamp: "20:10",
        isRead: true,
      },
      {
        id: "msg-s2",
        senderId: "seller-rian",
        senderName: "Rian Gadget Surabaya",
        text: "Malam kak Budi! Sensor 100% bersih kinclong, selalu simpan di dry cabinet. Boleh kak, silakan diajukan penawarannya di fitur Nego ya.",
        timestamp: "20:15",
        isRead: true,
      },
    ],
  },
];

export const SEED_DISPUTE: DisputeTicket = {
  id: "DSP-2026-88421",
  orderId: "STX-2026-0701",
  listingTitle: "MacBook Air M1 256GB Space Grey",
  listingPrice: 8450000,
  listingImage:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuB5AGlNW65v3aI0R4CrWZx64XEhcC9SCu6VYiQ7tk34hxG3vTLqNi6esOWfrCtIVWrFBhKvjo-mUPlTy1ytbnrP5B4jx3SfpmVpA0b9YJOUjDo-m92ptsOn4f-Q0fAOgkw4AwSG3hayF3hpXcawQOC9S59fm-bHYie6x-K3ctgzgNWMlrtH3ZDPWp8AZJCFCtnFMVcuXIRIVCAdyd6L0q40Lork3L5D_wKDNemifKRwMTJia9bCOGK6",
  buyerName: "Budi Pratama",
  sellerName: "Dimas Aditya",
  reason: "Barang Tidak Sesuai Deskripsi (Goresan Layar Tipis)",
  description:
    "Halo admin, saat paket dibuka dan dites di bawah cahaya ruangan, ada goresan mikro sepanjang 3cm di sudut kanan atas layar yang tidak diinfokan di deskripsi listing (dibilang mulus 99%). Video unboxing lengkap sudah diunggah.",
  buyerEvidencePhotos: [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBkWG7Sz_sUpraniQ69WX24MQTgqzorNsedCM66Z-sAMVmJbe_erxsIGGuTRROnbNvph-GsH2BZ7rnMOL7FSTITdrGVQo8_U6GEm6QBSHAF1q7pSumvADjrnkgttEQ6UKQNOypMwiGv3NlE_6tw9gMw-V-d8otWmEQRmrBw-LyTETWOdynPL-0hvHzF4RC-z_2q3ATU_A85QDbaqBhFXkP5kgeO-LiWi0f1SIilqhPyllSbhDkIpeRD",
  ],
  sellerEvidencePhotos: [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuB5AGlNW65v3aI0R4CrWZx64XEhcC9SCu6VYiQ7tk34hxG3vTLqNi6esOWfrCtIVWrFBhKvjo-mUPlTy1ytbnrP5B4jx3SfpmVpA0b9YJOUjDo-m92ptsOn4f-Q0fAOgkw4AwSG3hayF3hpXcawQOC9S59fm-bHYie6x-K3ctgzgNWMlrtH3ZDPWp8AZJCFCtnFMVcuXIRIVCAdyd6L0q40Lork3L5D_wKDNemifKRwMTJia9bCOGK6",
  ],
  slaExpiresAt: new Date(Date.now() + 160000000).toISOString(),
  status: "INVESTIGATING",
  messages: [
    {
      id: "disp-1",
      author: "Budi Pratama",
      role: "BUYER",
      text: "Saya mengajukan komplain retur dana / partial refund karena goresan layar ini mengurangi nilai jual gadget.",
      timestamp: "Kemarin, 16:40 WIB",
    },
    {
      id: "disp-2",
      author: "Dimas Aditya",
      role: "SELLER",
      text: "Halo mas Budi & admin. Sebelum kirim saya rekam video QC packing dan layar dalam keadaan mulus. Kemungkinan gores terjadi akibat gesekan debu saat kurir membuka atau handling pembeli.",
      timestamp: "Kemarin, 18:20 WIB",
    },
    {
      id: "disp-3",
      author: "Admin NgeBekasinYuk",
      role: "ADMIN",
      text: "Tim mediasi sedang menelaah video unboxing dan rekaman QC packing seller. Keputusan SLA mediasi maksimal 2x24 jam.",
      timestamp: "Hari ini, 09:00 WIB",
    },
  ],
};

export const SEED_USER: UserProfile = {
  id: "user-budi",
  name: "Budi Pratama",
  email: "budi.pratama@techmail.id",
  phone: "0812-8921-4432",
  avatar:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDCivYuQ1MnI7E6IupkVnB2wrdi0vZ4YEqyfTr2wFr4MaU5RbTNlZzKVLbY6mnGyFdyqX-FE0kVC8460WUMwZyEOE01o5wSIHm3BdBSMqOjiBicUzktSCRECCcm2fWwTgogLXVM-99usmt9_HZNnuqFofyCqzv1LkgmjmvKk2Re4EOV47Tt6eB8QeKSc4O8deh_Azmrwnk9_SF-A9p2wOHZXQYFmgiCIq8iIFvrTwvp_pdGJYaJOef8",
  isKYCVerified: true,
  trustScore: 92,
  joinedDate: "Februari 2024",
  addresses: [
    {
      id: "addr-1",
      label: "Rumah (Utama)",
      recipientName: "Budi Pratama",
      phone: "0812-8921-4432",
      addressLine:
        "Jl. Mawar Asri No. 18, RT 04/RW 02, Pondok Kelapa, Duren Sawit",
      city: "Jakarta Timur",
      postalCode: "13450",
      isDefault: true,
    },
    {
      id: "addr-2",
      label: "Kantor / Kosan",
      recipientName: "Budi Pratama",
      phone: "0812-8921-4432",
      addressLine: "Jl. Dipati Ukur No. 45, Lebakgede, Coblong",
      city: "Bandung",
      postalCode: "40132",
      isDefault: false,
    },
  ],
  favorites: ["prod-sony-a7iii", "prod-ipad-air5"],
};
