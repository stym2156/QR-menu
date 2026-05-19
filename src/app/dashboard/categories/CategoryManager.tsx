"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EmptyState,
  FormField,
  SectionHeading,
  buttonPrimary,
  card,
  cardPad,
  input,
} from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast";
import type { Category } from "@/lib/types";

interface Props {
  restaurantId: string;
  initialCategories: Category[];
}

export default function CategoryManager({ restaurantId, initialCategories }: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const sort_order = categories.length;
    const { data, error: insertError } = await supabase
      .from("categories")
      .insert({ restaurant_id: restaurantId, name, sort_order })
      .select()
      .single();

    if (insertError || !data) {
      setError(`เพิ่มหมวดไม่สำเร็จ: ${insertError?.message}`);
      setBusy(false);
      return;
    }

    setCategories((prev) => [...prev, data as Category]);
    setName("");
    setBusy(false);
  }

  async function deleteCategory(category: Category): Promise<void> {
    const ok = await confirm({
      title: `ลบหมวด "${category.name}"?`,
      description: "เมนูในหมวดจะกลายเป็นไม่มีหมวด การกระทำนี้ย้อนกลับไม่ได้",
      confirmText: "ลบ",
      tone: "danger",
    });
    if (!ok) return;
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    if (error) toast.error(`ลบไม่สำเร็จ: ${error.message}`);
    else toast.success("ลบหมวดแล้ว");
  }

  async function renameCategory(category: Category, newName: string): Promise<void> {
    if (!newName.trim() || newName === category.name) return;
    setCategories((prev) =>
      prev.map((c) => (c.id === category.id ? { ...c, name: newName } : c)),
    );
    await supabase.from("categories").update({ name: newName }).eq("id", category.id);
  }

  async function move(category: Category, direction: -1 | 1): Promise<void> {
    const idx = categories.findIndex((c) => c.id === category.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= categories.length) return;
    const next = [...categories];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setCategories(next);
    await Promise.all(
      next.map((c, i) =>
        supabase.from("categories").update({ sort_order: i }).eq("id", c.id),
      ),
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <form onSubmit={handleAdd} className={`${card} ${cardPad} h-fit space-y-4 lg:sticky lg:top-20`}>
        <SectionHeading title="เพิ่มหมวด" />

        <FormField label="ชื่อหมวด">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={input}
            placeholder="เช่น อาหาร, เครื่องดื่ม"
          />
        </FormField>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button type="submit" disabled={busy} className={`${buttonPrimary} w-full`}>
          {busy ? "กำลังเพิ่ม..." : "+ เพิ่มหมวด"}
        </button>
      </form>

      <div className="space-y-3">
        {categories.length === 0 ? (
          <EmptyState
            title="ยังไม่มีหมวด"
            description="เริ่มสร้างหมวดแรกของคุณด้วยฟอร์มทางซ้าย"
          />
        ) : (
          <>
            <SectionHeading
              title="รายการหมวด"
              description={`ทั้งหมด ${categories.length} หมวด · คลิกที่ชื่อเพื่อแก้ไข`}
            />
            <ul className="space-y-2">
              {categories.map((category, idx) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  isFirst={idx === 0}
                  isLast={idx === categories.length - 1}
                  onRename={(name) => renameCategory(category, name)}
                  onDelete={() => deleteCategory(category)}
                  onMoveUp={() => move(category, -1)}
                  onMoveDown={() => move(category, 1)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

interface CategoryRowProps {
  category: Category;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function CategoryRow({
  category,
  isFirst,
  isLast,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
}: CategoryRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);

  return (
    <li className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3 transition hover:border-ink/20">
      <div className="flex flex-col gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="flex h-5 w-5 items-center justify-center rounded text-muted transition hover:bg-canvas hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="เลื่อนขึ้น"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 14 6-6 6 6" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="flex h-5 w-5 items-center justify-center rounded text-muted transition hover:bg-canvas hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="เลื่อนลง"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 10 6 6 6-6" />
          </svg>
        </button>
      </div>
      <div className="flex-1">
        {editing ? (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              onRename(draft);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(draft);
                setEditing(false);
              }
              if (e.key === "Escape") {
                setDraft(category.name);
                setEditing(false);
              }
            }}
            autoFocus
            className="w-full rounded-md bg-canvas px-2 py-1 text-sm font-medium text-ink outline-none ring-2 ring-ink/5"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="block w-full text-left text-sm font-medium text-ink transition hover:text-accent-600"
          >
            {category.name}
          </button>
        )}
      </div>
      <button
        onClick={onDelete}
        className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600"
      >
        ลบ
      </button>
    </li>
  );
}
