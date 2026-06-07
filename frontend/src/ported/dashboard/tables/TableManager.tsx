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
import type { DiningTable, TableZone } from "@/lib/types";

interface Props {
  restaurantId: string;
  initialTables: DiningTable[];
  initialZones: TableZone[];
  // Owner only - controls add + delete UI.
  canManage: boolean;
  // Owner + waiter - controls open/close toggle. Cook gets read-only.
  canAct: boolean;
}

type TableGroup = {
  zone: TableZone | null;
  tables: DiningTable[];
};

const zoneSort = (a: TableZone, b: TableZone) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name);

export default function TableManager({
  restaurantId,
  initialTables,
  initialZones,
  canManage,
  canAct,
}: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { t } = useT();
  const [tables, setTables] = useState<DiningTable[]>(initialTables);
  const [zones, setZones] = useState<TableZone[]>([...initialZones].sort(zoneSort));
  const [tableNumber, setTableNumber] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState(initialZones[0]?.id ?? "");
  const [newZoneName, setNewZoneName] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [bulkZoneNames, setBulkZoneNames] = useState("");
  const [bulkFrom, setBulkFrom] = useState("1");
  const [bulkTo, setBulkTo] = useState("30");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const filteredTables = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tables.filter((table) => {
      const zone = zoneMap.get(table.zone_id);
      const matchesZone = zoneFilter === "all" || table.zone_id === zoneFilter;
      const matchesSearch =
        !q ||
        String(table.table_number).includes(q) ||
        (zone?.name.toLowerCase().includes(q) ?? false);
      return matchesZone && matchesSearch;
    });
  }, [tables, searchQuery, zoneFilter, zoneMap]);

  const groupedTables = useMemo<TableGroup[]>(() => {
    const byZone = new Map<string, DiningTable[]>();
    const unknown: DiningTable[] = [];
    for (const table of filteredTables) {
      if (!zoneMap.has(table.zone_id)) {
        unknown.push(table);
        continue;
      }
      const list = byZone.get(table.zone_id) ?? [];
      list.push(table);
      byZone.set(table.zone_id, list);
    }
    const groups: TableGroup[] = zones
      .map((zone) => ({
        zone,
        tables: (byZone.get(zone.id) ?? []).sort(
          (a, b) => a.table_number - b.table_number,
        ),
      }))
      .filter((group) => group.tables.length > 0);
    if (unknown.length > 0) {
      groups.push({
        zone: null,
        tables: unknown.sort((a, b) => a.table_number - b.table_number),
      });
    }
    return groups;
  }, [filteredTables, zoneMap, zones]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!selectedZoneId && zones[0]) setSelectedZoneId(zones[0].id);
  }, [selectedZoneId, zones]);

  async function handleAddZone(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const name = newZoneName.trim();
    if (!name) return;

    setZoneError(null);
    setZoneBusy(true);
    const nextSort = zones.length > 0 ? Math.max(...zones.map((z) => z.sort_order)) + 1 : 0;
    const { data, error: insertError } = await supabase
      .from("table_zones")
      .insert({ restaurant_id: restaurantId, name, sort_order: nextSort })
      .select()
      .single();

    setZoneBusy(false);
    if (insertError || !data) {
      const message =
        insertError?.code === "23505"
          ? t("mgr.tbl.zone.exists", { name })
          : t("mgr.tbl.zone.add_failed", { error: insertError?.message ?? "" });
      setZoneError(message);
      return;
    }
    const zone = data as TableZone;
    setZones((prev) => [...prev, zone].sort(zoneSort));
    setSelectedZoneId(zone.id);
    setZoneFilter("all");
    setNewZoneName("");
    toast.success(t("mgr.tbl.zone.added", { name: zone.name }));
  }

  async function deleteZone(zone: TableZone): Promise<void> {
    const usedCount = tables.filter((table) => table.zone_id === zone.id).length;
    if (usedCount > 0) {
      toast.error(t("mgr.tbl.zone.delete_has_tables", { count: usedCount }));
      return;
    }
    const ok = await confirm({
      title: t("mgr.tbl.zone.delete.title", { name: zone.name }),
      description: t("mgr.tbl.zone.delete.desc"),
      confirmText: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    const { error: deleteError } = await supabase
      .from("table_zones")
      .delete()
      .eq("id", zone.id);
    if (deleteError) {
      toast.error(t("mgr.tbl.zone.delete_failed", { error: deleteError.message }));
      return;
    }
    setZones((prev) => prev.filter((z) => z.id !== zone.id));
    if (selectedZoneId === zone.id) setSelectedZoneId(zones.find((z) => z.id !== zone.id)?.id ?? "");
    if (zoneFilter === zone.id) setZoneFilter("all");
    toast.success(t("mgr.tbl.zone.deleted", { name: zone.name }));
  }

  async function moveTableToZone(table: DiningTable, zoneId: string): Promise<void> {
    if (table.zone_id === zoneId) return;
    const targetZone = zoneMap.get(zoneId);
    const duplicate = tables.some(
      (x) =>
        x.id !== table.id &&
        x.zone_id === zoneId &&
        x.table_number === table.table_number,
    );
    if (duplicate) {
      toast.error(
        t("mgr.tbl.zone.move_duplicate", {
          n: table.table_number,
          zone: targetZone?.name ?? "",
        }),
      );
      return;
    }
    const previousZoneId = table.zone_id;
    setTables((prev) =>
      prev.map((x) => (x.id === table.id ? { ...x, zone_id: zoneId } : x)),
    );
    const { error: updateError } = await supabase
      .from("tables")
      .update({ zone_id: zoneId })
      .eq("id", table.id);
    if (updateError) {
      setTables((prev) =>
        prev.map((x) => (x.id === table.id ? { ...x, zone_id: previousZoneId } : x)),
      );
      toast.error(t("mgr.tbl.zone.move_failed", { error: updateError.message }));
      return;
    }
    toast.success(t("mgr.tbl.zone.moved", { n: table.table_number }));
  }

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
    if (!selectedZoneId) {
      setError(t("mgr.tbl.zone.required"));
      setBusy(false);
      return;
    }
    const selectedZone = zoneMap.get(selectedZoneId);
    const duplicate = tables.some(
      (table) => table.zone_id === selectedZoneId && table.table_number === num,
    );
    if (duplicate) {
      setError(
        t("mgr.tbl.zone.table_duplicate_hint", {
          n: num,
          zone: selectedZone?.name ?? "",
        }),
      );
      setBusy(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("tables")
      .insert({
        restaurant_id: restaurantId,
        table_number: num,
        zone_id: selectedZoneId,
      })
      .select()
      .single();

    if (insertError || !data) {
      const message =
        insertError?.code === "23505"
          ? t("mgr.tbl.zone.table_duplicate", {
              n: num,
              zone: selectedZone?.name ?? "",
            })
          : t("mgr.tbl.add_failed", { error: insertError?.message ?? "" });
      setError(message);
      setBusy(false);
      return;
    }

    setTables((prev) =>
      [...prev, data as DiningTable].sort((a, b) => a.table_number - b.table_number),
    );
    setTableNumber("");
    setBusy(false);
  }

  async function handleBulkCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBulkError(null);

    const zoneNames = parseBulkZoneNames(bulkZoneNames);
    const from = parseInt(bulkFrom, 10);
    const to = parseInt(bulkTo, 10);

    if (zoneNames.length === 0) {
      setBulkError(t("mgr.tbl.bulk.error.no_zone"));
      return;
    }
    if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0 || from > to) {
      setBulkError(t("mgr.tbl.bulk.error.range"));
      return;
    }
    if (zoneNames.length * (to - from + 1) > 500) {
      setBulkError(t("mgr.tbl.bulk.error.limit"));
      return;
    }

    setBulkBusy(true);

    let nextZones = zones;
    const existingByName = new Map(
      nextZones.map((zone) => [zone.name.trim().toLowerCase(), zone]),
    );
    const missingNames = zoneNames.filter(
      (name) => !existingByName.has(name.toLowerCase()),
    );

    if (missingNames.length > 0) {
      const maxSort =
        nextZones.length > 0 ? Math.max(...nextZones.map((z) => z.sort_order)) : -1;
      const { data: createdZones, error: zoneInsertError } = await supabase
        .from("table_zones")
        .insert(
          missingNames.map((name, index) => ({
            restaurant_id: restaurantId,
            name,
            sort_order: maxSort + index + 1,
          })),
        )
        .select();

      if (zoneInsertError || !createdZones) {
        setBulkBusy(false);
        setBulkError(t("mgr.tbl.bulk.zone_failed", { error: zoneInsertError?.message ?? "" }));
        return;
      }

      nextZones = [...nextZones, ...((createdZones ?? []) as TableZone[])].sort(zoneSort);
      setZones(nextZones);
    }

    const zoneByName = new Map(
      nextZones.map((zone) => [zone.name.trim().toLowerCase(), zone]),
    );
    const wantedZones = zoneNames
      .map((name) => zoneByName.get(name.toLowerCase()))
      .filter((zone): zone is TableZone => Boolean(zone));
    const existingTableKeys = new Set(
      tables.map((table) => `${table.zone_id}:${table.table_number}`),
    );
    const rows: Array<{
      restaurant_id: string;
      zone_id: string;
      table_number: number;
    }> = [];

    for (const zone of wantedZones) {
      for (let tableNumber = from; tableNumber <= to; tableNumber += 1) {
        const key = `${zone.id}:${tableNumber}`;
        if (existingTableKeys.has(key)) continue;
        existingTableKeys.add(key);
        rows.push({
          restaurant_id: restaurantId,
          zone_id: zone.id,
          table_number: tableNumber,
        });
      }
    }

    if (rows.length === 0) {
      setBulkBusy(false);
      toast.success(t("mgr.tbl.bulk.exists"));
      return;
    }

    const { data: createdTables, error: tableInsertError } = await supabase
      .from("tables")
      .insert(rows)
      .select();

    setBulkBusy(false);
    if (tableInsertError || !createdTables) {
      setBulkError(t("mgr.tbl.bulk.table_failed", { error: tableInsertError?.message ?? "" }));
      return;
    }

    setTables((prev) =>
      [...prev, ...((createdTables ?? []) as DiningTable[])].sort(
        (a, b) =>
          (zoneMap.get(a.zone_id)?.sort_order ?? 0) -
            (zoneMap.get(b.zone_id)?.sort_order ?? 0) ||
          a.table_number - b.table_number,
      ),
    );
    setSelectedZoneId(wantedZones[0]?.id ?? selectedZoneId);
    setZoneFilter("all");
    toast.success(
      t("mgr.tbl.bulk.done", {
        zones: wantedZones.length,
        tables: createdTables.length,
      }),
    );
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
    const { error: deleteError } = await supabase.from("tables").delete().eq("id", table.id);
    if (deleteError) toast.error(t("mgr.tbl.delete_failed", { error: deleteError.message }));
    else toast.success(t("mgr.tbl.deleted_toast", { n: table.table_number }));
  }

  async function downloadQR(table: DiningTable): Promise<void> {
    const url = `${origin}/menu/${restaurantId}/${table.id}`;
    const zone = zoneMap.get(table.zone_id);
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
    const { error: updateError } = await supabase
      .from("tables")
      .update({ is_open: next })
      .eq("id", table.id);
    if (updateError) {
      toast.error(t("mgr.tbl.update_failed", { error: updateError.message }));
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
        <div className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <form onSubmit={handleAddZone} className={`${card} ${cardPad} space-y-4`}>
            <SectionHeading
              title={t("mgr.tbl.zone.title")}
              description={t("mgr.tbl.zone.desc")}
            />
            <FormField label={t("mgr.tbl.zone.name")}>
              <input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className={input}
                placeholder={t("mgr.tbl.zone.placeholder")}
              />
            </FormField>
            <button
              type="submit"
              disabled={zoneBusy || !newZoneName.trim()}
              className={`${buttonSecondary} w-full`}
            >
              {zoneBusy ? t("mgr.tbl.zone.adding") : t("mgr.tbl.zone.add")}
            </button>
            {zoneError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {zoneError}
              </p>
            ) : null}
            {zones.length > 0 ? (
              <div className="space-y-1.5">
                {zones.map((zone) => {
                  const count = tables.filter((table) => table.zone_id === zone.id).length;
                  return (
                    <div
                      key={zone.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm"
                    >
                      <button
                        type="button"
                        onClick={() => setZoneFilter(zone.id)}
                        className="min-w-0 truncate text-left font-medium text-ink hover:underline"
                      >
                        {zone.name}
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs tabular-nums text-muted">{count}</span>
                        <button
                          type="button"
                          onClick={() => deleteZone(zone)}
                          className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-red-50 hover:text-red-600"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t("mgr.tbl.zone.empty_hint")}
              </p>
            )}
          </form>

          <form onSubmit={handleAdd} className={`${card} ${cardPad} space-y-4`}>
            <SectionHeading title={t("mgr.tbl.add_title")} />

            <FormField label={t("mgr.tbl.zone.title")}>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                required
                className={input}
              >
                <option value="" disabled>
                  {t("mgr.tbl.zone.select")}
                </option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </FormField>

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
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={busy || zones.length === 0} className={`${buttonPrimary} w-full`}>
              {busy ? t("mgr.tbl.submitting") : t("mgr.tbl.submit")}
            </button>
          </form>

          <form onSubmit={handleBulkCreate} className={`${card} ${cardPad} space-y-4`}>
            <SectionHeading
              title={t("mgr.tbl.bulk.title")}
              description={t("mgr.tbl.bulk.desc")}
            />

            <FormField label={t("mgr.tbl.bulk.zone_names")}>
              <textarea
                value={bulkZoneNames}
                onChange={(e) => setBulkZoneNames(e.target.value)}
                className={`${input} min-h-24 resize-y`}
                placeholder={t("mgr.tbl.bulk.zone_placeholder")}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("mgr.tbl.bulk.from")}>
                <input
                  type="number"
                  min="1"
                  value={bulkFrom}
                  onChange={(e) => setBulkFrom(e.target.value)}
                  className={`${input} tabular-nums`}
                />
              </FormField>
              <FormField label={t("mgr.tbl.bulk.to")}>
                <input
                  type="number"
                  min="1"
                  value={bulkTo}
                  onChange={(e) => setBulkTo(e.target.value)}
                  className={`${input} tabular-nums`}
                />
              </FormField>
            </div>

            {bulkError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {bulkError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={bulkBusy || !bulkZoneNames.trim()}
              className={`${buttonPrimary} w-full`}
            >
              {bulkBusy ? t("mgr.tbl.bulk.submitting") : t("mgr.tbl.bulk.submit")}
            </button>
          </form>
        </div>
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
                searchQuery.trim() || zoneFilter !== "all"
                  ? t("mgr.tbl.search.result", {
                      found: filteredTables.length,
                      total: tables.length,
                    })
                  : t("mgr.tbl.list_count", { n: tables.length })
              }
            />

            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <circle cx="11" cy="11" r="7" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
                  </svg>
                </span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("mgr.tbl.search.placeholder")}
                  className={`${input} pl-10 pr-10`}
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
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className={`${input} sm:w-52`}
              >
                <option value="all">{t("mgr.tbl.zone.all")}</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            {filteredTables.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-muted">
                {t("mgr.tbl.search.no_filter_match")}
              </div>
            ) : (
              <div className="space-y-5">
                {groupedTables.map((group) => (
                  <section key={group.zone?.id ?? "unknown"}>
                    <SectionHeading
                      title={group.zone?.name ?? t("mgr.tbl.zone.unknown")}
                      description={t("mgr.tbl.zone.table_count", { count: group.tables.length })}
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {group.tables.map((table) => (
                        <TableCard
                          key={table.id}
                          table={table}
                          zone={zoneMap.get(table.zone_id) ?? null}
                          zones={zones}
                          restaurantId={restaurantId}
                          origin={origin}
                          canManage={canManage}
                          canAct={canAct}
                          onDelete={() => deleteTable(table)}
                          onDownload={() => downloadQR(table)}
                          onToggleOpen={() => toggleOpen(table)}
                          onMoveZone={(zoneId) => moveTableToZone(table, zoneId)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function parseBulkZoneNames(value: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of value.split(/[\n\r,.;]+/)) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

interface TableCardProps {
  table: DiningTable;
  zone: TableZone | null;
  zones: TableZone[];
  restaurantId: string;
  origin: string;
  canManage: boolean;
  canAct: boolean;
  onDelete: () => void;
  onDownload: () => void;
  onToggleOpen: () => void;
  onMoveZone: (zoneId: string) => void;
}

function TableCard({
  table,
  zone,
  zones,
  restaurantId,
  origin,
  canManage,
  canAct,
  onDelete,
  onDownload,
  onToggleOpen,
  onMoveZone,
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
  }, [url, table.table_number, zone]);

  return (
    <div
      className={`rounded-2xl border bg-surface p-4 transition ${
        table.is_open ? "border-emerald-200 ring-1 ring-emerald-100" : "border-line"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink text-xs font-semibold tabular-nums text-surface">
            {table.table_number}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
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
            <div className="mt-1 truncate text-xs text-muted">
              {zone?.name ?? t("mgr.tbl.zone.unknown")}
            </div>
          </div>
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

      {canManage ? (
        <select
          value={table.zone_id}
          onChange={(e) => onMoveZone(e.target.value)}
          className={`${input} mb-3 py-2 text-xs`}
          aria-label={t("mgr.tbl.zone.move")}
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      ) : null}

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
