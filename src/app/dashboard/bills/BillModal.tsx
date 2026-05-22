"use client";

import { useState } from "react";
import { formatKIP, formatTime } from "@/lib/format";
import { calculateBill } from "@/lib/bill";
import { buttonPrimary } from "@/components/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import type { DiningTable, Menu, Order, PaymentMethod } from "@/lib/types";

export interface BillGroup {
  tableId: string;
  table: DiningTable | undefined;
  orders: Order[];
  total: number;
  itemCount: number;
}

const PAYMENT_METHODS: { value: PaymentMethod; icon: string }[] = [
  { value: "cash", icon: "💵" },
  { value: "promptpay", icon: "📱" },
  { value: "transfer", icon: "🏦" },
  { value: "card", icon: "💳" },
  { value: "other", icon: "•" },
];

interface BillModalProps {
  group: BillGroup;
  menuMap: Map<string, Menu>;
  serviceChargePct: number;
  vatPct: number;
  canAct: boolean;
  onClose: () => void;
  onSettle: (method: PaymentMethod) => Promise<void>;
}

export function BillModal({
  group,
  menuMap,
  serviceChargePct,
  vatPct,
  canAct,
  onClose,
  onSettle,
}: BillModalProps) {
  const { t, locale } = useT();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const bill = calculateBill(group.total, serviceChargePct, vatPct);

  // Block settle until the kitchen has marked every (non-cancelled) order
  // as served. Cancelled orders are excluded from the count because they
  // don't need to be served.
  const pendingServeCount = group.orders.filter(
    (o) => o.status !== "served" && o.status !== "cancelled",
  ).length;
  const canSettle = canAct && pendingServeCount === 0;

  async function handleSettle(): Promise<void> {
    setBusy(true);
    await onSettle(method);
    setBusy(false);
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end animate-fade-in bg-ink/30 sm:items-center sm:justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full animate-slide-up overflow-y-auto rounded-t-3xl bg-surface sm:max-w-lg sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-sm font-semibold tabular-nums text-surface">
              {group.table?.table_number}
            </span>
            <h3 className="text-base font-semibold tracking-tight text-ink">
              {t("bill.modal.title", { n: group.table?.table_number ?? "?" })}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="space-y-5">
            {group.orders.map((order, idx) => (
              <div key={order.id}>
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted">
                  <span>{t("bill.modal.order_n", { n: idx + 1 })}</span>
                  <span>{formatTime(order.created_at)}</span>
                </div>
                <ul className="space-y-1.5">
                  {order.items.map((item, i) => {
                    const menu = menuMap.get(item.menu_id);
                    const lineTotal = (menu?.price ?? 0) * item.qty;
                    const name = menu ? pickName(menu, locale) : t("kit.no_menu");
                    return (
                      <li
                        key={i}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 flex-1 text-ink">
                          {name}{" "}
                          <span className="text-muted">×{item.qty}</span>
                          {item.note ? (
                            <div className="text-xs text-muted">📝 {item.note}</div>
                          ) : null}
                        </span>
                        <span className="shrink-0 tabular-nums text-ink">
                          {formatKIP(lineTotal)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-1.5 rounded-2xl bg-canvas p-4">
            <BillLine label={t("bill.modal.subtotal")} value={bill.subtotal} muted />
            {bill.serviceChargePct > 0 ? (
              <BillLine
                label={t("bill.modal.service", { pct: bill.serviceChargePct })}
                value={bill.serviceCharge}
                muted
              />
            ) : null}
            {bill.vatPct > 0 ? (
              <BillLine
                label={t("bill.modal.vat", { pct: bill.vatPct })}
                value={bill.vat}
                muted
              />
            ) : null}
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-sm font-medium text-muted">
                {t("bill.modal.grand")}
              </span>
              <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink">
                {formatKIP(bill.grandTotal)}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted">
              {t("bill.modal.pay_method")}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition ${
                    method === m.value
                      ? "border-ink bg-ink text-surface"
                      : "border-line bg-surface text-ink hover:border-ink/30"
                  }`}
                >
                  <span className="text-base leading-none">{m.icon}</span>
                  <span>{t(`bill.settled.method.${m.value}`)}</span>
                </button>
              ))}
            </div>
          </div>

          {!canAct ? (
            <p className="mt-4 rounded-xl border border-line bg-canvas/50 px-3 py-2 text-xs text-muted">
              {t("bill.modal.read_only")}
            </p>
          ) : pendingServeCount > 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("bill.modal.cant_settle_yet", { n: pendingServeCount })}
            </p>
          ) : null}

          <button
            onClick={handleSettle}
            disabled={busy || !canSettle}
            className={`${buttonPrimary} mt-6 w-full py-3.5 text-base`}
          >
            {busy
              ? t("bill.modal.settling")
              : t("bill.modal.settle_now", { amount: formatKIP(bill.grandTotal) })}
          </button>
        </div>
      </div>
    </div>
  );
}

function BillLine({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between text-sm ${
        muted ? "text-muted" : "text-ink"
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatKIP(value)}</span>
    </div>
  );
}
