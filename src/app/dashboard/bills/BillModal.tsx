"use client";

import { useState } from "react";
import { formatKIP, formatTime } from "@/lib/format";
import { calculateBill } from "@/lib/bill";
import { buttonPrimary } from "@/components/ui";
import type { DiningTable, Menu, Order, PaymentMethod } from "@/lib/types";

export interface BillGroup {
  tableId: string;
  table: DiningTable | undefined;
  orders: Order[];
  total: number;
  itemCount: number;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: "cash", label: "เงินสด", icon: "💵" },
  { value: "promptpay", label: "พร้อมเพย์", icon: "📱" },
  { value: "transfer", label: "โอน", icon: "🏦" },
  { value: "card", label: "บัตร", icon: "💳" },
  { value: "other", label: "อื่นๆ", icon: "•" },
];

interface BillModalProps {
  group: BillGroup;
  menuMap: Map<string, Menu>;
  serviceChargePct: number;
  vatPct: number;
  onClose: () => void;
  onSettle: (method: PaymentMethod) => Promise<void>;
}

export function BillModal({
  group,
  menuMap,
  serviceChargePct,
  vatPct,
  onClose,
  onSettle,
}: BillModalProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const bill = calculateBill(group.total, serviceChargePct, vatPct);

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
              บิลโต๊ะที่ {group.table?.table_number}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="space-y-5">
            {group.orders.map((order, idx) => (
              <div key={order.id}>
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted">
                  <span>ออเดอร์ #{idx + 1}</span>
                  <span>{formatTime(order.created_at)}</span>
                </div>
                <ul className="space-y-1.5">
                  {order.items.map((item, i) => {
                    const menu = menuMap.get(item.menu_id);
                    const lineTotal = (menu?.price ?? 0) * item.qty;
                    return (
                      <li
                        key={i}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 flex-1 text-ink">
                          {menu?.name ?? "(เมนูถูกลบ)"}{" "}
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
            <BillLine label="ยอดรวมรายการ" value={bill.subtotal} muted />
            {bill.serviceChargePct > 0 ? (
              <BillLine
                label={`Service charge (${bill.serviceChargePct}%)`}
                value={bill.serviceCharge}
                muted
              />
            ) : null}
            {bill.vatPct > 0 ? (
              <BillLine
                label={`VAT (${bill.vatPct}%)`}
                value={bill.vat}
                muted
              />
            ) : null}
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-sm font-medium text-muted">ยอดสุทธิ</span>
              <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink">
                {formatKIP(bill.grandTotal)}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted">
              วิธีชำระเงิน
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
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSettle}
            disabled={busy}
            className={`${buttonPrimary} mt-6 w-full py-3.5 text-base`}
          >
            {busy ? "กำลังบันทึก..." : `รับชำระ ${formatKIP(bill.grandTotal)}`}
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
