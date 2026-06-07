"use client";

import { useT } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "./ui";

interface Props {
  titleKey: string;
  descKey?: string;
  titleVars?: Record<string, string | number>;
  descVars?: Record<string, string | number>;
  action?: React.ReactNode;
}

/**
 * Drop-in for <PageHeader> on dashboard pages — looks up title + description
 * from the i18n dictionary so they translate live with the language switcher.
 */
export default function I18nPageHeader({
  titleKey,
  descKey,
  titleVars,
  descVars,
  action,
}: Props) {
  const { t } = useT();
  return (
    <PageHeader
      title={t(titleKey, titleVars)}
      description={descKey ? t(descKey, descVars) : undefined}
      action={action}
    />
  );
}
