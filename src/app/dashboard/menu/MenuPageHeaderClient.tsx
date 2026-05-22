"use client";

import { useT } from "@/lib/i18n/I18nProvider";
import { LinkButton, PageHeader } from "@/components/ui";

export default function MenuPageHeaderClient() {
  const { t } = useT();
  return (
    <PageHeader
      title={t("page.menu.title")}
      description={t("page.menu.desc")}
      action={
        <LinkButton href="/dashboard/categories">
          {t("page.menu.manage_categories")}
        </LinkButton>
      }
    />
  );
}
