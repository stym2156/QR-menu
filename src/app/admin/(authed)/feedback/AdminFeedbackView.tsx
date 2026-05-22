"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill, buttonPrimary, card, cardPad, input } from "@/components/ui";
import { useToast } from "@/components/toast";
import { formatDateTime } from "@/lib/format";
import type { Feedback, FeedbackCategory } from "@/lib/types";

interface FeedbackWithRestaurant extends Feedback {
  restaurant_name: string | null;
}

const CATEGORIES: Array<{ value: FeedbackCategory; label: string; icon: string }> = [
  { value: "bug", label: "Bug", icon: "🐞" },
  { value: "feature", label: "Feature", icon: "✨" },
  { value: "question", label: "คำถาม", icon: "❓" },
  { value: "general", label: "ทั่วไป", icon: "💬" },
];

type ResolvedFilter = "all" | "pending" | "resolved";

interface Props {
  initialFeedback: FeedbackWithRestaurant[];
}

export default function AdminFeedbackView({ initialFeedback }: Props) {
  const supabase = createClient();
  const toast = useToast();

  const [feedback, setFeedback] = useState<FeedbackWithRestaurant[]>(initialFeedback);
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | "all">(
    "all",
  );
  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const visible = useMemo(() => {
    return feedback.filter((f) => {
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (resolvedFilter === "pending" && f.resolved) return false;
      if (resolvedFilter === "resolved" && !f.resolved) return false;
      return true;
    });
  }, [feedback, categoryFilter, resolvedFilter]);

  const counts = useMemo(() => {
    return {
      pending: feedback.filter((f) => !f.resolved).length,
      resolved: feedback.filter((f) => f.resolved).length,
    };
  }, [feedback]);

  async function toggleResolved(fb: FeedbackWithRestaurant): Promise<void> {
    setBusyId(fb.id);
    const next = !fb.resolved;
    const { error } = await supabase
      .from("feedback")
      .update({ resolved: next })
      .eq("id", fb.id);
    setBusyId(null);
    if (error) {
      toast.error(`อัปเดตไม่สำเร็จ: ${error.message}`);
      return;
    }
    setFeedback((prev) =>
      prev.map((x) => (x.id === fb.id ? { ...x, resolved: next } : x)),
    );
    toast.success(next ? "ทำเครื่องหมาย: แก้ไขแล้ว" : "เปิดเรื่องกลับมาแล้ว");
  }

  function startReply(fb: FeedbackWithRestaurant): void {
    setReplyOpenId(fb.id);
    setReplyDraft(fb.admin_reply ?? "");
  }

  function cancelReply(): void {
    setReplyOpenId(null);
    setReplyDraft("");
  }

  async function saveReply(fb: FeedbackWithRestaurant): Promise<void> {
    const trimmed = replyDraft.trim();
    if (!trimmed) {
      toast.error("กรุณาพิมพ์ข้อความตอบกลับ");
      return;
    }
    setBusyId(fb.id);
    const now = new Date().toISOString();
    // Auto-mark resolved when admin sends a reply for the first time.
    const shouldAutoResolve = !fb.resolved && !fb.admin_reply;
    const patch: Partial<Feedback> = {
      admin_reply: trimmed,
      replied_at: now,
      ...(shouldAutoResolve ? { resolved: true } : {}),
    };
    const { error } = await supabase
      .from("feedback")
      .update(patch)
      .eq("id", fb.id);
    setBusyId(null);
    if (error) {
      toast.error(`ส่งคำตอบไม่สำเร็จ: ${error.message}`);
      return;
    }
    setFeedback((prev) =>
      prev.map((x) => (x.id === fb.id ? { ...x, ...patch } : x)),
    );
    setReplyOpenId(null);
    setReplyDraft("");
    toast.success(fb.admin_reply ? "แก้ไขคำตอบแล้ว" : "ส่งคำตอบแล้ว");
  }

  function categoryMeta(c: FeedbackCategory): { icon: string; label: string } {
    const item = CATEGORIES.find((x) => x.value === c);
    return item ?? { icon: "💬", label: c };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterButton
          label={`ค้างอยู่ (${counts.pending})`}
          active={resolvedFilter === "pending"}
          onClick={() => setResolvedFilter("pending")}
        />
        <FilterButton
          label={`แก้ไขแล้ว (${counts.resolved})`}
          active={resolvedFilter === "resolved"}
          onClick={() => setResolvedFilter("resolved")}
        />
        <FilterButton
          label="ทั้งหมด"
          active={resolvedFilter === "all"}
          onClick={() => setResolvedFilter("all")}
        />
        <span className="mx-2 hidden h-5 w-px bg-line sm:inline-block" />
        <FilterButton
          label="ทุกหมวด"
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
        />
        {CATEGORIES.map((c) => (
          <FilterButton
            key={c.value}
            label={`${c.icon} ${c.label}`}
            active={categoryFilter === c.value}
            onClick={() => setCategoryFilter(c.value)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center text-sm text-muted">
          ไม่มีข้อความตามเงื่อนไขที่เลือก
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((fb) => {
            const meta = categoryMeta(fb.category);
            const replyOpen = replyOpenId === fb.id;
            return (
              <li key={fb.id} className={`${card} ${cardPad} space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{meta.icon}</span>
                    <span className="text-xs font-medium text-ink">
                      {meta.label}
                    </span>
                    {fb.resolved ? (
                      <StatusPill tone="success">แก้ไขแล้ว</StatusPill>
                    ) : (
                      <StatusPill tone="warning">รอตรวจสอบ</StatusPill>
                    )}
                    {fb.admin_reply ? (
                      <StatusPill tone="success">ตอบแล้ว</StatusPill>
                    ) : null}
                  </div>
                  <span className="text-[11px] tabular-nums text-muted">
                    {formatDateTime(fb.created_at)}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-sm text-ink/90">
                  {fb.message}
                </p>

                {fb.admin_reply && !replyOpen ? (
                  <div className="rounded-xl border-l-2 border-emerald-400 bg-emerald-50/40 px-3 py-2 text-sm">
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-emerald-700">
                      <span>💬 คำตอบของ Admin</span>
                      {fb.replied_at ? (
                        <span className="text-muted tabular-nums">
                          · {formatDateTime(fb.replied_at)}
                        </span>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-ink/90">
                      {fb.admin_reply}
                    </p>
                  </div>
                ) : null}

                {replyOpen ? (
                  <div className="space-y-2 rounded-xl border border-line bg-canvas/40 p-3">
                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="พิมพ์ข้อความตอบกลับเจ้าของร้าน..."
                      autoFocus
                      className={`${input} resize-none`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted tabular-nums">
                        {replyDraft.length} / 2,000
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelReply}
                          disabled={busyId === fb.id}
                          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-ink/30 hover:text-ink disabled:opacity-50"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="button"
                          onClick={() => saveReply(fb)}
                          disabled={busyId === fb.id}
                          className={`${buttonPrimary} px-3 py-1.5 text-xs disabled:opacity-60`}
                        >
                          {busyId === fb.id
                            ? "กำลังส่ง..."
                            : fb.admin_reply
                              ? "บันทึกการแก้ไข"
                              : "ส่งคำตอบ"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
                  <div className="space-y-0.5 text-muted">
                    {fb.restaurant_id ? (
                      <div>
                        ร้าน:{" "}
                        <Link
                          href={`/admin/restaurants/${fb.restaurant_id}`}
                          className="font-medium text-ink hover:text-accent-600"
                        >
                          {fb.restaurant_name ?? "(ไม่ทราบชื่อ)"}
                        </Link>
                      </div>
                    ) : (
                      <div className="italic">ไม่มีร้านผูกกับข้อความนี้</div>
                    )}
                    {fb.email ? (
                      <div>
                        ติดต่อกลับ:{" "}
                        <a
                          href={`mailto:${fb.email}`}
                          className="font-medium text-ink hover:text-accent-600"
                        >
                          {fb.email}
                        </a>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {!replyOpen ? (
                      <button
                        type="button"
                        onClick={() => startReply(fb)}
                        disabled={busyId === fb.id}
                        className="rounded-lg border border-accent-200 bg-accent-50 px-3 py-1.5 font-medium text-accent-700 transition hover:bg-accent-100 disabled:opacity-50"
                      >
                        {fb.admin_reply ? "แก้ไขคำตอบ" : "✏️ ตอบกลับ"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleResolved(fb)}
                      disabled={busyId === fb.id}
                      className={`rounded-lg border px-3 py-1.5 font-medium transition disabled:opacity-60 ${
                        fb.resolved
                          ? "border-line bg-surface text-muted hover:border-ink/30 hover:text-ink"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {busyId === fb.id
                        ? "กำลังบันทึก..."
                        : fb.resolved
                          ? "เปิดเรื่อง"
                          : "✓ มาร์กแก้แล้ว"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface FilterButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterButton({ label, active, onClick }: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-ink bg-ink text-surface"
          : "border-line bg-surface text-muted hover:border-ink/30 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
