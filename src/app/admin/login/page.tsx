"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  FormField,
  buttonPrimary,
  card,
  cardPad,
  input,
} from "@/components/ui";

export default function AdminLoginPage() {
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

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.user) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
      return;
    }

    // Verify the signed-in user is in app_admins.
    // RLS only returns the row matching auth.uid(), so this is safe.
    const { data: adminRow } = await supabase
      .from("app_admins")
      .select("user_id")
      .eq("user_id", signInData.user.id)
      .maybeSingle();

    if (!adminRow) {
      // Not an admin — sign them right back out so no Dashboard session leaks.
      await supabase.auth.signOut();
      setError("บัญชีนี้ไม่มีสิทธิ์เข้าระบบ Admin");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-8 flex items-center justify-center gap-2">
        <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-surface">
          Admin
        </span>
        <span className="text-base font-semibold tracking-tight text-ink">
          QR Menu Console
        </span>
      </div>

      <div className={`${card} ${cardPad}`}>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          เข้าสู่ระบบ Admin
        </h1>
        <p className="mt-1 text-sm text-muted">
          เฉพาะผู้ดูแลแพลตฟอร์มเท่านั้น — แยกจากระบบร้านค้า
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormField label="อีเมล">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={input}
              placeholder="admin@example.com"
            />
          </FormField>

          <FormField label="รหัสผ่าน">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
    </main>
  );
}
