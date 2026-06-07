"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKIP } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmDialog";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import { placeOrder } from "./actions";
import { useCart } from "./hooks/useCart";
import { useTableOrders } from "./hooks/useTableOrders";
import { BillModal } from "./components/BillModal";
import { CallStaffModal } from "./components/CallStaffModal";
import { CartSheet } from "./components/CartSheet";
import { FilterChip } from "./components/FilterChip";
import { FloatingButton } from "./components/FloatingButton";
import { MenuCard } from "./components/MenuCard";
import { PromotionStrip } from "./components/PromotionStrip";
import type {
  Category,
  Menu,
  OrderItem,
  Promotion,
} from "@/lib/types";

interface Props {
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  menus: Menu[];
  categories: Category[];
  promotions: Promotion[];
  shopOpen?: boolean;
  serviceChargePct?: number;
  vatPct?: number;
}

type Group = {
  id: string | null;
  name: string;
  items: Menu[];
};

export default function CustomerOrder({
  restaurantId,
  tableId,
  tableNumber,
  menus,
  categories,
  promotions,
  shopOpen = true,
  serviceChargePct = 0,
  vatPct = 0,
}: Props) {
  const confirm = useConfirm();
  const { t, locale } = useT();
  const supabase = useMemo(() => createClient(), []);
  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);
  const validMenuIds = useMemo(() => new Set(menus.map((m) => m.id)), [menus]);

  const { cart, add, remove, setNote, clear } = useCart({
    storageKey: `shopqr.cart.${restaurantId}.${tableId}`,
    validMenuIds,
  });
  const tableOrders = useTableOrders({ supabase, restaurantId, tableId });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteEditing, setNoteEditing] = useState<string | null>(null);
  const [showBill, setShowBill] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | "all">("all");

  const activeOrders = useMemo(
    () => tableOrders.filter((o) => !o.paid),
    [tableOrders],
  );
  const readyCount = useMemo(
    () => activeOrders.filter((o) => o.status === "ready").length,
    [activeOrders],
  );

  const grouped = useMemo<Group[]>(() => {
    const groups: Group[] = [];
    const indexById = new Map<string | null, number>();
    for (const c of categories) {
      indexById.set(c.id, groups.length);
      groups.push({ id: c.id, name: pickName(c, locale), items: [] });
    }
    const uncategorised: Menu[] = [];
    for (const m of menus) {
      if (m.category_id && indexById.has(m.category_id)) {
        groups[indexById.get(m.category_id)!].items.push(m);
      } else {
        uncategorised.push(m);
      }
    }
    if (uncategorised.length > 0) {
      groups.push({ id: null, name: t("cust.uncategorized"), items: uncategorised });
    }
    return groups.filter((g) => g.items.length > 0);
  }, [menus, categories, locale, t]);

  const visibleGroups = useMemo(() => {
    if (activeFilter === "all") return grouped;
    return grouped.filter((g) => (g.id ?? "uncat") === activeFilter);
  }, [grouped, activeFilter]);

  const { totalQty, totalPrice } = useMemo(() => {
    let qty = 0;
    let price = 0;
    for (const line of Object.values(cart)) {
      const m = menuMap.get(line.menuId);
      if (!m) continue;
      qty += line.qty;
      price += line.qty * Number(m.price);
    }
    return { totalQty: qty, totalPrice: price };
  }, [cart, menuMap]);

  async function submitOrder(): Promise<void> {
    if (totalQty === 0) return;
    if (!shopOpen) {
      setError(t("cust.shop_closed_cant_order"));
      return;
    }
    setSubmitting(true);
    setError(null);

    const items: OrderItem[] = Object.values(cart).map((line) => ({
      menu_id: line.menuId,
      qty: line.qty,
      ...(line.note.trim() ? { note: line.note.trim() } : {}),
    }));

    // Server action validates table↔restaurant, menu↔restaurant, availability,
    // shop hours, and recomputes total from DB prices to prevent tampering.
    const result = await placeOrder({ restaurantId, tableId, items });

    if (!result.ok) {
      setError(t("cust.submit_failed", { error: result.error ?? "" }));
      setSubmitting(false);
      return;
    }

    clear();
    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => setSuccess(false), 4000);
  }

  if (menus.length === 0) {
    return (
      <div className="px-5 py-16 text-center text-muted">
        {t("cust.no_menus")}
      </div>
    );
  }

  return (
    <>
      {promotions.length > 0 && <PromotionStrip promotions={promotions} />}

      {grouped.length > 1 && (
        <div className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur-md">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
            <FilterChip
              label={t("cust.filter.all")}
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            />
            {grouped.map((g) => {
              const key = g.id ?? "uncat";
              return (
                <FilterChip
                  key={key}
                  label={g.name}
                  active={activeFilter === key}
                  onClick={() => setActiveFilter(key)}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-8 px-5 pt-6">
        {visibleGroups.map((group) => (
          <section key={group.id ?? "uncat"}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-semibold tracking-tight text-ink">
                {group.name}
              </h2>
              <span className="text-xs text-muted">
                {t("cust.items_count", { count: group.items.length })}
              </span>
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.items.map((menu) => {
                const line = cart[menu.id];
                const qty = line?.qty ?? 0;
                const note = line?.note ?? "";
                const isEditingNote = noteEditing === menu.id;
                return (
                  <MenuCard
                    key={menu.id}
                    menu={menu}
                    qty={qty}
                    note={note}
                    editingNote={isEditingNote}
                    onAdd={() => add(menu.id)}
                    onRemove={() => remove(menu.id)}
                    onToggleNote={() => setNoteEditing(isEditingNote ? null : menu.id)}
                    onNoteChange={(v) => setNote(menu.id, v)}
                    onCloseNote={() => setNoteEditing(null)}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-20 flex flex-col items-end gap-2">
        <FloatingButton
          icon={readyCount > 0 ? "🍽" : "🧾"}
          label={
            activeOrders.length > 0
              ? t("cust.your_orders_n", { count: activeOrders.length })
              : t("cust.view_bill")
          }
          onClick={() => setShowBill(true)}
          badge={readyCount > 0 ? t("cust.ready_badge") : null}
        />
        <FloatingButton
          icon="🛎"
          label={t("cust.call_staff")}
          onClick={() => setCallOpen(true)}
          accent
        />
      </div>

      {success && (
        <div className="fixed inset-x-0 top-4 z-30 mx-auto flex w-fit animate-slide-up items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-surface shadow-pop">
          <span className="text-emerald-400">✓</span>
          {t("cust.order_sent_long")}
        </div>
      )}

      {totalQty > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
          {error && (
            <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: t("cust.clear_cart.title"),
                  description: t("cust.clear_cart.desc"),
                  confirmText: t("cust.clear_cart.confirm"),
                  tone: "danger",
                });
                if (ok) clear();
              }}
              disabled={submitting}
              className="flex h-[3.25rem] shrink-0 items-center gap-1.5 rounded-2xl border border-line bg-surface px-3.5 text-sm font-medium text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
              onClick={() => setCartOpen(true)}
              disabled={submitting}
              className="relative flex h-[3.25rem] shrink-0 items-center justify-center rounded-2xl border border-line bg-surface px-3.5 text-ink transition hover:border-ink/30 hover:bg-canvas disabled:opacity-50"
              aria-label={t("cust.cart")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13l-1.6-8M7 13l-2.3 6h13.6M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
              </svg>
              {totalQty > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-surface">
                  {totalQty > 99 ? "99+" : totalQty}
                </span>
              ) : null}
            </button>
            <button
              onClick={submitOrder}
              disabled={submitting || !shopOpen}
              className="group flex flex-1 items-center justify-between rounded-2xl bg-ink px-5 py-3.5 text-surface shadow-ink transition active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-blue-500/15 px-1.5 text-xs font-semibold text-blue-400 tabular-nums">
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
        </div>
      )}

      {showBill && (
        <BillModal
          restaurantId={restaurantId}
          tableId={tableId}
          tableNumber={tableNumber}
          menus={menus}
          orders={activeOrders}
          serviceChargePct={serviceChargePct}
          vatPct={vatPct}
          onClose={() => setShowBill(false)}
        />
      )}

      {callOpen && (
        <CallStaffModal
          restaurantId={restaurantId}
          tableId={tableId}
          onClose={() => setCallOpen(false)}
        />
      )}

      {cartOpen && (
        <CartSheet
          cart={cart}
          menuMap={menuMap}
          shopOpen={shopOpen}
          submitting={submitting}
          onClose={() => setCartOpen(false)}
          onAdd={(menuId) => add(menuId)}
          onRemove={(menuId) => remove(menuId)}
          onClear={async () => {
            const ok = await confirm({
              title: t("cust.clear_cart.title"),
              description: t("cust.clear_cart.desc"),
              confirmText: t("cust.clear_cart.confirm"),
              tone: "danger",
            });
            if (ok) {
              clear();
              setCartOpen(false);
            }
          }}
          onSubmit={async () => {
            setCartOpen(false);
            await submitOrder();
          }}
          onEditNote={(menuId) => {
            setNoteEditing(menuId);
            setCartOpen(false);
          }}
        />
      )}
    </>
  );
}
