"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./I18nProvider";
import { LOCALE_FLAG, LOCALE_LABEL, LOCALES, type Locale } from "./types";

interface Props {
  variant?: "default" | "compact";
}

export function LanguageSwitcher({ variant = "default" }: Props) {
  const { locale, setLocale, t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("lang.switch")}
        className={
          variant === "compact"
            ? "flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink transition hover:border-ink/30 hover:bg-canvas"
            : "flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink transition hover:border-ink/30 hover:bg-canvas"
        }
      >
        <span aria-hidden="true">{LOCALE_FLAG[locale]}</span>
        <span className="hidden sm:inline">{LOCALE_LABEL[locale]}</span>
        <span aria-hidden="true" className="text-muted">
          ▾
        </span>
      </button>

      {open ? (
        <ul
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        >
          {LOCALES.map((l: Locale) => (
            <li key={l} role="none">
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setLocale(l);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-canvas ${
                  l === locale ? "font-semibold text-ink" : "text-muted"
                }`}
              >
                <span aria-hidden="true">{LOCALE_FLAG[l]}</span>
                <span>{LOCALE_LABEL[l]}</span>
                {l === locale ? (
                  <span aria-hidden="true" className="ml-auto text-ink">
                    ✓
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
