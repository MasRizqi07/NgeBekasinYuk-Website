"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, MapPin, Star, ShieldCheck } from "lucide-react";
import { ProductListing } from "@/types";
import { formatRupiah } from "@/lib/utils";
import { useUserStore } from "@/stores/useUserStore";

interface ListingCardProps {
  listing: ProductListing;
  priority?: boolean;
}

export function ListingCard({ listing, priority = false }: ListingCardProps) {
  const { user, toggleFavorite } = useUserStore();
  const isFavorite = user.favorites.includes(listing.id);

  // Extract key spec preview (e.g. first spec item)
  const specEntries = Object.entries(listing.specifications);
  const keySpec = specEntries.length > 0 ? `${specEntries[0][0]}: ${specEntries[0][1]}` : null;

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
      className="group bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
    >
      {/* 1:1 Aspect Ratio Media Container */}
      <Link href={`/product/${listing.slug}`} className="relative aspect-square w-full bg-surface-subtle overflow-hidden">
        <Image
          src={listing.images[0] || "/assets/products/ipad-mini-unboxing.png"}
          alt={listing.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Top-Left: Escrow Guarantee Badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-brand-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          <ShieldCheck className="w-3 h-3" />
          <span>Rekber</span>
        </div>

        {/* Top-Right: Wishlist Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(listing.id);
          }}
          aria-label="Simpan ke favorit"
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/85 backdrop-blur-md flex items-center justify-center text-text-muted hover:text-brand-danger hover:scale-110 active:scale-95 transition-all shadow-xs"
        >
          <Heart
            className={`w-4 h-4 ${
              isFavorite ? "fill-brand-danger text-brand-danger" : ""
            }`}
          />
        </button>

        {/* Bottom Overlay: Condition Tag */}
        <div className="absolute bottom-2 left-2.5">
          <span className="bg-black/70 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
            {listing.conditionLabel}
          </span>
        </div>
      </Link>

      {/* Body Content */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2">
        <div className="flex flex-col gap-1">
          {/* Title (max 2 lines) */}
          <Link
            href={`/product/${listing.slug}`}
            className="font-bold text-xs sm:text-sm text-on-surface line-clamp-2 leading-snug group-hover:text-brand-primary transition-colors"
          >
            {listing.title}
          </Link>

          {/* Key Spec Highlight */}
          {keySpec && (
            <p className="text-[11px] text-text-muted truncate mt-0.5">
              {keySpec}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 pt-1 border-t border-surface-border/60">
          {/* Price with Tabular Numbers */}
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-extrabold text-sm sm:text-base text-on-surface tabular-nums">
              {formatRupiah(listing.price)}
            </span>
            {listing.canNego && (
              <span className="text-[10px] font-bold text-[#B26A00] bg-[#FFF4E0] px-1.5 py-0.2 rounded-md">
                Nego
              </span>
            )}
          </div>

          {/* Seller Metadata (City & Rating) */}
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <div className="flex items-center gap-1 truncate max-w-30">
              <MapPin className="w-3 h-3 text-text-muted shrink-0" />
              <span className="truncate">{listing.city}</span>
            </div>

            <div className="flex items-center gap-0.5 shrink-0 font-medium">
              <Star className="w-3 h-3 fill-brand-warning text-brand-warning" />
              <span>{listing.seller.rating}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default ListingCard;
