"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  FormField,
  SectionHeading,
  buttonPrimary,
  card,
  cardPad,
  input,
} from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast";
import type { Restaurant } from "@/lib/types";

interface Props {
  restaurant: Restaurant;
}

export default function AdminRestaurantForm({ restaurant }: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();

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
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(
    restaurant.payment_qr_url ?? null,
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("กรุณาใส่ชื่อร้าน");
      return;
    }
    const service = Number(serviceCharge);
    const vat = Number(vatPct);
    if (!Number.isFinite(service) || service < 0 || service > 100) {
      setError("Service charge ต้องเป็น 0–100");
      return;
    }
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      setError("VAT ต้องเป็น 0–100");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("restaurants")
      .update({
        name: trimmedName,
        accepting_orders: acceptingOrders,
        open_time: openTime.trim() || null,
        close_time: closeTime.trim() || null,
        service_charge_pct: service,
        vat_pct: vat,
      })
      .eq("id", restaurant.id);
    setSaving(false);

    if (updateError) {
      setError(`บันทึกไม่สำเร็จ: ${updateError.message}`);
      return;
    }
    toast.success("บันทึกข้อมูลร้านแล้ว");
    router.refresh();
  }

  async function handleRemoveQr(): Promise<void> {
    const ok = await confirm({
      title: "ลบ QR ชำระเงินของร้านนี้?",
      description: "ลูกค้าจะไม่เห็น QR ในใบเสร็จอีก",
      confirmText: "ลบ",
      tone: "danger",
    });
    if (!ok) return;
    const { error: updateError } = await supabase
      .from("restaurants")
      .update({ payment_qr_url: null })
      .eq("id", restaurant.id);
    if (updateError) {
      toast.error(`ลบไม่สำเร็จ: ${updateError.message}`);
      return;
    }
    setPaymentQrUrl(null);
    toast.success("ลบ QR แล้ว");
    router.refresh();
  }

  async function handleDeleteRestaurant(): Promise<void> {
    const ok = await confirm({
      title: `ลบร้าน "${restaurant.name}"?`,
      description:
        "การกระทำนี้จะลบเมนู, โต๊ะ, ออเดอร์, สมาชิก และข้อมูลทั้งหมดของร้านนี้ — ย้อนกลับไม่ได้",
      confirmText: "ลบร้าน",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    const { error: deleteError } = await supabase
      .from("restaurants")
      .delete()
      .eq("id", restaurant.id);
    if (deleteError) {
      setDeleting(false);
      toast.error(`ลบร้านไม่สำเร็จ: ${deleteError.message}`);
      return;
    }
    toast.success("ลบร้านแล้ว");
    router.push("/admin");
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSave} className={`${card} ${cardPad} space-y-5`}>
        <SectionHeading
          title="ข้อมูลร้าน"
          description="แก้ไขข้อมูลทั่วไป สถานะรับออเดอร์ เวลาทำการ และภาษี"
        />

        <FormField label="ชื่อร้าน">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={input}
          />
        </FormField>

        <FormField label="สถานะรับออเดอร์">
          <label className="flex cursor-pointer items-center gap-3 select-none">
            <input
              type="checkbox"
              checked={acceptingOrders}
              onChange={(e) => setAcceptingOrders(e.target.checked)}
              className="peer sr-only"
            />
            <span className="relative h-6 w-11 rounded-full bg-line transition peer-checked:bg-emerald-500 after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:after:translate-x-5" />
            <span className="text-sm text-ink">
              {acceptingOrders ? "เปิดรับออเดอร์" : "ปิดร้าน"}
            </span>
          </label>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="เวลาเปิด" hint="รูปแบบ HH:MM เช่น 09:00">
            <input
              type="text"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              placeholder="09:00"
              className={input}
            />
          </FormField>
          <FormField label="เวลาปิด" hint="รูปแบบ HH:MM เช่น 22:00">
            <input
              type="text"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              placeholder="22:00"
              className={input}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Service charge (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={serviceCharge}
              onChange={(e) => setServiceCharge(e.target.value)}
              className={`${input} tabular-nums`}
            />
          </FormField>
          <FormField label="VAT (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={vatPct}
              onChange={(e) => setVatPct(e.target.value)}
              className={`${input} tabular-nums`}
            />
          </FormField>
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className={`${buttonPrimary} w-full disabled:opacity-70`}
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </form>

      <div className={`${card} ${cardPad} space-y-4`}>
        <SectionHeading
          title="QR ชำระเงิน"
          description="QR ของธนาคาร/พร้อมเพย์ที่แสดงท้ายใบเสร็จ"
        />
        {paymentQrUrl ? (
          <div className="flex items-start gap-4">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas">
              <Image
                src={paymentQrUrl}
                alt="Payment QR"
                fill
                sizes="128px"
                className="object-contain"
              />
            </div>
            <div className="flex-1 space-y-2 text-xs">
              <p className="break-all text-muted">{paymentQrUrl}</p>
              <button
                type="button"
                onClick={handleRemoveQr}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-700 transition hover:bg-red-100"
              >
                ลบ QR
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">ร้านยังไม่อัปโหลด QR ชำระเงิน</p>
        )}
      </div>

      <div className={`${card} ${cardPad} space-y-3 border-red-100/50`}>
        <SectionHeading
          title="โซนอันตราย"
          description="ลบร้านนี้ออกจากระบบ — ลบข้อมูลทั้งหมดของร้าน"
        />
        <button
          type="button"
          onClick={handleDeleteRestaurant}
          disabled={deleting}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
        >
          {deleting ? "กำลังลบ..." : "ลบร้านนี้"}
        </button>
      </div>
    </div>
  );
}
