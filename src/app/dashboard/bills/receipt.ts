// Generate a printable receipt HTML and open in a new window for print.
// Works with regular printers and 58/80mm thermal printers (browser handles scaling).

import { formatKIP, formatTime } from "@/lib/format";
import type { Menu, Order, PaymentMethod } from "@/lib/types";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "เงินสด",
  promptpay: "พร้อมเพย์",
  transfer: "โอน",
  card: "บัตร",
  other: "อื่นๆ",
};

interface PrintReceiptInput {
  restaurantName: string;
  tableNumber: number;
  orders: Order[];
  menus: Menu[];
  method: PaymentMethod;
  paidAt: string;
}

export function printReceipt(input: PrintReceiptInput): void {
  const menuMap = new Map(input.menus.map((m) => [m.id, m]));
  const total = input.orders.reduce((s, o) => s + Number(o.total), 0);

  const html = renderHTML({
    ...input,
    menuMap,
    total,
  });

  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) {
    alert("เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่ — กรุณาอนุญาต popup");
    return;
  }
  w.document.write(html);
  w.document.close();
  // Give the new document time to layout before printing.
  setTimeout(() => {
    w.focus();
    w.print();
  }, 150);
}

interface RenderInput extends PrintReceiptInput {
  menuMap: Map<string, Menu>;
  total: number;
}

function renderHTML(input: RenderInput): string {
  const lines: string[] = [];
  for (const order of input.orders) {
    for (const item of order.items) {
      const menu = input.menuMap.get(item.menu_id);
      const name = menu?.name ?? "(เมนูถูกลบ)";
      const price = (menu?.price ?? 0) * item.qty;
      lines.push(
        `<tr><td>${escape(name)}${
          item.note ? `<div class="note">${escape(item.note)}</div>` : ""
        }</td><td class="qty">×${item.qty}</td><td class="total">${formatKIP(price)}</td></tr>`,
      );
    }
  }

  const time = formatTime(input.paidAt);
  const date = new Date(input.paidAt).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>ใบเสร็จ — โต๊ะ ${input.tableNumber}</title>
<style>
  @page { size: 58mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Sarabun", sans-serif; margin: 0; padding: 8px; color: #000; }
  .center { text-align: center; }
  h1 { font-size: 14px; margin: 0 0 4px; }
  .meta { font-size: 10px; color: #444; line-height: 1.4; }
  hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 2px 0; vertical-align: top; text-align: left; }
  th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; font-weight: 600; }
  .qty { text-align: right; width: 36px; }
  .total { text-align: right; width: 90px; font-variant-numeric: tabular-nums; }
  .note { font-size: 9px; color: #555; padding-left: 6px; }
  .grand { font-size: 14px; font-weight: 700; }
  .footer { font-size: 9px; color: #666; text-align: center; margin-top: 10px; }
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
      โต๊ะที่ ${input.tableNumber}<br/>
      ${date} · ${time}
    </div>
  </div>
  <hr/>
  <table>
    <thead>
      <tr><th>รายการ</th><th class="qty">จน</th><th class="total">ราคา</th></tr>
    </thead>
    <tbody>
      ${lines.join("")}
    </tbody>
  </table>
  <hr/>
  <table>
    <tr>
      <td class="grand">รวม</td>
      <td class="total grand">${formatKIP(input.total)}</td>
    </tr>
    <tr>
      <td>ชำระโดย</td>
      <td class="total">${PAYMENT_LABEL[input.method]}</td>
    </tr>
  </table>
  <div class="footer">ขอบคุณที่ใช้บริการ</div>
  <script>window.onafterprint = () => window.close();</script>
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
