"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FormField,
  SectionHeading,
  StatusPill,
  buttonPrimary,
  card,
  cardPad,
  input,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { formatDateTime } from "@/lib/format";
import type { Feedback, FeedbackCategory } from "@/lib/types";

interface Props {
  userId: string;
  userEmail: string;
  restaurantId: string | null;
  restaurantName: string | null;
  initialFeedback: Feedback[];
}

const CATEGORIES: { value: FeedbackCategory; label: string; icon: string }[] = [
  { value: "bug", label: "Bug / ปัญหา", icon: "🐞" },
  { value: "feature", label: "ขอ feature", icon: "✨" },
  { value: "question", label: "สอบถาม", icon: "❓" },
  { value: "general", label: "ทั่วไป", icon: "💬" },
];

const CATEGORY_LABEL: Record<FeedbackCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<FeedbackCategory, string>;

export default function FeedbackView({
  userId,
  userEmail,
  restaurantId,
  restaurantName,
  initialFeedback,
}: Props) {
  const supabase = createClient();
  const toast = useToast();

  const [feedbackList, setFeedbackList] = useState<Feedback[]>(initialFeedback);
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      setError("ข้อความสั้นเกินไป (อย่างน้อย 5 ตัวอักษร)");
      return;
    }
    if (trimmed.length > 2000) {
      setError("ข้อความยาวเกินไป (ไม่เกิน 2,000 ตัวอักษร)");
      return;
    }
    setBusy(true);

    const { data, error: insertError } = await supabase
      .from("feedback")
      .insert({
        user_id: userId,
        restaurant_id: restaurantId,
        email: email.trim() || null,
        category,
        message: trimmed,
      })
      .select()
      .single();

    setBusy(false);

    if (insertError || !data) {
      setError(`ส่งไม่สำเร็จ: ${insertError?.message ?? "unknown"}`);
      return;
    }

    setFeedbackList((prev) => [data as Feedback, ...prev]);
    setMessage("");
    setCategory("general");
    toast.success("ส่งข้อความเรียบร้อย ขอบคุณครับ");
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[420px_1fr]">
      <form
        onSubmit={handleSubmit}
        className={`${card} ${cardPad} h-fit space-y-4 lg:sticky lg:top-20`}
      >
        <FormField label="">
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  category === c.value
                    ? "border-ink bg-ink text-surface"
                    : "border-line bg-surface text-ink hover:border-ink/30"
                }`}
              >
                <span className="text-base">{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="ข้อความ" hint="5 – 2,000 ตัวอักษร">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={2000}
            required
            className={`${input} resize-none`}
          />
          <div className="mt-1 text-right text-[11px] text-muted tabular-nums">
            {message.length} / 2,000
          </div>
        </FormField>

        <FormField label="อีเมลที่ติดต่อกลับ" hint="ไม่บังคับ — ถ้าอยากให้ตอบกลับ">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
            placeholder="you@example.com"
          />
        </FormField>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className={`${buttonPrimary} w-full`}
        >
          {busy ? "กำลังส่ง..." : "ส่งข้อความ"}
        </button>
      </form>

      <div className="space-y-3">
        <SectionHeading
          title="ประวัติข้อความที่คุณส่ง"
          description={`${feedbackList.length} รายการ (แสดง 20 ล่าสุด)`}
        />

        {feedbackList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center text-sm text-muted">
            ยังไม่เคยส่งข้อความ
          </div>
        ) : (
          <ul className="space-y-2">
            {feedbackList.map((fb) => (
              <li
                key={fb.id}
                className="rounded-2xl border border-line bg-surface p-4"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-ink">
                      {CATEGORY_LABEL[fb.category] ?? fb.category}
                    </span>
                    {fb.resolved ? (
                      <StatusPill tone="success">แก้ไขแล้ว</StatusPill>
                    ) : (
                      <StatusPill tone="warning">รอตรวจสอบ</StatusPill>
                    )}
                  </div>
                  <span className="text-[11px] text-muted">
                    {formatDateTime(fb.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-700">
                  {fb.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
