"use client";

import { useT } from "@/lib/i18n/I18nProvider";

interface Props {
  kind: "invalid" | "used" | "revoked" | "failed";
  detail?: string;
}

export default function JoinStatus({ kind, detail }: Props) {
  const { t } = useT();
  const title = t(`join.${kind === "failed" ? "failed.title" : kind + ".title"}`);
  const desc = kind === "failed" ? detail : t(`join.${kind}.desc`);
  return (
    <>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      {desc ? <p className="mt-2 text-sm text-muted">{desc}</p> : null}
    </>
  );
}
