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
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import type { Category } from "@/lib/types";

interface Props {
  restaurantId: string;
  initialCategories: Category[];
}

export default function CategoryManager({ restaurantId, initialCategories }: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { t, locale } = useT();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [name, setName] = useState("");
  const [nameLo, setNameLo] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    const th = name.trim();
    const lo = nameLo.trim();
    const en = nameEn.trim();
    if (!th && !lo && !en) {
      setError(t("mgr.cat.error.no_name"));
      return;
    }

    setBusy(true);

    const sort_order = categories.length;
    // `name` is NOT NULL in the schema — fall back to whichever language is filled
    // so owners can add a category in only Lao or only English if they want.
    const primary = th || lo || en;
    const { data, error: insertError } = await supabase
      .from("categories")
      .insert({
        restaurant_id: restaurantId,
        name: primary,
        name_lo: lo || null,
        name_en: en || null,
        sort_order,
      })
      .select()
      .single();

    if (insertError || !data) {
      setError(t("mgr.cat.add_failed", { error: insertError?.message ?? "" }));
      setBusy(false);
      return;
    }

    setCategories((prev) => [...prev, data as Category]);
    setName("");
    setNameLo("");
    setNameEn("");
    setBusy(false);
  }

  async function deleteCategory(category: Category): Promise<void> {
    const ok = await confirm({
      title: t("mgr.cat.delete.title", { name: category.name }),
      description: t("mgr.cat.delete.desc"),
      confirmText: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    if (error) toast.error(t("mgr.cat.delete_failed", { error: error.message }));
    else toast.success(t("mgr.cat.deleted"));
  }

  async function deleteCategoryWithMenus(category: Category): Promise<void> {
    const ok = await confirm({
      title: `ลบหมวด "${pickName(category, locale)}" พร้อมเมนูทั้งหมด?`,
      description:
        "เมนูอาหารทั้งหมดในหมวดนี้จะถูกลบออกถาวร เหมาะกับกรณีที่ไม่ต้องการขายหมวดนี้แล้ว",
      confirmText: "ลบหมวด + เมนู",
      tone: "danger",
    });
    if (!ok) return;

    const { error: menuDeleteError } = await supabase
      .from("menus")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("category_id", category.id);
    if (menuDeleteError) {
      toast.error(`ลบเมนูในหมวดไม่สำเร็จ: ${menuDeleteError.message}`);
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== category.id));
    const { error: categoryDeleteError } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);
    if (categoryDeleteError) {
      toast.error(t("mgr.cat.delete_failed", { error: categoryDeleteError.message }));
      return;
    }
    toast.success(`ลบหมวด ${pickName(category, locale)} และเมนูในหมวดแล้ว`);
  }

  async function renameCategory(category: Category, newName: string): Promise<void> {
    const next = newName.trim();
    if (!next || next === category.name) return;
    // If name_lo / name_en were auto-mirrored from `name` (i.e. the owner only
    // typed one language), sync them too so the rename actually takes effect
    // for customers viewing in those locales.
    const patch: { name: string; name_lo?: string; name_en?: string } = { name: next };
    if (category.name_lo && category.name_lo === category.name) patch.name_lo = next;
    if (category.name_en && category.name_en === category.name) patch.name_en = next;
    setCategories((prev) =>
      prev.map((c) => (c.id === category.id ? { ...c, ...patch } : c)),
    );
    await supabase.from("categories").update(patch).eq("id", category.id);
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
        <SectionHeading title={t("mgr.cat.add_title")} />

        <FormField label={t("mgr.cat.name_th")} hint={t("mgr.cat.name_th.hint")}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={input}
            placeholder={t("mgr.cat.name_th.placeholder")}
          />
        </FormField>

        <FormField label={t("mgr.cat.name_lo")} hint={t("mgr.cat.name_lo.hint")}>
          <input
            type="text"
            value={nameLo}
            onChange={(e) => setNameLo(e.target.value)}
            className={input}
            placeholder={t("mgr.cat.name_lo.placeholder")}
          />
        </FormField>

        <FormField label={t("mgr.cat.name_en")} hint={t("mgr.cat.name_en.hint")}>
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            className={input}
            placeholder={t("mgr.cat.name_en.placeholder")}
          />
        </FormField>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button type="submit" disabled={busy} className={`${buttonPrimary} w-full`}>
          {busy ? t("mgr.cat.submitting") : t("mgr.cat.submit")}
        </button>
      </form>

      <div className="space-y-3">
        {categories.length === 0 ? (
          <EmptyState
            title={t("mgr.cat.empty")}
            description={t("mgr.cat.empty.desc")}
          />
        ) : (
          <>
            <SectionHeading
              title={t("mgr.cat.list_title")}
              description={t("mgr.cat.list_desc", { n: categories.length })}
            />
            <ul className="space-y-2">
              {categories.map((category, idx) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  displayName={pickName(category, locale)}
                  isFirst={idx === 0}
                  isLast={idx === categories.length - 1}
                  onRename={(name) => renameCategory(category, name)}
                  onDelete={() => deleteCategory(category)}
                  onDeleteWithMenus={() => deleteCategoryWithMenus(category)}
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
  displayName: string;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDeleteWithMenus: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function CategoryRow({
  category,
  displayName,
  isFirst,
  isLast,
  onRename,
  onDelete,
  onDeleteWithMenus,
  onMoveUp,
  onMoveDown,
}: CategoryRowProps) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);

  return (
    <li className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3 transition hover:border-ink/20">
      <div className="flex flex-col gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="flex h-5 w-5 items-center justify-center rounded text-muted transition hover:bg-canvas hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label={t("mgr.cat.move_up")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 14 6-6 6 6" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="flex h-5 w-5 items-center justify-center rounded text-muted transition hover:bg-canvas hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label={t("mgr.cat.move_down")}
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
            {displayName}
          </button>
        )}
      </div>
      <button
        onClick={onDelete}
        className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600"
      >
        {t("common.delete")}
      </button>
      <button
        onClick={onDeleteWithMenus}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
        title="ลบหมวดพร้อมเมนูทั้งหมด"
        aria-label="ลบหมวดพร้อมเมนูทั้งหมด"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 7 1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M3 7h18" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </li>
  );
}
