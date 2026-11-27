"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Camera,
  X,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Lightbulb,
} from "lucide-react";
import type { TechCondition } from "@/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface PendingImageFile {
  file: File;
  previewUrl: string;
  uploadKey: string;
  uploaded: boolean;
}

export default function SellPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [pendingImages, setPendingImages] = useState<PendingImageFile[]>([]);
  const livePreviewUrlsRef = useRef<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState<
    "smartphone" | "laptop" | "audio" | "pc-gaming" | "console" | "camera" | "accessories"
  >("smartphone");
  const [condition, setCondition] = useState<TechCondition>("LIKE_NEW");
  const [price, setPrice] = useState<number | "">("");
  const [canNego, setCanNego] = useState(true);
  const [city, setCity] = useState("Jakarta Selatan");
  const [description, setDescription] = useState("");
  const [completeness, setCompleteness] = useState<string[]>([
    "Dus / Box Asli",
    "Charger Original",
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [draftListing, setDraftListing] = useState<{
    id: string;
    slug: string;
    needsPublish: boolean;
  } | null>(null);

  useEffect(() => {
    const urls = livePreviewUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = Math.max(0, 8 - pendingImages.length);
    if (remainingSlots === 0) {
      showToast("Maksimal 8 foto per iklan.", "error");
      e.target.value = "";
      return;
    }

    const accepted: PendingImageFile[] = [];
    for (const file of Array.from(files)) {
      if (accepted.length >= remainingSlots) {
        showToast("Sebagian foto dilewati karena batas maksimal 8 foto.", "info");
        break;
      }
      if (file.size === 0) {
        showToast(`"${file.name}" kosong (0 byte).`, "error");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast(`"${file.name}" melebihi batas 5 MB.`, "error");
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      livePreviewUrlsRef.current.add(previewUrl);
      accepted.push({
        file,
        previewUrl,
        uploadKey: crypto.randomUUID(),
        uploaded: false,
      });
    }

    if (accepted.length > 0) {
      setPendingImages((prev) => [...prev, ...accepted]);
    }
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setPendingImages((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        livePreviewUrlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const toggleCompleteness = (item: string) => {
    if (completeness.includes(item)) {
      setCompleteness(completeness.filter((c) => c !== item));
    } else {
      setCompleteness([...completeness, item]);
    }
  };

  const handleSubmitListing = async () => {
    if (isSubmitting) return;
    if (!title.trim() || !price || Number(price) < 10000) {
      showToast("Judul dan harga (min Rp 10.000) wajib diisi!", "error");
      return;
    }

    setIsSubmitting(true);
    const activeKey = idempotencyKey || crypto.randomUUID();
    if (!idempotencyKey) {
      setIdempotencyKey(activeKey);
    }

    const finalDescription = [
      description.trim() ||
        "Unit terawat mulus, fungsi 100% normal tanpa kendala. Siap dikirim dan diuji via Escrow NgeBekasinYuk.",
      completeness.length > 0
        ? `\nKelengkapan: ${completeness.join(", ")}`
        : "",
    ]
      .join("")
      .trim();

    const derivedBrand = brand.trim() || title.trim().split(/\s+/)[0] || "Gadget";
    const derivedModel = model.trim() || title.trim().slice(0, 80);
    const hasPendingImages = pendingImages.length > 0;

    try {
      let targetListing = draftListing;

      if (!targetListing) {
        const createRes = await fetch("/api/listings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": activeKey,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: finalDescription,
            price: Number(price),
            category,
            brand: derivedBrand,
            model: derivedModel,
            condition,
            canNego,
            deferPublish: hasPendingImages,
          }),
        });

        const createdJson = await createRes.json().catch(() => ({}));
        if (createRes.status === 401) {
          showToast("Silakan login terlebih dahulu untuk memasang iklan.", "error");
          setIsSubmitting(false);
          router.push("/login");
          return;
        }

        if (!createRes.ok) {
          showToast(
            createdJson?.detail ||
              createdJson?.message ||
              "Gagal membuat iklan gadget.",
            "error"
          );
          setIsSubmitting(false);
          return;
        }

        targetListing = {
          id: createdJson.id,
          slug: createdJson.slug,
          needsPublish: createdJson.status === "ARCHIVED" || hasPendingImages,
        };
        setDraftListing(targetListing);
      }

      for (let i = 0; i < pendingImages.length; i++) {
        const item = pendingImages[i];
        if (item.uploaded) continue;

        const formData = new FormData();
        formData.append("file", item.file);
        const uploadRes = await fetch(
          `/api/listings/${targetListing.id}/images`,
          {
            method: "POST",
            headers: {
              "Idempotency-Key": item.uploadKey,
            },
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json().catch(() => ({}));
          showToast(
            uploadErr?.detail ||
              uploadErr?.message ||
              `Foto "${item.file.name}" ditolak server.`,
            "error"
          );
          setIsSubmitting(false);
          return;
        }

        setPendingImages((prev) =>
          prev.map((img, idx) => (idx === i ? { ...img, uploaded: true } : img))
        );
      }

      if (targetListing.needsPublish) {
        const publishRes = await fetch(
          `/api/listings/${targetListing.id}/relist`,
          { method: "POST" }
        );
        if (!publishRes.ok) {
          const pubErr = await publishRes.json().catch(() => ({}));
          showToast(
            pubErr?.detail ||
              pubErr?.message ||
              "Foto tersimpan namun gagal menayangkan iklan.",
            "error"
          );
          setIsSubmitting(false);
          return;
        }
        targetListing = { ...targetListing, needsPublish: false };
        setDraftListing(targetListing);
      }

      setIdempotencyKey(null);
      setDraftListing(null);
      showToast("Iklan gadget berhasil ditayangkan! 🎉", "success");
      router.push(`/product/${targetListing.slug}`);
    } catch {
      showToast("Terjadi kesalahan jaringan saat menayangkan iklan.", "error");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">
      {/* Wizard Progress Header */}
      <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-extrabold text-lg sm:text-xl text-on-surface">
              Pasang Iklan Gadget Bekas
            </h1>
            <p className="text-xs text-brand-secondary font-semibold flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Transaksi Terlindungi Rekber Escrow
            </p>
          </div>
          <span className="text-xs font-bold text-text-muted bg-surface-subtle px-3 py-1 rounded-full">
            Langkah {currentStep} dari 4
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1">
          {[
            { num: 1, label: "Foto Unit" },
            { num: 2, label: "Spesifikasi" },
            { num: 3, label: "Harga & Nego" },
            { num: 4, label: "Review & Tayang" },
          ].map((s) => (
            <div key={s.num} className="flex flex-col items-center gap-1 text-center">
              <div
                className={`w-full h-1.5 rounded-full transition-colors ${
                  currentStep >= s.num ? "bg-brand-primary" : "bg-surface-subtle"
                }`}
              />
              <span
                className={`text-[10px] sm:text-xs font-bold ${
                  currentStep >= s.num ? "text-brand-primary" : "text-text-muted"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: FOTO PRODUK */}
      {currentStep === 1 && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-5">
          <div>
            <h2 className="font-bold text-base text-on-surface">
              Langkah 1: Unggah Foto Gadget
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Format JPG, PNG, atau WebP (maks. 5 MB per foto). Foto disimpan
              langsung ke server saat iklan ditayangkan.
            </p>
          </div>

          <div className="bg-brand-secondary-light p-3.5 rounded-xl border border-brand-secondary/30 flex items-start gap-2.5 text-xs text-on-secondary-container">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-brand-secondary" />
            <p className="leading-relaxed">
              <strong>Tips Kurasi:</strong> Pastikan foto jelas di ruangan terang.
              Wajib sertakan foto layar saat menyala dan fisik sudut bodi tanpa filter.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {pendingImages.map((img, idx) => (
              <div
                key={img.previewUrl}
                className="relative aspect-square rounded-xl overflow-hidden bg-surface-subtle border border-surface-border shadow-xs group"
              >
                <Image
                  src={img.previewUrl}
                  alt={`Upload ${idx + 1}`}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  aria-label="Hapus foto"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-brand-danger transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 bg-brand-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    Foto Sampul
                  </span>
                )}
              </div>
            ))}

            {pendingImages.length < 8 && (
              <label className="relative aspect-square rounded-xl border-2 border-dashed border-surface-border hover:border-brand-primary bg-surface-subtle hover:bg-brand-primary-soft/30 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all">
                <Camera className="w-6 h-6 text-text-muted" />
                <span className="text-[11px] font-bold text-text-secondary">
                  + Tambah Foto
                </span>
                <span className="text-[9px] text-text-muted">
                  JPG/PNG/WebP (Maks 8)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => setCurrentStep(2)}
              className="gap-2 font-bold"
            >
              <span>Lanjut ke Spesifikasi</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: SPESIFIKASI & KONDISI */}
      {currentStep === 2 && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-5">
          <div>
            <h2 className="font-bold text-base text-on-surface">
              Langkah 2: Detail & Kondisi Gadget
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Jujur dalam menyatakan kondisi untuk menghindari risiko dispute saat
              masa inspeksi 48 jam.
            </p>
          </div>

          <div>
            <label
              htmlFor="sell-title"
              className="text-xs font-bold text-on-surface block mb-1"
            >
              Judul Iklan Gadget:
            </label>
            <input
              id="sell-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: MacBook Pro M2 16GB 512GB Space Grey - iBox Mulus"
              className="w-full h-11 px-3.5 bg-surface-subtle rounded-xl text-xs sm:text-sm text-on-surface border border-transparent focus:border-brand-primary focus:bg-white outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sell-brand"
                className="text-xs font-bold text-on-surface block mb-1"
              >
                Merek (Brand):
              </label>
              <input
                id="sell-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Contoh: Apple, Sony, Lenovo"
                className="w-full h-11 px-3.5 bg-surface-subtle rounded-xl text-xs sm:text-sm text-on-surface border border-transparent focus:border-brand-primary focus:bg-white outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="sell-model"
                className="text-xs font-bold text-on-surface block mb-1"
              >
                Seri / Model:
              </label>
              <input
                id="sell-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Contoh: MacBook Pro 14 M2"
                className="w-full h-11 px-3.5 bg-surface-subtle rounded-xl text-xs sm:text-sm text-on-surface border border-transparent focus:border-brand-primary focus:bg-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface block mb-1.5">
              Kategori:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(
                [
                  { id: "smartphone", label: "Smartphone" },
                  { id: "laptop", label: "Laptop / Mac" },
                  { id: "camera", label: "Kamera & Lensa" },
                  { id: "audio", label: "Audio / TWS" },
                  { id: "console", label: "Konsol Gaming" },
                  { id: "pc-gaming", label: "PC Gaming / GPU" },
                  { id: "accessories", label: "Aksesoris" },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    category === c.id
                      ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                      : "bg-surface-subtle text-text-secondary border-surface-border hover:bg-outline-variant"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface block mb-1.5">
              Pilihan Kondisi Unit:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  id: "BRAND_NEW_SEALED",
                  label: "Segel Baru (100%)",
                  desc: "Unit BNIB/BNOB, segel utuh belum aktif",
                },
                {
                  id: "LIKE_NEW",
                  label: "Seperti Baru (99%)",
                  desc: "Mulus tanpa baret/dent, baterai awet",
                },
                {
                  id: "NORMAL_USE",
                  label: "Pemakaian Wajar (95%)",
                  desc: "Baret halus pemakaian biasa, layar aman",
                },
                {
                  id: "MINOR_SCRATCHES",
                  label: "Lecet Pemakaian (90%)",
                  desc: "Ada baret/dent di sudut, fungsi 100%",
                },
                {
                  id: "MINOR_DEFECT",
                  label: "Ada Minus Tertentu",
                  desc: "Minus dijelaskan jujur di deskripsi",
                },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCondition(c.id as TechCondition)}
                  className={`p-3 rounded-xl border text-left flex items-start justify-between transition-all ${
                    condition === c.id
                      ? "border-brand-primary bg-brand-primary-soft/50 text-brand-primary"
                      : "border-surface-border bg-white text-text-secondary hover:bg-surface-subtle"
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs">{c.label}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">{c.desc}</div>
                  </div>
                  {condition === c.id && (
                    <CheckCircle2 className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface block mb-1.5">
              Kelengkapan yang Disertakan:
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                "Dus / Box Asli",
                "Charger Original",
                "Kabel Data",
                "Nota Pembelian Toko",
                "Kartu Garansi Resmi",
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleCompleteness(item)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    completeness.includes(item)
                      ? "bg-brand-secondary text-white"
                      : "bg-surface-subtle text-text-secondary hover:bg-outline-variant"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="md" onClick={() => setCurrentStep(1)}>
              Kembali
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                if (title.trim().length < 3) {
                  showToast("Mohon masukkan judul iklan minimal 3 karakter", "error");
                  return;
                }
                setCurrentStep(3);
              }}
              className="gap-2 font-bold"
            >
              <span>Lanjut ke Harga</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: HARGA & NEGO */}
      {currentStep === 3 && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-5">
          <div>
            <h2 className="font-bold text-base text-on-surface">
              Langkah 3: Harga & Pengaturan Nego
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Tentukan harga pasaran wajar agar iklan gadget cepat laku.
            </p>
          </div>

          <div>
            <label
              htmlFor="sell-price"
              className="text-xs font-bold text-on-surface block mb-1"
            >
              Harga Jual (Rp):
            </label>
            <input
              id="sell-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
              placeholder="Contoh: 8500000"
              min={10000}
              className="w-full h-12 px-3.5 bg-surface-subtle rounded-xl text-lg font-mono font-bold text-on-surface border border-transparent focus:border-brand-primary focus:bg-white outline-none"
              required
            />
          </div>

          <div className="p-4 bg-surface-subtle rounded-xl border border-surface-border flex items-center justify-between">
            <div>
              <h4 className="font-bold text-xs text-on-surface">
                Aktifkan Fitur Tawar / Nego
              </h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                Calon pembeli dapat mengajukan tawaran harga di ruang chat.
              </p>
            </div>
            <input
              type="checkbox"
              checked={canNego}
              onChange={(e) => setCanNego(e.target.checked)}
              className="w-5 h-5 rounded text-brand-primary accent-brand-primary"
            />
          </div>

          <div>
            <label
              htmlFor="sell-city"
              className="text-xs font-bold text-on-surface block mb-1"
            >
              Kota Asal Pengiriman:
            </label>
            <select
              id="sell-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-11 px-3 bg-surface-subtle rounded-xl text-xs sm:text-sm font-semibold text-on-surface border border-transparent focus:border-brand-primary outline-none"
            >
              <option value="Jakarta Selatan">Jakarta Selatan</option>
              <option value="Jakarta Barat">Jakarta Barat</option>
              <option value="Jakarta Pusat">Jakarta Pusat</option>
              <option value="Surabaya">Surabaya</option>
              <option value="Bandung">Bandung</option>
              <option value="Depok">Depok</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="sell-description"
              className="text-xs font-bold text-on-surface block mb-1"
            >
              Deskripsi Lengkap:
            </label>
            <textarea
              id="sell-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ceritakan riwayat pemakaian, alasan jual, siklus baterai..."
              className="w-full p-3 bg-surface-subtle rounded-xl text-xs sm:text-sm text-on-surface border border-transparent focus:border-brand-primary focus:bg-white outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="md" onClick={() => setCurrentStep(2)}>
              Kembali
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                if (!price || Number(price) < 10000) {
                  showToast("Mohon tentukan harga jual minimal Rp 10.000", "error");
                  return;
                }
                setCurrentStep(4);
              }}
              className="gap-2 font-bold"
            >
              <span>Review Iklan</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & TAYANG */}
      {currentStep === 4 && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-5">
          <div>
            <h2 className="font-bold text-base text-on-surface">
              Langkah 4: Konfirmasi & Siap Tayang
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Iklanmu akan langsung aktif dan dapat dicari oleh ribuan tech hunter.
            </p>
          </div>

          <div className="p-4 bg-surface-subtle rounded-xl border border-surface-border flex gap-4">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white shrink-0 shadow-xs">
              <Image
                src={
                  pendingImages[0]?.previewUrl ||
                  "/assets/products/ipad-mini-unboxing.png"
                }
                alt={title}
                fill
                unoptimized
                sizes="80px"
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold bg-brand-primary-soft text-brand-primary px-2 py-0.5 rounded-full uppercase">
                {category}
              </span>
              <h3 className="font-bold text-sm text-on-surface mt-1 truncate">
                {title}
              </h3>
              <div className="font-extrabold text-base text-brand-primary mt-0.5 tabular-nums">
                Rp {Number(price).toLocaleString("id-ID")}
              </div>
              <span className="text-xs text-text-muted">
                {city} • {canNego ? "Bisa Nego" : "Harga Pas"} •{" "}
                {pendingImages.length} Foto
              </span>
            </div>
          </div>

          <div className="bg-brand-secondary-light p-4 rounded-xl border border-brand-secondary/30 flex items-start gap-3 text-xs text-on-secondary-container">
            <ShieldCheck className="w-5 h-5 text-brand-secondary shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Jaminan Keamanan Penjual:</strong> Pembeli wajib mentransfer
              dana ke rekening escrow sebelum kamu diminta mengirim barang. Dana
              dijamin cair setelah barang tiba dan masa uji 2x24 jam usai.
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setCurrentStep(3)}
              disabled={isSubmitting}
            >
              Ubah Data
            </Button>
            <Button
              variant="accent"
              size="lg"
              onClick={handleSubmitListing}
              disabled={isSubmitting}
              className="gap-2 font-bold shadow-lg"
            >
              <Sparkles className="w-5 h-5" />
              <span>
                {isSubmitting ? "Menayangkan Iklan..." : "Tayangkan Iklan Sekarang"}
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
