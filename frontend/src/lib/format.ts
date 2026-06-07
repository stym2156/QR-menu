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
  return new Date(iso).toLocaleString("th-TH-u-ca-gregory", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function pickName(item: {
  name?: string | null;
  name_lo?: string | null;
  name_en?: string | null;
}): string {
  return item.name_lo || item.name || item.name_en || "";
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}
