"use client";

import React, { useState } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import { Order } from "@/types";
import { useOrderStore } from "@/stores/useOrderStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
}

export function ReviewModal({ isOpen, onClose, order }: ReviewModalProps) {
  const { submitReview } = useOrderStore();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([
    "Kondisi Sesuai Deskripsi",
    "Packing Sangat Tebal",
  ]);
  const [comment, setComment] = useState(
    "Unit mantap pol! Shutter count & fisik sesuai persis di foto. Seller responsif dan pengiriman cepat via Rekber."
  );
  const [submitted, setSubmitted] = useState(false);

  const availableTags = [
    "Kondisi Sesuai Deskripsi",
    "Packing Sangat Tebal",
    "Respon Seller Kilat",
    "Fungsi 100% Normal",
    "Baterai Awet",
    "Pengiriman Cepat",
  ];

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitReview(order.id, rating, selectedTags, comment);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Beri Ulasan Gadget Kamu ⭐"
      description="Ulasan kamu membantu tech shopper lain menghindari barang minus atau tipuan."
    >
      {submitted ? (
        <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-brand-secondary-light text-brand-secondary flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-lg text-on-surface">Ulasan Berhasil Dikirim!</h4>
          <p className="text-xs text-text-secondary">
            Terima kasih telah berbagi pengalaman belanja aman via Escrow NgeBekasinYuk.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Star Rating selector */}
          <div className="flex flex-col items-center justify-center p-4 bg-surface-subtle rounded-xl">
            <span className="text-xs font-bold text-text-secondary mb-2">
              Beri Bintang untuk Kondisi Unit:
            </span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 hover:scale-125 transition-transform"
                >
                  <Star
                    className={`w-7 h-7 ${
                      (hoverRating || rating) >= star
                        ? "fill-brand-warning text-brand-warning"
                        : "text-surface-border"
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-semibold text-[#B26A00] mt-2">
              {rating === 5 && "Sangat Puas! Unit Sempurna"}
              {rating === 4 && "Puas, Barang Bagus"}
              {rating === 3 && "Cukup, Ada Sedikit Minus"}
              {rating === 2 && "Kurang Memuaskan"}
              {rating === 1 && "Kecewa, Banyak Minus"}
            </span>
          </div>

          {/* Quick Feedback Chips */}
          <div>
            <label className="text-xs font-bold text-on-surface mb-1.5 block">
              Pilih Kelebihan Transaksi:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      isSelected
                        ? "bg-brand-primary text-white"
                        : "bg-surface-subtle text-text-secondary hover:bg-outline-variant"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment Textarea */}
          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">
              Tulis Pengalaman Ujimu:
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full p-3 bg-surface-subtle rounded-xl text-xs sm:text-sm text-on-surface border border-transparent focus:border-brand-primary focus:bg-white outline-none"
              placeholder="Ceritakan kondisi baterai, fisik, kelengkapan..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Nanti Saja
            </Button>
            <Button type="submit" variant="primary">
              Kirim Ulasan Sekarang
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default ReviewModal;
