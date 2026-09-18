#!/usr/bin/env node
// Static check for "claude to fix 2" item 18 (currency migration): fails
// with a non-zero exit code if any source file outside the currency
// utility itself, or a test file, contains a direct Rand interpolation
// instead of going through formatCurrency/formatCurrencyRange
// (src/lib/currency.ts).
//
// Why a standalone script and not an oxlint rule: this repo's lint script
// is plain `oxlint` with no config file (see package.json) — oxlint ships
// a fixed set of built-in rules and doesn't support authoring a custom
// pattern-matching rule the way an ESLint plugin would. A small script is
// the pragmatic way to get an enforceable, CI-able check without adding a
// new lint framework/dependency to the project just for this one rule.
// Wired into `npm run lint` (see package.json) so it runs wherever lint
// already runs, including any CI step that calls it.
//
// What it catches (each is a real pattern this codebase actually had,
// found and fixed across ~35 files in this same task — not a hypothetical
// list):
//   - `R{...}` / `R${...}` — a literal Rand symbol directly beside a JS
//     expression in JSX or a template literal, e.g. `R{amount}`,
//     `` `R${amount.toLocaleString()}` ``. This was by far the most common
//     form, and included plain `R{amount}` with NO formatting at all (no
//     thousands separator) as well as `.toFixed()`/`.toLocaleString()`
//     variants — the regex below doesn't care which, it flags the "R"
//     immediately followed by an expression either way.
//   - `new Intl.NumberFormat(...)` with `style: "currency"` — a
//     reimplementation of what src/lib/currency.ts already provides,
//     which is exactly how this codebase drifted in the first place (8
//     files hardcoded "en-ZA", 3 passed `undefined` for the locale).
//
// What it deliberately does NOT try to catch (would need a real parser,
// not a regex, to do safely): money values referenced without any "R"
// prefix nearby, or currency amounts hidden inside more complex string
// building. This check is a floor, not a guarantee — code review is still
// the real backstop for anything more subtle than the direct-interpolation
// pattern this repo actually had.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIRS = ["src", "supabase/functions"];
const SKIP_DIR_NAMES = new Set(["node_modules", "dist", "build", ".git"]);
const FILE_EXTENSIONS = new Set([".ts", ".tsx"]);

// The currency utility itself is allowed to reference "R" however it
// needs to (it's the one place that's supposed to build these strings),
// and its own test file legitimately asserts on formatted "R ..." output.
//
// publisher-authenticity-check is a different, deliberate exception: its
// "R{amount}" is plain-text fed into an LLM prompt (Cloudflare Workers
// AI), not a screen a person reads — the model doesn't care whether an
// amount is grouped as "15000" or "15 000", and this file can't import
// src/lib/currency.ts anyway (it's a separate Deno runtime, not bundled
// with the Vite app). If this function ever starts showing that text to a
// user instead of an LLM, it stops qualifying for this exception.
//
// supabase/functions/_shared/currency.ts is the Deno-side counterpart to
// src/lib/currency.ts itself — same reasoning as publisher-authenticity-
// check for why it can't just import the Vite one, but this one DOES show
// its output to a person (e.g. notify/index.ts's admin lead-notification
// email), so it re-implements the exact same Intl.NumberFormat call
// rather than being let off formatting consistency altogether. Any other
// edge function that needs to show a Rand amount to a person should
// import formatCurrency from there, not add itself to this list.
const ALLOWED_FILE_SUFFIXES = [
  "src/lib/currency.ts",
  "src/lib/currency.test.ts",
  "supabase/functions/_shared/currency.ts",
  "supabase/functions/publisher-authenticity-check/index.ts",
];

// A literal "R" immediately followed by "{" (JSX/template-literal
// interpolation) or by "$" then "{" (a plain template literal).
const RAND_INTERPOLATION_PATTERN = /R\$?\{/;
const REIMPLEMENTED_FORMATTER_PATTERN = /new\s+Intl\.NumberFormat\([^)]*\bstyle:\s*["']currency["']/s;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (FILE_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) {
      files.push(full);
    }
  }
  return files;
}

function isAllowed(relPath) {
  return ALLOWED_FILE_SUFFIXES.some((suffix) => relPath.endsWith(suffix)) || relPath.endsWith(".test.ts") || relPath.endsWith(".test.tsx");
}

const violations = [];

for (const dir of SRC_DIRS) {
  const absDir = join(ROOT, dir);
  let files;
  try {
    files = walk(absDir);
  } catch (err) {
    if (err && err.code === "ENOENT") continue; // directory doesn't exist in this checkout — skip, not an error
    throw err; // any other failure (e.g. a real path/permissions bug) should be loud, not silently swallowed
  }
  for (const absPath of files) {
    const relPath = relative(ROOT, absPath);
    if (isAllowed(relPath)) continue;
    const content = readFileSync(absPath, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      if (RAND_INTERPOLATION_PATTERN.test(line) || REIMPLEMENTED_FORMATTER_PATTERN.test(line)) {
        violations.push(`${relPath}:${i + 1}: ${line.trim()}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error("Direct Rand formatting found outside src/lib/currency.ts — use formatCurrency()/formatCurrencyRange() instead:\n");
  for (const v of violations) console.error("  " + v);
  console.error(`\n${violations.length} violation(s). See src/lib/currency.ts for the shared formatter and why it exists.`);
  process.exit(1);
} else {
  console.log("check-currency-formatting: no direct Rand interpolation found outside src/lib/currency.ts.");
}
