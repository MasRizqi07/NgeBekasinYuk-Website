"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1">
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-text-muted">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "w-full h-11 px-3.5 bg-surface-subtle text-on-surface rounded-xl text-sm transition-all outline-none border border-transparent placeholder:text-text-muted",
              "focus:border-brand-primary focus:bg-white focus:ring-3 focus:ring-brand-primary/15",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-brand-danger focus:border-brand-danger focus:ring-brand-danger/15",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-text-muted">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-brand-danger font-medium pl-1">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
