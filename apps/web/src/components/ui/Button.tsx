"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "outline"
    | "ghost"
    | "destructive"
    | "success";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";

    const variants = {
      primary:
        "bg-brand-primary text-white hover:bg-brand-primary-hover shadow-[0_4px_16px_0_rgba(15,111,255,0.28)] focus-visible:ring-brand-primary",
      secondary:
        "bg-brand-primary-soft text-brand-primary hover:bg-[#DCE7FF] focus-visible:ring-brand-primary",
      accent:
        "bg-brand-accent text-white hover:bg-brand-accent-hover shadow-[0_4px_16px_0_rgba(255,122,0,0.32)] focus-visible:ring-brand-accent",
      outline:
        "border border-surface-border bg-white text-on-surface hover:bg-surface-subtle focus-visible:ring-brand-primary",
      ghost:
        "text-on-surface hover:bg-surface-subtle focus-visible:ring-brand-primary",
      destructive:
        "bg-brand-danger-soft text-brand-danger hover:bg-[#FCD1D1] focus-visible:ring-brand-danger",
      success:
        "bg-brand-secondary text-white hover:bg-[#00B07D] shadow-[0_4px_14px_0_rgba(0,196,140,0.25)] focus-visible:ring-brand-secondary",
    };

    const sizes = {
      sm: "h-9 px-3 text-xs rounded-lg gap-1.5",
      md: "h-11 px-4 text-sm rounded-xl gap-2",
      lg: "h-12 px-6 text-base rounded-xl gap-2.5 font-bold",
      icon: "h-10 w-10 p-0 rounded-xl",
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
