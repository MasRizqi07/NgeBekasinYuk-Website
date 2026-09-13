import React from "react";
import { Navbar } from "@/components/shared/Navbar";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";
import { Footer } from "@/components/shared/Footer";
import { ToastProvider } from "@/components/ui/Toast";
import { PageTransition } from "@/components/shared/PageTransition";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-surface pb-16 sm:pb-0">
        <Navbar />
        <main className="flex-1 w-full flex flex-col">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
        <MobileBottomNav />
      </div>
    </ToastProvider>
  );
}
