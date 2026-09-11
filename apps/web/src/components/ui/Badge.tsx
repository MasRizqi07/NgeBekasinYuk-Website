import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "outline"
    | "danger"
    | "warning"
    | "subtle"
    | "likeNew"
    | "normalUse"
    | "minorScratch"
    | "minorDefect";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center font-semibold rounded-full select-none";

  const variants = {
    primary: "bg-brand-primary-soft text-brand-primary border border-brand-primary/20",
    secondary: "bg-brand-secondary-light text-brand-secondary border border-brand-secondary/20",
    accent: "bg-brand-accent-soft text-brand-accent border border-brand-accent/20",
    outline: "bg-white text-text-secondary border border-surface-border",
    danger: "bg-brand-danger-soft text-brand-danger border border-brand-danger/20",
    warning: "bg-brand-warning-soft text-[#B26A00] border border-brand-warning/20",
    subtle: "bg-surface-subtle text-text-secondary border border-transparent",
    
    // Tech conditions
    likeNew: "bg-secondary-container/30 text-[#00714F] border border-secondary-container/50",
    normalUse: "bg-primary-fixed text-[#00419E] border border-primary-fixed-dim",
    minorScratch: "bg-[#FFF4E0] text-[#B26A00] border border-[#FFE0A3]",
    minorDefect: "bg-brand-danger-soft text-brand-danger border border-brand-danger/20",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
  };

  return (
    <div className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </div>
  );
}
