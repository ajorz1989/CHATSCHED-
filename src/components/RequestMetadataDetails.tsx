import { REQUEST_FIELD_LABELS } from "../lib/channelRequestFieldSchemas";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatMetaValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value == null || value === "") return "—";
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    return new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  }
  return String(value);
}

/**
 * Renders the per-channel request_metadata a business filled in on
 * ChannelRequestForm (schema_phase95_channel_request_metadata.sql,
 * src/lib/channelRequestFieldSchemas.ts) as a small label/value list.
 * Shared between PublisherDashboardView (the creator reviewing a
 * request) and AdminChannelRequests (admin oversight) so the two views
 * can't drift on how a given field renders.
 *
 * Renders nothing for social-media requests (which never populate this
 * column) or for rows saved before it existed — both leave metadata
 * null — and omits any individual field left null/empty (e.g. an
 * unfilled optional field) rather than showing it as blank.
 */
export default function RequestMetadataDetails({
  channelSlug,
  metadata,
}: {
  channelSlug: string;
  metadata: Record<string, unknown> | null;
}) {
  if (!metadata) return null;
  const labels = REQUEST_FIELD_LABELS[channelSlug] ?? {};
  const entries = Object.entries(metadata).filter(([, v]) => v !== null && v !== "");
  if (entries.length === 0) return null;

  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="font-mono uppercase text-billboard-inkSoft">{labels[key] ?? key}</dt>
          <dd>{formatMetaValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
