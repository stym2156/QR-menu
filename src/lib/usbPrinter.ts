"use client";

// WebUSB wrapper for ESC/POS thermal printers connected via USB cable.
//
// Browser support:
//   ✅ Chrome / Edge on Desktop + Android
//   ❌ Safari (iOS / macOS), Firefox
//
// Permission model:
//   First call must come from a user gesture (click). Browser shows a
//   device picker. After the user grants permission, the page can call
//   navigator.usb.getDevices() to find paired devices without re-prompting
//   (we use that on next page load to auto-reconnect).
//
// We filter by USB printer class (0x07) to surface only printers in the
// picker. If a vendor exposes the printer with class 0xFF (vendor-specific)
// we also include that — many cheap thermal printers do this.

// Minimal WebUSB type declarations — TS lib.dom doesn't ship them.
interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
}
interface USBRequestDeviceOptions {
  filters: USBDeviceFilter[];
}
interface USBAlternateInterface {
  endpoints: USBEndpoint[];
}
interface USBInterface {
  interfaceNumber: number;
  alternate: USBAlternateInterface;
  alternates: USBAlternateInterface[];
}
interface USBConfiguration {
  interfaces: USBInterface[];
}
interface USBEndpoint {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "isochronous";
  packetSize: number;
}
interface USBOutTransferResult {
  bytesWritten: number;
  status: "ok" | "stall" | "babble";
}
interface USBDevice {
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  vendorId: number;
  productId: number;
  configuration: USBConfiguration | null;
  configurations: USBConfiguration[];
  opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(value: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferOut(
    endpointNumber: number,
    data: BufferSource,
  ): Promise<USBOutTransferResult>;
}
interface USBNavigator {
  requestDevice(options: USBRequestDeviceOptions): Promise<USBDevice>;
  getDevices(): Promise<USBDevice[]>;
}

interface ActiveUsbPrinter {
  device: USBDevice;
  interfaceNumber: number;
  endpointNumber: number;
}

let activePrinter: ActiveUsbPrinter | null = null;
const listeners = new Set<() => void>();

function getUsb(): USBNavigator | null {
  if (typeof window === "undefined") return null;
  const u = (navigator as Navigator & { usb?: USBNavigator }).usb;
  return u ?? null;
}

export function isUsbSupported(): boolean {
  return getUsb() !== null;
}

export function getActiveUsbPrinter(): { name: string } | null {
  if (!activePrinter) return null;
  return {
    name:
      activePrinter.device.productName ||
      activePrinter.device.manufacturerName ||
      "USB printer",
  };
}

export function onUsbPrinterChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emitChange(): void {
  for (const cb of listeners) cb();
}

// Try to find an OUT bulk endpoint on an opened device. Returns
// interface + endpoint numbers, or null if we can't find one.
function findWriteEndpoint(
  device: USBDevice,
): { interfaceNumber: number; endpointNumber: number } | null {
  for (const cfg of device.configurations) {
    for (const iface of cfg.interfaces) {
      for (const alt of iface.alternates) {
        for (const ep of alt.endpoints) {
          if (ep.direction === "out" && ep.type === "bulk") {
            return {
              interfaceNumber: iface.interfaceNumber,
              endpointNumber: ep.endpointNumber,
            };
          }
        }
      }
    }
  }
  return null;
}

async function setupDevice(
  device: USBDevice,
): Promise<
  | { ok: true; printer: ActiveUsbPrinter }
  | { ok: false; error: string }
> {
  try {
    if (!device.opened) await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    const ep = findWriteEndpoint(device);
    if (!ep) {
      try {
        await device.close();
      } catch {
        /* noop */
      }
      return {
        ok: false,
        error:
          "หา endpoint สำหรับเขียนข้อมูลไม่เจอ — อาจไม่ใช่ printer หรือยังถือ driver อยู่",
      };
    }
    await device.claimInterface(ep.interfaceNumber);
    return {
      ok: true,
      printer: {
        device,
        interfaceNumber: ep.interfaceNumber,
        endpointNumber: ep.endpointNumber,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function requestAndConnectUsb(): Promise<
  { ok: true; name: string } | { ok: false; error: string }
> {
  const usb = getUsb();
  if (!usb) {
    return {
      ok: false,
      error:
        "เบราว์เซอร์นี้ไม่รองรับ WebUSB (ลอง Chrome หรือ Edge บน Desktop/Android)",
    };
  }
  try {
    const device = await usb.requestDevice({
      // class 7 = printer, 0xFF = vendor-specific (many cheap thermal
      // printers register here instead of the standard printer class).
      filters: [{ classCode: 0x07 }, { classCode: 0xff }],
    });
    const result = await setupDevice(device);
    if (!result.ok) return result;
    activePrinter = result.printer;
    emitChange();
    return {
      ok: true,
      name: device.productName || device.manufacturerName || "USB printer",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Chromium-style cancellation messages we want to swallow.
    if (
      message.includes("No device selected") ||
      message.includes("user cancelled")
    ) {
      return { ok: false, error: "ยกเลิกการเชื่อมต่อ" };
    }
    return { ok: false, error: message };
  }
}

// Reuse a previously-granted device without re-prompting the user. Call
// this on page mount to auto-restore the printer.
export async function tryReconnectUsb(): Promise<boolean> {
  const usb = getUsb();
  if (!usb) return false;
  try {
    const devices = await usb.getDevices();
    if (devices.length === 0) return false;
    // If user has paired more than one, just pick the first — owner can
    // re-pick via requestAndConnectUsb if they need a specific one.
    const result = await setupDevice(devices[0]);
    if (!result.ok) return false;
    activePrinter = result.printer;
    emitChange();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectUsb(): Promise<void> {
  if (!activePrinter) return;
  const { device, interfaceNumber } = activePrinter;
  activePrinter = null;
  try {
    await device.releaseInterface(interfaceNumber);
  } catch {
    /* noop */
  }
  try {
    await device.close();
  } catch {
    /* noop */
  }
  emitChange();
}

export async function printBytesUsb(
  bytes: Uint8Array,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!activePrinter) {
    return { ok: false, error: "ยังไม่ได้เชื่อมต่อเครื่องพิมพ์ USB" };
  }
  const { device, endpointNumber } = activePrinter;
  try {
    // USB bulk endpoints can handle larger chunks than BLE (typically 512
    // or 64 byte packets); transferOut handles segmentation internally,
    // so we can just send everything in one call.
    // Copy into a fresh ArrayBuffer-backed Uint8Array — the input might be
    // ArrayBufferLike (SharedArrayBuffer-capable) which TS narrows away
    // from BufferSource. The copy is cheap relative to USB transfer time.
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    const result = await device.transferOut(endpointNumber, copy);
    if (result.status !== "ok") {
      return { ok: false, error: `transfer status: ${result.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
