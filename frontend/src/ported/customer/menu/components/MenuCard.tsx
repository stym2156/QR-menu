"use client";

import Image from "next/image";
import { formatKIP } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import type { Menu } from "@/lib/types";

interface MenuCardProps {
  menu: Menu;
  qty: number;
  note: string;
  editingNote: boolean;
  onAdd: () => void;
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
  onRemove,
  onToggleNote,
  onNoteChange,
  onCloseNote,
}: MenuCardProps) {
  const { t, locale } = useT();
  const selected = qty > 0;
  const displayName = pickName(menu, locale);
  return (
    <li
      className={`group relative overflow-hidden rounded-2xl border bg-surface transition ${
        selected ? "border-ink/30 shadow-card" : "border-line"
      }`}
    >
      <button
        type="button"
        onClick={onAdd}
        className="relative block w-full text-left active:scale-[0.98] transition-transform"
        aria-label={`${t("cust.add_to_order")} ${displayName}`}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-canvas">
          {menu.image_url ? (
            <Image
              src={menu.image_url}
              alt={displayName}
              fill
              sizes="(max-width: 640px) 50vw, 240px"
              quality={70}
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              —
            </div>
          )}
          {selected ? (
            <span className="absolute right-2 top-2 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-ink px-2 text-xs font-bold tabular-nums text-surface shadow-md">
              {qty}
            </span>
          ) : null}
        </div>

        <div className="space-y-1 px-3 py-2.5 pr-12">
          <div className="line-clamp-2 min-h-[2.5em] text-[13px] font-medium leading-snug text-ink">
            {displayName}
          </div>
          <div className="text-sm font-semibold tabular-nums text-ink">
            {formatKIP(menu.price)}
          </div>
        </div>

        {/* Blue + affordance, anchored inside the main button so the click
            always reaches onAdd — even when the card grows (note row, etc.)
            below changes the <li> bottom. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/40 ring-2 ring-surface transition group-hover:scale-110"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>

      {selected ? (
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface/95 text-base font-semibold text-ink shadow-md ring-1 ring-line backdrop-blur transition hover:bg-surface active:scale-95"
            aria-label={t("cust.dec")}
          >
            −
          </button>
        </div>
      ) : null}

      {selected ? (
        <button
          type="button"
          onClick={onToggleNote}
          className={`block w-full border-t border-line px-3 py-1.5 text-left text-[11px] font-medium transition ${
            note ? "bg-canvas text-accent-600" : "text-muted hover:bg-canvas hover:text-ink"
          }`}
        >
          {note ? `📝 ${note}` : `+ ${t("cust.note_add")}`}
        </button>
      ) : null}

      {editingNote && (
        <div className="border-t border-line bg-canvas px-3 py-2.5">
          <input
            type="text"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            onBlur={onCloseNote}
            onKeyDown={(e) => e.key === "Enter" && onCloseNote()}
            placeholder={t("cust.note_placeholder_examples")}
            autoFocus
            maxLength={120}
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none"
          />
        </div>
      )}
    </li>
  );
}
