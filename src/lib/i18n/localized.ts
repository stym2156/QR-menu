// Pick a localized name from a record that has name + name_lo + name_en.
// Fallback chain: requested locale → other locales that are present → empty.
// Owners only need to fill in one language; the rest fall back to whatever exists.

import type { Locale } from "./types";

interface LocalizedNamed {
  name?: string | null;
  name_lo?: string | null;
  name_en?: string | null;
}

export function pickName(item: LocalizedNamed, locale: Locale): string {
  const th = item.name?.trim() || "";
  const lo = item.name_lo?.trim() || "";
  const en = item.name_en?.trim() || "";

  if (locale === "lo") return lo || th || en || "";
  if (locale === "en") return en || th || lo || "";
  return th || lo || en || "";
}
