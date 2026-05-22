"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";

interface CancelOrderDialogProps {
  tableNumber: number | string;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}

export function CancelOrderDialog({
  tableNumber,
  onConfirm,
  onClose,
}: CancelOrderDialogProps) {
  const { t } = useT();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const presets = [
    t("cancel.preset.out_alt"),
    t("cancel.preset.cust_change"),
    t("cancel.preset.dup"),
    t("cancel.preset.equipment"),
  ];

  async function submit(presetReason?: string): Promise<void> {
    const finalReason = (presetReason ?? reason).trim();
    if (!finalReason) return;
    setBusy(true);
    await onConfirm(finalReason);
    // dialog closer is responsible for unmounting; don't reset busy
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center animate-fade-in bg-ink/40 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-slide-up overflow-hidden rounded-2xl bg-surface shadow-pop"
      >
        <div className="px-5 pt-5">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            {t("cancel.title_table", { n: tableNumber })}
          </h3>
          <p className="mt-1.5 text-sm text-muted">{t("cancel.desc")}</p>
        </div>

        <div className="space-y-3 px-5 pt-4">
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
              {t("cancel.preset_header")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => submit(preset)}
                  disabled={busy}
                  className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm font-medium text-ink transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs uppercase tracking-wider text-muted">
              {t("cancel.or")}
            </span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("cancel.placeholder_self")}
            maxLength={200}
            rows={2}
            autoFocus
            disabled={busy}
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-ink focus:bg-surface focus:outline-none disabled:opacity-50"
          />
        </div>

        <div className="mt-4 flex gap-2 border-t border-line bg-canvas/40 px-5 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-canvas disabled:opacity-50"
          >
            {t("cancel.keep")}
          </button>
          <button
            onClick={() => submit()}
            disabled={busy || !reason.trim()}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-surface transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? t("cancel.submitting") : t("cancel.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
