// Browser-print version of the kitchen ticket — works with ANY printer
// the OS knows about (USB-wired thermal, networked, AirPrint, etc.). Used
// as a fallback when the cook doesn't have a Web Bluetooth / WebUSB-capable
// printer, OR when the owner runs Chrome with --kiosk-printing for true
// silent print on a wired thermal printer.
//
// Mirrors the receipt.ts iframe pattern (fixed in commit b7d6d22):
// write HTML first, then wait for fonts/images, THEN call window.print().
// Hooking iframe.onload fires before doc.write() and prints a blank page.

import { formatDateTime } from "./format";
import { DICTIONARIES } from "./i18n/dict";
import { DEFAULT_LOCALE, type Locale } from "./i18n/types";
import { pickName } from "./i18n/localized";
import type { Menu, Order } from "./types";

interface PrintKitchenTicketInput {
  order: Order;
  menus: Menu[];
  tableNumber: number;
  zoneName?: string | null;
  // 58 / 76 / 80. Drives the @page width hint. Anything ≥ 100 falls into
  // the auto-A4 branch via CSS media query (same trick as receipt.ts).
  widthMm: number;
  locale?: Locale;
  // Optional badge — "REPRINT" / "TEST" so the cook doesn't double-cook.
  badge?: string;
}

export function printKitchenTicketSystem(input: PrintKitchenTicketInput): void {
  const html = renderHTML(input);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  const cleanup = (): void => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    cleanup();
    alert("ไม่สามารถสร้าง kitchen ticket ได้ — กรุณาลองใหม่");
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const doPrint = (): void => {
    try {
      win.focus();
      win.print();
    } finally {
      // print() returns once the dialog opens (or immediately under
      // kiosk mode). Give the iframe a beat to flush, then drop it.
      setTimeout(cleanup, 1000);
    }
  };

  const fonts =
    (win.document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  const fontsReady = fonts?.ready ?? Promise.resolve();
  // Kitchen tickets have no images today but kept the wait for safety.
  Promise.all([fontsReady]).then(doPrint).catch(doPrint);
}

function renderHTML(input: PrintKitchenTicketInput): string {
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

  let totalQty = 0;
  let lineCount = 0;
  const rows: string[] = [];
  for (const item of input.order.items) {
    const menu = menuMap.get(item.menu_id);
    const name = menu
      ? pickName(menu, locale)
      : t("kit.ticket.unknown_item");
    rows.push(`
      <li>
        <div class="item-row">
          <span class="item-name">${escape(name)}</span>
          <span class="item-qty">×${item.qty}</span>
        </div>
        ${item.note ? `<div class="item-note">📝 ${escape(item.note)}</div>` : ""}
      </li>
    `);
    totalQty += item.qty;
    lineCount += 1;
  }

  const shortId = input.order.id.slice(-4).toUpperCase();
  const tableLine = t("kit.ticket.table", { n: input.tableNumber });
  const zoneLine = input.zoneName?.trim() || null;
  const summaryLine = t("kit.ticket.summary", {
    items: lineCount,
    qty: totalQty,
  });

  // Same adaptive CSS approach as receipt.ts: tight under 100mm (thermal),
  // full-page above (A4/Letter/A3).
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<title>${escape(tableLine)} — ${escape(t("kit.tab.active"))}</title>
<style>
  @page { margin: 6mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Sarabun", sans-serif;
    margin: 0;
    padding: 0;
    color: #000;
    font-size: 12px;
    line-height: 1.35;
  }
  .badge {
    text-align: center;
    font-weight: 700;
    font-size: 11px;
    margin-bottom: 4px;
    padding: 2px 0;
    border: 1px dashed #000;
  }
  .header { text-align: center; }
  .zone {
    display: inline-block;
    border: 1px solid #000;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 2px;
  }
  h1 {
    font-size: 28px;
    margin: 4px 0;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .sub { font-size: 11px; color: #333; margin-bottom: 4px; }
  .rule { border-top: 1px dashed #000; margin: 6px 0; height: 0; }
  .double-rule { border-top: 2px solid #000; margin: 6px 0; height: 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 6px 0; border-bottom: 1px dotted #999; }
  li:last-child { border-bottom: 0; }
  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
  }
  .item-name { flex: 1; min-width: 0; }
  .item-qty { font-variant-numeric: tabular-nums; }
  .item-note {
    font-size: 11px;
    color: #444;
    padding-left: 10px;
    margin-top: 2px;
  }
  .summary {
    text-align: center;
    font-size: 11px;
    color: #444;
    padding: 6px 0;
  }

  /* Bigger paper = scale up so the cook can read from across the kitchen. */
  @media print and (min-width: 100mm) {
    @page { margin: 12mm; }
    body {
      max-width: 180mm;
      margin: 0 auto;
      font-size: 14pt;
      line-height: 1.5;
    }
    .badge { font-size: 12pt; padding: 4pt 0; margin-bottom: 12pt; }
    .zone { font-size: 13pt; padding: 3pt 10pt; margin-bottom: 6pt; }
    h1 { font-size: 36pt; margin: 12pt 0 4pt; }
    .sub { font-size: 13pt; margin-bottom: 12pt; }
    .rule, .double-rule { margin: 12pt 0; }
    li { padding: 10pt 0; }
    .item-row { font-size: 18pt; }
    .item-note { font-size: 12pt; padding-left: 14pt; }
    .summary { font-size: 13pt; padding: 12pt 0; }
  }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  ${input.badge ? `<div class="badge">** ${escape(input.badge)} **</div>` : ""}
  <div class="header">
    ${zoneLine ? `<div class="zone">${escape(zoneLine)}</div>` : ""}
    <h1>${escape(tableLine)}</h1>
    <div class="sub">#${escape(shortId)} · ${escape(formatDateTime(input.order.created_at))}</div>
  </div>
  <div class="double-rule"></div>
  <ul>${rows.join("")}</ul>
  <div class="rule"></div>
  <div class="summary">${escape(summaryLine)}</div>
</body>
</html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
