"use client";

// Unified facade over Web Bluetooth and WebUSB printer transports.
// Callers don't care which cable the printer uses — they just print bytes.
//
// Resolution rule: if both a BT and USB printer are connected at the same
// time, USB wins (it's wired = faster + more reliable). Owners would only
// connect one in practice, but the rule keeps behavior deterministic.

import {
  getActivePrinter as getActiveBt,
  onPrinterChange as onBtChange,
  printBytes as printBtBytes,
} from "./btPrinter";
import {
  getActiveUsbPrinter,
  onUsbPrinterChange,
  printBytesUsb,
} from "./usbPrinter";

export type PrinterKind = "bluetooth" | "usb";

export interface ActivePrinterInfo {
  kind: PrinterKind;
  name: string;
}

export function getActivePrinter(): ActivePrinterInfo | null {
  const usb = getActiveUsbPrinter();
  if (usb) return { kind: "usb", name: usb.name };
  const bt = getActiveBt();
  if (bt) return { kind: "bluetooth", name: bt.name };
  return null;
}

export function onAnyPrinterChange(cb: () => void): () => void {
  const offBt = onBtChange(cb);
  const offUsb = onUsbPrinterChange(cb);
  return () => {
    offBt();
    offUsb();
  };
}

export async function printToActivePrinter(
  bytes: Uint8Array,
): Promise<{ ok: true; kind: PrinterKind } | { ok: false; error: string }> {
  const active = getActivePrinter();
  if (!active) {
    return { ok: false, error: "ยังไม่ได้เชื่อมต่อเครื่องพิมพ์" };
  }
  const result =
    active.kind === "usb"
      ? await printBytesUsb(bytes)
      : await printBtBytes(bytes);
  if (!result.ok) return result;
  return { ok: true, kind: active.kind };
}
