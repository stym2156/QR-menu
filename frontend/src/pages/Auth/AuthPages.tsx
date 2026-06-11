import { useEffect, useState } from "react";
import { PasswordInput } from "../../components/PasswordInput";
import { buttonPrimary, card, cardPad, FormField, input } from "../../components/ui";
import { LanguageSwitcher } from "../../lib/i18n/LanguageSwitcher";
import { useT } from "../../lib/i18n/I18nProvider";
import { env } from "../../lib/env";
import { go } from "../../lib/router";
import { supabase } from "../../lib/supabase";

const AuthHeader = () => {
  const { t } = useT();
  return (
    <div className="mb-8 flex items-center justify-between">
      <button
        type="button"
        onClick={() => go("/")}
        className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-ink"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-xs font-bold text-surface">Q</span>
        QR Menu
      </button>
      <LanguageSwitcher variant="compact" />
    </div>
  );
};

function isPasswordWeak(password: string): boolean {
  return password.trim().length < 6;
}

function toMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
}

export function LoginPage() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase().auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(t("auth.login.invalid"));
      setLoading(false);
      return;
    }

    go("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <AuthHeader />
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

          <div className="text-right">
            <button
              type="button"
              onClick={() => go("/forgot-password")}
              className="text-sm text-ink underline-offset-2 hover:underline"
            >
              {t("auth.login.forgot_password")}
            </button>
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={loading} className={`${buttonPrimary} w-full`}>
            {loading ? t("auth.login.submitting") : t("auth.login.submit")}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.login.no_account")}{" "}
        <button type="button" onClick={() => go("/signup")} className="font-medium text-ink hover:underline">
          {t("auth.signup.title")}
        </button>
      </p>
    </main>
  );
}

export function SignupPage() {
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

    const { data, error: signUpError } = await supabase().auth.signUp({
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

    go("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <AuthHeader />
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

          <FormField label={t("auth.field.password")} hint={t("auth.field.password.hint")}>
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

          <button type="submit" disabled={loading} className={`${buttonPrimary} w-full`}>
            {loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.signup.has_account")}{" "}
        <button type="button" onClick={() => go("/login")} className="font-medium text-ink hover:underline">
          {t("auth.signup.login_link")}
        </button>
      </p>
    </main>
  );
}

export function ForgotPasswordPage() {
  const { t } = useT();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const normalizedPhone = phone.replace(/\D/g, "").trim();
    if (!normalizedPhone) {
      setError(t("auth.forgot.phone_required"));
      setLoading(false);
      return;
    }
    if (normalizedPhone.length < 8) {
      setError(t("auth.forgot.phone_required"));
      setLoading(false);
      return;
    }

    const apiBase = env.apiUrl.replace(/\/+$/, "");
    const response = await fetch(`${apiBase}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone }),
    });

    if (!response.ok) {
      let message = toMessage(response.statusText);
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (payload?.error) message = payload.error;
      if (!message) message = t("auth.forgot.not_found");
      setError(message);
      setLoading(false);
      return;
    }

    const result = (await response.json().catch(() => null)) as
      | {
          access_token?: string;
          refresh_token?: string;
        }
      | null;

    const accessToken = result?.access_token?.trim();
    const refreshToken = result?.refresh_token?.trim();
    if (!accessToken || !refreshToken) {
      setError(t("auth.forgot.not_found"));
      setLoading(false);
      return;
    }

    setSuccess(t("auth.forgot.sent"));
    setLoading(false);
    go(`/reset-password?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <AuthHeader />
      <div className={`${card} ${cardPad}`}>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{t("auth.forgot.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("auth.forgot.subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormField label={t("auth.field.phone")}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
              inputMode="tel"
              name="phone"
              className={input}
              placeholder={t("auth.field.phone.placeholder")}
            />
          </FormField>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {success ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
          ) : null}

          <button type="submit" disabled={loading} className={`${buttonPrimary} w-full`}>
            {loading ? t("auth.forgot.loading") : t("auth.forgot.submit")}
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-5 text-muted">
          {t("auth.forgot.info")}
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <button type="button" onClick={() => go("/login")} className="font-medium text-ink hover:underline">
          {t("auth.reset.back_to_login")}
        </button>
      </p>
    </main>
  );
}

export function ResetPasswordPage() {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string>(t("auth.reset.prepare"));

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const client = supabase();
      let sessionData = await client.auth.getSession();

      // Supabase may send tokens in hash when user opens email link.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      const accessToken = query.get("access_token") || hash.get("access_token");
      const refreshToken = query.get("refresh_token") || hash.get("refresh_token");

      if (!sessionData.data.session && accessToken && refreshToken) {
        const { data: session, error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!error && session.session) {
          sessionData = await client.auth.getSession();
        } else if (active) {
          setError(t("auth.reset.invalid_session"));
          setStatus("");
          setReady(false);
          return;
        }
      }

      if (!active) return;

      if (sessionData.data.session) {
        setReady(true);
        setStatus("");
        return;
      }

      setError(t("auth.reset.invalid_session"));
      setStatus("");
      setReady(false);
    }

    checkSession().catch(() => {
      if (!active) return;
      setError(t("auth.reset.invalid_session"));
      setStatus("");
      setReady(false);
    });

    return () => {
      active = false;
    };
  }, [t]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!password.trim() || isPasswordWeak(password)) {
      setError(t("set.pw.error.short"));
      return;
    }

    if (password !== confirm) {
      setError(t("set.pw.error.mismatch"));
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase().auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(t("auth.reset.success"));
    setLoading(false);
    setTimeout(() => go("/login"), 900);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <AuthHeader />
      <div className={`${card} ${cardPad}`}>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{t("auth.reset.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("auth.reset.subtitle")}</p>

        <p className="mt-4 text-sm text-muted">{status}</p>

        {ready ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <FormField label={t("set.pw.new")}>
              <PasswordInput
                value={password}
                onChange={setPassword}
                required
                autoComplete="new-password"
              />
            </FormField>

            <FormField label={t("set.pw.confirm")}>
              <PasswordInput
                value={confirm}
                onChange={setConfirm}
                required
                autoComplete="new-password"
              />
            </FormField>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </p>
            ) : null}

            <button type="submit" disabled={loading} className={`${buttonPrimary} w-full`}>
              {loading ? t("set.pw.submitting") : t("set.pw.submit")}
            </button>
          </form>
        ) : null}

        <p className="mt-4 text-center text-xs leading-5 text-muted">
          {t("auth.reset.back_to_login_note")}
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <button type="button" onClick={() => go("/forgot-password")} className="font-medium text-ink hover:underline">
          {t("auth.forgot.title")}
        </button>
      </p>
    </main>
  );
}
