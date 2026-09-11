"use client";

import React from "react";
import { SlidersHorizontal, Check, X, RotateCcw } from "lucide-react";
import { useListingStore } from "@/stores/useListingStore";
import { TechCondition } from "@/types";
import { Button } from "@/components/ui/Button";

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FilterSheet({ isOpen, onClose }: FilterSheetProps) {
  const {
    selectedCategory,
    setSelectedCategory,
    selectedConditions,
    toggleCondition,
    minPrice,
    maxPrice,
    setPriceRange,
    selectedCity,
    setSelectedCity,
    verifiedSellerOnly,
    toggleVerifiedSellerOnly,
    canNegoOnly,
    toggleCanNegoOnly,
    resetFilters,
  } = useListingStore();

  if (!isOpen) return null;

  const categories = [
    { id: "all", label: "Semua Kategori" },
    { id: "smartphone", label: "Smartphone" },
    { id: "laptop", label: "Laptop & MacBook" },
    { id: "camera", label: "Kamera & Lensa" },
    { id: "pc-gaming", label: "PC Gaming & GPU" },
    { id: "console", label: "Konsol Gaming" },
    { id: "audio", label: "Audio & Earbuds" },
  ];

  const conditions: { id: TechCondition; label: string; desc: string }[] = [
    {
      id: "LIKE_NEW",
      label: "Seperti Baru (99%)",
      desc: "Mulus tanpa baret, fungsi 100% prima",
    },
    {
      id: "NORMAL_USE",
      label: "Pemakaian Wajar (95%)",
      desc: "Baret halus pemakaian biasa, fungsi normal",
    },
    {
      id: "MINOR_SCRATCHES",
      label: "Lecet / Dent Ringan",
      desc: "Ada dent/lecet sudut, layar & fungsi aman",
    },
    {
      id: "MINOR_DEFECT",
      label: "Minus Tertentu",
      desc: "Ada fungsi minus yang dijelaskan jujur",
    },
  ];

  const cities = ["Semua Kota", "Jakarta Selatan", "Jakarta Barat", "Surabaya", "Bandung", "Depok"];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-brand-primary" />
            <h3 className="font-bold text-base text-on-surface">Filter Gadget</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-text-muted hover:text-on-surface"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-6 overflow-y-auto no-scrollbar">
          {/* 1. Kategori */}
          <div>
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-2">
              Kategori Perangkat
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      isSelected
                        ? "bg-brand-primary text-white shadow-xs"
                        : "bg-surface-subtle text-text-secondary hover:bg-[#E3E8EF]"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Kondisi Fisik */}
          <div>
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-2">
              Kondisi Unit
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {conditions.map((c) => {
                const isChecked = selectedConditions.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCondition(c.id)}
                    className={`p-3 rounded-xl border text-left flex items-start justify-between transition-all ${
                      isChecked
                        ? "border-brand-primary bg-brand-primary-soft/50 text-brand-primary"
                        : "border-surface-border bg-white text-text-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs">{c.label}</div>
                      <div className="text-[10px] text-text-muted mt-0.5 leading-tight">
                        {c.desc}
                      </div>
                    </div>
                    {isChecked && <Check className="w-4 h-4 shrink-0 text-brand-primary mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Range Harga */}
          <div>
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-2">
              Rentang Harga (Rp)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-text-muted mb-1 block">Harga Minimum</span>
                <input
                  type="number"
                  placeholder="Rp 0"
                  value={minPrice ?? ""}
                  onChange={(e) =>
                    setPriceRange(
                      e.target.value ? Number(e.target.value) : null,
                      maxPrice
                    )
                  }
                  className="w-full px-3 py-2 bg-surface-subtle rounded-xl text-xs font-mono border border-transparent focus:border-brand-primary focus:bg-white outline-none"
                />
              </div>

              <div>
                <span className="text-[11px] text-text-muted mb-1 block">Harga Maksimum</span>
                <input
                  type="number"
                  placeholder="Rp 50.000.000"
                  value={maxPrice ?? ""}
                  onChange={(e) =>
                    setPriceRange(
                      minPrice,
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 bg-surface-subtle rounded-xl text-xs font-mono border border-transparent focus:border-brand-primary focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. Lokasi Kota */}
          <div>
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-2">
              Lokasi Penjual
            </label>
            <div className="flex flex-wrap gap-1.5">
              {cities.map((city) => {
                const isSelected =
                  city === "Semua Kota"
                    ? selectedCity === null
                    : selectedCity === city;
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() =>
                      setSelectedCity(city === "Semua Kota" ? null : city)
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      isSelected
                        ? "bg-brand-primary text-white"
                        : "bg-surface-subtle text-text-secondary hover:bg-[#E3E8EF]"
                    }`}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Toggles (Verified Seller & Nego) */}
          <div className="space-y-3 pt-2 border-t border-surface-border">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-bold text-on-surface">
                Hanya Penjual Terverifikasi e-KYC
              </span>
              <input
                type="checkbox"
                checked={verifiedSellerOnly}
                onChange={toggleVerifiedSellerOnly}
                className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary accent-brand-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-bold text-on-surface">
                Hanya Gadget yang Bisa Dinego
              </span>
              <input
                type="checkbox"
                checked={canNegoOnly}
                onChange={toggleCanNegoOnly}
                className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary accent-brand-primary"
              />
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-surface-border flex items-center justify-between gap-3 bg-white">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-xs text-text-muted gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filter</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={onClose}
            className="flex-1 font-bold"
          >
            Terapkan Filter
          </Button>
        </div>
      </div>
    </div>
  );
}
