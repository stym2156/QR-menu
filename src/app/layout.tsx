import type { Metadata } from "next";
import { Inter, Sarabun } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

// Latin UI — clean, neutral.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Thai — Sarabun is the de-facto modern Thai UI font.
const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

// Lao — Saysettha OT is loaded via @font-face in globals.css (file lives
// in /public/fonts). Variable here is just so Tailwind's font chain can
// reference it; the @font-face declaration defines the actual family.

export const metadata: Metadata = {
  title: "QR Menu— QR Ordering",
  description: "Scan-to-order restaurant platform powered by Supabase.",
  applicationName: "QR Menu",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QR Menu",
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
    <html
      lang="th"
      className={`${inter.variable} ${sarabun.variable}`}
    >
      <body
        className="min-h-screen bg-canvas font-sans text-ink antialiased"
        suppressHydrationWarning
      >
        <I18nProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
