"use client";

import { useMemo } from "react";
import { formatKIP, formatTime } from "@/lib/format";
import { calculateBill } from "@/lib/bill";
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
  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);

  const subtotal = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.total), 0),
    [orders],
  );
  const bill = useMemo(
    () => calculateBill(subtotal, serviceChargePct, vatPct),
    [subtotal, serviceChargePct, vatPct],
  );

  return (
    <Sheet onClose={onClose} title={`ออเดอร์โต๊ะที่ ${tableNumber}`}>
      {orders.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted">
          ยังไม่มีออเดอร์
        </div>
      ) : (
        <>
          <div className="space-y-5 py-4">
            {orders.map((order, idx) => (
              <div key={order.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wider">
                  <span className="flex items-center gap-2 text-muted">
                    <span>ออเดอร์ #{idx + 1}</span>
                    <span className="text-line">·</span>
                    <span>{formatTime(order.created_at)}</span>
                  </span>
                  <OrderStatusBadge status={order.status} />
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
                        <span className="text-ink">
                          {menu?.name ?? "(เมนูถูกลบ)"}{" "}
                          <span className="text-muted">×{item.qty}</span>
                          {item.note && (
                            <div className="text-xs text-muted">{item.note}</div>
                          )}
                        </span>
                        <span className="tabular-nums text-ink">
                          {formatKIP(lineTotal)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="-mx-5 border-t border-line px-5 py-4 space-y-1.5">
            <div className="flex items-baseline justify-between text-sm text-muted">
              <span>ยอดรวมรายการ</span>
              <span className="tabular-nums">{formatKIP(bill.subtotal)}</span>
            </div>
            {bill.serviceChargePct > 0 ? (
              <div className="flex items-baseline justify-between text-sm text-muted">
                <span>Service charge ({bill.serviceChargePct}%)</span>
                <span className="tabular-nums">{formatKIP(bill.serviceCharge)}</span>
              </div>
            ) : null}
            {bill.vatPct > 0 ? (
              <div className="flex items-baseline justify-between text-sm text-muted">
                <span>VAT ({bill.vatPct}%)</span>
                <span className="tabular-nums">{formatKIP(bill.vat)}</span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-sm font-medium text-muted">ยอดสุทธิ</span>
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {formatKIP(bill.grandTotal)}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">
              กรุณาแจ้งพนักงานเพื่อชำระเงิน
            </p>
          </div>
        </>
      )}
    </Sheet>
  );
}
