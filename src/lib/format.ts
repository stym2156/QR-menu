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
  // Force Gregorian calendar — th-TH defaults to Buddhist Era (e.g. "23/5/69"
  // for 2026 CE), which confuses owners who think of years as 2025/2026.
  return new Date(iso).toLocaleString("th-TH-u-ca-gregory", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
