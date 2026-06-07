"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DICTIONARIES } from "./dict";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./types";

const STORAGE_KEY = "qrmenu.locale";

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  // Saved preference wins.
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && LOCALES.includes(saved as Locale)) return saved as Locale;
  // Otherwise sniff navigator.languages.
  const langs = window.navigator.languages ?? [window.navigator.language];
  for (const raw of langs) {
    const code = raw.slice(0, 2).toLowerCase();
    if (code === "th") return "th";
    if (code === "lo") return "lo";
    if (code === "en") return "en";
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start with DEFAULT_LOCALE on server + first client render to avoid
  // hydration mismatch, then sync from localStorage on mount.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(detectInitialLocale());
  }, []);

  // Reflect locale on <html lang> so screen readers + fonts behave right.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale);
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = DICTIONARIES[locale];
      // Fallback chain: requested locale → Thai → key itself.
      const value = dict[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
      if (!vars) return value;
      return value.replace(/\{(\w+)\}/g, (_, name: string) =>
        name in vars ? String(vars[name]) : `{${name}}`,
      );
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback for components rendered outside provider — returns
    // Thai strings so the UI still works.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key, vars) => {
        const v = DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
        if (!vars) return v;
        return v.replace(/\{(\w+)\}/g, (_, name: string) =>
          name in vars ? String(vars[name]) : `{${name}}`,
        );
      },
    };
  }
  return ctx;
}
