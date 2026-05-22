"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/I18nProvider";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import {
  FormField,
  buttonPrimary,
  card,
  cardPad,
  input,
} from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(t("auth.login.invalid"));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-ink"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-xs font-bold text-surface">
            Q
          </span>
          QR Menu
        </Link>
        <LanguageSwitcher variant="compact" />
      </div>

      <div className={`${card} ${cardPad}`}>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          {t("auth.login.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("auth.login.subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormField label={t("auth.field.email")}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              name="email"
              className={input}
              placeholder={t("auth.field.email.placeholder")}
            />
          </FormField>

          <FormField label={t("auth.field.password")}>
            <PasswordInput
              value={password}
              onChange={setPassword}
              required
              autoComplete="current-password"
            />
          </FormField>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={`${buttonPrimary} w-full`}
          >
            {loading ? t("auth.login.submitting") : t("auth.login.submit")}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.login.no_account")}{" "}
        <Link href="/signup" className="font-medium text-ink hover:underline">
          {t("auth.signup.title")}
        </Link>
      </p>
    </main>
  );
}
