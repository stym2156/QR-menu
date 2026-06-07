"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { useT } from "@/lib/i18n/I18nProvider";

export interface AuditLogRow {
  id: string;
  action: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor_user_id: string | null;
}

interface Props {
  rows: AuditLogRow[];
  actorEmails: Record<string, string>;
  pageSize: number;
}

const ACTION_TONE: Record<string, "danger" | "success" | "neutral"> = {
  "order.cancel": "danger",
  "order.served": "success",
  "bill.settle": "success",
  "call.ready": "neutral",
};

export default function AuditView({ rows, actorEmails, pageSize }: Props) {
  const { t } = useT();
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");

  const actionTypes = useMemo(() => {
    const set = new Set(rows.map((r) => r.action));
    return Array.from(set).sort();
  }, [rows]);

  const actorIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.actor_user_id) set.add(r.actor_user_id);
    }
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (actorFilter !== "all" && r.actor_user_id !== actorFilter) return false;
      return true;
    });
  }, [rows, actionFilter, actorFilter]);

  function exportCsv(): void {
    const csv = buildCsv(filtered, [
      { header: "timestamp", value: (r) => r.created_at },
      {
        header: "actor",
        value: (r) =>
          r.actor_user_id ? actorEmails[r.actor_user_id] ?? r.actor_user_id : "system",
      },
      { header: "action", value: (r) => r.action },
      { header: "target_id", value: (r) => r.target_id ?? "" },
      { header: "details", value: (r) => JSON.stringify(r.details) },
    ]);
    downloadCsv(`audit_${new Date().toISOString().slice(0, 10)}`, csv);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("audit.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t("audit.subtitle", { n: pageSize })}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/30 disabled:opacity-50"
        >
          {t("audit.export")}
        </button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink"
        >
          <option value="all">{t("audit.filter.all_actions")}</option>
          {actionTypes.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink"
        >
          <option value="all">{t("audit.filter.all_actors")}</option>
          {actorIds.map((id) => (
            <option key={id} value={id}>
              {actorEmails[id] ?? id.slice(0, 8)}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">
          {t("audit.count", { n: filtered.length })}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center text-sm text-muted">
          {t("audit.empty")}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
          {filtered.map((r) => {
            const tone = ACTION_TONE[r.action] ?? "neutral";
            const actor = r.actor_user_id
              ? actorEmails[r.actor_user_id] ?? r.actor_user_id.slice(0, 8)
              : t("audit.system");
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        tone === "danger"
                          ? "bg-red-50 text-red-700"
                          : tone === "success"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-canvas text-muted"
                      }`}
                    >
                      {r.action}
                    </span>
                    <span className="text-xs text-muted">{actor}</span>
                  </div>
                  <DetailsBlock details={r.details} />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {formatDateTime(r.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DetailsBlock({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
      {entries.map(([k, v]) => (
        <span key={k} className="tabular-nums">
          <span className="text-ink/60">{k}:</span>{" "}
          <span className="text-ink">{formatVal(v)}</span>
        </span>
      ))}
    </div>
  );
}

function formatVal(v: unknown): string {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  return JSON.stringify(v);
}
