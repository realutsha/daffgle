import PWAInstall from "@/components/PWAInstall";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daffgle",
  description:
    "Anonymous realtime chat platform for DIU students",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#111111] text-white/92 font-sans selection:bg-[#C9D7F2]/20 selection:text-[#C9D7F2]">
        {children}
        <PWAInstall />
        <Toaster position="top-center" theme="dark" richColors closeButton />
      </body>
    </html>
  );
}