// Generate a printable receipt HTML and open in a new window for print.
// Works with regular printers and 58/80mm thermal printers (browser handles scaling).

import { formatKIP, formatTime } from "@/lib/format";
import { calculateBill } from "@/lib/bill";
import { DICTIONARIES } from "@/lib/i18n/dict";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/types";
import { pickName } from "@/lib/i18n/localized";
import type { Menu, Order, PaymentMethod } from "@/lib/types";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function makeTranslator(locale: Locale): Translate {
  const dict = DICTIONARIES[locale];
  const fallback = DICTIONARIES[DEFAULT_LOCALE];
  return (key, vars) => {
    const v = dict[key] ?? fallback[key] ?? key;
    if (!vars) return v;
    return v.replace(/\{(\w+)\}/g, (_, name: string) =>
      name in vars ? String(vars[name]) : `{${name}}`,
    );
  };
}

interface PrintReceiptInput {
  restaurantName: string;
  tableNumber: number;
  orders: Order[];
  menus: Menu[];
  method: PaymentMethod;
  paidAt: string;
  serviceChargePct: number;
  vatPct: number;
  paymentQrUrl?: string | null;
  locale?: Locale;
}

export function printReceipt(input: PrintReceiptInput): void {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const t = makeTranslator(locale);
  const menuMap = new Map(input.menus.map((m) => [m.id, m]));
  const subtotal = input.orders.reduce((s, o) => s + Number(o.total), 0);
  const bill = calculateBill(subtotal, input.serviceChargePct, input.vatPct);

  const html = renderHTML({
    ...input,
    menuMap,
    bill,
    locale,
    t,
  });

  // Hidden iframe avoids popup blockers and works on mobile Safari where
  // window.open + document.write is unreliable.
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

  // DON'T use iframe.onload here — appendChild fires onload for the empty
  // about:blank document BEFORE doc.write() injects our HTML. At that point
  // document.images is empty, so the "wait for images" promise resolves
  // immediately and print() runs before the QR image has loaded.
  // (Second clicks "worked" only because the image was already in browser
  // cache.) Instead, write HTML first, then wait for images directly.
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    cleanup();
    alert("ไม่สามารถสร้างใบเสร็จได้ — กรุณาลองใหม่");
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
      // Some browsers fire onafterprint, others don't — clean up either way.
      setTimeout(cleanup, 1000);
    }
  };

  // After doc.close() the document is fully parsed and image elements exist
  // in the DOM (though their bytes may still be downloading). Treat complete
  // + naturalWidth>0 as truly loaded (some browsers report complete=true
  // momentarily before the image actually decodes).
  const fonts = (win.document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  const fontsReady = fonts?.ready ?? Promise.resolve();
  const imgs = Array.from(win.document.images);
  const imagesReady = Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
  Promise.all([fontsReady, imagesReady]).then(doPrint).catch(doPrint);
}

interface RenderInput extends PrintReceiptInput {
  menuMap: Map<string, Menu>;
  bill: ReturnType<typeof calculateBill>;
  locale: Locale;
  t: Translate;
}

function renderHTML(input: RenderInput): string {
  const t = input.t;
  const lines: string[] = [];
  let totalQty = 0;
  for (const order of input.orders) {
    for (const item of order.items) {
      const menu = input.menuMap.get(item.menu_id);
      const name = menu
        ? pickName(menu, input.locale)
        : t("receipt.menu_removed");
      const unit = menu?.price ?? 0;
      const lineTotal = unit * item.qty;
      totalQty += item.qty;
      lines.push(
        `<tr>
          <td>
            ${escape(name)}
            <div class="unit">${formatKIP(unit)} × ${item.qty}</div>
            ${item.note ? `<div class="note">${escape(item.note)}</div>` : ""}
          </td>
          <td class="qty">×${item.qty}</td>
          <td class="total">${formatKIP(lineTotal)}</td>
        </tr>`,
      );
    }
  }

  const time = formatTime(input.paidAt);
  const date = new Date(input.paidAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8" />
<title>${escape(t("receipt.title_table", { n: input.tableNumber }))}</title>
<style>
  /* Let the browser/user pick paper size in the print dialog. The layout
     below adapts: tight thermal-style under ~100mm, full-page A4 style
     above. Removing the @page size hint avoids the bug where selecting
     A3/Letter on mobile crammed a 58mm-wide layout into the top-left
     corner of a big sheet. */
  @page { margin: 6mm; }
  * { box-sizing: border-box; }

  /* ============ Base = compact (good for thermal 58/80mm) ============ */
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Sarabun", sans-serif;
    margin: 0;
    padding: 0;
    color: #000;
    font-size: 11px;
    line-height: 1.35;
  }
  .center { text-align: center; }
  h1 { font-size: 14px; margin: 0 0 4px; font-weight: 700; }
  .meta { font-size: 10px; color: #444; line-height: 1.4; }
  hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 2px 0; vertical-align: top; text-align: left; }
  th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; font-weight: 600; }
  .qty { text-align: right; width: 36px; }
  .total { text-align: right; width: 90px; font-variant-numeric: tabular-nums; }
  .unit { font-size: 9px; color: #666; font-variant-numeric: tabular-nums; margin-top: 1px; }
  .note { font-size: 9px; color: #555; padding-left: 6px; }
  .grand { font-size: 14px; font-weight: 700; }
  .summary { font-size: 9px; color: #555; text-align: center; margin: 6px 0; }
  .qr-section { margin-top: 12px; text-align: center; }
  .qr-section img { width: 140px; height: 140px; object-fit: contain; display: block; margin: 0 auto; }
  .qr-label { font-size: 10px; font-weight: 600; margin-bottom: 4px; }
  .footer { font-size: 9px; color: #666; text-align: center; margin-top: 10px; }

  /* ============ Wider paper = full-page A4 layout ============
     Triggers at A4 / Letter / A3 etc. (anything wider than 100mm).
     Thermal 58/80mm paper falls below the threshold and keeps the
     compact base style above. */
  @media print and (min-width: 100mm) {
    @page { margin: 12mm; }
    body {
      max-width: 180mm;
      margin: 0 auto;
      font-size: 13pt;
      line-height: 1.5;
    }
    h1 {
      font-size: 26pt;
      margin: 0 0 8pt;
      letter-spacing: -0.01em;
    }
    .meta {
      font-size: 11pt;
      line-height: 1.6;
    }
    hr {
      border-top: 1px solid #000;
      margin: 16pt 0;
    }
    table {
      font-size: 13pt;
    }
    th, td {
      padding: 6pt 0;
    }
    th {
      font-size: 9pt;
      padding-bottom: 8pt;
      border-bottom: 1px solid #ccc;
    }
    .qty {
      width: 50pt;
    }
    .total {
      width: 110pt;
    }
    .unit {
      font-size: 10pt;
      margin-top: 2pt;
    }
    .note {
      font-size: 10pt;
      padding-left: 10pt;
    }
    .grand {
      font-size: 20pt;
      padding-top: 8pt;
    }
    .summary {
      font-size: 11pt;
      margin: 12pt 0;
    }
    .qr-section {
      margin-top: 24pt;
    }
    .qr-section img {
      width: 50mm;
      height: 50mm;
    }
    .qr-label {
      font-size: 12pt;
      margin-bottom: 8pt;
    }
    .footer {
      font-size: 11pt;
      margin-top: 20pt;
    }
  }

  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="center">
    <h1>${escape(input.restaurantName)}</h1>
    <div class="meta">
      ${escape(t("receipt.table_n", { n: input.tableNumber }))}<br/>
      ${escape(date)} · ${escape(time)}
    </div>
  </div>
  <hr/>
  <table>
    <thead>
      <tr><th>${escape(t("receipt.col.item"))}</th><th class="qty">${escape(t("receipt.col.qty"))}</th><th class="total">${escape(t("receipt.col.price"))}</th></tr>
    </thead>
    <tbody>
      ${lines.join("")}
    </tbody>
  </table>
  <div class="summary">${escape(t("receipt.total_items", { n: totalQty }))}</div>
  <hr/>
  <table>
    <tr>
      <td>${escape(t("receipt.subtotal"))}</td>
      <td class="total">${formatKIP(input.bill.subtotal)}</td>
    </tr>
    ${
      input.bill.serviceChargePct > 0
        ? `<tr><td>${escape(t("receipt.service", { pct: input.bill.serviceChargePct }))}</td><td class="total">${formatKIP(input.bill.serviceCharge)}</td></tr>`
        : ""
    }
    ${
      input.bill.vatPct > 0
        ? `<tr><td>${escape(t("receipt.vat", { pct: input.bill.vatPct }))}</td><td class="total">${formatKIP(input.bill.vat)}</td></tr>`
        : ""
    }
    <tr>
      <td class="grand">${escape(t("receipt.grand"))}</td>
      <td class="total grand">${formatKIP(input.bill.grandTotal)}</td>
    </tr>
    <tr>
      <td>${escape(t("receipt.paid_by"))}</td>
      <td class="total">${escape(t(`bill.settled.method.${input.method}`))}</td>
    </tr>
  </table>
  ${
    input.paymentQrUrl
      ? `<hr/>
  <div class="qr-section">
    <div class="qr-label">${escape(t("receipt.scan_to_pay"))}</div>
    <img src="${escape(input.paymentQrUrl)}" alt="${escape(t("receipt.qr_alt"))}" />
  </div>`
      : ""
  }
  <div class="footer">${escape(t("receipt.thanks"))}</div>
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
