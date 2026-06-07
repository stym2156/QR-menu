"use client";

import { useState } from "react";
import { useT } from "./I18nProvider";
import { LOCALE_FLAG, LOCALE_LABEL, LOCALES, type Locale } from "./types";

interface Props {
  variant?: "default" | "compact" | "popup";
}

export function LanguageSwitcher({ variant = "default" }: Props) {
  const { locale, setLocale, t } = useT();
  const [open, setOpen] = useState(false);
  const usePopup = variant === "popup";

  const buttonClass =
    variant === "popup"
      ? "flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-ink/30 hover:bg-canvas"
      : variant === "compact"
        ? "flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink transition hover:border-ink/30 hover:bg-canvas"
        : "flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink transition hover:border-ink/30 hover:bg-canvas";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("lang.switch")}
        className={buttonClass}
      >
        <span aria-hidden="true">{usePopup ? "A" : LOCALE_FLAG[locale]}</span>
        <span className={usePopup ? "inline" : "hidden sm:inline"}>
          {usePopup ? t("lang.label") : LOCALE_LABEL[locale]}
        </span>
        <span aria-hidden="true" className="text-muted">
          v
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 px-4 pb-4 sm:items-center sm:pb-0"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("lang.switch")}
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold tracking-tight text-ink">
                {t("lang.switch")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-muted transition hover:bg-canvas hover:text-ink"
              >
                {t("common.close")}
              </button>
            </div>
            <ul className="p-2">
              {LOCALES.map((l: Locale) => (
                <li key={l}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocale(l);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition hover:bg-canvas ${
                      l === locale ? "bg-canvas font-semibold text-ink" : "text-muted"
                    }`}
                  >
                    <span aria-hidden="true">{LOCALE_FLAG[l]}</span>
                    <span>{LOCALE_LABEL[l]}</span>
                    {l === locale ? (
                      <span aria-hidden="true" className="ml-auto text-ink">
                        *
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
