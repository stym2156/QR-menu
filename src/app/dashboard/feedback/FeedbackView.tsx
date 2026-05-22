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
import { useT } from "@/lib/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";
import type { Feedback, FeedbackCategory } from "@/lib/types";

interface Props {
  userId: string;
  userEmail: string;
  restaurantId: string | null;
  restaurantName: string | null;
  initialFeedback: Feedback[];
}

const CATEGORY_KEYS: { value: FeedbackCategory; key: string; icon: string }[] = [
  { value: "bug", key: "fb.cat.bug_long", icon: "🐞" },
  { value: "feature", key: "fb.cat.feature_long", icon: "✨" },
  { value: "question", key: "fb.cat.question_long", icon: "❓" },
  { value: "general", key: "fb.cat.general", icon: "💬" },
];

export default function FeedbackView({
  userId,
  userEmail,
  restaurantId,
  initialFeedback,
}: Props) {
  const supabase = createClient();
  const toast = useToast();
  const { t } = useT();

  const [feedbackList, setFeedbackList] = useState<Feedback[]>(initialFeedback);
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function categoryLabel(c: FeedbackCategory): string {
    const item = CATEGORY_KEYS.find((x) => x.value === c);
    return item ? t(item.key) : c;
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      setError(t("fb.error.short"));
      return;
    }
    if (trimmed.length > 2000) {
      setError(t("fb.error.long"));
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
      setError(t("fb.failed_short", { error: insertError?.message ?? "unknown" }));
      return;
    }

    setFeedbackList((prev) => [data as Feedback, ...prev]);
    setMessage("");
    setCategory("general");
    toast.success(t("fb.submit_thanks"));
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[420px_1fr]">
      <form
        onSubmit={handleSubmit}
        className={`${card} ${cardPad} h-fit space-y-4 lg:sticky lg:top-20`}
      >
        <FormField label={t("fb.cat")}>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_KEYS.map((c) => (
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
                <span>{t(c.key)}</span>
              </button>
            ))}
          </div>
        </FormField>

        <FormField label={t("fb.message")} hint={t("fb.message.hint")}>
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

        <FormField label={t("fb.contact_email")} hint={t("fb.contact_email.hint")}>
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
          {busy ? t("fb.submitting") : t("fb.submit")}
        </button>
      </form>

      <div className="space-y-3">
        <SectionHeading
          title={t("fb.history.title")}
          description={t("fb.history.count", { n: feedbackList.length })}
        />

        {feedbackList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center text-sm text-muted">
            {t("fb.history.empty")}
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
                      {categoryLabel(fb.category)}
                    </span>
                    {fb.resolved ? (
                      <StatusPill tone="success">{t("fb.resolved")}</StatusPill>
                    ) : (
                      <StatusPill tone="warning">{t("fb.pending_label")}</StatusPill>
                    )}
                  </div>
                  <span className="text-[11px] text-muted">
                    {formatDateTime(fb.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-700">
                  {fb.message}
                </p>
                {fb.admin_reply ? (
                  <div className="mt-3 rounded-xl border-l-2 border-emerald-400 bg-emerald-50/40 px-3 py-2 text-sm">
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-emerald-700">
                      <span>💬 คำตอบจากทีมงาน</span>
                      {fb.replied_at ? (
                        <span className="text-muted tabular-nums">
                          · {formatDateTime(fb.replied_at)}
                        </span>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-zinc-700">
                      {fb.admin_reply}
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
