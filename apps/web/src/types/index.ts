export type TechCondition =
  | 'BRAND_NEW_SEALED'// Segel Baru (100%)
  | 'LIKE_NEW'        // Seperti Baru (99%)
  | 'NORMAL_USE'      // Pemakaian Wajar (95%)
  | 'MINOR_SCRATCHES' // Lecet Pemakaian (90%)
  | 'MINOR_DEFECT';   // Minus / Rusak Ringan

export interface SellerProfile {
  id: string;
  name: string;
  avatar: string;
  verifiedKYC: boolean;
  isVerified?: boolean;
  isOnline?: boolean;
  trustScore: number;
  rating: number;
  reviewCount: number;
  location: string;
  city: string;
  joinedDate: string;
  responseTime: string;
  successTransactions: number;
}

export interface ProductListing {
  id: string;
  slug: string;
  title: string;
  price: number;
  originalPrice?: number;
  category: 'smartphone' | 'laptop' | 'audio' | 'pc-gaming' | 'console' | 'camera' | 'accessories';
  categoryLabel: string;
  brand: string;
  model: string;
  condition: TechCondition;
  conditionLabel: string;
  conditionScore: number; // e.g. 98
  canNego: boolean;
  images: string[];
  location: string;
  city: string;
  description: string;
  specifications: Record<string, string>;
  completeness: string[];
  diagnosticPassed: boolean;
  diagnosticTool?: string; // e.g. '3uTools Verified', 'Sony SC 4xxx Passed'
  seller: SellerProfile;
  createdAt: string;
  viewsCount: number;
  favoritesCount: number;
  isPromoted?: boolean;
  isSold?: boolean;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'FUNDED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'INSPECTING'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'REFUNDED'
  | 'CANCELLED';

export interface Order {
  id: string; // e.g. STX-2026-88421
  listing: ProductListing;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  shippingAddress: string;
  itemPrice: number;
  shippingFee: number;
  escrowFee: number;
  totalAmount: number;
  paymentMethod: 'BCA_VA' | 'MANDIRI_VA' | 'BRI_VA' | 'BNI_VA' | 'QRIS';
  vaNumber: string;
  status: OrderStatus;
  paymentExpiresAt: string;
  inspectionExpiresAt?: string;
  courier: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  disputeId?: string;
  reviewGiven?: boolean;
  createdAt: string;
}

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'EXPIRED';

export interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  originalPrice: number;
  offerPrice: number;
  discountPercent: number;
  status: OfferStatus;
  expiresAt: string;
  checkoutWindowExpiresAt?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  imageUrl?: string;
  isRead: boolean;
  offer?: Offer;
}

export interface Conversation {
  id: string;
  listingId: string;
  listing: ProductListing;
  counterpart: SellerProfile;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  messages: ChatMessage[];
}

export type DisputeStatus =
  | 'OPEN'
  | 'AWAITING_SELLER'
  | 'UNDER_REVIEW'
  | 'INVESTIGATING'
  | 'RESOLVED_BUYER'
  | 'RESOLVED_SELLER';

export interface DisputeMessage {
  id: string;
  author: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  text: string;
  timestamp: string;
  attachment?: string;
}

export interface DisputeTicket {
  id: string; // e.g. DSP-2026-88421
  orderId: string;
  listingTitle: string;
  listingPrice: number;
  listingImage: string;
  buyerName: string;
  sellerName: string;
  reason: string;
  description: string;
  buyerEvidencePhotos: string[];
  sellerEvidencePhotos: string[];
  slaExpiresAt: string;
  status: DisputeStatus;
  messages: DisputeMessage[];
  resolutionNote?: string;
  resolvedAt?: string;
}

export interface WalletTransaction {
  id: string;
  type: 'ESCROW_HOLD' | 'ESCROW_RELEASE' | 'WITHDRAWAL' | 'REFUND';
  amount: number;
  referenceId: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  timestamp: string;
  description: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isPrimary: boolean;
}

export interface UserAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  isKYCVerified: boolean;
  trustScore: number;
  joinedDate: string;
  addresses: UserAddress[];
  favorites: string[];
  role?: string;
  city?: string;
  bio?: string;
  totalSales?: number;
}

export interface ReviewSubmission {
  orderId: string;
  rating: number;
  tags: string[];
  comment: string;
  photos: string[];
  createdAt: string;
}
