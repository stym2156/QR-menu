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

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          restaurant_name: restaurantName,
          phone: phone.trim() || null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError(t("auth.signup.failed"));
      setLoading(false);
      return;
    }

    if (!data.session) {
      setInfo(t("auth.signup.verify_email"));
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
          {t("auth.signup.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("auth.signup.subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormField label={t("auth.field.shop_name")}>
            <input
              type="text"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              required
              className={input}
              placeholder={t("auth.field.shop_name.placeholder")}
            />
          </FormField>

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

          <FormField label={t("auth.field.phone")} hint={t("common.optional")}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              name="phone"
              inputMode="tel"
              className={input}
              placeholder={t("auth.field.phone.placeholder")}
            />
          </FormField>

          <FormField
            label={t("auth.field.password")}
            hint={t("auth.field.password.hint")}
          >
            <PasswordInput
              value={password}
              onChange={setPassword}
              required
              autoComplete="new-password"
            />
          </FormField>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {info ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={`${buttonPrimary} w-full`}
          >
            {loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.signup.has_account")}{" "}
        <Link href="/login" className="font-medium text-ink hover:underline">
          {t("auth.signup.login_link")}
        </Link>
      </p>
    </main>
  );
}
