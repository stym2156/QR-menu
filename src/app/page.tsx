"use client";

import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";

export default function HomePage() {
  const { t } = useT();
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher variant="compact" />
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-xs font-bold text-surface">
          Q
        </span>
        QR Menu
      </div>

      <div className="space-y-4">
        <h1 className="text-5xl font-semibold tracking-tightest text-ink sm:text-6xl">
          {t("home.h1.line1")}
          <br />
          {t("home.h1.line2")}
        </h1>
        <p className="mx-auto max-w-xl text-base text-muted sm:text-lg">
          {t("home.summary")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/signup" className={buttonPrimary}>
          {t("home.cta.signup_free")}
        </Link>
        <Link href="/login" className={buttonSecondary}>
          {t("home.cta.login")}
        </Link>
      </div>

      <p className="text-xs text-muted">{t("home.footer.no_card")}</p>
    </main>
  );
}
