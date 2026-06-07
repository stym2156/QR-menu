// Build an ESC/POS byte stream for a KITCHEN ticket — what the cook
// pulls from the printer when an order arrives. Unlike a customer
// receipt, this:
//   - shows item name + qty + note only (no prices, no totals, no QR)
//   - puts the table number in big bold up top so the cook sees it
//     from across the kitchen
//   - takes a width param so it formats correctly on 58 / 76 / 80mm
//     thermal paper (different col counts)

import { formatDateTime } from "./format";
import { DICTIONARIES } from "./i18n/dict";
import { DEFAULT_LOCALE, type Locale } from "./i18n/types";
import { pickName } from "./i18n/localized";
import type { Menu, Order } from "./types";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const INIT = new Uint8Array([ESC, 0x40]);
const CODEPAGE_CP874 = new Uint8Array([ESC, 0x74, 0x14]);
const ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]);
const ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]);
const SIZE_NORMAL = new Uint8Array([ESC, 0x21, 0x00]);
const SIZE_DOUBLE = new Uint8Array([ESC, 0x21, 0x30]); // double w + double h
const SIZE_TRIPLE_W = new Uint8Array([GS, 0x21, 0x22]); // triple-width-ish via GS !
const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
const FEED_LINES = (n: number) => new Uint8Array([ESC, 0x64, n]);
const CUT = new Uint8Array([GS, 0x56, 0x42, 0x00]);

function encodeChar(code: number): number {
  if (code <= 0x7e) return code;
  if (code >= 0x0e01 && code <= 0x0e3a) return code - 0x0e01 + 0xa1;
  if (code >= 0x0e3f && code <= 0x0e5b) return code - 0x0e3f + 0xdf;
  return 0x3f;
}

function encodeText(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    out.push(encodeChar(ch.codePointAt(0) ?? 0x3f));
  }
  return new Uint8Array(out);
}

// Char count per line at the printer's default font for each paper width.
function widthMmToCols(widthMm: number): number {
  if (widthMm >= 80) return 48;
  if (widthMm >= 76) return 42;
  return 32; // 58mm
}

function leftRight(left: string, right: string, cols: number): string {
  const leftBytes = encodeText(left).length;
  const rightBytes = encodeText(right).length;
  const space = Math.max(1, cols - leftBytes - rightBytes);
  return left + " ".repeat(space) + right;
}

function rule(char: string, cols: number): string {
  return char.repeat(cols);
}

interface BuildKitchenTicketInput {
  order: Order;
  menus: Menu[];
  tableNumber: number;
  zoneName?: string | null;
  widthMm: number;
  locale?: Locale;
  // Optional label printed at the top — usually short order id or "REPRINT".
  badge?: string;
}

export function buildKitchenTicketBytes(
  input: BuildKitchenTicketInput,
): Uint8Array {
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
  const cols = widthMmToCols(input.widthMm);
  const menuMap = new Map(input.menus.map((m) => [m.id, m]));

  const chunks: Uint8Array[] = [];
  const push = (b: Uint8Array): void => {
    chunks.push(b);
  };
  const line = (s = ""): void => {
    push(encodeText(s));
    push(new Uint8Array([LF]));
  };

  push(INIT);
  push(CODEPAGE_CP874);

  // Optional badge — e.g. "REPRINT" so the cook doesn't double-cook.
  if (input.badge) {
    push(ALIGN_CENTER);
    push(BOLD_ON);
    line(`** ${input.badge} **`);
    push(BOLD_OFF);
  }

  // Top rule + huge table number — visible from across the kitchen.
  push(ALIGN_LEFT);
  line(rule("=", cols));
  push(ALIGN_CENTER);
  if (input.zoneName) {
    push(BOLD_ON);
    line(input.zoneName);
    push(BOLD_OFF);
  }
  push(SIZE_TRIPLE_W);
  push(BOLD_ON);
  line(t("kit.ticket.table", { n: input.tableNumber }));
  push(BOLD_OFF);
  push(SIZE_NORMAL);
  // Short order id (last 4 of uuid) + date+time stamp so the cook can
  // tell tickets apart across shifts and reprints.
  const shortId = input.order.id.slice(-4).toUpperCase();
  line(`#${shortId} · ${formatDateTime(input.order.created_at)}`);
  push(ALIGN_LEFT);
  line(rule("=", cols));

  // Items. Each item gets its own block: bold name + qty, indented note.
  let totalQty = 0;
  let lineCount = 0;
  for (const item of input.order.items) {
    const menu = menuMap.get(item.menu_id);
    const name = menu
      ? pickName(menu, locale)
      : t("kit.ticket.unknown_item");
    push(SIZE_DOUBLE);
    push(BOLD_ON);
    line(leftRight(name, `x${item.qty}`, Math.floor(cols / 2)));
    push(BOLD_OFF);
    push(SIZE_NORMAL);
    if (item.note) {
      line(`  >> ${item.note}`);
    }
    line(""); // spacer between items so cook can scan
    totalQty += item.qty;
    lineCount += 1;
  }

  line(rule("-", cols));
  push(ALIGN_CENTER);
  line(
    t("kit.ticket.summary", { items: lineCount, qty: totalQty }),
  );
  push(ALIGN_LEFT);
  line(rule("=", cols));

  push(FEED_LINES(3));
  push(CUT);

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
