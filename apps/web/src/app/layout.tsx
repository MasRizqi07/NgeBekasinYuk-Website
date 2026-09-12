import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClientErrorHandler } from "@/components/shared/ClientErrorHandler";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0F6FFF",
};

export const metadata: Metadata = {
  title: "NgeBekasinYuk — Jual Beli Gadget Bekas Aman dengan Escrow",
  description:
    "Marketplace C2C barang bekas teknologi (smartphone, laptop, console, audio) dengan jaminan pembayaran rekening bersama (Escrow). Dana aman sampai barang kamu uji dan terima.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-surface font-sans text-on-surface" suppressHydrationWarning>
        <ClientErrorHandler />
        {children}
      </body>
    </html>
  );
}
