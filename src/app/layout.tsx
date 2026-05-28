import PWAInstall from "@/components/PWAInstall";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AppSettingsProvider } from "@/components/providers/AppSettingsProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daffgle",
  description: "Anonymous realtime student communication platform for DIU students",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Daffgle",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#050805",
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
      <body className="min-h-full flex flex-col bg-brand-primary text-brand-text-primary font-sans selection:bg-brand-accent/20 selection:text-brand-accent">
        <AppSettingsProvider>
          {children}
        </AppSettingsProvider>
        <PWAInstall />
        <Toaster position="top-center" theme="dark" richColors closeButton />
      </body>
    </html>
  );
}