"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/I18nProvider";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { FormField, buttonPrimary, buttonSecondary, input } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

interface Props {
  token: string;
  restaurantName: string;
  role: string;
}

export default function JoinForm({ token, restaurantName, role }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useT();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The trigger reads this and attaches the new user to the invite's
        // restaurant + role instead of creating a new restaurant.
        data: { invite_token: token },
      },
    });

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      setLoading(false);
      return;
    }

    if (!data.session) {
      setInfo(t("join.verify_email"));
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleLogin(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginErr) {
      setError(t("auth.login.invalid"));
      setLoading(false);
      return;
    }
    // Logged in — accept invite via RPC.
    const { error: acceptErr } = await supabase.rpc("accept_invite", {
      token_input: token,
    });
    if (acceptErr) {
      setError(`${t("join.failed.title")}: ${acceptErr.message}`);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const roleLabel = t(`role.${role}`);

  function translateAuthError(msg: string): string {
    if (/already registered|already exists/i.test(msg)) {
      return t("join.already_registered");
    }
    if (/INVITE_/i.test(msg)) {
      if (/USED/i.test(msg)) return t("join.used.title");
      if (/REVOKED/i.test(msg)) return t("join.revoked.title");
      if (/NOT_FOUND/i.test(msg)) return t("join.invalid.title");
    }
    return msg;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {t("join.title", { restaurant: restaurantName })}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t("join.role_label")}{" "}
            <span className="font-medium text-ink">{roleLabel}</span>
          </p>
        </div>
        <LanguageSwitcher variant="compact" />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-canvas p-1">
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setInfo(null);
          }}
          className={`rounded-lg py-2 text-xs font-medium transition ${
            mode === "signup"
              ? "bg-surface text-ink shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          {t("join.tab.signup")}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
            setInfo(null);
          }}
          className={`rounded-lg py-2 text-xs font-medium transition ${
            mode === "login"
              ? "bg-surface text-ink shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          {t("join.tab.login")}
        </button>
      </div>

      <form
        onSubmit={mode === "signup" ? handleSignup : handleLogin}
        className="space-y-4"
      >
        <FormField label={t("auth.field.email")}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={input}
            placeholder={t("auth.field.email.placeholder")}
            autoComplete="email"
          />
        </FormField>

        <FormField
          label={t("auth.field.password")}
          hint={mode === "signup" ? t("auth.field.password.hint") : undefined}
        >
          <PasswordInput
            value={password}
            onChange={setPassword}
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </FormField>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
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
          {loading
            ? t("join.submitting")
            : mode === "signup"
              ? t("join.submit.signup")
              : t("join.submit.login")}
        </button>
      </form>

      <button
        type="button"
        onClick={() => router.push("/")}
        className={`${buttonSecondary} w-full py-2 text-xs`}
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}
