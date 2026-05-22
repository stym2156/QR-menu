"use client";

import { useState } from "react";
import Image from "next/image";
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
import { compressImage } from "@/lib/image";
import { randomId } from "@/lib/uuid";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Promotion } from "@/lib/types";

interface Props {
  restaurantId: string;
  initialPromotions: Promotion[];
}

export default function PromotionManager({
  restaurantId,
  initialPromotions,
}: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { t } = useT();
  const [promotions, setPromotions] = useState<Promotion[]>(initialPromotions);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filePreview = file ? URL.createObjectURL(file) : null;

  async function uploadImage(): Promise<string | null> {
    if (!file) return null;
    const compressed = await compressImage(file).catch(() => file);
    const ext = compressed.name.split(".").pop() ?? "jpg";
    const path = `${restaurantId}/${randomId()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("promotion-images")
      .upload(path, compressed, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setError(t("promo.upload_failed", { error: uploadError.message }));
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from("promotion-images")
      .getPublicUrl(path);
    return publicUrl.publicUrl;
  }

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);

    let imageUrl: string | null = null;
    if (file) {
      imageUrl = await uploadImage();
      if (!imageUrl) {
        setBusy(false);
        return;
      }
    }

    const sort_order = promotions.length;
    const { data, error: insertError } = await supabase
      .from("promotions")
      .insert({
        restaurant_id: restaurantId,
        title: title.trim(),
        description: description.trim() || null,
        image_url: imageUrl,
        active: true,
        sort_order,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        end_at: endAt ? new Date(endAt).toISOString() : null,
      })
      .select()
      .single();

    if (insertError || !data) {
      setError(t("promo.add_failed", { error: insertError?.message ?? "" }));
      setBusy(false);
      return;
    }

    setPromotions((prev) => [...prev, data as Promotion]);
    setTitle("");
    setDescription("");
    setStartAt("");
    setEndAt("");
    setFile(null);
    setBusy(false);
  }

  async function toggleActive(promotion: Promotion): Promise<void> {
    const next = !promotion.active;
    setPromotions((prev) =>
      prev.map((p) => (p.id === promotion.id ? { ...p, active: next } : p)),
    );
    await supabase
      .from("promotions")
      .update({ active: next })
      .eq("id", promotion.id);
  }

  async function deletePromotion(promotion: Promotion): Promise<void> {
    const ok = await confirm({
      title: t("promo.delete.title", { name: promotion.title }),
      description: t("promo.delete.desc"),
      confirmText: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    setPromotions((prev) => prev.filter((p) => p.id !== promotion.id));
    const { error } = await supabase.from("promotions").delete().eq("id", promotion.id);
    if (error) toast.error(t("promo.delete_failed", { error: error.message }));
    else toast.success(t("promo.deleted"));
  }

  const activeCount = promotions.filter((p) => p.active).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
      <form
        onSubmit={handleAdd}
        className={`${card} ${cardPad} h-fit space-y-4 lg:sticky lg:top-20`}
      >
        <SectionHeading title={t("promo.add_title")} />

        <FormField label={t("promo.title_field")}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
            className={input}
            placeholder={t("promo.title.placeholder")}
          />
        </FormField>

        <FormField label={t("promo.desc_field")} hint={t("common.optional")}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={3}
            className={`${input} resize-none`}
            placeholder={t("promo.desc.placeholder")}
          />
        </FormField>

        <div className="rounded-2xl border border-line bg-canvas/40 p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={t("promo.start")}>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className={`${input} tabular-nums`}
              />
            </FormField>
            <FormField label={t("promo.end")}>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className={`${input} tabular-nums`}
              />
            </FormField>
          </div>
        </div>

        <FormField label={t("promo.image")} hint={t("common.optional")}>
          <div className="flex items-center gap-3">
            {filePreview ? (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas">
                <Image
                  src={filePreview}
                  alt="preview"
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </div>
            ) : null}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-canvas file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-line"
            />
          </div>
        </FormField>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className={`${buttonPrimary} w-full`}>
          {busy ? t("promo.submitting") : t("promo.submit")}
        </button>
      </form>

      <div className="space-y-3">
        {promotions.length === 0 ? (
          <EmptyState
            title={t("promo.empty")}
            description={t("promo.empty.desc")}
          />
        ) : (
          <>
            <SectionHeading
              title={t("promo.list_title")}
              description={`${activeCount} · ${promotions.length}`}
            />
            <ul className="space-y-2">
              {promotions.map((promotion) => (
                <li
                  key={promotion.id}
                  className={`flex gap-3 rounded-2xl border bg-surface p-3 transition ${
                    promotion.active ? "border-line" : "border-line/60 opacity-60"
                  }`}
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas">
                    {promotion.image_url ? (
                      <Image
                        src={promotion.image_url}
                        alt={promotion.title}
                        fill
                        sizes="80px"
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-canvas to-line text-xl">
                        ✦
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">
                        {promotion.title}
                      </span>
                      {promotion.active ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
                          {t("promo.active")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                          {t("promo.inactive")}
                        </span>
                      )}
                    </div>
                    {promotion.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted">
                        {promotion.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <label
                      className="flex cursor-pointer items-center gap-2 select-none"
                      title={`${t("promo.active")} / ${t("promo.inactive")}`}
                    >
                      <input
                        type="checkbox"
                        checked={promotion.active}
                        onChange={() => toggleActive(promotion)}
                        className="peer sr-only"
                      />
                      <span className="relative h-5 w-9 rounded-full bg-line transition peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition after:content-[''] peer-checked:after:translate-x-4" />
                    </label>
                    <button
                      onClick={() => deletePromotion(promotion)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
