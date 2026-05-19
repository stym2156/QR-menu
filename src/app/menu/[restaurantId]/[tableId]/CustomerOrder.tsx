"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { formatKIP, formatTime } from "@/lib/format";
import { calculateBill } from "@/lib/bill";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast";
import { callStaff, placeOrder } from "./actions";
import type {
  Category,
  Menu,
  Order,
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

interface CartLine {
  menuId: string;
  qty: number;
  note: string;
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
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const cartStorageKey = `shopqr.cart.${restaurantId}.${tableId}`;
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartHydrated, setCartHydrated] = useState(false);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteEditing, setNoteEditing] = useState<string | null>(null);
  const [showBill, setShowBill] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | "all">("all");

  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);

  // Fetch + subscribe to orders for this table (live status tracking).
  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("table_id", tableId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setTableOrders((data ?? []) as Order[]);
      });

    const channel = supabase
      .channel(`customer:${tableId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `table_id=eq.${tableId}`,
        },
        (payload) => {
          setTableOrders((prev) => [...prev, payload.new as Order]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `table_id=eq.${tableId}`,
        },
        (payload) => {
          const next = payload.new as Order;
          const old = payload.old as Order;
          setTableOrders((prev) =>
            prev.map((o) => (o.id === next.id ? next : o)),
          );
          if (old.status !== "ready" && next.status === "ready") {
            toast.success("ออเดอร์ของคุณพร้อมเสิร์ฟแล้ว!");
          }
          if (!old.paid && next.paid) {
            toast.success("รับชำระเรียบร้อย ขอบคุณครับ");
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "orders",
          filter: `table_id=eq.${tableId}`,
        },
        (payload) => {
          const old = payload.old as { id: string };
          setTableOrders((prev) => prev.filter((o) => o.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, restaurantId, tableId, toast]);

  // Active (unpaid) orders for badges / bill modal.
  const activeOrders = useMemo(
    () => tableOrders.filter((o) => !o.paid),
    [tableOrders],
  );
  const readyCount = useMemo(
    () => activeOrders.filter((o) => o.status === "ready").length,
    [activeOrders],
  );

  // Restore cart from localStorage on mount (per restaurant + table).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cartStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CartLine>;
        // Drop lines for menus that no longer exist (deleted by owner).
        const cleaned: Record<string, CartLine> = {};
        for (const [id, line] of Object.entries(parsed)) {
          if (menuMap.has(id) && line.qty > 0) cleaned[id] = line;
        }
        setCart(cleaned);
      }
    } catch {
      // ignore parse / storage errors
    }
    setCartHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartStorageKey]);

  // Persist cart whenever it changes (after hydration to avoid wiping).
  useEffect(() => {
    if (!cartHydrated) return;
    try {
      if (Object.keys(cart).length === 0) {
        localStorage.removeItem(cartStorageKey);
      } else {
        localStorage.setItem(cartStorageKey, JSON.stringify(cart));
      }
    } catch {
      // ignore
    }
  }, [cart, cartHydrated, cartStorageKey]);

  const grouped = useMemo<Group[]>(() => {
    const groups: Group[] = [];
    const indexById = new Map<string | null, number>();
    for (const c of categories) {
      indexById.set(c.id, groups.length);
      groups.push({ id: c.id, name: c.name, items: [] });
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
      groups.push({ id: null, name: "อื่นๆ", items: uncategorised });
    }
    return groups.filter((g) => g.items.length > 0);
  }, [menus, categories]);

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

  function add(menuId: string, amount: number = 1): void {
    setCart((prev) => {
      const existing = prev[menuId];
      return {
        ...prev,
        [menuId]: {
          menuId,
          qty: (existing?.qty ?? 0) + amount,
          note: existing?.note ?? "",
        },
      };
    });
  }

  function remove(menuId: string): void {
    setCart((prev) => {
      const existing = prev[menuId];
      if (!existing) return prev;
      const nextQty = existing.qty - 1;
      const copy = { ...prev };
      if (nextQty <= 0) delete copy[menuId];
      else copy[menuId] = { ...existing, qty: nextQty };
      return copy;
    });
  }

  function setNote(menuId: string, note: string): void {
    setCart((prev) => {
      const existing = prev[menuId];
      if (!existing) return prev;
      return { ...prev, [menuId]: { ...existing, note } };
    });
  }

  async function submitOrder(): Promise<void> {
    if (totalQty === 0) return;
    if (!shopOpen) {
      setError("ร้านปิดอยู่ตอนนี้ ไม่สามารถสั่งได้");
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
    const result = await placeOrder({
      restaurantId,
      tableId,
      items,
    });

    if (!result.ok) {
      setError(`สั่งไม่สำเร็จ: ${result.error}`);
      setSubmitting(false);
      return;
    }

    setCart({});
    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => setSuccess(false), 4000);
  }

  if (menus.length === 0) {
    return (
      <div className="px-5 py-16 text-center text-muted">
        ยังไม่มีเมนูพร้อมขาย กรุณาสอบถามพนักงาน
      </div>
    );
  }

  return (
    <>
      {promotions.length > 0 && (
        <PromotionStrip promotions={promotions} />
      )}

      {grouped.length > 1 && (
        <div className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur-md">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
            <FilterChip
              label="ทั้งหมด"
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
              <span className="text-xs text-muted">{group.items.length} รายการ</span>
            </div>

            <ul className="space-y-2.5">
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
                    onAddBundle={(amount) => add(menu.id, amount)}
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

      {/* Floating action buttons */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-20 flex flex-col items-end gap-2">
        <FloatingButton
          icon={readyCount > 0 ? "🍽" : "🧾"}
          label={
            activeOrders.length > 0
              ? `ออเดอร์ของคุณ (${activeOrders.length})`
              : "ดูบิล"
          }
          onClick={() => setShowBill(true)}
          badge={readyCount > 0 ? "พร้อมเสิร์ฟ" : null}
        />
        <FloatingButton
          icon="🛎"
          label="เรียกพนักงาน"
          onClick={() => setCallOpen(true)}
          accent
        />
      </div>

      {success && (
        <div className="fixed inset-x-0 top-4 z-30 mx-auto flex w-fit animate-slide-up items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-surface shadow-pop">
          <span className="text-emerald-400">✓</span>
          ส่งออเดอร์เรียบร้อย กำลังเตรียมให้
        </div>
      )}

      {totalQty > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur"
        >
          {error && (
            <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "ล้างรายการทั้งหมดในตะกร้า?",
                  description: "รายการที่เลือกไว้จะหายหมด สามารถเลือกใหม่ได้",
                  confirmText: "ล้างทั้งหมด",
                  tone: "danger",
                });
                if (ok) setCart({});
              }}
              disabled={submitting}
              className="flex h-[3.25rem] shrink-0 items-center gap-1.5 rounded-2xl border border-line bg-surface px-3.5 text-sm font-medium text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              aria-label="ล้างตะกร้า"
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
              <span className="hidden sm:inline">ล้าง</span>
            </button>
            <button
              onClick={submitOrder}
              disabled={submitting || !shopOpen}
              className="group flex flex-1 items-center justify-between rounded-2xl bg-ink px-5 py-3.5 text-surface shadow-ink transition active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-surface/15 px-1.5 text-xs font-semibold tabular-nums">
                  {totalQty}
                </span>
                <span className="text-sm font-medium">
                  {!shopOpen
                    ? "ร้านปิดอยู่"
                    : submitting
                      ? "กำลังส่ง..."
                      : "สั่งเลย"}
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
    </>
  );
}

interface MenuCardProps {
  menu: Menu;
  qty: number;
  note: string;
  editingNote: boolean;
  onAdd: () => void;
  onAddBundle: (amount: number) => void;
  onRemove: () => void;
  onToggleNote: () => void;
  onNoteChange: (value: string) => void;
  onCloseNote: () => void;
}

function MenuCard({
  menu,
  qty,
  note,
  editingNote,
  onAdd,
  onAddBundle,
  onRemove,
  onToggleNote,
  onNoteChange,
  onCloseNote,
}: MenuCardProps) {
  const selected = qty > 0;
  return (
    <li
      className={`group relative overflow-hidden rounded-2xl border bg-surface transition ${selected ? "border-ink/30 shadow-card" : "border-line"
        }`}
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas">
          {menu.image_url ? (
            <Image
              src={menu.image_url}
              alt={menu.name}
              fill
              sizes="96px"
              className="object-contain transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              —
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between gap-1.5">
          <div>
            <div className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">
              {menu.name}
            </div>
            <div className="mt-0.5 text-sm font-medium tabular-nums text-muted">
              {formatKIP(menu.price)}
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div className="flex-1">
              {selected && (
                <button
                  onClick={onToggleNote}
                  className={`text-[11px] font-medium ${note ? "text-accent-600" : "text-muted hover:text-ink"
                    }`}
                >
                  {note ? `📝 ${note}` : "+ หมายเหตุ"}
                </button>
              )}
            </div>

            {selected ? (
              <div className="flex items-center gap-1 rounded-full border border-line bg-canvas p-0.5">
                <button
                  onClick={onRemove}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink transition hover:bg-line"
                  aria-label="ลด"
                >
                  −
                </button>
                <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums">
                  {qty}
                </span>
                <button
                  onClick={onAdd}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-xl shadow-red-500/40 transition-all hover:scale-110 hover:shadow-red-500/50 active:scale-90 ring-2 ring-white ring-offset-2 ring-offset-surface"
                  aria-label="เพิ่ม"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                onClick={onAdd}
                className="rounded-full border border-ink/15 bg-canvas px-4 py-1.5 text-sm font-medium text-ink transition hover:border-ink hover:bg-ink hover:text-surface"
              >
                เพิ่ม
              </button>
            )}
          </div>
        </div>
      </div>

      {menu.bundles && menu.bundles.length > 0 ? (
        <div className="border-t border-line bg-amber-50/40 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-amber-700">
              แนะนำ
            </span>
            {menu.bundles.map((b, idx) => (
              <button
                key={idx}
                onClick={() => onAddBundle(b.qty)}
                className="rounded-full border border-amber-200 bg-surface px-2.5 py-1 text-[11px] font-medium text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 active:scale-95"
              >
                {b.label} ×{b.qty}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {editingNote && (
        <div className="border-t border-line bg-canvas px-3 py-2.5">
          <input
            type="text"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            onBlur={onCloseNote}
            onKeyDown={(e) => e.key === "Enter" && onCloseNote()}
            placeholder="เช่น เผ็ดน้อย, ไม่ใส่ผัก, ไม่หวาน"
            autoFocus
            maxLength={120}
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none"
          />
        </div>
      )}
    </li>
  );
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

interface PromotionStripProps {
  promotions: Promotion[];
}

function PromotionStrip({ promotions }: PromotionStripProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  function getCardWidth(): number {
    const el = ref.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return 0;
    return card.offsetWidth + 12; // gap-3 = 12px
  }

  function onScroll(): void {
    const el = ref.current;
    if (!el) return;
    const cardWidth = getCardWidth();
    if (cardWidth === 0) return;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIdx(Math.max(0, Math.min(promotions.length - 1, idx)));
  }

  function scrollTo(idx: number): void {
    const el = ref.current;
    if (!el) return;
    const cardWidth = getCardWidth();
    if (cardWidth === 0) return;
    el.scrollTo({ left: cardWidth * idx, behavior: "smooth" });
  }

  return (
    <div className="border-b border-line bg-surface py-4">
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar flex gap-3 overflow-x-auto px-5 snap-x snap-mandatory"
      >
        {promotions.map((promo) => (
          <PromotionCard key={promo.id} promotion={promo} />
        ))}
      </div>

      {promotions.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {promotions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollTo(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === activeIdx
                  ? "w-6 bg-ink"
                  : "w-1.5 bg-line hover:bg-muted"
              }`}
              aria-label={`โปรที่ ${idx + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface PromotionCardProps {
  promotion: Promotion;
}

function PromotionCard({ promotion }: PromotionCardProps) {
  const hasImage = !!promotion.image_url;
  return (
    <div className="flex w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-ink text-surface shadow-card sm:w-[60%] lg:w-[40%]">
      <div className="relative aspect-[5/3] w-full overflow-hidden bg-zinc-900">
        {hasImage && promotion.image_url ? (
          <Image
            src={promotion.image_url}
            alt={promotion.title}
            fill
            sizes="(min-width: 1024px) 40vw, (min-width: 640px) 60vw, 85vw"
            className="object-contain"
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-ink to-zinc-700" />
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/20 blur-2xl" />
            <div className="absolute inset-0 flex items-center justify-center text-5xl text-amber-300/40">
              ✦
            </div>
          </>
        )}
      </div>

      <div className="flex min-h-[5.5rem] flex-col justify-center px-4 py-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-amber-300">
          <span>✦</span>
          <span>Promotion</span>
        </div>
        <div className="mt-1 line-clamp-2 text-base font-semibold leading-snug tracking-tight">
          {promotion.title}
        </div>
        {promotion.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-200">
            {promotion.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${active
          ? "bg-ink text-surface"
          : "bg-canvas text-muted hover:bg-line hover:text-ink"
        }`}
    >
      {label}
    </button>
  );
}

interface FloatingButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  accent?: boolean;
  badge?: string | null;
}

function FloatingButton({
  icon,
  label,
  onClick,
  accent,
  badge,
}: FloatingButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium shadow-pop backdrop-blur transition active:scale-95 ${
        accent
          ? "border-accent-600 bg-accent-600 text-surface hover:bg-accent-700"
          : "border-line bg-surface/95 text-ink hover:border-ink/30"
      }`}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span>{label}</span>
      {badge ? (
        <span className="absolute -right-1 -top-1 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-surface shadow-card">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-100" />
          </span>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function OrderStatusBadge({ status }: { status: Order["status"] }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-800">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
        </span>
        กำลังทำ
      </span>
    );
  }
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-700">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        พร้อมเสิร์ฟ
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted">
      ✓ เสิร์ฟแล้ว
    </span>
  );
}

interface BillModalProps {
  tableNumber: number;
  menus: Menu[];
  orders: Order[];
  serviceChargePct: number;
  vatPct: number;
  onClose: () => void;
}

function BillModal({
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

interface CallStaffModalProps {
  restaurantId: string;
  tableId: string;
  onClose: () => void;
}

function CallStaffModal({ restaurantId, tableId, onClose }: CallStaffModalProps) {
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

interface SheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Sheet({ title, onClose, children }: SheetProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end animate-fade-in bg-ink/30 sm:items-center sm:justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full animate-slide-up overflow-y-auto rounded-t-3xl bg-surface sm:max-w-md sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
          <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
