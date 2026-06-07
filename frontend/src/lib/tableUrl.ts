import type { DiningTable } from "@/lib/types";

type CustomerTableLink = Pick<DiningTable, "id" | "restaurant_id" | "short_code">;

export function customerTablePath(table: CustomerTableLink): string {
  return table.short_code ? `/t/${table.short_code}` : `/menu/${table.restaurant_id}/${table.id}`;
}

export function customerTableUrl(origin: string, table: CustomerTableLink): string {
  return `${origin.replace(/\/+$/, "")}${customerTablePath(table)}`;
}
