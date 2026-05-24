"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { qrWithLabel } from "@/lib/qrWithLabel";
import { createClient } from "@/lib/supabase/client";
import {
  EmptyState,
  FormField,
  SectionHeading,
  buttonPrimary,
  buttonSecondary,
  card,
  cardPad,
  input,
} from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/I18nProvider";
import type { DiningTable } from "@/lib/types";

interface Props {
  restaurantId: string;
  initialTables: DiningTable[];
  // Owner only — controls add + delete UI.
  canManage: boolean;
  // Owner + waiter — controls open/close toggle. Cook gets read-only.
  canAct: boolean;
}

export default function TableManager({
  restaurantId,
  initialTables,
  canManage,
  canAct,
}: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { t } = useT();
  const [tables, setTables] = useState<DiningTable[]>(initialTables);
  const [tableNumber, setTableNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Substring match on the stringified table number. Typing "5" matches
  // table 5, 50–59, 105, 500, etc. — sorted ascending so 5 appears first.
  const filteredTables = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return tables;
    return tables.filter((t) => String(t.table_number).includes(q));
  }, [tables, searchQuery]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const num = parseInt(tableNumber, 10);
    if (!Number.isFinite(num) || num <= 0) {
      setError(t("mgr.tbl.error.invalid"));
      setBusy(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("tables")
      .insert({ restaurant_id: restaurantId, table_number: num })
      .select()
      .single();

    if (insertError || !data) {
      setError(t("mgr.tbl.add_failed", { error: insertError?.message ?? "" }));
      setBusy(false);
      return;
    }

    setTables((prev) =>
      [...prev, data as DiningTable].sort((a, b) => a.table_number - b.table_number),
    );
    setTableNumber("");
    setBusy(false);
  }

  async function deleteTable(table: DiningTable): Promise<void> {
    const ok = await confirm({
      title: t("mgr.tbl.delete.title", { n: table.table_number }),
      description: t("mgr.tbl.delete.desc"),
      confirmText: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    setTables((prev) => prev.filter((x) => x.id !== table.id));
    const { error } = await supabase.from("tables").delete().eq("id", table.id);
    if (error) toast.error(t("mgr.tbl.delete_failed", { error: error.message }));
    else toast.success(t("mgr.tbl.deleted_toast", { n: table.table_number }));
  }

  async function downloadQR(table: DiningTable): Promise<void> {
    const url = `${origin}/menu/${restaurantId}/${table.id}`;
    const dataUrl = await qrWithLabel({
      url,
      label: String(table.table_number),
      size: 600,
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `table-${table.table_number}.png`;
    link.click();
  }

  async function toggleOpen(table: DiningTable): Promise<void> {
    const next = !table.is_open;
    setTables((prev) =>
      prev.map((x) => (x.id === table.id ? { ...x, is_open: next } : x)),
    );
    const { error } = await supabase
      .from("tables")
      .update({ is_open: next })
      .eq("id", table.id);
    if (error) {
      toast.error(t("mgr.tbl.update_failed", { error: error.message }));
      setTables((prev) =>
        prev.map((x) => (x.id === table.id ? { ...x, is_open: !next } : x)),
      );
      return;
    }
    toast.success(
      next
        ? t("mgr.tbl.opened_toast", { n: table.table_number })
        : t("mgr.tbl.closed_toast", { n: table.table_number }),
    );
  }

  return (
    <div
      className={
        canManage
          ? "grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]"
          : "grid grid-cols-1 gap-5"
      }
    >
      {canManage ? (
        <form onSubmit={handleAdd} className={`${card} ${cardPad} h-fit space-y-4 lg:sticky lg:top-20`}>
          <SectionHeading title={t("mgr.tbl.add_title")} />

          <FormField label={t("mgr.tbl.number")}>
            <input
              type="number"
              min="1"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              required
              className={`${input} tabular-nums`}
              placeholder="1"
            />
          </FormField>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <button type="submit" disabled={busy} className={`${buttonPrimary} w-full`}>
            {busy ? t("mgr.tbl.submitting") : t("mgr.tbl.submit")}
          </button>
        </form>
      ) : null}

      <div>
        {tables.length === 0 ? (
          <EmptyState
            title={t("mgr.tbl.empty.title")}
            description={
              canManage
                ? t("mgr.tbl.empty.desc.owner")
                : t("mgr.tbl.empty.desc.waiter")
            }
          />
        ) : (
          <>
            <SectionHeading
              title={t("mgr.tbl.list_title")}
              description={
                searchQuery.trim()
                  ? t("mgr.tbl.search.result", {
                      found: filteredTables.length,
                      total: tables.length,
                    })
                  : t("mgr.tbl.list_count", { n: tables.length })
              }
            />

            <div className="relative my-3">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("mgr.tbl.search.placeholder")}
                className={`${input} pl-10 pr-10 tabular-nums`}
                autoComplete="off"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label={t("mgr.tbl.search.clear")}
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : null}
            </div>

            {filteredTables.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-muted">
                {t("mgr.tbl.search.no_match", { q: searchQuery.trim() })}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredTables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    restaurantId={restaurantId}
                    origin={origin}
                    canManage={canManage}
                    canAct={canAct}
                    onDelete={() => deleteTable(table)}
                    onDownload={() => downloadQR(table)}
                    onToggleOpen={() => toggleOpen(table)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface TableCardProps {
  table: DiningTable;
  restaurantId: string;
  origin: string;
  canManage: boolean;
  canAct: boolean;
  onDelete: () => void;
  onDownload: () => void;
  onToggleOpen: () => void;
}

function TableCard({
  table,
  restaurantId,
  origin,
  canManage,
  canAct,
  onDelete,
  onDownload,
  onToggleOpen,
}: TableCardProps) {
  const { t } = useT();
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const url = origin ? `${origin}/menu/${restaurantId}/${table.id}` : "";

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void qrWithLabel({
      url,
      label: String(table.table_number),
      size: 240,
      margin: 1,
    }).then((src) => {
      if (!cancelled) setQrSrc(src);
    });
    return () => {
      cancelled = true;
    };
  }, [url, table.table_number]);

  return (
    <div
      className={`rounded-2xl border bg-surface p-4 transition ${
        table.is_open ? "border-emerald-200 ring-1 ring-emerald-100" : "border-line"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink text-xs font-semibold tabular-nums text-surface">
            {table.table_number}
          </span>
          <span className="text-sm font-medium text-ink">
            {t("mgr.tbl.label", { n: table.table_number })}
          </span>
          {table.is_open ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {t("mgr.tbl.open_badge")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
              {t("mgr.tbl.closed_badge")}
            </span>
          )}
        </div>
        {canManage ? (
          <button
            onClick={onDelete}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600"
          >
            {t("common.delete")}
          </button>
        ) : null}
      </div>

      {canAct ? (
        <button
          onClick={onToggleOpen}
          className={`mb-3 w-full rounded-xl px-3 py-2 text-xs font-medium transition active:scale-[0.98] ${
            table.is_open
              ? "border border-line bg-surface text-ink hover:bg-canvas"
              : "bg-ink text-surface shadow-ink hover:bg-ink/85"
          }`}
        >
          {table.is_open ? t("mgr.tbl.close_btn") : t("mgr.tbl.open_btn")}
        </button>
      ) : null}

      <div className="flex gap-3">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas p-1.5">
          {qrSrc ? (
            <Image
              src={qrSrc}
              alt={`QR table ${table.table_number}`}
              width={112}
              height={112}
              unoptimized
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted">
              {t("mgr.tbl.qr_loading")}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-3 break-all text-[11px] leading-relaxed text-accent-600 hover:underline"
          >
            {url}
          </a>
          <button onClick={onDownload} className={`${buttonSecondary} w-full py-1.5 text-xs`}>
            {t("mgr.tbl.download")}
          </button>
        </div>
      </div>
    </div>
  );
}
