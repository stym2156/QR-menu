"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Category } from "@/lib/types";

interface CategoryComboboxProps {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  categories: Category[];
  onCreate?: (name: string) => Promise<Category | null>;
  placeholder?: string;
  variant?: "default" | "compact";
}

export default function CategoryCombobox({
  value,
  onChange,
  categories,
  onCreate,
  placeholder = "พิมพ์เพื่อค้นหา...",
  variant = "default",
}: CategoryComboboxProps) {
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [creating, setCreating] = useState(false);

  const selected = categories.find((c) => c.id === value) ?? null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? categories.filter((c) => c.name.toLowerCase().includes(q))
    : categories;

  const exactMatch = q
    ? categories.some((c) => c.name.toLowerCase() === q)
    : true;

  const canCreate = !!onCreate && q && !exactMatch;

  // Total navigable rows: "no category" + filtered + ("create new" if applicable)
  const totalRows = 1 + filtered.length + (canCreate ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent): void {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query, open]);

  function selectRow(idx: number): void {
    if (idx === 0) {
      onChange(null);
      close();
      return;
    }
    const filteredIdx = idx - 1;
    if (filteredIdx < filtered.length) {
      onChange(filtered[filteredIdx].id);
      close();
      return;
    }
    if (canCreate) {
      void handleCreate();
    }
  }

  async function handleCreate(): Promise<void> {
    if (!onCreate || !q || creating) return;
    setCreating(true);
    const created = await onCreate(query.trim());
    setCreating(false);
    if (created) {
      onChange(created.id);
      close();
    }
  }

  function close(): void {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlightIdx((i) => Math.min(i + 1, Math.max(0, totalRows - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open) selectRow(highlightIdx);
    } else if (e.key === "Escape") {
      close();
    }
  }

  const inputClass =
    variant === "compact"
      ? "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-ink/30 focus:ring-2 focus:ring-ink/5"
      : "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-2 focus:ring-ink/5";

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={open ? query : (selected?.name ?? "")}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={selected ? selected.name : placeholder}
        className={inputClass}
        autoComplete="off"
      />

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-pop">
          <Row
            label="— ไม่มีหมวด —"
            muted
            active={highlightIdx === 0}
            onSelect={() => selectRow(0)}
            onMouseEnter={() => setHighlightIdx(0)}
            selected={value === null}
          />

          {filtered.length === 0 && !q ? (
            <div className="px-3 py-2.5 text-xs italic text-muted">
              ยังไม่มีหมวดหมู่
            </div>
          ) : null}

          {filtered.map((c, i) => {
            const rowIdx = 1 + i;
            return (
              <Row
                key={c.id}
                label={c.name}
                active={highlightIdx === rowIdx}
                onSelect={() => selectRow(rowIdx)}
                onMouseEnter={() => setHighlightIdx(rowIdx)}
                selected={value === c.id}
              />
            );
          })}

          {filtered.length === 0 && q && !canCreate ? (
            <div className="px-3 py-2.5 text-xs italic text-muted">
              ไม่เจอ &quot;{query}&quot;
            </div>
          ) : null}

          {canCreate ? (
            <Row
              label={
                creating ? `กำลังสร้าง "${query}"...` : `+ สร้างหมวด "${query}"`
              }
              active={highlightIdx === 1 + filtered.length}
              onSelect={() => selectRow(1 + filtered.length)}
              onMouseEnter={() => setHighlightIdx(1 + filtered.length)}
              accent
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  label: string;
  active: boolean;
  selected?: boolean;
  muted?: boolean;
  accent?: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
}

function Row({
  label,
  active,
  selected,
  muted,
  accent,
  onSelect,
  onMouseEnter,
}: RowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
        active ? "bg-canvas" : ""
      } ${accent ? "text-accent-600" : muted ? "text-muted" : "text-ink"}`}
    >
      <span>{label}</span>
      {selected ? <span className="text-xs text-muted">✓</span> : null}
    </button>
  );
}
