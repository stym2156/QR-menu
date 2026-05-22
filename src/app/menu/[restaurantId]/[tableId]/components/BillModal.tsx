"use client";

import { useMemo } from "react";
import { formatKIP, formatTime } from "@/lib/format";
import { calculateBill } from "@/lib/bill";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import type { Menu, Order } from "@/lib/types";
import { Sheet } from "./Sheet";
import { OrderStatusBadge } from "./OrderStatusBadge";

interface BillModalProps {
  tableNumber: number;
  menus: Menu[];
  orders: Order[];
  serviceChargePct: number;
  vatPct: number;
  onClose: () => void;
}

export function BillModal({
  tableNumber,
  menus,
  orders,
  serviceChargePct,
  vatPct,
  onClose,
}: BillModalProps) {
  const { t, locale } = useT();
  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);

  // Cancelled orders don't count toward the bill total but are still shown
  // in the list so the customer can see what was cancelled and why.
  const subtotal = useMemo(
    () =>
      orders.reduce(
        (sum, o) => (o.status === "cancelled" ? sum : sum + Number(o.total)),
        0,
      ),
    [orders],
  );
  const bill = useMemo(
    () => calculateBill(subtotal, serviceChargePct, vatPct),
    [subtotal, serviceChargePct, vatPct],
  );

  return (
    <Sheet
      onClose={onClose}
      title={t("cust.bill.title_table", { table: tableNumber })}
    >
      {orders.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted">
          {t("cust.bill.empty")}
        </div>
      ) : (
        <>
          <div className="space-y-5 py-4">
            {orders.map((order, idx) => {
              const isCancelled = order.status === "cancelled";
              return (
                <div key={order.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wider">
                    <span className="flex items-center gap-2 text-muted">
                      <span>{t("cust.bill.order_n", { n: idx + 1 })}</span>
                      <span className="text-line">·</span>
                      <span>{formatTime(order.created_at)}</span>
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  {isCancelled && order.cancel_reason ? (
                    <div className="mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span className="font-medium">{t("cust.bill.reason")}</span>{" "}
                      {order.cancel_reason}
                    </div>
                  ) : null}
                  <ul className={`space-y-1.5 ${isCancelled ? "opacity-60" : ""}`}>
                    {order.items.map((item, i) => {
                      const menu = menuMap.get(item.menu_id);
                      const lineTotal = (menu?.price ?? 0) * item.qty;
                      const displayName = menu
                        ? pickName(menu, locale)
                        : t("cust.bill.menu_removed");
                      return (
                        <li
                          key={i}
                          className="flex items-baseline justify-between gap-3 text-sm"
                        >
                          <span className={isCancelled ? "text-muted line-through" : "text-ink"}>
                            {displayName}{" "}
                            <span className="text-muted">×{item.qty}</span>
                            {item.note && (
                              <div className="text-xs text-muted">{item.note}</div>
                            )}
                          </span>
                          <span className={`tabular-nums ${isCancelled ? "text-muted line-through" : "text-ink"}`}>
                            {formatKIP(lineTotal)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="-mx-5 border-t border-line px-5 py-4 space-y-1.5">
            <div className="flex items-baseline justify-between text-sm text-muted">
              <span>{t("cust.bill.subtotal")}</span>
              <span className="tabular-nums">{formatKIP(bill.subtotal)}</span>
            </div>
            {bill.serviceChargePct > 0 ? (
              <div className="flex items-baseline justify-between text-sm text-muted">
                <span>{t("cust.bill.service")} ({bill.serviceChargePct}%)</span>
                <span className="tabular-nums">{formatKIP(bill.serviceCharge)}</span>
              </div>
            ) : null}
            {bill.vatPct > 0 ? (
              <div className="flex items-baseline justify-between text-sm text-muted">
                <span>{t("cust.bill.vat")} ({bill.vatPct}%)</span>
                <span className="tabular-nums">{formatKIP(bill.vat)}</span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-sm font-medium text-muted">
                {t("cust.bill.grand")}
              </span>
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {formatKIP(bill.grandTotal)}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">
              {t("cust.bill.pay_hint")}
            </p>
          </div>
        </>
      )}
    </Sheet>
  );
}
