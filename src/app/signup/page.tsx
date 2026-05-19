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

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
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
        data: { restaurant_name: restaurantName },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Signup ไม่สำเร็จ ลองใหม่อีกครั้ง");
      setLoading(false);
      return;
    }

    if (!data.session) {
      setInfo(
        "สมัครสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วเข้าสู่ระบบ",
      );
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
        <h1 className="text-xl font-semibold tracking-tight text-ink">เปิดร้านใหม่</h1>
        <p className="mt-1 text-sm text-muted">สมัครสมาชิก ShopQR ฟรี ใช้งานได้ทันที</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormField label="ชื่อร้าน">
            <input
              type="text"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              required
              className={input}
              placeholder="ร้านอาหารของคุณ"
            />
          </FormField>

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

          <FormField label="รหัสผ่าน" hint="อย่างน้อย 6 ตัวอักษร">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={input}
              placeholder="••••••••"
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
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="font-medium text-ink hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </main>
  );
}
