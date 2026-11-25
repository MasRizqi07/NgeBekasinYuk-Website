import React from "react";
import Link from "next/link";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { getListingByIdOrSlug } from "@/domain/listing/listingService";
import { ProductDetailClient } from "@/components/product/ProductDetailClient";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await validateAuthoritativeSession();
  const listing = await getListingByIdOrSlug(
    slug,
    session ? { id: session.id, role: session.role } : null
  );

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center">
        <h2 className="text-xl font-bold text-on-surface">
          Produk tidak ditemukan
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          Iklan mungkin telah dihapus atau diarsipkan oleh penjual.
        </p>
        <Link
          href="/search"
          className="text-brand-primary underline mt-3 inline-block text-sm font-semibold"
        >
          Jelajahi Katalog Gadget
        </Link>
      </div>
    );
  }

  return <ProductDetailClient listing={listing} />;
}
