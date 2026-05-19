import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShopQR — QR Ordering",
  description: "Scan-to-order restaurant platform powered by Supabase.",
  applicationName: "ShopQR",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ShopQR",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={inter.variable}>
      <body
        className="min-h-screen bg-canvas font-sans text-ink antialiased"
        suppressHydrationWarning
      >
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
