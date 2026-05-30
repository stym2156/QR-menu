"use client";

import { useT } from "@/lib/i18n/I18nProvider";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";

interface Props {
  restaurantName: string;
  tableNumber: number;
  zoneName: string | null;
  shopIsOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  closedReason: "manually_closed" | "outside_hours" | null;
  tableIsOpen: boolean;
}

export default function CustomerHeader({
  restaurantName,
  tableNumber,
  zoneName,
  shopIsOpen,
  openTime,
  closeTime,
  closedReason,
  tableIsOpen,
}: Props) {
  const { t } = useT();
  const hoursText =
    openTime && closeTime ? `${openTime} – ${closeTime}` : null;

  return (
    <>
      <header className="border-b border-line bg-surface px-5 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-ink">
              {restaurantName}
            </h1>
            {hoursText ? (
              <p className="mt-1 text-xs text-muted">
                {t("cust.hours")} {hoursText}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <div className="rounded-xl bg-canvas px-3 py-2 text-right">
              {zoneName ? (
                <div className="max-w-24 truncate text-[11px] font-medium text-muted">
                  {zoneName}
                </div>
              ) : null}
              <div className="text-[10px] font-medium tracking-[0.14em] text-muted">
                {t("cust.table_label")}
              </div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {tableNumber}
              </div>
            </div>
            <LanguageSwitcher variant="compact" />
          </div>
        </div>
      </header>

      {!shopIsOpen ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-6 text-center">
          <div className="mb-1 text-3xl">🌙</div>
          <h2 className="text-base font-semibold tracking-tight text-red-900">
            {t("cust.closed.title")}
          </h2>
          <p className="mt-1 text-sm text-red-700">
            {closedReason === "manually_closed"
              ? t("cust.closed.manually")
              : hoursText
                ? t("cust.closed.hours", { hours: hoursText })
                : t("cust.closed.desc")}
          </p>
        </div>
      ) : !tableIsOpen ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-6 text-center">
          <div className="mb-1 text-3xl">🔒</div>
          <h2 className="text-base font-semibold tracking-tight text-amber-900">
            {t("cust.table_closed.title")}
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            {t("cust.table_closed.desc")}
          </p>
        </div>
      ) : null}
    </>
  );
}
