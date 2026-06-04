"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  FormField,
  SectionHeading,
  buttonPrimary,
  buttonSecondary,
  card,
  cardPad,
  input,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { PasswordInput } from "@/components/PasswordInput";
import { uploadPublicImage } from "@/lib/storage/images";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Restaurant } from "@/lib/types";

interface Props {
  restaurant: Restaurant;
  userEmail: string;
}

export default function SettingsForm({ restaurant, userEmail }: Props) {
  const supabase = createClient();
  const toast = useToast();
  const { t } = useT();

  const [name, setName] = useState(restaurant.name);
  const [acceptingOrders, setAcceptingOrders] = useState(
    restaurant.accepting_orders,
  );
  const [openTime, setOpenTime] = useState(restaurant.open_time ?? "");
  const [closeTime, setCloseTime] = useState(restaurant.close_time ?? "");
  const [serviceCharge, setServiceCharge] = useState(
    String(restaurant.service_charge_pct ?? 0),
  );
  const [vatPct, setVatPct] = useState(String(restaurant.vat_pct ?? 0));
  const [kitchenPrintWidth, setKitchenPrintWidth] = useState(
    String(restaurant.kitchen_print_width ?? 58),
  );
  const [savingShop, setSavingShop] = useState(false);

  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(
    restaurant.payment_qr_url ?? null,
  );
  const [uploadingQr, setUploadingQr] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function handleQrUpload(file: File): Promise<void> {
    setUploadingQr(true);
    try {
      const uploaded = await uploadPublicImage(supabase, {
        bucket: "payment-qr",
        ownerId: restaurant.id,
        file,
        maxDimension: 800,
      });
      if ("error" in uploaded) {
        toast.error(t("set.qr.upload_failed", { error: uploaded.error }));
        return;
      }
      const url = uploaded.publicUrl;
      const { error: dbError } = await supabase
        .from("restaurants")
        .update({ payment_qr_url: url })
        .eq("id", restaurant.id);
      if (dbError) {
        toast.error(t("set.qr.save_failed", { error: dbError.message }));
        return;
      }
      setPaymentQrUrl(url);
      toast.success(t("set.qr.saved"));
    } finally {
      setUploadingQr(false);
    }
  }

  async function handleQrRemove(): Promise<void> {
    setUploadingQr(true);
    const { error } = await supabase
      .from("restaurants")
      .update({ payment_qr_url: null })
      .eq("id", restaurant.id);
    setUploadingQr(false);
    if (error) {
      toast.error(t("set.qr.remove_failed", { error: error.message }));
      return;
    }
    setPaymentQrUrl(null);
    toast.success(t("set.qr.removed"));
  }

  async function saveShop(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("set.shop.error.name"));
      return;
    }
    const service = Number(serviceCharge);
    const vat = Number(vatPct);
    if (!Number.isFinite(service) || service < 0 || service > 100) {
      toast.error(t("set.shop.error.service"));
      return;
    }
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      toast.error(t("set.shop.error.vat"));
      return;
    }
    const widthNum = Number(kitchenPrintWidth);
    const allowedWidths = [58, 76, 80];
    if (!allowedWidths.includes(widthNum)) {
      toast.error(t("set.shop.error.kitchen_width"));
      return;
    }
    setSavingShop(true);
    const { error } = await supabase
      .from("restaurants")
      .update({
        name: name.trim(),
        accepting_orders: acceptingOrders,
        open_time: openTime || null,
        close_time: closeTime || null,
        service_charge_pct: service,
        vat_pct: vat,
        kitchen_print_width: widthNum,
      })
      .eq("id", restaurant.id);
    setSavingShop(false);
    if (error) {
      toast.error(t("set.shop.error.save", { error: error.message }));
      return;
    }
    toast.success(t("set.shop.saved"));
  }

  async function savePassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error(t("set.pw.error.short"));
      return;
    }
    if (newPw !== confirmPw) {
      toast.error(t("set.pw.error.mismatch"));
      return;
    }
    setSavingPw(true);

    // Verify current password by re-authenticating.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPw,
    });
    if (verifyError) {
      setSavingPw(false);
      toast.error(t("set.pw.error.invalid"));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPw,
    });
    setSavingPw(false);
    if (updateError) {
      toast.error(t("set.pw.error.save", { error: updateError.message }));
      return;
    }
    toast.success(t("set.pw.saved"));
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }

  return (
    <div className="space-y-5">
      <form onSubmit={saveShop} className={`${card} ${cardPad} space-y-5`}>
        <SectionHeading
          title={t("set.shop.title")}
          description={t("set.shop.desc")}
        />

        <FormField label={t("set.shop.name")}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className={input}
          />
        </FormField>

        <div className="rounded-2xl border border-line bg-canvas/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">{t("set.shop.accepting")}</div>
              <p className="mt-0.5 text-xs text-muted">{t("set.shop.accepting_hint")}</p>
            </div>
            <label
              className="flex shrink-0 cursor-pointer items-center gap-2 select-none"
              title={t("set.shop.accepting")}
            >
              <input
                type="checkbox"
                checked={acceptingOrders}
                onChange={(e) => setAcceptingOrders(e.target.checked)}
                className="peer sr-only"
              />
              <span className="relative h-6 w-11 rounded-full bg-line transition-colors duration-200 peer-checked:bg-emerald-500 after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:after:translate-x-5" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("set.shop.open_time")} hint={t("common.optional")}>
            <input
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className={`${input} tabular-nums`}
            />
          </FormField>
          <FormField label={t("set.shop.close_time")} hint={t("common.optional")}>
            <input
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className={`${input} tabular-nums`}
            />
          </FormField>
        </div>

        <div className="rounded-2xl border border-line bg-canvas/40 p-4 space-y-3">
          <div className="text-sm font-medium text-ink">{t("set.shop.tax_title")}</div>
          <p className="text-xs text-muted">{t("set.shop.tax_desc")}</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("set.shop.service")}>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(e.target.value)}
                  className={`${input} pr-7 tabular-nums`}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                  %
                </span>
              </div>
            </FormField>
            <FormField label={t("set.shop.vat")}>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={vatPct}
                  onChange={(e) => setVatPct(e.target.value)}
                  className={`${input} pr-7 tabular-nums`}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                  %
                </span>
              </div>
            </FormField>
          </div>
        </div>

        <FormField
          label={t("set.shop.kitchen_print_width")}
          hint={t("set.shop.kitchen_print_width.hint")}
        >
          <select
            value={kitchenPrintWidth}
            onChange={(e) => setKitchenPrintWidth(e.target.value)}
            className={`${input} appearance-none`}
          >
            <option value="58">58 mm — {t("set.shop.kitchen_width.58")}</option>
            <option value="76">76 mm — {t("set.shop.kitchen_width.76")}</option>
            <option value="80">80 mm — {t("set.shop.kitchen_width.80")}</option>
          </select>
        </FormField>

        <button
          type="submit"
          disabled={savingShop}
          className={`${buttonPrimary} w-full`}
        >
          {savingShop ? t("set.shop.submitting") : t("set.shop.submit")}
        </button>
      </form>

      <div className={`${card} ${cardPad} space-y-4`}>
        <SectionHeading
          title={t("set.qr.title")}
          description={t("set.qr.desc")}
        />

        {paymentQrUrl ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-canvas/40 p-4">
            <div className="relative h-48 w-48 overflow-hidden rounded-xl border border-line bg-surface">
              <Image
                src={paymentQrUrl}
                alt={t("set.qr.title")}
                fill
                className="object-contain p-2"
                sizes="192px"
                unoptimized
              />
            </div>
            <div className="flex gap-2">
              <label className={`${buttonSecondary} cursor-pointer py-2 text-xs`}>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingQr}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleQrUpload(f);
                    e.target.value = "";
                  }}
                />
                {t("set.qr.change")}
              </label>
              <button
                type="button"
                onClick={() => void handleQrRemove()}
                disabled={uploadingQr}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                {t("set.qr.remove")}
              </button>
            </div>
          </div>
        ) : (
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-canvas/40 px-4 py-8 text-center transition hover:border-ink/30 hover:bg-canvas ${
              uploadingQr ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingQr}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleQrUpload(f);
                e.target.value = "";
              }}
            />
            <span className="text-2xl">📱</span>
            <div className="text-sm font-medium text-ink">
              {uploadingQr ? t("set.qr.uploading") : t("set.qr.upload")}
            </div>
            <p className="text-xs text-muted">{t("set.qr.hint")}</p>
          </label>
        )}
      </div>

      <form onSubmit={savePassword} className={`${card} ${cardPad} space-y-4`}>
        <SectionHeading
          title={t("set.pw.title")}
          description={t("set.pw.desc_email", { email: userEmail })}
        />

        <FormField label={t("set.pw.current")}>
          <PasswordInput
            value={currentPw}
            onChange={setCurrentPw}
            required
            autoComplete="current-password"
          />
        </FormField>

        <FormField label={t("set.pw.new")} hint={t("set.pw.new.hint")}>
          <PasswordInput
            value={newPw}
            onChange={setNewPw}
            required
            autoComplete="new-password"
          />
        </FormField>

        <FormField label={t("set.pw.confirm")}>
          <PasswordInput
            value={confirmPw}
            onChange={setConfirmPw}
            required
            autoComplete="new-password"
          />
        </FormField>

        <button
          type="submit"
          disabled={savingPw}
          className={`${buttonPrimary} w-full`}
        >
          {savingPw ? t("set.pw.submitting") : t("set.pw.submit")}
        </button>
      </form>
    </div>
  );
}
