"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EmptyState,
  FormField,
  buttonPrimary,
  card,
  cardPad,
  input,
} from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast";
import { formatDateTime } from "@/lib/format";

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "staff";
  invited_email: string | null;
  created_at: string;
}

interface Props {
  restaurantId: string;
  currentUserId: string;
  initialMembers: Member[];
}

export default function StaffManager({
  restaurantId,
  currentUserId,
  initialMembers,
}: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^@]+@[^@]+\.[^@]+$/.test(trimmed)) {
      setError("กรุณาใส่อีเมลให้ถูกต้อง");
      return;
    }
    setBusy(true);

    // Find user by email via Supabase. Users must already have an account.
    // We can't query auth.users from client; instead store invited_email and
    // resolve later via a database trigger or admin-side script.
    // For now: insert a placeholder row that admins can match manually,
    // or use a real lookup via a server action.
    // Simpler: look up via Supabase's identities table if accessible — not
    // available client-side. We'll require the user to already exist and
    // owner to know their user_id. As a stopgap, we'll insert with
    // invited_email and ask user to share signup link with staff.

    // Real lookup via SQL function call:
    const { data: lookup, error: lookupErr } = await supabase
      .rpc("find_user_id_by_email", { email_input: trimmed })
      .single();

    if (lookupErr || !lookup) {
      setError(
        "ไม่พบบัญชีของอีเมลนี้ — แจ้งให้ทีมงานสมัครที่ /signup ก่อน แล้วจึงเพิ่มที่นี่",
      );
      setBusy(false);
      return;
    }

    const userId = (lookup as { user_id: string }).user_id;

    const { data: inserted, error: insertErr } = await supabase
      .from("restaurant_members")
      .insert({
        restaurant_id: restaurantId,
        user_id: userId,
        role: "staff",
        invited_email: trimmed,
      })
      .select()
      .single();

    setBusy(false);

    if (insertErr || !inserted) {
      if (insertErr?.code === "23505") {
        setError("อีเมลนี้เป็นพนักงานอยู่แล้ว");
      } else {
        setError(`เพิ่มไม่สำเร็จ: ${insertErr?.message ?? "unknown"}`);
      }
      return;
    }

    setMembers((prev) => [...prev, inserted as Member]);
    setEmail("");
    toast.success(`เพิ่ม ${trimmed} เป็นพนักงานแล้ว`);
  }

  async function removeMember(m: Member): Promise<void> {
    if (m.role === "owner") {
      toast.error("ลบเจ้าของร้านไม่ได้");
      return;
    }
    if (m.user_id === currentUserId) {
      toast.error("ลบตัวเองไม่ได้");
      return;
    }
    const ok = await confirm({
      title: `ลบพนักงาน "${m.invited_email ?? m.user_id}" ออก?`,
      description: "พนักงานจะไม่สามารถเข้าใช้ระบบของร้านนี้ได้อีก",
      confirmText: "ลบออก",
      tone: "danger",
    });
    if (!ok) return;
    setMembers((prev) => prev.filter((x) => x.id !== m.id));
    const { error } = await supabase
      .from("restaurant_members")
      .delete()
      .eq("id", m.id);
    if (error) toast.error(`ลบไม่สำเร็จ: ${error.message}`);
    else toast.success("ลบพนักงานแล้ว");
  }

  return (
    <div className={`${card} ${cardPad} space-y-5`}>
      <form onSubmit={handleInvite} className="space-y-3">
        <FormField
          label="เพิ่มพนักงานจากอีเมล"
          hint="ทีมงานต้องสมัครบัญชีที่ /signup ก่อน แล้วเอาอีเมลนั้นมาใส่ที่นี่"
        >
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="staff@example.com"
              className={`${input} flex-1`}
            />
            <button
              type="submit"
              disabled={busy}
              className={`${buttonPrimary} shrink-0`}
            >
              {busy ? "..." : "เพิ่ม"}
            </button>
          </div>
        </FormField>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </form>

      <div className="border-t border-line pt-4">
        {members.length === 0 ? (
          <EmptyState title="ยังไม่มีพนักงาน" />
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas/40 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {m.invited_email ?? m.user_id}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        m.role === "owner"
                          ? "bg-ink text-surface"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {m.role === "owner" ? "เจ้าของ" : "พนักงาน"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted">
                    เพิ่มเมื่อ {formatDateTime(m.created_at)}
                  </div>
                </div>
                {m.role === "staff" && m.user_id !== currentUserId ? (
                  <button
                    onClick={() => removeMember(m)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600"
                  >
                    ลบ
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
