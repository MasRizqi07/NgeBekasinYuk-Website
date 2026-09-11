import React from "react";
import { ShieldCheck, CheckCircle2, Star, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustBadgeProps {
  type?: "kyc" | "escrow" | "diagnostic" | "score";
  score?: number;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function TrustBadge({
  type = "kyc",
  score,
  label,
  className,
  size = "md",
}: TrustBadgeProps) {
  if (type === "kyc") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-brand-secondary-light border border-brand-secondary/30 text-brand-secondary font-semibold select-none",
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
          className
        )}
      >
        <CheckCircle2 className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>{label || "e-KYC Verified"}</span>
      </span>
    );
  }

  if (type === "escrow") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-brand-secondary text-white font-bold select-none shadow-xs",
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
          className
        )}
      >
        <ShieldCheck className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>{label || "Rekber Aktif"}</span>
      </span>
    );
  }

  if (type === "diagnostic") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-brand-primary-soft border border-brand-primary/20 text-brand-primary font-semibold select-none",
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
          className
        )}
      >
        <ShieldCheck className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>{label || "Diagnostic Passed"}</span>
      </span>
    );
  }

  if (type === "score") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-[#FFF4E0] border border-[#FFE0A3] text-[#B26A00] font-bold select-none",
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
          className
        )}
      >
        <Star className={cn("fill-[#F5A524] text-[#F5A524]", size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")} />
        <span>{score ? `${score} Trust Score` : label || "4.9 (50+)"}</span>
      </span>
    );
  }

  return null;
}
