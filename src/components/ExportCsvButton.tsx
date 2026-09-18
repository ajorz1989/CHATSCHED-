import { downloadCsv, dateStampedFilename, type CsvRow } from "../lib/csvExport";
import Button from "./Button";

/**
 * Sits at the top of an admin table tab. `rows` is already the shaped,
 * caller-built export data (see the `*_ROWS` builders next to each tab in
 * Admin.tsx / AdminChannelRequests.tsx) — this component doesn't know or
 * care what table it's exporting, only how to turn rows into a download.
 */
export default function ExportCsvButton({ label, filenameBase, rows }: { label: string; filenameBase: string; rows: CsvRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Button size="sm" onClick={() => downloadCsv(dateStampedFilename(filenameBase), rows)} className="shrink-0">
      ⬇ {label} ({rows.length})
    </Button>
  );
}
