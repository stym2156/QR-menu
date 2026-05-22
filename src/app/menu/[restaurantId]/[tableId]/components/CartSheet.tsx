"use client";

import Image from "next/image";
import { useMemo } from "react";
import { formatKIP } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import type { Menu } from "@/lib/types";
import { Sheet } from "./Sheet";
import type { CartLine } from "../hooks/useCart";

interface CartSheetProps {
  cart: Record<string, CartLine>;
  menuMap: Map<string, Menu>;
  shopOpen: boolean;
  submitting: boolean;
  onClose: () => void;
  onAdd: (menuId: string) => void;
  onRemove: (menuId: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  onEditNote: (menuId: string) => void;
}

export function CartSheet({
  cart,
  menuMap,
  shopOpen,
  submitting,
  onClose,
  onAdd,
  onRemove,
  onClear,
  onSubmit,
  onEditNote,
}: CartSheetProps) {
  const { t, locale } = useT();

  const lines = useMemo(() => {
    const out: Array<{ line: CartLine; menu: Menu }> = [];
    for (const line of Object.values(cart)) {
      const menu = menuMap.get(line.menuId);
      if (menu) out.push({ line, menu });
    }
    return out;
  }, [cart, menuMap]);

  const { totalQty, totalPrice } = useMemo(() => {
    let qty = 0;
    let price = 0;
    for (const { line, menu } of lines) {
      qty += line.qty;
      price += line.qty * Number(menu.price);
    }
    return { totalQty: qty, totalPrice: price };
  }, [lines]);

  return (
    <Sheet title={t("cust.cart.title")} onClose={onClose}>
      {lines.length === 0 ? (
        <div className="px-2 py-12 text-center text-sm text-muted">
          {t("cust.cart.empty.desc")}
        </div>
      ) : (
        <>
          <ul className="space-y-3 pt-3">
            {lines.map(({ line, menu }) => {
              const lineTotal = line.qty * Number(menu.price);
              return (
                <li
                  key={menu.id}
                  className="flex gap-3 rounded-2xl border border-line bg-canvas/40 p-3"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">
                    {menu.image_url ? (
                      <Image
                        src={menu.image_url}
                        alt={pickName(menu, locale)}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">
                        —
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-sm font-medium leading-snug text-ink">
                          {pickName(menu, locale)}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted tabular-nums">
                          {formatKIP(menu.price)} {t("cust.cart.unit_price")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          for (let i = 0; i < line.qty; i++) onRemove(menu.id);
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-600"
                        aria-label={t("cust.cart.remove_item")}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="h-4 w-4"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onEditNote(menu.id)}
                      className={`self-start text-[11px] font-medium transition ${
                        line.note ? "text-accent-600" : "text-muted hover:text-ink"
                      }`}
                    >
                      {line.note ? `📝 ${line.note}` : `+ ${t("cust.note_add")}`}
                    </button>

                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-0.5">
                        <button
                          type="button"
                          onClick={() => onRemove(menu.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-ink transition hover:bg-canvas"
                          aria-label={t("cust.dec")}
                        >
                          −
                        </button>
                        <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAdd(menu.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-surface transition active:scale-90"
                          aria-label={t("cust.inc")}
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-ink">
                        {formatKIP(lineTotal)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm font-medium text-muted">
              {t("cust.cart.subtotal")}
              <span className="ml-1.5 text-xs">
                ({t("cust.items_count", { count: totalQty })})
              </span>
            </span>
            <span className="text-lg font-bold tabular-nums text-ink">
              {formatKIP(totalPrice)}
            </span>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClear}
              disabled={submitting}
              className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border border-line bg-surface px-3.5 text-sm font-medium text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              aria-label={t("cust.clear_cart.button")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 7 1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M3 7h18" />
              </svg>
              <span className="hidden sm:inline">{t("cust.clear_cart.button")}</span>
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !shopOpen}
              className="flex flex-1 items-center justify-between rounded-2xl bg-ink px-5 py-3 text-surface shadow-ink transition active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-surface/15 px-1.5 text-xs font-semibold tabular-nums">
                  {totalQty}
                </span>
                <span className="text-sm font-medium">
                  {!shopOpen
                    ? t("cust.shop_closed_short")
                    : submitting
                      ? t("cust.sending")
                      : t("cust.submit_order")}
                </span>
              </span>
              <span className="text-base font-semibold tabular-nums">
                {formatKIP(totalPrice)}
              </span>
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
