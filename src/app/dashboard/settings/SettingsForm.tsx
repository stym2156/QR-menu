"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FormField,
  SectionHeading,
  buttonPrimary,
  card,
  cardPad,
  input,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Restaurant } from "@/lib/types";

interface Props {
  restaurant: Restaurant;
  userEmail: string;
}

export default function SettingsForm({ restaurant, userEmail }: Props) {
  const supabase = createClient();
  const toast = useToast();

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
  const [savingShop, setSavingShop] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function saveShop(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("กรุณาใส่ชื่อร้าน");
      return;
    }
    const service = Number(serviceCharge);
    const vat = Number(vatPct);
    if (!Number.isFinite(service) || service < 0 || service > 100) {
      toast.error("Service charge ต้องเป็น 0–100");
      return;
    }
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      toast.error("VAT ต้องเป็น 0–100");
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
      })
      .eq("id", restaurant.id);
    setSavingShop(false);
    if (error) {
      toast.error(`บันทึกไม่สำเร็จ: ${error.message}`);
      return;
    }
    toast.success("บันทึกการตั้งค่าแล้ว");
  }

  async function savePassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error("รหัสผ่านใหม่ต้องอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("รหัสผ่านยืนยันไม่ตรงกัน");
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
      toast.error("รหัสผ่านปัจจุบันไม่ถูกต้อง");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPw,
    });
    setSavingPw(false);
    if (updateError) {
      toast.error(`เปลี่ยนรหัสผ่านไม่สำเร็จ: ${updateError.message}`);
      return;
    }
    toast.success("เปลี่ยนรหัสผ่านแล้ว");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }

  return (
    <div className="space-y-5">
      <form onSubmit={saveShop} className={`${card} ${cardPad} space-y-5`}>
        <SectionHeading
          title="ข้อมูลร้าน"
          description="แก้ไขชื่อและสถานะรับออเดอร์"
        />

        <FormField label="ชื่อร้าน">
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
              <div className="text-sm font-medium text-ink">รับออเดอร์</div>
              <p className="mt-0.5 text-xs text-muted">
                ปิดเมื่อร้านปิดทำการ — ลูกค้าจะเห็นข้อความ &quot;ร้านปิดอยู่&quot; แทนเมนู
              </p>
            </div>
            <label
              className="flex shrink-0 cursor-pointer items-center gap-2 select-none"
              title="เปิด/ปิดรับออเดอร์"
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
          <FormField label="เวลาเปิด" hint="ไม่บังคับ">
            <input
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className={`${input} tabular-nums`}
            />
          </FormField>
          <FormField label="เวลาปิด" hint="ไม่บังคับ">
            <input
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className={`${input} tabular-nums`}
            />
          </FormField>
        </div>

        <div className="rounded-2xl border border-line bg-canvas/40 p-4 space-y-3">
          <div className="text-sm font-medium text-ink">ค่าบริการ + ภาษี</div>
          <p className="text-xs text-muted">
            ตั้งเป็น 0 ถ้าไม่ต้องการคิด · VAT จะถูกคำนวณจาก (ยอด + service)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Service charge %">
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
            <FormField label="VAT %">
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

        <button
          type="submit"
          disabled={savingShop}
          className={`${buttonPrimary} w-full`}
        >
          {savingShop ? "กำลังบันทึก..." : "บันทึกข้อมูลร้าน"}
        </button>
      </form>

      <form onSubmit={savePassword} className={`${card} ${cardPad} space-y-4`}>
        <SectionHeading
          title="เปลี่ยนรหัสผ่าน"
          description={`บัญชี ${userEmail}`}
        />

        <FormField label="รหัสผ่านปัจจุบัน">
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
            className={input}
            autoComplete="current-password"
          />
        </FormField>

        <FormField label="รหัสผ่านใหม่" hint="อย่างน้อย 6 ตัวอักษร">
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={6}
            className={input}
            autoComplete="new-password"
          />
        </FormField>

        <FormField label="ยืนยันรหัสผ่านใหม่">
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
            minLength={6}
            className={input}
            autoComplete="new-password"
          />
        </FormField>

        <button
          type="submit"
          disabled={savingPw}
          className={`${buttonPrimary} w-full`}
        >
          {savingPw ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
        </button>
      </form>
    </div>
  );
}
