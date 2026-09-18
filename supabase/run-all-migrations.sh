#!/usr/bin/env bash
# Applies schema.sql, then every schema_phase*.sql file, against a target
# Postgres database — in the correct numeric order, which a plain
# alphabetical `ls`/glob sort gets wrong (schema_phase17 sorts before
# schema_phase2 as strings, not numbers).
#
# NEXT_STAGE_DEVELOPMENT_BRIEF.md Task 4, option (b): a script that applies
# every schema_phase*.sql in numeric order, preferred over consolidating 78
# files into one bootstrap script because that would mean re-verifying each
# file's idempotency by hand — this script instead runs the same files this
# repo's own history has already applied one at a time, in the SQL editor,
# 74 times over. It changes HOW they're applied, not WHAT gets applied.
#
# HONESTY NOTE: the first version of this script only globbed
# schema_phase*.sql, silently skipping schema_payouts_phase1.sql,
# schema_payouts_functions.sql, and analytics_functions.sql — three real
# files with no schema_phase prefix, that a genuinely clean setup needs
# (payout tables/functions, analytics RPCs). Found and fixed by re-checking
# `ls supabase/*.sql` against what the glob actually matched, the same
# discipline this whole task exists to instill, not by a real database run
# catching the missing tables. Fixed now, but flagged here so the fact that
# a hand-review still missed it on the first pass isn't quietly lost.
#
# Usage:
#   DATABASE_URL=postgres://... ./supabase/run-all-migrations.sh
#
# Stops on the first failing file (psql -v ON_ERROR_STOP=1) rather than
# continuing past a broken migration and leaving the database in a
# half-applied, hard-to-diagnose state — same reasoning the DEPLOY.md
# manual SQL-editor process already implicitly relies on (each file's own
# header says "run once... AFTER" the previous one, in order).

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Example:" >&2
  echo "  DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres ./supabase/run-all-migrations.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required and was not found on PATH." >&2
  exit 1
fi

apply() {
  local file="$1"
  echo "==> Applying $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
}

if [ ! -f schema.sql ]; then
  echo "schema.sql not found in $SCRIPT_DIR — run this from a checkout that has it." >&2
  exit 1
fi

apply schema.sql

# Payout tables/functions are their own files, not schema_phase*.sql —
# easy to miss with a glob that only matches that pattern (this script's
# own first draft did, caught only by re-checking `ls supabase/*.sql`
# against what this script actually globs rather than trusting the glob
# was complete). schema_payouts_phase1.sql only depends on schema.sql's
# own tables (publishers, payments), so it's safe immediately after the
# base; schema_payouts_functions.sql depends on schema_payouts_phase1.sql's
# tables and nothing from any later phase, so it can follow directly.
apply schema_payouts_phase1.sql
apply schema_payouts_functions.sql

# Numeric sort on the phase number, not a lexical `ls` sort — extracts the
# digits right after "schema_phase" (e.g. schema_phase53_content_approval.sql
# -> 53) and orders on that, so schema_phase9.sql (if it existed) would
# correctly apply before schema_phase10_*.sql rather than after it.
for f in $(ls schema_phase*.sql 2>/dev/null | \
           sed -E 's/^(schema_phase([0-9]+)[^ ]*)$/\2 \1/' | \
           sort -n -k1,1 | \
           cut -d' ' -f2-); do
  apply "$f"
done

# analytics_functions.sql references tables from several late phases
# (business_subscriptions, channel_requests, agency_campaigns) — must run
# after every schema_phase*.sql above, never before.
apply analytics_functions.sql

echo "==> All migrations applied."
