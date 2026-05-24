"use client";

// Minimal Web Bluetooth type declarations — TS lib.dom doesn't ship these.
// We only use a small subset; declare just what we need.
type BluetoothServiceUUID = number | string;
interface BluetoothRemoteGATTCharacteristic {
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
  };
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}
interface BluetoothRemoteGATTService {
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}
interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}
interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: "gattserverdisconnected", listener: () => void): void;
  removeEventListener(
    type: "gattserverdisconnected",
    listener: () => void,
  ): void;
}
interface BluetoothRequestDeviceOptions {
  acceptAllDevices?: boolean;
  filters?: Array<{ services?: BluetoothServiceUUID[]; name?: string }>;
  optionalServices?: BluetoothServiceUUID[];
}
interface BluetoothNavigator {
  requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>;
}

// Web Bluetooth wrapper for ESC/POS thermal printers (58mm/80mm BLE models).
//
// Browser support:
//   ✅ Chrome / Edge / Opera on Desktop + Android
//   ❌ Safari (iOS/macOS), Firefox
//
// Printer support:
//   ✅ BLE printers with a writable GATT characteristic (most newer
//      58mm/80mm thermal printers like Munbyn ITPP200-BLE, Xprinter XP-58,
//      Goojprt PT-210 BLE variants, etc.)
//   ❌ Classic SPP-only printers — Web Bluetooth can't talk to SPP.
//
// We auto-discover the writable characteristic by walking all GATT services
// on the device, so we don't have to maintain a vendor lookup table.

interface PrinterRef {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

const STORAGE_KEY = "qrmenu.btprinter.lastDeviceId";

let activePrinter: PrinterRef | null = null;
const listeners = new Set<() => void>();

function getBluetooth(): BluetoothNavigator | null {
  if (typeof window === "undefined") return null;
  const bt = (navigator as Navigator & { bluetooth?: BluetoothNavigator })
    .bluetooth;
  return bt ?? null;
}

export function isBluetoothSupported(): boolean {
  return getBluetooth() !== null;
}

export function getActivePrinter(): { name: string; id: string } | null {
  if (!activePrinter) return null;
  return {
    name: activePrinter.device.name ?? "BT printer",
    id: activePrinter.device.id,
  };
}

export function onPrinterChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emitChange(): void {
  for (const cb of listeners) cb();
}

// Common service UUIDs across cheap thermal printers. Listed in optionalServices
// so the browser allows us to discover them post-pairing.
const COMMON_SERVICE_UUIDS: BluetoothServiceUUID[] = [
  0xff00,
  0xff10,
  0xffe0,
  0x18f0,
  0x1101,
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC / Microchip
  "0000ff00-0000-1000-8000-00805f9b34fb",
];

export async function requestAndConnect(): Promise<{
  ok: true;
  name: string;
} | { ok: false; error: string }> {
  const bt = getBluetooth();
  if (!bt) {
    return {
      ok: false,
      error:
        "เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth (ลอง Chrome หรือ Edge บน Desktop/Android)",
    };
  }
  try {
    const device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: COMMON_SERVICE_UUIDS,
    });
    if (!device.gatt) {
      return { ok: false, error: "อุปกรณ์นี้ไม่รองรับ GATT" };
    }
    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    let writeChar: BluetoothRemoteGATTCharacteristic | null = null;
    for (const svc of services) {
      const chars = await svc.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.write || ch.properties.writeWithoutResponse) {
          writeChar = ch;
          break;
        }
      }
      if (writeChar) break;
    }
    if (!writeChar) {
      try {
        device.gatt.disconnect();
      } catch {
        /* noop */
      }
      return {
        ok: false,
        error:
          "หา characteristic สำหรับเขียนข้อมูลไม่เจอ — อาจไม่ใช่ BLE thermal printer",
      };
    }

    device.addEventListener("gattserverdisconnected", handleDisconnected);

    activePrinter = { device, characteristic: writeChar };
    try {
      localStorage.setItem(STORAGE_KEY, device.id);
    } catch {
      /* noop */
    }
    emitChange();
    return { ok: true, name: device.name ?? "BT printer" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User cancelled")) {
      return { ok: false, error: "ยกเลิกการเชื่อมต่อ" };
    }
    return { ok: false, error: message };
  }
}

function handleDisconnected(): void {
  activePrinter = null;
  emitChange();
}

export function disconnectPrinter(): void {
  if (!activePrinter) return;
  try {
    activePrinter.device.removeEventListener(
      "gattserverdisconnected",
      handleDisconnected,
    );
    activePrinter.device.gatt?.disconnect();
  } catch {
    /* noop */
  }
  activePrinter = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  emitChange();
}

// Chunked write: BLE has a small MTU (typically 20–512 bytes). Sending the
// whole receipt at once tends to fail or print partial data.
export async function printBytes(
  bytes: Uint8Array,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!activePrinter) {
    return { ok: false, error: "ยังไม่ได้เชื่อมต่อเครื่องพิมพ์" };
  }
  const char = activePrinter.characteristic;
  // Reconnect if the GATT server dropped between prints.
  if (!activePrinter.device.gatt?.connected) {
    try {
      await activePrinter.device.gatt?.connect();
    } catch (err) {
      return {
        ok: false,
        error: `เชื่อมต่อใหม่ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Use 180-byte chunks — most BLE printers reliably handle this size.
  // Larger chunks (512) work on some, fail silently on others.
  const CHUNK = 180;
  try {
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const chunk = bytes.slice(i, i + CHUNK);
      if (char.properties.writeWithoutResponse) {
        await char.writeValueWithoutResponse(chunk);
      } else {
        await char.writeValueWithResponse(chunk);
      }
      // Small pause so the printer firmware can drain its buffer.
      await new Promise((r) => setTimeout(r, 20));
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
