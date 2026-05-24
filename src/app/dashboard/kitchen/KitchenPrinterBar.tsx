"use client";

import { useEffect, useState } from "react";
import {
  disconnectPrinter as disconnectBt,
  isBluetoothSupported,
  requestAndConnect as connectBt,
} from "@/lib/btPrinter";
import {
  disconnectUsb,
  isUsbSupported,
  requestAndConnectUsb,
  tryReconnectUsb,
} from "@/lib/usbPrinter";
import {
  getActivePrinter,
  onAnyPrinterChange,
  printToActivePrinter,
} from "@/lib/printer";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/I18nProvider";

const AUTO_PRINT_KEY = "qrmenu.kitchen.autoPrint";
const SYSTEM_PRINT_KEY = "qrmenu.kitchen.systemPrint";

interface KitchenPrinterBarProps {
  // Notified when auto-print toggle changes — KitchenDisplay reads this to
  // decide whether to fire on new orders.
  onAutoPrintChange: (enabled: boolean) => void;
  // Notified when the "use OS print" toggle flips — used as a fallback
  // when no direct Bluetooth/USB printer is connected.
  onSystemPrintChange: (enabled: boolean) => void;
  // Build the ESC/POS test-print payload (for direct BT/USB printers).
  onTestPrint: () => Uint8Array;
  // Trigger a system-print test (window.print() via iframe). Used when
  // owner wants to verify the OS print pipeline works.
  onTestSystemPrint: () => void;
}

export function KitchenPrinterBar({
  onAutoPrintChange,
  onSystemPrintChange,
  onTestPrint,
  onTestSystemPrint,
}: KitchenPrinterBarProps) {
  const toast = useToast();
  const { t } = useT();
  const [hydrated, setHydrated] = useState(false);
  const [printer, setPrinter] = useState(getActivePrinter());
  const [btSupported, setBtSupported] = useState(false);
  const [usbSupported, setUsbSupported] = useState(false);
  const [connecting, setConnecting] = useState<"bt" | "usb" | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const [systemPrint, setSystemPrint] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setBtSupported(isBluetoothSupported());
    setUsbSupported(isUsbSupported());
    try {
      const saved = localStorage.getItem(AUTO_PRINT_KEY);
      if (saved !== null) setAutoPrint(saved === "true");
      const sys = localStorage.getItem(SYSTEM_PRINT_KEY);
      if (sys !== null) setSystemPrint(sys === "true");
    } catch {
      /* noop */
    }
    // Try to silently restore a previously-paired USB printer.
    void tryReconnectUsb();
    return onAnyPrinterChange(() => setPrinter(getActivePrinter()));
  }, []);

  useEffect(() => {
    onAutoPrintChange(autoPrint);
  }, [autoPrint, onAutoPrintChange]);

  useEffect(() => {
    onSystemPrintChange(systemPrint);
  }, [systemPrint, onSystemPrintChange]);

  function saveAutoPrint(value: boolean): void {
    setAutoPrint(value);
    try {
      localStorage.setItem(AUTO_PRINT_KEY, String(value));
    } catch {
      /* noop */
    }
  }

  function saveSystemPrint(value: boolean): void {
    setSystemPrint(value);
    try {
      localStorage.setItem(SYSTEM_PRINT_KEY, String(value));
    } catch {
      /* noop */
    }
  }

  async function handleConnectBt(): Promise<void> {
    setConnecting("bt");
    const result = await connectBt();
    setConnecting(null);
    if (result.ok) {
      toast.success(t("bt.connected", { name: result.name }));
      // Default auto-print on after a fresh connect.
      saveAutoPrint(true);
    } else if (result.error !== "ยกเลิกการเชื่อมต่อ") {
      toast.error(result.error);
    }
  }

  async function handleConnectUsb(): Promise<void> {
    setConnecting("usb");
    const result = await requestAndConnectUsb();
    setConnecting(null);
    if (result.ok) {
      toast.success(t("bt.connected", { name: result.name }));
      saveAutoPrint(true);
    } else if (result.error !== "ยกเลิกการเชื่อมต่อ") {
      toast.error(result.error);
    }
  }

  async function handleDisconnect(): Promise<void> {
    if (printer?.kind === "usb") {
      await disconnectUsb();
    } else {
      disconnectBt();
    }
    saveAutoPrint(false);
    toast.success(t("bt.disconnected"));
  }

  async function handleTestPrint(): Promise<void> {
    setPrinting(true);
    const result = await printToActivePrinter(onTestPrint());
    setPrinting(false);
    if (result.ok) {
      toast.success(t("kitchen_print.test_sent"));
    } else {
      toast.error(t("bt.print_failed", { error: result.error }));
    }
  }

  if (!hydrated) return null;

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface px-3 py-2.5">
      {/* Direct connection row — only visible if browser supports BT or USB. */}
      {btSupported || usbSupported ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!printer ? (
            <>
              <span className="text-xs text-muted">
                {t("kitchen_print.not_connected")}
              </span>
              <div className="flex gap-1.5">
                {btSupported ? (
                  <button
                    type="button"
                    onClick={handleConnectBt}
                    disabled={connecting !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/30 disabled:opacity-60"
                  >
                    <BtIcon />
                    {connecting === "bt"
                      ? t("bt.connecting")
                      : t("kitchen_print.connect_bt")}
                  </button>
                ) : null}
                {usbSupported ? (
                  <button
                    type="button"
                    onClick={handleConnectUsb}
                    disabled={connecting !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/30 disabled:opacity-60"
                  >
                    <UsbIcon />
                    {connecting === "usb"
                      ? t("bt.connecting")
                      : t("kitchen_print.connect_usb")}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {printer.kind === "usb" ? <UsbIcon /> : <BtIcon />}
                {printer.name}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <span className="text-xs text-muted">
                    {t("kitchen_print.auto")}
                  </span>
                  <input
                    type="checkbox"
                    checked={autoPrint}
                    onChange={(e) => saveAutoPrint(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="relative h-5 w-9 rounded-full bg-line transition-colors peer-checked:bg-emerald-500 after:absolute after:left-[2px] after:top-[2px] after:h-[16px] after:w-[16px] after:rounded-full after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:after:translate-x-4" />
                </label>
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={printing}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-ink/30 disabled:opacity-60"
                >
                  {printing ? t("bt.printing") : t("kitchen_print.test")}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-canvas hover:text-ink"
                >
                  {t("bt.disconnect")}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* System-print fallback row — always shown. Works with any printer
          installed at OS level (USB-wired thermal, network, AirPrint).
          Best paired with Chrome --kiosk-printing for silent auto-print. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
        <div className="min-w-0 flex-1">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={systemPrint}
              onChange={(e) => saveSystemPrint(e.target.checked)}
              className="peer sr-only"
            />
            <span className="relative h-5 w-9 rounded-full bg-line transition-colors peer-checked:bg-emerald-500 after:absolute after:left-[2px] after:top-[2px] after:h-[16px] after:w-[16px] after:rounded-full after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:after:translate-x-4" />
            <span className="text-xs font-medium text-ink">
              {t("kitchen_print.system")}
            </span>
          </label>
          <p className="ml-11 mt-0.5 text-[11px] text-muted">
            {t("kitchen_print.system.hint")}
          </p>
        </div>
        {systemPrint ? (
          <button
            type="button"
            onClick={onTestSystemPrint}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-ink/30"
          >
            {t("kitchen_print.test")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BtIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 7 10 10-5 5V2l5 5L7 17" />
    </svg>
  );
}

function UsbIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v18M9 5l3-3 3 3M7 11h10M9 17l3 3 3-3" />
    </svg>
  );
}
