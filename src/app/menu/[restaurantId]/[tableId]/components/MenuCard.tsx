"use client";

import Image from "next/image";
import { formatKIP } from "@/lib/format";
import type { Menu } from "@/lib/types";

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

export function MenuCard({
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
      className={`group relative overflow-hidden rounded-2xl border bg-surface transition ${
        selected ? "border-ink/30 shadow-card" : "border-line"
      }`}
    >
      <div className="flex gap-3 p-3">
        <div
          className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-xl ${
            menu.image_url ? "" : "border border-line bg-canvas"
          }`}
        >
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
                  className={`text-[11px] font-medium ${
                    note ? "text-accent-600" : "text-muted hover:text-ink"
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
