"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
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
  const { t } = useT();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    t("cust.call.preset.water"),
    t("cust.call.preset.utensils"),
    t("cust.call.preset.tissue"),
    t("cust.call.preset.bill"),
  ];

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
      setError(t("cust.call.failed", { error: result.error ?? "" }));
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    setTimeout(onClose, 1800);
  }

  return (
    <Sheet onClose={onClose} title={t("cust.call_staff.title")}>
      {done ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
            ✓
          </div>
          <p className="font-medium text-ink">{t("cust.call.done")}</p>
          <p className="mt-1 text-sm text-muted">{t("cust.call.coming")}</p>
        </div>
      ) : (
        <div className="space-y-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
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
            <span className="text-xs uppercase tracking-wider text-muted">
              {t("cust.call.or")}
            </span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("cust.call.placeholder")}
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
            {busy ? t("cust.sending") : t("cust.call_staff.submit")}
          </button>
        </div>
      )}
    </Sheet>
  );
}
