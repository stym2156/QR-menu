"use client";

import { useEffect, useState } from "react";
import {
  disconnectPrinter,
  getActivePrinter,
  isBluetoothSupported,
  onPrinterChange,
  printBytes,
  requestAndConnect,
} from "@/lib/btPrinter";
import { buildReceiptBytes } from "@/lib/escposReceipt";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Menu, Order, PaymentMethod } from "@/lib/types";
import type { Locale } from "@/lib/i18n/types";

interface PrintArgs {
  restaurantName: string;
  tableNumber: number;
  zoneName?: string | null;
  orders: Order[];
  menus: Menu[];
  method: PaymentMethod;
  paidAt: string;
  serviceChargePct: number;
  vatPct: number;
  locale: Locale;
}

interface BluetoothPrinterButtonProps {
  // Optional print job. When provided the print button is shown.
  job?: PrintArgs;
  // Compact (icon only) variant for tight spaces.
  variant?: "default" | "compact";
}

export function BluetoothPrinterButton({
  job,
  variant = "default",
}: BluetoothPrinterButtonProps) {
  const toast = useToast();
  const { t } = useT();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [printer, setPrinter] = useState(getActivePrinter());
  const [connecting, setConnecting] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    setSupported(isBluetoothSupported());
    return onPrinterChange(() => setPrinter(getActivePrinter()));
  }, []);

  async function handleConnect(): Promise<void> {
    setConnecting(true);
    const result = await requestAndConnect();
    setConnecting(false);
    if (result.ok) {
      toast.success(t("bt.connected", { name: result.name }));
    } else if (result.error !== "ยกเลิกการเชื่อมต่อ") {
      toast.error(result.error);
    }
  }

  function handleDisconnect(): void {
    disconnectPrinter();
    toast.success(t("bt.disconnected"));
  }

  async function handlePrint(): Promise<void> {
    if (!job) return;
    setPrinting(true);
    const bytes = buildReceiptBytes(job);
    const result = await printBytes(bytes);
    setPrinting(false);
    if (result.ok) {
      toast.success(t("bt.printed"));
    } else {
      toast.error(t("bt.print_failed", { error: result.error }));
    }
  }

  if (supported === null) return null; // first render before client mount
  if (!supported) {
    // Render a tiny hint instead of a button so the layout doesn't shift.
    return variant === "compact" ? null : (
      <p className="text-[11px] text-muted">{t("bt.unsupported")}</p>
    );
  }

  // Not yet connected → show single Connect button.
  if (!printer) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/30 disabled:opacity-60"
      >
        <BtIcon />
        {connecting ? t("bt.connecting") : t("bt.connect")}
      </button>
    );
  }

  // Connected → show status + print + disconnect.
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {printer.name}
      </span>
      {job ? (
        <button
          type="button"
          onClick={handlePrint}
          disabled={printing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-surface transition hover:bg-ink/85 disabled:opacity-60"
        >
          <BtIcon />
          {printing ? t("bt.printing") : t("bt.print")}
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleDisconnect}
        className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-canvas hover:text-ink"
      >
        {t("bt.disconnect")}
      </button>
    </div>
  );
}

function BtIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3.5 w-3.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m7 7 10 10-5 5V2l5 5L7 17"
      />
    </svg>
  );
}
