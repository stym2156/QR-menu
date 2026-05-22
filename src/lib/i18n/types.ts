// Supported locales for the QR Menu app.
//   th — Thai (default)
//   lo — Lao (the customer's language for Lao restaurants)
//   en — English (fallback for foreign tourists)
export type Locale = "th" | "lo" | "en";

export const LOCALES: Locale[] = ["th", "lo", "en"];
export const DEFAULT_LOCALE: Locale = "th";

export const LOCALE_LABEL: Record<Locale, string> = {
  th: "ไทย",
  lo: "ລາວ",
  en: "English",
};

export const LOCALE_FLAG: Record<Locale, string> = {
  th: "🇹🇭",
  lo: "🇱🇦",
  en: "🇬🇧",
};
