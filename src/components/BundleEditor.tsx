"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import type { MenuBundle } from "@/lib/types";

interface BundleEditorProps {
  bundles: MenuBundle[];
  onChange: (next: MenuBundle[]) => void;
  unitPrice?: number;
}

export default function BundleEditor({
  bundles,
  onChange,
  unitPrice,
}: BundleEditorProps) {
  const { t } = useT();
  const [label, setLabel] = useState("");
  const [qty, setQty] = useState("");

  function addBundle(): void {
    const trimmedLabel = label.trim();
    const numQty = parseInt(qty, 10);
    if (!trimmedLabel || !Number.isFinite(numQty) || numQty <= 0) return;
    onChange([...bundles, { label: trimmedLabel, qty: numQty }]);
    setLabel("");
    setQty("");
  }

  function removeBundle(idx: number): void {
    onChange(bundles.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {bundles.length > 0 ? (
        <ul className="space-y-1.5">
          {bundles.map((b, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-ink">{b.label}</span>
                <span className="ml-2 text-xs tabular-nums text-muted">
                  ×{b.qty}
                  {unitPrice != null && unitPrice > 0
                    ? ` · ₭${(unitPrice * b.qty).toLocaleString("th-TH")}`
                    : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeBundle(idx)}
                className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-red-50 hover:text-red-600"
                aria-label={t("bundle.remove_aria")}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addBundle();
            }
          }}
          placeholder={t("bundle.placeholder_label")}
          maxLength={32}
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 outline-none focus:border-ink/30 focus:ring-2 focus:ring-ink/5"
        />
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addBundle();
            }
          }}
          placeholder={t("bundle.placeholder_qty")}
          className="w-20 rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums text-ink placeholder:text-muted/70 outline-none focus:border-ink/30 focus:ring-2 focus:ring-ink/5"
        />
        <button
          type="button"
          onClick={addBundle}
          className="rounded-lg bg-ink px-3 py-2 text-xs font-medium text-surface transition hover:bg-ink/85"
        >
          +
        </button>
      </div>

      {bundles.length === 0 ? (
        <p className="text-[11px] text-muted">{t("bundle.hint")}</p>
      ) : null}
    </div>
  );
}
