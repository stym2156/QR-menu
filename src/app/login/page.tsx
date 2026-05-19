"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  FormField,
  buttonPrimary,
  card,
  cardPad,
  input,
} from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
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
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 self-center text-base font-semibold tracking-tight text-ink"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-xs font-bold text-surface">
          S
        </span>
        ShopQR
      </Link>

      <div className={`${card} ${cardPad}`}>
        <h1 className="text-xl font-semibold tracking-tight text-ink">เข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-muted">ยินดีต้อนรับกลับ</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormField label="อีเมล">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={input}
              placeholder="you@example.com"
            />
          </FormField>

          <FormField label="รหัสผ่าน">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={input}
              placeholder="••••••••"
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
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        ยังไม่มีบัญชี?{" "}
        <Link href="/signup" className="font-medium text-ink hover:underline">
          เปิดร้านใหม่
        </Link>
      </p>
    </main>
  );
}
