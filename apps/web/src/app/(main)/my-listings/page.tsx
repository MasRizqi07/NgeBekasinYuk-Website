"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus,
  Eye,
  Heart,
  Edit,
  ExternalLink,
  Archive,
  RotateCcw,
} from "lucide-react";
import type { ListingPublicDto } from "@/domain/listing/listingDto";
import { formatRupiah } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

type ListingFilter = "ALL" | "ACTIVE" | "SOLD" | "ARCHIVED";

export default function MyListingsPage() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<ListingFilter>("ALL");
  const [listings, setListings] = useState<ListingPublicDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);

  const [editingItem, setEditingItem] = useState<ListingPublicDto | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCanNego, setEditCanNego] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadListings = async () => {
    try {
      const res = await fetch("/api/listings?mine=true&limit=50", {
        cache: "no-store",
      });
      if (res.status === 401) {
        setUnauthenticated(true);
        setListings([]);
        setIsLoading(false);
        return;
      }
      const json = await res.json();
      setUnauthenticated(false);
      setListings(Array.isArray(json?.data) ? json.data : []);
      setIsLoading(false);
    } catch {
      setListings([]);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch("/api/listings?mine=true&limit=50", {
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 401) {
          setUnauthenticated(true);
          setListings([]);
          setIsLoading(false);
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setUnauthenticated(false);
          setListings(Array.isArray(json?.data) ? json.data : []);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setListings([]);
          setIsLoading(false);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredListings = listings.filter((item) => {
    if (filter === "ALL") return true;
    return item.status === filter;
  });

  const activeCount = listings.filter((l) => l.status === "ACTIVE").length;
  const soldCount = listings.filter((l) => l.status === "SOLD").length;
  const totalViews = listings.reduce((sum, l) => sum + (l.viewsCount || 0), 0);

  const openEditModal = (item: ListingPublicDto) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditPrice(String(item.price));
    setEditDescription(item.description);
    setEditCanNego(item.canNego);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || isSaving) return;
    setIsSaving(true);

    try {
      const res = await fetch(`/api/listings/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          price: Number(editPrice),
          description: editDescription.trim(),
          canNego: editCanNego,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(
          json?.detail || json?.message || "Gagal memperbarui iklan.",
          "error"
        );
        setIsSaving(false);
        return;
      }

      showToast("Iklan berhasil diperbarui.", "success");
      setEditingItem(null);
      setIsSaving(false);
      await loadListings();
    } catch {
      showToast("Terjadi kesalahan jaringan.", "error");
      setIsSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    const res = await fetch(`/api/listings/${id}/archive`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(
        json?.detail || json?.message || "Gagal mengarsipkan iklan.",
        "error"
      );
      return;
    }
    showToast("Iklan diarsipkan dari katalog.", "info");
    await loadListings();
  };

  const handleRelist = async (id: string) => {
    const res = await fetch(`/api/listings/${id}/relist`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(
        json?.detail || json?.message || "Gagal menayangkan ulang iklan.",
        "error"
      );
      return;
    }
    showToast("Iklan kembali tayang aktif!", "success");
    await loadListings();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="px-2 py-0.2 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold">
            Aktif Tayang
          </span>
        );
      case "RESERVED":
        return (
          <span className="px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
            Sedang Dipesan
          </span>
        );
      case "SOLD":
        return (
          <span className="px-2 py-0.2 rounded-full bg-brand-primary-soft text-brand-primary text-[10px] font-bold">
            Terjual
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.2 rounded-full bg-surface-subtle text-text-muted text-[10px] font-bold">
            Diarsipkan
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface pb-32 pt-4">
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-on-surface">
              Kelola Iklan Gadget
            </h1>
            <p className="text-xs text-on-surface-variant">
              Dashboard inventaris gadget secondhand dan status penjualan escrow
            </p>
          </div>
          <Link
            href="/sell"
            className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-xs hover:bg-primary/90 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Pasang Iklan Baru</span>
          </Link>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5 text-xs">
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs">
            <span className="text-[11px] text-on-surface-variant block">
              Iklan Aktif
            </span>
            <div className="font-bold text-base text-on-surface mt-0.5">
              {activeCount} Unit
            </div>
            <span className="text-[10px] text-secondary font-semibold">
              Ready to Escrow
            </span>
          </div>
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs">
            <span className="text-[11px] text-on-surface-variant block">
              Total Tayangan
            </span>
            <div className="font-bold text-base text-primary mt-0.5">
              {totalViews} Views
            </div>
            <span className="text-[10px] text-primary font-semibold">
              Data Real Server
            </span>
          </div>
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs">
            <span className="text-[11px] text-on-surface-variant block">
              Terjual via Rekber
            </span>
            <div className="font-bold text-base text-secondary mt-0.5">
              {soldCount} Unit
            </div>
            <span className="text-[10px] text-secondary font-semibold">
              Escrow Terjamin
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 text-xs overflow-x-auto no-scrollbar">
          {[
            { id: "ALL", label: "Semua Iklan" },
            { id: "ACTIVE", label: "Sedang Tayang" },
            { id: "SOLD", label: "Sudah Terjual" },
            { id: "ARCHIVED", label: "Diarsipkan" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as ListingFilter)}
              className={`px-4 py-2 rounded-full font-bold transition-all whitespace-nowrap ${
                filter === tab.id
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {unauthenticated ? (
          <div className="bg-white p-8 rounded-2xl border border-surface-border text-center space-y-3">
            <p className="text-sm font-bold text-on-surface">
              Silakan masuk untuk mengelola iklan Anda
            </p>
            <Link
              href="/login"
              className="inline-flex px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold"
            >
              Masuk Sekarang
            </Link>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-surface-subtle animate-pulse border border-surface-border"
              />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-surface-border text-center space-y-2">
            <p className="text-sm font-bold text-on-surface">
              Belum ada iklan pada tab ini
            </p>
            <Link
              href="/sell"
              className="text-xs font-bold text-brand-primary underline inline-block"
            >
              Pasang iklan pertamamu sekarang
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredListings.map((item) => {
              const cover =
                item.images[0] || "/assets/products/ipad-mini-unboxing.png";
              return (
                <div
                  key={item.id}
                  className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-20 h-20 rounded-xl bg-surface-container overflow-hidden shrink-0 relative border border-outline-variant/20">
                      <Image
                        src={cover}
                        alt={item.title}
                        fill
                        unoptimized={cover.startsWith("/api/")}
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        {statusBadge(item.status)}
                        <span className="text-on-surface-variant text-[11px]">
                          {item.conditionLabel}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-on-surface truncate mt-1">
                        {item.title}
                      </h3>
                      <div className="font-bold text-primary text-sm mt-0.5 tabular-nums">
                        {formatRupiah(item.price)}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-on-surface-variant mt-1.5">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-outline" />{" "}
                          {item.viewsCount} dilihat
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5 text-outline" />{" "}
                          {item.favoritesCount} wishlist
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center flex-wrap gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 text-xs">
                    <Link
                      href={`/product/${item.slug}`}
                      className="px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Lihat</span>
                    </Link>

                    {item.status === "ACTIVE" && (
                      <>
                        <button
                          onClick={() => openEditModal(item)}
                          className="px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold flex items-center gap-1"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => void handleArchive(item.id)}
                          className="px-3 py-2 rounded-xl bg-surface-container-low hover:bg-amber-50 text-amber-800 font-semibold flex items-center gap-1"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Arsipkan</span>
                        </button>
                      </>
                    )}

                    {item.status === "ARCHIVED" && (
                      <button
                        onClick={() => void handleRelist(item.id)}
                        className="px-3 py-2 rounded-xl bg-brand-secondary text-white font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Tayangkan Ulang</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Listing Modal */}
      <Modal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Edit Iklan Gadget"
        description="Perubahan harga atau deskripsi hanya diizinkan saat tidak ada pesanan aktif."
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-on-surface block mb-1">
              Judul Iklan
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              minLength={3}
              required
              className="w-full h-10 px-3 rounded-xl bg-surface-subtle border border-surface-border outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-on-surface block mb-1">
              Harga (Rp)
            </label>
            <input
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              min={10000}
              required
              className="w-full h-10 px-3 rounded-xl bg-surface-subtle border border-surface-border outline-none font-mono font-bold"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-subtle rounded-xl">
            <span className="font-bold text-on-surface">Bisa Nego</span>
            <input
              type="checkbox"
              checked={editCanNego}
              onChange={(e) => setEditCanNego(e.target.checked)}
              className="w-4 h-4 accent-brand-primary"
            />
          </div>

          <div>
            <label className="font-bold text-on-surface block mb-1">
              Deskripsi
            </label>
            <textarea
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              minLength={10}
              required
              className="w-full p-3 rounded-xl bg-surface-subtle border border-surface-border outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingItem(null)}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
