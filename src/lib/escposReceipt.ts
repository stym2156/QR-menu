// Build an ESC/POS byte stream for a receipt printable on 58mm thermal
// printers. Thai text is encoded as CP874 (TIS-620) which most cheap
// thermal printers support natively when switched to codepage 21.
//
// Layout target (32 columns at default font on 58mm):
//
//   ============================
//          Restaurant Name
//        Table 5 · 22:15
//   ----------------------------
//   ผัดไทยกุ้งสด           ×2
//      ₭ 60,000 × 2
//   ชาเขียวนม              ×1
//      ₭ 30,000 × 1
//   ----------------------------
//   Subtotal           150,000
//   Service 10%         15,000
//   VAT 7%              11,550
//   ----------------------------
//   TOTAL              176,550
//   Paid by                Cash
//   ============================
//          Thank you!

import { calculateBill } from "./bill";
import { formatKIP, formatTime } from "./format";
import { DICTIONARIES } from "./i18n/dict";
import { DEFAULT_LOCALE, type Locale } from "./i18n/types";
import { pickName } from "./i18n/localized";
import type { Menu, Order, PaymentMethod } from "./types";

// ============================================================
// ESC/POS command constants
// ============================================================
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const INIT = new Uint8Array([ESC, 0x40]); // initialize printer
const CODEPAGE_CP874 = new Uint8Array([ESC, 0x74, 0x14]); // codepage 20 (Thai)
const ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]);
const ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]);
const SIZE_NORMAL = new Uint8Array([ESC, 0x21, 0x00]);
const SIZE_DOUBLE = new Uint8Array([ESC, 0x21, 0x30]); // double w + double h
const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
const FEED_LINES = (n: number) => new Uint8Array([ESC, 0x64, n]);
const CUT = new Uint8Array([GS, 0x56, 0x42, 0x00]); // partial cut + 3-line feed

// ============================================================
// Text encoding (Unicode → CP874 / TIS-620)
// ============================================================
function encodeChar(code: number): number {
  if (code <= 0x7e) return code;
  // Thai consonants + vowels: U+0E01–U+0E3A → 0xA1–0xDA
  if (code >= 0x0e01 && code <= 0x0e3a) return code - 0x0e01 + 0xa1;
  // Thai currency + tone marks + digits: U+0E3F–U+0E5B → 0xDF–0xFB
  if (code >= 0x0e3f && code <= 0x0e5b) return code - 0x0e3f + 0xdf;
  // Replacement for chars we can't encode.
  return 0x3f; // '?'
}

function encodeText(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0x3f;
    out.push(encodeChar(code));
  }
  return new Uint8Array(out);
}

// ============================================================
// Layout helpers (column padding done in CP874 bytes, not chars,
// because some Thai vowels combine visually with the preceding
// consonant — we want byte-width alignment for the printer)
// ============================================================
const WIDTH_NORMAL = 32; // chars per line at default font on 58mm

function leftRight(left: string, right: string, width = WIDTH_NORMAL): string {
  const leftBytes = encodeText(left).length;
  const rightBytes = encodeText(right).length;
  const space = Math.max(1, width - leftBytes - rightBytes);
  return left + " ".repeat(space) + right;
}

function rule(char: string, width = WIDTH_NORMAL): string {
  return char.repeat(width);
}

// ============================================================
// Builder
// ============================================================
interface BuildReceiptInput {
  restaurantName: string;
  tableNumber: number;
  orders: Order[];
  menus: Menu[];
  method: PaymentMethod;
  paidAt: string;
  serviceChargePct: number;
  vatPct: number;
  locale?: Locale;
}

export function buildReceiptBytes(input: BuildReceiptInput): Uint8Array {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const dict = DICTIONARIES[locale];
  const fallback = DICTIONARIES[DEFAULT_LOCALE];
  const t = (key: string, vars?: Record<string, string | number>): string => {
    const v = dict[key] ?? fallback[key] ?? key;
    if (!vars) return v;
    return v.replace(/\{(\w+)\}/g, (_, name: string) =>
      name in vars ? String(vars[name]) : `{${name}}`,
    );
  };

  const menuMap = new Map(input.menus.map((m) => [m.id, m]));
  const subtotal = input.orders.reduce(
    (s, o) => (o.status === "cancelled" ? s : s + Number(o.total)),
    0,
  );
  const bill = calculateBill(subtotal, input.serviceChargePct, input.vatPct);

  const chunks: Uint8Array[] = [];
  const push = (b: Uint8Array): void => {
    chunks.push(b);
  };
  const line = (s = ""): void => {
    push(encodeText(s));
    push(new Uint8Array([LF]));
  };

  // Header
  push(INIT);
  push(CODEPAGE_CP874);
  push(ALIGN_CENTER);
  push(SIZE_DOUBLE);
  push(BOLD_ON);
  line(input.restaurantName);
  push(BOLD_OFF);
  push(SIZE_NORMAL);
  line(t("receipt.table_n", { n: input.tableNumber }));
  const date = new Date(input.paidAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  line(`${date} · ${formatTime(input.paidAt)}`);
  push(ALIGN_LEFT);
  line(rule("="));

  // Items
  for (const order of input.orders) {
    if (order.status === "cancelled") continue;
    for (const item of order.items) {
      const menu = menuMap.get(item.menu_id);
      const name = menu
        ? pickName(menu, locale)
        : t("receipt.menu_removed");
      const unit = menu?.price ?? 0;
      const lineTotal = unit * item.qty;
      line(leftRight(name, `×${item.qty}`));
      line(leftRight(`  ${formatKIP(unit)} × ${item.qty}`, formatKIP(lineTotal)));
      if (item.note) {
        line(`  📝 ${item.note}`);
      }
    }
  }
  line(rule("-"));

  // Totals
  line(leftRight(t("receipt.subtotal"), formatKIP(bill.subtotal)));
  if (bill.serviceChargePct > 0) {
    line(
      leftRight(
        t("receipt.service", { pct: bill.serviceChargePct }),
        formatKIP(bill.serviceCharge),
      ),
    );
  }
  if (bill.vatPct > 0) {
    line(
      leftRight(t("receipt.vat", { pct: bill.vatPct }), formatKIP(bill.vat)),
    );
  }
  line(rule("-"));

  push(SIZE_DOUBLE);
  push(BOLD_ON);
  line(leftRight(t("receipt.grand"), formatKIP(bill.grandTotal), 16));
  push(BOLD_OFF);
  push(SIZE_NORMAL);

  line(leftRight(t("receipt.paid_by"), t(`bill.settled.method.${input.method}`)));
  line(rule("="));

  // Footer
  push(ALIGN_CENTER);
  line(t("receipt.thanks"));

  push(FEED_LINES(3));
  push(CUT);

  // Concatenate all chunks into one byte stream.
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
