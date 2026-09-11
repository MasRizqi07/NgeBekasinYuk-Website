"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastMessage {
  id: string;
  type?: "success" | "error" | "info" | "warning";
  title?: string;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: "success" | "error" | "info" | "warning", title?: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const showToast = React.useCallback(
    (message: string, type: "success" | "error" | "info" | "warning" = "success", title?: string) => {
      const id = `toast-${Date.now()}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 sm:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={cn(
                "pointer-events-auto p-4 rounded-xl shadow-lg border flex items-start gap-3 bg-white",
                toast.type === "success" && "border-brand-secondary/30 text-on-surface",
                toast.type === "error" && "border-brand-danger/30 text-on-surface",
                toast.type === "info" && "border-brand-primary/30 text-on-surface",
                toast.type === "warning" && "border-[#F5A524]/40 text-on-surface"
              )}
            >
              {toast.type === "success" && (
                <CheckCircle2 className="w-5 h-5 text-brand-secondary flex-shrink-0 mt-0.5" />
              )}
              {toast.type === "error" && (
                <AlertCircle className="w-5 h-5 text-brand-danger flex-shrink-0 mt-0.5" />
              )}
              {toast.type === "info" && (
                <Info className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" />
              )}
              {toast.type === "warning" && (
                <AlertCircle className="w-5 h-5 text-[#F5A524] flex-shrink-0 mt-0.5" />
              )}

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className="font-bold text-sm text-on-surface">{toast.title}</h4>
                )}
                <p className="text-xs text-text-secondary mt-0.5 leading-snug">{toast.message}</p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-text-muted hover:text-on-surface p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    return {
      showToast: (msg: string) => {
        if (typeof window !== "undefined") {
          console.log("[Toast]:", msg);
        }
      },
    };
  }
  return context;
}
