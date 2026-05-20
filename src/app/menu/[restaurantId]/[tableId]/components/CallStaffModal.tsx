"use client";

import { useState } from "react";
import { callStaff } from "../actions";
import { Sheet } from "./Sheet";

interface CallStaffModalProps {
  restaurantId: string;
  tableId: string;
  onClose: () => void;
}

export function CallStaffModal({
  restaurantId,
  tableId,
  onClose,
}: CallStaffModalProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(presetReason?: string): Promise<void> {
    setBusy(true);
    setError(null);
    const text = presetReason ?? reason;
    const result = await callStaff({
      restaurantId,
      tableId,
      reason: text.trim() || null,
    });
    if (!result.ok) {
      setError(`เรียกไม่สำเร็จ: ${result.error}`);
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    setTimeout(onClose, 1800);
  }

  return (
    <Sheet onClose={onClose} title="เรียกพนักงาน">
      {done ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
            ✓
          </div>
          <p className="font-medium text-ink">เรียกพนักงานแล้ว</p>
          <p className="mt-1 text-sm text-muted">กำลังไปเดี๋ยวนี้</p>
        </div>
      ) : (
        <div className="space-y-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {["ขอน้ำเพิ่ม", "ขอช้อนส้อม", "ขอกระดาษ", "ขอเช็คบิล"].map((preset) => (
              <button
                key={preset}
                onClick={() => submit(preset)}
                disabled={busy}
                className="rounded-xl border border-line bg-canvas px-3 py-3 text-sm font-medium text-ink transition hover:border-ink/30 hover:bg-surface disabled:opacity-50"
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs uppercase tracking-wider text-muted">หรือ</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="พิมพ์ที่ต้องการ..."
            maxLength={200}
            rows={2}
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-ink focus:bg-surface focus:outline-none"
          />

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            onClick={() => submit()}
            disabled={busy}
            className="w-full rounded-xl bg-accent-600 px-4 py-3 text-sm font-medium text-surface shadow-ink transition hover:bg-accent-700 disabled:opacity-50"
          >
            {busy ? "กำลังส่ง..." : "เรียกพนักงาน"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
