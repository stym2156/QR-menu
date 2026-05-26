// Lightweight CSV builder for owner exports (daily close, audit log, etc.).
// No dependency — restaurants on slow networks shouldn't pay 30kb for this.
//
// Includes:
//   - RFC 4180-style escaping (quotes wrap fields that contain quote/comma/
//     newline, internal quotes doubled)
//   - UTF-8 BOM so Excel opens Thai/Lao characters correctly on Windows

export type CsvValue = string | number | boolean | null | undefined | Date;

export interface CsvColumn<T> {
  header: string;
  // Extract the raw value from a row. Return null/undefined for empty cells.
  value: (row: T) => CsvValue;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(","),
  );
  return [headerLine, ...dataLines].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // UTF-8 BOM (﻿) — Excel needs it to open Thai correctly.
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revoke so browsers that download asynchronously don't break.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  // Wrap in quotes if it contains a quote, comma, or newline; double internal quotes.
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
