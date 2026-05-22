"use client";

import { useT } from "@/lib/i18n/I18nProvider";
import { SectionHeading } from "@/components/ui";

export default function SettingsTeamHeadingClient() {
  const { t } = useT();
  return (
    <SectionHeading
      title={t("page.settings.team_title")}
      description={t("page.settings.team_desc")}
    />
  );
}
