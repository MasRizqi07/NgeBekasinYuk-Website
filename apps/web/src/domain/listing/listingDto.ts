import type { ListingStatus } from "@/domain/listing/listingStatus";
import {
  getCategoryLabel,
  getConditionDisplay,
} from "@/domain/listing/listingMetadata";
import type { ProductListing, SellerProfile, TechCondition } from "@/types";

export interface ListingAuthorViewer {
  id: string;
  role: string;
}

export interface ListingRawRow {
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
  minNegoPrice: number | null;
  status: string;
  sellerId: string;
  viewsCount: number;
  favoritesCount: number;
  createdAt: Date;
  updatedAt: Date;
  sellerName: string;
  sellerAvatar: string | null;
  sellerIsVerified: boolean;
  sellerCreatedAt: Date;
  storeName: string | null;
  storeSlug: string | null;
  storeCity: string | null;
  storeRating: number | null;
  storeTotalSales: number | null;
  storeBadge: string | null;
  images: string[];
}

export interface ListingPublicDto extends ProductListing {
  status: ListingStatus;
  sellerId: string;
  updatedAt: string;
}

function buildSellerDto(row: ListingRawRow): SellerProfile {
  const city = row.storeCity || "Jakarta Selatan";
  const rating = row.storeRating ?? 5.0;
  const totalSales = row.storeTotalSales ?? 0;

  return {
    id: row.sellerId,
    name: row.storeName || row.sellerName,
    avatar: row.sellerAvatar || "/assets/products/ipad-mini-unboxing.png",
    verifiedKYC: Boolean(row.sellerIsVerified),
    isVerified: Boolean(row.sellerIsVerified),
    isOnline: true,
    trustScore: Math.min(100, Math.round(rating * 20)),
    rating,
    reviewCount: totalSales,
    location: city,
    city,
    joinedDate: new Date(row.sellerCreatedAt).toISOString(),
    responseTime: "± 10 menit",
    successTransactions: totalSales,
  };
}

/**
 * Maps raw PostgreSQL listing rows to the public ProductListing DTO contract.
 * Excludes all sensitive user PII (email, phone) and hides minNegoPrice from non-owners.
 */
export function mapListingToDto(
  row: ListingRawRow,
  viewer?: ListingAuthorViewer | null
): ListingPublicDto {
  const conditionMeta = getConditionDisplay(row.condition);
  const resolvedCategoryLabel = row.categoryLabel || getCategoryLabel(row.category);
  const seller = buildSellerDto(row);
  const isPrivilegedViewer =
    Boolean(viewer) &&
    (viewer!.id === row.sellerId || viewer!.role === "ADMIN");

  const dto: ListingPublicDto = {
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
    ...(isPrivilegedViewer && row.minNegoPrice != null
      ? { minNegoPrice: row.minNegoPrice }
      : {}),
    status: row.status as ListingStatus,
    sellerId: row.sellerId,
    images: row.images.length > 0 ? row.images : [],
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
    diagnosticPassed: Boolean(row.sellerIsVerified),
    diagnosticTool: row.sellerIsVerified ? "Verified Seller Check" : undefined,
    seller,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    viewsCount: row.viewsCount,
    favoritesCount: row.favoritesCount,
    isSold: row.status === "SOLD",
  };

  return dto;
}
