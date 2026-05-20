"use client";

import { useMemo, useState } from "react";
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
import BundleEditor from "@/components/BundleEditor";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast";
import { compressImage } from "@/lib/image";
import type { Category, Menu, MenuBundle } from "@/lib/types";

interface Props {
  restaurantId: string;
  initialMenus: Menu[];
  categories: Category[];
}

export default function MenuManager({
  restaurantId,
  initialMenus,
  categories: initialCategories,
}: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [menus, setMenus] = useState<Menu[]>(initialMenus);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [bundles, setBundles] = useState<MenuBundle[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundlesEditingId, setBundlesEditingId] = useState<string | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
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
    setBusy(true);

    let imageUrl: string | null = null;

    if (file) {
      const compressed = await compressImage(file).catch(() => file);
      const ext = compressed.name.split(".").pop() ?? "jpg";
      const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(path, compressed, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        setError(`อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}`);
        setBusy(false);
        return;
      }

      const { data: publicUrl } = supabase.storage.from("menu-images").getPublicUrl(path);
      imageUrl = publicUrl.publicUrl;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("menus")
      .insert({
        restaurant_id: restaurantId,
        category_id: categoryId,
        name,
        price: Number(price),
        image_url: imageUrl,
        available: true,
        bundles,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      setError(`เพิ่มเมนูไม่สำเร็จ: ${insertError?.message}`);
      setBusy(false);
      return;
    }

    setMenus((prev) => [inserted as Menu, ...prev]);
    setName("");
    setPrice("");
    setCategoryId(null);
    setBundles([]);
    setFile(null);
    setBusy(false);
  }

  async function updateBundles(menu: Menu, next: MenuBundle[]): Promise<void> {
    setMenus((prev) =>
      prev.map((m) => (m.id === menu.id ? { ...m, bundles: next } : m)),
    );
    await supabase.from("menus").update({ bundles: next }).eq("id", menu.id);
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

  async function deleteMenu(menu: Menu): Promise<void> {
    const ok = await confirm({
      title: `ลบเมนู "${menu.name}"?`,
      description: "เมนูจะหายจากร้านทันที ลูกค้าสั่งไม่ได้ การกระทำนี้ย้อนกลับไม่ได้",
      confirmText: "ลบ",
      tone: "danger",
    });
    if (!ok) return;
    setMenus((prev) => prev.filter((m) => m.id !== menu.id));
    const { error } = await supabase.from("menus").delete().eq("id", menu.id);
    if (error) toast.error(`ลบไม่สำเร็จ: ${error.message}`);
    else toast.success(`ลบ "${menu.name}" แล้ว`);
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr] max-w-7xl mx-auto px-4 py-6">
      {/* ฝั่งซ้าย: ฟอร์มเพิ่มเมนู */}
      <div className="lg:sticky lg:top-24 h-fit">
        <form onSubmit={handleAdd} className={`${card} ${cardPad} shadow-sm border border-line/60 rounded-2xl bg-surface space-y-5 relative overflow-hidden`}>
          <div className="border-b border-line pb-4 mb-2">
            <SectionHeading title="เพิ่มเมนูใหม่" />
          </div>

          <FormField label="ชื่อเมนู">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={`${input} focus:ring-2 focus:ring-ink/10 transition-all duration-200`}
              placeholder="เช่น ผัดไทยกุ้งสด, ชาเขียวนม"
            />
          </FormField>

          <FormField label="ราคา">
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

          <FormField
            label="หมวดหมู่"
            hint="พิมพ์เพื่อค้นหา หรือสร้างหมวดหมู่ใหม่ได้ทันที"
          >
            <CategoryCombobox
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              onCreate={createCategoryInline}
              placeholder="— เลือกหมวดหมู่ —"
            />
          </FormField>

          <FormField label="รูปภาพเมนู" hint="แนะนำรูปอัตราส่วน 1:1 เพื่อการแสดงผลที่สวยงาม">
            <div className="mt-1 flex justify-center rounded-xl border border-dashed border-line px-4 py-4 hover:bg-canvas/40 transition group cursor-pointer relative">
              <div className="space-y-1 text-center">
                <svg className="mx-auto h-6 w-6 text-muted group-hover:text-ink transition" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4-4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-xs text-muted justify-center">
                  <span className="relative font-medium text-ink hover:underline">
                    {file ? file.name : "เลือกอัปโหลดไฟล์รูปภาพ"}
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

          <FormField
            label="ชุดแนะนำ (ไม่บังคับ)"
            hint="เช่น เครื่องดื่ม → ครึ่งลัง 12, ลัง 24"
          >
            <BundleEditor
              bundles={bundles}
              onChange={setBundles}
              unitPrice={Number(price) || 0}
            />
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
                กำลังบันทึก...
              </>
            ) : (
              "+ เพิ่มเมนูเข้าสู่ระบบ"
            )}
          </button>
        </form>
      </div>

      {/* ฝั่งขวา: รายการเมนู */}
      <div className="space-y-4">
        {menus.length === 0 ? (
          <div className="border border-dashed border-line rounded-2xl bg-surface/50 p-8">
            <EmptyState
              title="ยังไม่มีรายการเมนูในระบบ"
              description="เริ่มต้นสร้างเมนูแรกของคุณด้วยการกรอกข้อมูลที่ฟอร์มทางด้านซ้ายมือ"
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
              <SectionHeading title="รายการเมนูทั้งหมด" description={`พบข้อมูลในระบบทั้งหมด ${menus.length} รายการ`} />
            </div>
            
            <ul className="grid grid-cols-1 gap-3">
              {menus.map((menu) => {
                const isAvailable = menu.available;
                const isEditingBundles = bundlesEditingId === menu.id;
                const bundleCount = menu.bundles?.length ?? 0;
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
                          alt={menu.name}
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
                      <div className={`truncate text-sm font-semibold tracking-tight transition ${!isAvailable ? "text-muted line-through" : "text-ink"}`}>
                        {menu.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        <span className={`font-bold tabular-nums ${!isAvailable ? "text-muted" : "text-ink"}`}>
                          {formatKIP(menu.price)}
                        </span>
                        <span className="text-line-vertical border-l border-line h-3" />
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          menu.category_id 
                            ? "bg-canvas text-ink/80 border border-line/40" 
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}>
                          {menu.category_id
                            ? (categoryMap.get(menu.category_id)?.name ?? "(หมวดถูกลบ)")
                            : "ไม่มีหมวดหมู่"}
                        </span>
                      </div>
                    </div>

                    {/* ตัวเลือกเปลี่ยนหมวดหมู่ (Desktop Only) */}
                    <div className="hidden lg:block w-44 shrink-0">
                      <CategoryCombobox
                        value={menu.category_id}
                        onChange={(id) => changeCategory(menu, id)}
                        categories={categories}
                        placeholder="— เปลี่ยนหมวดหมู่ —"
                        variant="compact"
                      />
                    </div>

                    {/* สวิตช์เปิด/ปิดการขาย และ ปุ่มลบ */}
                    <div className="flex items-center gap-2 pl-2 border-l border-line">
                      <button
                        type="button"
                        onClick={() =>
                          setBundlesEditingId(isEditingBundles ? null : menu.id)
                        }
                        className={`relative rounded-lg p-2 text-xs font-medium transition active:scale-95 ${
                          isEditingBundles
                            ? "bg-ink text-surface"
                            : "text-muted hover:bg-canvas hover:text-ink"
                        }`}
                        title={`จัดการชุดแนะนำ (${bundleCount})`}
                        aria-label="จัดการชุดแนะนำ"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"
                          />
                        </svg>
                        {bundleCount > 0 && !isEditingBundles ? (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-semibold tabular-nums text-ink">
                            {bundleCount}
                          </span>
                        ) : null}
                      </button>

                      <label
                        className="flex cursor-pointer items-center select-none"
                        title={isAvailable ? "เปิดขายอยู่ (คลิกเพื่อปิด)" : "ปิดการขายอยู่ (คลิกเพื่อเปิด)"}
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
                        aria-label="ลบเมนู"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isEditingBundles ? (
                    <div className="border-t border-line bg-canvas/40 p-4">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                        ชุดแนะนำของ &quot;{menu.name}&quot;
                      </div>
                      <BundleEditor
                        bundles={menu.bundles ?? []}
                        onChange={(next) => updateBundles(menu, next)}
                        unitPrice={Number(menu.price)}
                      />
                    </div>
                  ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}