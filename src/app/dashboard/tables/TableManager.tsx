"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import {
  EmptyState,
  FormField,
  SectionHeading,
  buttonPrimary,
  buttonSecondary,
  card,
  cardPad,
  input,
} from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast";
import type { DiningTable } from "@/lib/types";

interface Props {
  restaurantId: string;
  initialTables: DiningTable[];
}

export default function TableManager({ restaurantId, initialTables }: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [tables, setTables] = useState<DiningTable[]>(initialTables);
  const [tableNumber, setTableNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const num = parseInt(tableNumber, 10);
    if (!Number.isFinite(num) || num <= 0) {
      setError("เลขโต๊ะต้องเป็นตัวเลขบวก");
      setBusy(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("tables")
      .insert({ restaurant_id: restaurantId, table_number: num })
      .select()
      .single();

    if (insertError || !data) {
      setError(`เพิ่มโต๊ะไม่สำเร็จ: ${insertError?.message}`);
      setBusy(false);
      return;
    }

    setTables((prev) =>
      [...prev, data as DiningTable].sort((a, b) => a.table_number - b.table_number),
    );
    setTableNumber("");
    setBusy(false);
  }

  async function deleteTable(table: DiningTable): Promise<void> {
    const ok = await confirm({
      title: `ลบโต๊ะที่ ${table.table_number}?`,
      description: "QR ของโต๊ะนี้จะใช้ไม่ได้ทันที ออเดอร์ที่ค้างอยู่จะถูกลบด้วย",
      confirmText: "ลบโต๊ะ",
      tone: "danger",
    });
    if (!ok) return;
    setTables((prev) => prev.filter((t) => t.id !== table.id));
    const { error } = await supabase.from("tables").delete().eq("id", table.id);
    if (error) toast.error(`ลบไม่สำเร็จ: ${error.message}`);
    else toast.success(`ลบโต๊ะ ${table.table_number} แล้ว`);
  }

  async function downloadQR(table: DiningTable): Promise<void> {
    const url = `${origin}/menu/${restaurantId}/${table.id}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 600, margin: 2 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `table-${table.table_number}.png`;
    link.click();
  }

  async function toggleOpen(table: DiningTable): Promise<void> {
    const next = !table.is_open;
    setTables((prev) =>
      prev.map((t) => (t.id === table.id ? { ...t, is_open: next } : t)),
    );
    const { error } = await supabase
      .from("tables")
      .update({ is_open: next })
      .eq("id", table.id);
    if (error) {
      toast.error(`อัปเดตไม่สำเร็จ: ${error.message}`);
      setTables((prev) =>
        prev.map((t) => (t.id === table.id ? { ...t, is_open: !next } : t)),
      );
      return;
    }
    toast.success(
      next
        ? `เปิดโต๊ะ ${table.table_number} แล้ว — ลูกค้าสั่งได้`
        : `ปิดโต๊ะ ${table.table_number} แล้ว — สแกนสั่งไม่ได้`,
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <form onSubmit={handleAdd} className={`${card} ${cardPad} h-fit space-y-4 lg:sticky lg:top-20`}>
        <SectionHeading title="เพิ่มโต๊ะ" />

        <FormField label="เลขโต๊ะ">
          <input
            type="number"
            min="1"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            required
            className={`${input} tabular-nums`}
            placeholder="1"
          />
        </FormField>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button type="submit" disabled={busy} className={`${buttonPrimary} w-full`}>
          {busy ? "กำลังเพิ่ม..." : "+ เพิ่มโต๊ะ"}
        </button>
      </form>

      <div>
        {tables.length === 0 ? (
          <EmptyState
            title="ยังไม่มีโต๊ะ"
            description="สร้างโต๊ะแรกเพื่อให้ลูกค้าสแกน QR สั่งอาหาร"
          />
        ) : (
          <>
            <SectionHeading title="โต๊ะทั้งหมด" description={`${tables.length} โต๊ะ`} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  restaurantId={restaurantId}
                  origin={origin}
                  onDelete={() => deleteTable(table)}
                  onDownload={() => downloadQR(table)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface TableCardProps {
  table: DiningTable;
  restaurantId: string;
  origin: string;
  onDelete: () => void;
  onDownload: () => void;
}

function TableCard({
  table,
  restaurantId,
  origin,
  onDelete,
  onDownload,
}: TableCardProps) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const url = origin ? `${origin}/menu/${restaurantId}/${table.id}` : "";

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void QRCode.toDataURL(url, { width: 240, margin: 1 }).then((src) => {
      if (!cancelled) setQrSrc(src);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-xs font-semibold tabular-nums text-surface">
            {table.table_number}
          </span>
          <span className="text-sm font-medium text-ink">โต๊ะที่ {table.table_number}</span>
        </div>
        <button
          onClick={onDelete}
          className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600"
        >
          ลบ
        </button>
      </div>

      <div className="flex gap-3">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas p-1.5">
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrSrc}
              alt={`QR table ${table.table_number}`}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted">
              loading...
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-3 break-all text-[11px] leading-relaxed text-accent-600 hover:underline"
          >
            {url}
          </a>
          <button onClick={onDownload} className={`${buttonSecondary} w-full py-1.5 text-xs`}>
            ดาวน์โหลด PNG
          </button>
        </div>
      </div>
    </div>
  );
}
