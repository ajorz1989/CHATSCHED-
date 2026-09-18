/**
 * Client-side CSV export — no server round trip, nothing stored. Every
 * admin table (requests, applications, publishers, businesses, messages,
 * reports, disputes, channel requests) already has its full dataset
 * loaded in the browser to render the page; this just re-shapes whatever
 * rows are currently on screen into a CSV and triggers a download,
 * rather than requiring a spreadsheet-friendly export endpoint that
 * doesn't otherwise exist anywhere in this codebase.
 *
 * Row shaping (which columns, what order, how a value is formatted) is
 * the caller's job — see the `*_ROWS` builders in Admin.tsx,
 * AdminChannelRequests.tsx — this module only handles the mechanical
 * "objects in, correctly-escaped CSV file out" part.
 */

export type CsvRow = Record<string, string | number | boolean | null | undefined>;

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // RFC 4180: quote any field containing a comma, quote, or newline, and
  // double up any quote characters inside it.
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function rowsToCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(",")),
  ];
  // \r\n per RFC 4180 — Excel (still the most likely destination for an
  // admin CSV export) is fussier about bare \n than most other tools.
  return lines.join("\r\n");
}

/** Downloads `rows` as a CSV file named `filename` (`.csv` appended if missing). Safe to call with an empty array — produces a header-less empty file rather than throwing. */
export function downloadCsv(filename: string, rows: CsvRow[]): void {
  const csv = rowsToCsv(rows);
  // Leading UTF-8 BOM so Excel — which otherwise guesses the wrong
  // encoding for anything outside ASCII — renders Afrikaans/isiZulu
  // names and the R/± symbols correctly instead of as mojibake.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** `chatsched-requests-2026-08-16.csv` — every export uses today's date in the filename so re-downloading later doesn't silently overwrite an earlier one. */
export function dateStampedFilename(base: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `chatsched-${base}-${today}.csv`;
}
