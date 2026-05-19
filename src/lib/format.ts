// Lao Kip (LAK) currency symbol.
const CURRENCY_SYMBOL = "₭";

export function formatKIP(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return `${CURRENCY_SYMBOL}0`;
  const formatted = num.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY_SYMBOL}${formatted}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
