"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { formatKIP } from "@/lib/format";
import {
  EmptyState,
  FormField,
  SectionHeading,
  buttonPrimary,
  card,
  cardPad,
  input,
} from "@/components/ui";
import CategoryCombobox from "@/components/CategoryCombobox";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast";
import { compressImage } from "@/lib/image";
import { randomId } from "@/lib/uuid";
import { useT } from "@/lib/i18n/I18nProvider";
import { pickName } from "@/lib/i18n/localized";
import type { Category, Menu } from "@/lib/types";

interface Props {
  restaurantId: string;
  initialMenus: Menu[];
  categories: Category[];
  // Owner-only edit controls. Waiter/cook see the list read-only.
  canAct: boolean;
}

export default function MenuManager({
  restaurantId,
  initialMenus,
  categories: initialCategories,
  canAct,
}: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { t, locale } = useT();
  const [menus, setMenus] = useState<Menu[]>(initialMenus);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [name, setName] = useState("");
  const [nameLo, setNameLo] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catEditingId, setCatEditingId] = useState<string | null>(null);
  const [nameEditingId, setNameEditingId] = useState<string | null>(null);
  const [addCatPickerOpen, setAddCatPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  // Group menus into category sections, applying the search filter.
  // Sections with zero items after filtering are dropped from the output.
  const groupedMenus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? menus.filter((m) => {
          const th = m.name?.toLowerCase() ?? "";
          const lo = m.name_lo?.toLowerCase() ?? "";
          const en = m.name_en?.toLowerCase() ?? "";
          return th.includes(q) || lo.includes(q) || en.includes(q);
        })
      : menus;

    const sections: Array<{
      id: string | null;
      name: string;
      items: Menu[];
    }> = [];
    const idxById = new Map<string, number>();
    for (const c of categories) {
      idxById.set(c.id, sections.length);
      sections.push({ id: c.id, name: pickName(c, locale), items: [] });
    }
    const uncategorized: Menu[] = [];
    for (const m of filtered) {
      const idx = m.category_id ? idxById.get(m.category_id) : undefined;
      if (idx !== undefined) {
        sections[idx].items.push(m);
      } else {
        uncategorized.push(m);
      }
    }
    if (uncategorized.length > 0) {
      sections.push({
        id: null,
        name: t("mgr.menu.uncategorized"),
        items: uncategorized,
      });
    }
    return sections.filter((s) => s.items.length > 0);
  }, [menus, categories, locale, searchQuery, t]);

  const filteredTotal = useMemo(
    () => groupedMenus.reduce((sum, g) => sum + g.items.length, 0),
    [groupedMenus],
  );

  async function createCategoryInline(name: string): Promise<Category | null> {
    const sort_order = categories.length;
    const { data, error: insertError } = await supabase
      .from("categories")
      .insert({ restaurant_id: restaurantId, name, sort_order })
      .select()
      .single();

    if (insertError || !data) return null;
    const created = data as Category;
    setCategories((prev) => [...prev, created]);
    return created;
  }

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    const th = name.trim();
    const lo = nameLo.trim();
    const en = nameEn.trim();
    if (!th && !lo && !en) {
      setError(t("mgr.menu.error.no_name"));
      return;
    }

    setBusy(true);

    let imageUrl: string | null = null;

    if (file) {
      const compressed = await compressImage(file).catch(() => file);
      const ext = compressed.name.split(".").pop() ?? "jpg";
      const path = `${restaurantId}/${randomId()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(path, compressed, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        setError(t("mgr.menu.upload_failed", { error: uploadError.message }));
        setBusy(false);
        return;
      }

      const { data: publicUrl } = supabase.storage.from("menu-images").getPublicUrl(path);
      imageUrl = publicUrl.publicUrl;
    }

    // `name` is NOT NULL in the schema — fall back to whichever language is filled.
    const primary = th || lo || en;
    const { data: inserted, error: insertError } = await supabase
      .from("menus")
      .insert({
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: primary,
        name_lo: lo || null,
        name_en: en || null,
        price: Number(price),
        image_url: imageUrl,
        available: true,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      setError(t("mgr.menu.add_failed", { error: insertError?.message ?? "" }));
      setBusy(false);
      return;
    }

    setMenus((prev) => [inserted as Menu, ...prev]);
    setName("");
    setNameLo("");
    setNameEn("");
    setPrice("");
    setCategoryId(null);
    setFile(null);
    setBusy(false);
  }

  async function toggleAvailable(menu: Menu): Promise<void> {
    const next = !menu.available;
    setMenus((prev) =>
      prev.map((m) => (m.id === menu.id ? { ...m, available: next } : m)),
    );
    await supabase.from("menus").update({ available: next }).eq("id", menu.id);
  }

  async function changeCategory(menu: Menu, newCategoryId: string | null): Promise<void> {
    setMenus((prev) =>
      prev.map((m) => (m.id === menu.id ? { ...m, category_id: newCategoryId } : m)),
    );
    await supabase.from("menus").update({ category_id: newCategoryId }).eq("id", menu.id);
  }

  async function updateMenuFields(
    menu: Menu,
    next: {
      name_th: string;
      name_lo: string;
      name_en: string;
      price: number;
      imageFile: File | null;
      removeImage: boolean;
    },
  ): Promise<boolean> {
    const th = next.name_th.trim();
    const lo = next.name_lo.trim();
    const en = next.name_en.trim();
    if (!th && !lo && !en) return false;
    // `name` is NOT NULL — fall back to whichever language is filled.
    const primary = th || lo || en;

    // Resolve final image_url: explicit remove → null; new upload → new URL;
    // otherwise keep existing.
    let nextImageUrl: string | null = menu.image_url ?? null;
    if (next.removeImage) {
      nextImageUrl = null;
    } else if (next.imageFile) {
      const compressed = await compressImage(next.imageFile).catch(
        () => next.imageFile!,
      );
      const ext = compressed.name.split(".").pop() ?? "jpg";
      const path = `${restaurantId}/${randomId()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(path, compressed, { cacheControl: "3600", upsert: false });
      if (uploadError) {
        toast.error(t("mgr.menu.upload_failed", { error: uploadError.message }));
        return false;
      }
      const { data: publicUrl } = supabase.storage
        .from("menu-images")
        .getPublicUrl(path);
      nextImageUrl = publicUrl.publicUrl;
    }

    const patch = {
      name: primary,
      name_lo: lo || null,
      name_en: en || null,
      price: next.price,
      image_url: nextImageUrl,
    };
    setMenus((prev) =>
      prev.map((m) => (m.id === menu.id ? { ...m, ...patch } : m)),
    );
    const { error } = await supabase
      .from("menus")
      .update(patch)
      .eq("id", menu.id);
    if (error) {
      toast.error(t("mgr.menu.add_failed", { error: error.message }));
      return false;
    }
    return true;
  }

  async function deleteMenu(menu: Menu): Promise<void> {
    const ok = await confirm({
      title: t("mgr.menu.delete.title", { name: menu.name }),
      description: t("mgr.menu.delete.desc"),
      confirmText: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    setMenus((prev) => prev.filter((m) => m.id !== menu.id));
    const { error } = await supabase.from("menus").delete().eq("id", menu.id);
    if (error) toast.error(t("mgr.menu.delete_failed", { error: error.message }));
    else toast.success(t("mgr.menu.deleted", { name: menu.name }));
  }

  return (
    <div
      className={`grid grid-cols-1 gap-8 max-w-7xl mx-auto px-4 py-6 ${
        canAct ? "lg:grid-cols-[380px_1fr]" : ""
      }`}
    >
      {/* ฝั่งซ้าย: ฟอร์มเพิ่มเมนู — เฉพาะ owner เท่านั้น */}
      {canAct ? (
      <div className="lg:sticky lg:top-24 h-fit">
        <form onSubmit={handleAdd} className={`${card} ${cardPad} shadow-sm border border-line/60 rounded-2xl bg-surface space-y-5 relative overflow-hidden`}>
          <div className="border-b border-line pb-4 mb-2">
            <SectionHeading title={t("mgr.menu.add_title")} />
          </div>

          <FormField label={t("mgr.menu.name_th")} hint={t("mgr.menu.name_th.hint")}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${input} focus:ring-2 focus:ring-ink/10 transition-all duration-200`}
              placeholder={t("mgr.menu.name_th.placeholder")}
            />
          </FormField>

          <FormField label={t("mgr.menu.name_lo")} hint={t("mgr.menu.name_lo.hint")}>
            <input
              type="text"
              value={nameLo}
              onChange={(e) => setNameLo(e.target.value)}
              className={`${input} focus:ring-2 focus:ring-ink/10`}
              placeholder={t("mgr.menu.name_lo.placeholder")}
            />
          </FormField>

          <FormField label={t("mgr.menu.name_en")} hint={t("mgr.menu.name_en.hint")}>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className={`${input} focus:ring-2 focus:ring-ink/10`}
              placeholder={t("mgr.menu.name_en.placeholder")}
            />
          </FormField>

          <FormField label={t("mgr.menu.price")}>
            <div className="relative rounded-xl shadow-sm">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium text-muted/80">
                ₭
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className={`${input} pl-9 tabular-nums focus:ring-2 focus:ring-ink/10 transition-all duration-200`}
                placeholder="0.00"
              />
            </div>
          </FormField>

          <FormField label={t("mgr.menu.category")}>
            <button
              type="button"
              onClick={() => setAddCatPickerOpen(true)}
              className={`${input} flex items-center justify-between text-left`}
            >
              <span className={categoryId ? "text-ink" : "text-muted"}>
                {categoryId
                  ? (() => {
                      const c = categoryMap.get(categoryId);
                      return c ? pickName(c, locale) : t("combobox.none");
                    })()
                  : t("combobox.placeholder")}
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 opacity-60">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </FormField>

          <FormField label={t("mgr.menu.image")}>
            <div className="mt-1 flex justify-center rounded-xl border border-dashed border-line px-4 py-4 hover:bg-canvas/40 transition group cursor-pointer relative">
              <div className="space-y-1 text-center">
                <svg className="mx-auto h-6 w-6 text-muted group-hover:text-ink transition" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4-4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-xs text-muted justify-center">
                  <span className="relative font-medium text-ink hover:underline">
                    {file ? file.name : t("mgr.menu.image.choose")}
                  </span>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </FormField>

         
          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-medium text-red-600 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              {error}
            </div>
          ) : null}

          <button 
            type="submit" 
            disabled={busy} 
            className={`${buttonPrimary} w-full py-2.5 rounded-xl font-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex justify-center items-center gap-2`}
          >
            {busy ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                {t("mgr.menu.submitting")}
              </>
            ) : (
              t("mgr.menu.submit")
            )}
          </button>
        </form>
      </div>
      ) : null}

      {/* ฝั่งขวา: รายการเมนู */}
      <div className="space-y-4">
        {menus.length === 0 ? (
          <div className="border border-dashed border-line rounded-2xl bg-surface/50 p-8">
            <EmptyState
              title={t("mgr.menu.empty")}
              description={t("mgr.menu.empty.desc")}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
              <SectionHeading
                title={t("mgr.menu.list_title")}
                description={
                  searchQuery.trim()
                    ? t("mgr.menu.search.result", {
                        found: filteredTotal,
                        total: menus.length,
                      })
                    : t("mgr.menu.list_count", { n: menus.length })
                }
              />
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("mgr.menu.search.placeholder")}
                className={`${input} pl-10 pr-10`}
                autoComplete="off"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label={t("mgr.menu.search.clear")}
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : null}
            </div>

            {groupedMenus.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-muted">
                {t("mgr.menu.search.no_match", { q: searchQuery.trim() })}
              </div>
            ) : (
              groupedMenus.map((group) => (
                <section key={group.id ?? "uncat"} className="space-y-2">
                  <div className="flex items-baseline justify-between border-b border-line/60 pb-1.5">
                    <h3 className="text-sm font-semibold tracking-tight text-ink">
                      {group.name}
                    </h3>
                    <span className="text-[11px] text-muted tabular-nums">
                      {t("mgr.menu.list_count", { n: group.items.length })}
                    </span>
                  </div>
                  <ul className="grid grid-cols-1 gap-3">
                    {group.items.map((menu) => {
                      const isAvailable = menu.available;
                      return (
                  <li
                    key={menu.id}
                    className={`overflow-hidden rounded-xl border bg-surface shadow-sm transition-all duration-200 hover:shadow-md hover:border-line/80 ${
                      !isAvailable ? "opacity-75 bg-canvas/30" : "border-line/60"
                    }`}
                  >
                  <div className="flex items-center gap-4 p-3.5">
                    {/* รูปภาพเมนู */}
                    <div
                      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ${
                        menu.image_url
                          ? ""
                          : "border border-line bg-canvas"
                      }`}
                    >
                      {menu.image_url ? (
                        <Image
                          src={menu.image_url}
                          alt={pickName(menu, locale)}
                          fill
                          sizes="64px"
                          className={`object-contain transition-transform duration-300 hover:scale-105 ${!isAvailable && "grayscale"}`}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-medium text-muted/60 select-none">
                          No Pic
                        </div>
                      )}
                    </div>

                    {/* รายละเอียดเมนู */}
                    <div className="min-w-0 flex-1 space-y-1">
                      {canAct ? (
                        <button
                          type="button"
                          onClick={() => setNameEditingId(menu.id)}
                          className={`group/name flex w-full min-w-0 items-center gap-1.5 truncate text-left text-sm font-semibold tracking-tight transition hover:text-accent-600 ${!isAvailable ? "text-muted line-through" : "text-ink"}`}
                          aria-label={t("common.edit")}
                        >
                          <span className="truncate">{pickName(menu, locale)}</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3 shrink-0 opacity-0 transition group-hover/name:opacity-60">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.06 2.06 0 1 1 2.915 2.914L7.5 19.673 3 21l1.327-4.5L16.862 4.487Z" />
                          </svg>
                        </button>
                      ) : (
                        <div className={`truncate text-sm font-semibold tracking-tight ${!isAvailable ? "text-muted line-through" : "text-ink"}`}>
                          {pickName(menu, locale)}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        <span className={`font-bold tabular-nums ${!isAvailable ? "text-muted" : "text-ink"}`}>
                          {formatKIP(menu.price)}
                        </span>
                        <span className="text-line-vertical border-l border-line h-3" />
                        {canAct ? (
                          <button
                            type="button"
                            onClick={() => setCatEditingId(menu.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition hover:ring-1 hover:ring-ink/20 active:scale-95 ${
                              menu.category_id
                                ? "bg-canvas text-ink/80 border border-line/40 hover:bg-line/40"
                                : "bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100"
                            }`}
                            aria-label={t("mgr.menu.category")}
                          >
                            <span>
                              {menu.category_id
                                ? (() => {
                                    const c = categoryMap.get(menu.category_id);
                                    return c ? pickName(c, locale) : t("kit.no_menu");
                                  })()
                                : t("combobox.none")}
                            </span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 opacity-60">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                              menu.category_id
                                ? "bg-canvas text-ink/80 border border-line/40"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}
                          >
                            {menu.category_id
                              ? (() => {
                                  const c = categoryMap.get(menu.category_id);
                                  return c ? pickName(c, locale) : t("kit.no_menu");
                                })()
                              : t("combobox.none")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* สวิตช์เปิด/ปิดการขาย และ ปุ่มลบ — เฉพาะ owner เท่านั้น */}
                    {canAct ? (
                      <div className="flex items-center gap-2 pl-2 border-l border-line">
                        <label
                          className="flex cursor-pointer items-center select-none"
                          title={isAvailable ? t("mgr.menu.available.on") : t("mgr.menu.available.off")}
                        >
                          <input
                            type="checkbox"
                            checked={isAvailable}
                            onChange={() => toggleAvailable(menu)}
                            className="peer sr-only"
                          />
                          <span className="relative h-6 w-11 rounded-full bg-line transition-colors duration-200 peer-checked:bg-emerald-500 after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:after:translate-x-5" />
                        </label>

                        <button
                          onClick={() => deleteMenu(menu)}
                          className="rounded-lg p-2 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600 active:scale-95"
                          aria-label={t("common.delete")}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    ) : !isAvailable ? (
                      <span className="shrink-0 rounded-full bg-muted/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                        {t("mgr.menu.available.off")}
                      </span>
                    ) : null}
                  </div>
                  </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </div>

      {catEditingId
        ? (() => {
            const target = menus.find((m) => m.id === catEditingId);
            if (!target) return null;
            return (
              <CategoryPickerModal
                title={t("mgr.menu.category")}
                currentId={target.category_id}
                categories={categories}
                locale={locale}
                noneLabel={t("combobox.none")}
                closeLabel={t("common.close")}
                onSelect={(id) => {
                  void changeCategory(target, id);
                  setCatEditingId(null);
                }}
                onClose={() => setCatEditingId(null)}
              />
            );
          })()
        : null}

      {nameEditingId
        ? (() => {
            const target = menus.find((m) => m.id === nameEditingId);
            if (!target) return null;
            return (
              <MenuEditModal
                menu={target}
                onSave={async (vals) => {
                  const ok = await updateMenuFields(target, vals);
                  if (ok) setNameEditingId(null);
                  return ok;
                }}
                onClose={() => setNameEditingId(null)}
              />
            );
          })()
        : null}

      {addCatPickerOpen ? (
        <CategoryPickerModal
          title={t("mgr.menu.category")}
          currentId={categoryId}
          categories={categories}
          locale={locale}
          noneLabel={t("combobox.none")}
          closeLabel={t("common.close")}
          onSelect={(id) => {
            setCategoryId(id);
            setAddCatPickerOpen(false);
          }}
          onClose={() => setAddCatPickerOpen(false)}
          onCreate={createCategoryInline}
          createPlaceholder={t("combobox.placeholder_search")}
          createButtonLabel={t("common.add")}
        />
      ) : null}
    </div>
  );
}

interface MenuEditModalProps {
  menu: Menu;
  onSave: (vals: {
    name_th: string;
    name_lo: string;
    name_en: string;
    price: number;
    imageFile: File | null;
    removeImage: boolean;
  }) => Promise<boolean>;
  onClose: () => void;
}

function MenuEditModal({ menu, onSave, onClose }: MenuEditModalProps) {
  const { t } = useT();
  const [nameTh, setNameTh] = useState(menu.name ?? "");
  const [nameLo, setNameLo] = useState(menu.name_lo ?? "");
  const [nameEn, setNameEn] = useState(menu.name_en ?? "");
  const [price, setPrice] = useState(String(menu.price ?? ""));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    menu.image_url ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Manage preview URL: revoke object URLs on change/unmount to avoid leaks.
  useEffect(() => {
    if (removeImage) {
      setPreviewUrl(null);
      return;
    }
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(menu.image_url ?? null);
  }, [imageFile, removeImage, menu.image_url]);

  function handlePickImage(e: React.ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    setRemoveImage(false);
  }

  function handleRemoveImage(): void {
    setImageFile(null);
    setRemoveImage(true);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!nameTh.trim() && !nameLo.trim() && !nameEn.trim()) {
      setError(t("mgr.menu.error.no_name"));
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("กรุณาใส่ราคาที่ถูกต้อง (≥ 0)");
      return;
    }
    setBusy(true);
    const ok = await onSave({
      name_th: nameTh,
      name_lo: nameLo,
      name_en: nameEn,
      price: priceNum,
      imageFile,
      removeImage,
    });
    if (!ok) setBusy(false);
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 px-4 pb-4 animate-fade-in sm:items-center sm:pb-0"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-sm animate-slide-up overflow-hidden rounded-2xl bg-surface shadow-pop"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            {t("common.edit")} — {t("mgr.menu.name_th")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition hover:bg-canvas hover:text-ink"
            aria-label={t("common.close")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <FormField label={t("mgr.menu.name_th")} hint={t("mgr.menu.name_th.hint")}>
            <input
              type="text"
              value={nameTh}
              onChange={(e) => setNameTh(e.target.value)}
              className={input}
              placeholder={t("mgr.menu.name_th.placeholder")}
              autoFocus
            />
          </FormField>
          <FormField label={t("mgr.menu.name_lo")} hint={t("mgr.menu.name_lo.hint")}>
            <input
              type="text"
              value={nameLo}
              onChange={(e) => setNameLo(e.target.value)}
              className={input}
              placeholder={t("mgr.menu.name_lo.placeholder")}
            />
          </FormField>
          <FormField label={t("mgr.menu.name_en")} hint={t("mgr.menu.name_en.hint")}>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className={input}
              placeholder={t("mgr.menu.name_en.placeholder")}
            />
          </FormField>
          <FormField label={t("mgr.menu.image")}>
            {previewUrl ? (
              <div className="flex items-start gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 text-center text-xs font-medium text-ink transition hover:bg-canvas">
                    {t("mgr.menu.image.replace")}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePickImage}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                  >
                    {t("mgr.menu.image.remove")}
                  </button>
                </div>
              </div>
            ) : (
              <label className="block cursor-pointer rounded-xl border border-dashed border-line bg-surface/50 px-4 py-3 text-center text-xs font-medium text-muted transition hover:bg-canvas/40 hover:text-ink">
                {t("mgr.menu.image.choose")}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePickImage}
                  className="sr-only"
                />
              </label>
            )}
          </FormField>
          <FormField label={t("mgr.menu.price")}>
            <div className="relative rounded-xl">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium text-muted/80">
                ₭
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`${input} pl-9 tabular-nums`}
                placeholder="0.00"
              />
            </div>
          </FormField>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-line bg-canvas/40 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-canvas"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`${buttonPrimary} flex-1 disabled:opacity-70`}
          >
            {busy ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

interface CategoryPickerModalProps {
  title: string;
  currentId: string | null;
  categories: Category[];
  locale: "th" | "lo" | "en";
  noneLabel: string;
  closeLabel: string;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  // Optional: enable inline "create new category" input at the top of the
  // modal. When provided, a successful create auto-selects the new row.
  onCreate?: (name: string) => Promise<Category | null>;
  createPlaceholder?: string;
  createButtonLabel?: string;
}

function CategoryPickerModal({
  title,
  currentId,
  categories,
  locale,
  noneLabel,
  closeLabel,
  onSelect,
  onClose,
  onCreate,
  createPlaceholder,
  createButtonLabel,
}: CategoryPickerModalProps) {
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleCreate(): Promise<void> {
    const trimmed = createName.trim();
    if (!trimmed || !onCreate || creating) return;
    setCreating(true);
    const created = await onCreate(trimmed);
    setCreating(false);
    if (created) {
      setCreateName("");
      onSelect(created.id);
    }
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 px-4 pb-4 animate-fade-in sm:items-center sm:pb-0"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-slide-up overflow-hidden rounded-2xl bg-surface shadow-pop"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition hover:bg-canvas hover:text-ink"
            aria-label={closeLabel}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {onCreate ? (
          <div className="border-b border-line bg-canvas/30 px-3 py-2.5">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreate();
                  }
                }}
                placeholder={createPlaceholder ?? ""}
                className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition focus:border-ink/30"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!createName.trim() || creating}
                className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-surface transition hover:bg-ink/85 disabled:opacity-50"
              >
                {createButtonLabel ?? "+"}
              </button>
            </div>
          </div>
        ) : null}

        <ul className="max-h-[60vh] overflow-y-auto py-1">
          <li>
            <PickerRow
              label={noneLabel}
              muted
              selected={currentId === null}
              onClick={() => onSelect(null)}
            />
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <PickerRow
                label={pickName(c, locale)}
                selected={currentId === c.id}
                onClick={() => onSelect(c.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface PickerRowProps {
  label: string;
  selected: boolean;
  muted?: boolean;
  onClick: () => void;
}

function PickerRow({ label, selected, muted, onClick }: PickerRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-5 py-3 text-left text-sm transition hover:bg-canvas ${
        selected ? "bg-canvas font-semibold" : ""
      } ${muted ? "text-muted" : "text-ink"}`}
    >
      <span>{label}</span>
      {selected ? <span className="text-xs text-accent-600">✓</span> : null}
    </button>
  );
}