"use client";

import { useT } from "@/lib/i18n/I18nProvider";

interface Props {
  kind?: "no_shop" | "no_data";
}

export default function NoShopMessage({ kind = "no_shop" }: Props) {
  const { t } = useT();
  return (
    <p className="text-muted">
      {kind === "no_data" ? t("dash.no_data") : t("dash.no_shop")}
    </p>
  );
}
