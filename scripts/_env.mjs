// Shared by scripts/generate-security-headers.mjs and
// scripts/generate-sitemap.mjs — both are standalone Node scripts (not
// bundled by Vite), so neither gets Vite's own env loading into
// import.meta.env for free. Real deploy platforms (Netlify/Vercel/
// Cloudflare Pages) already inject configured env vars into
// process.env for the build command, so those always win; local .env*
// files (Vite's own precedence order, later overrides earlier) are read
// only to fill in anything not already set, for local `npm run build`
// testing. Extracted here rather than duplicated after both scripts
// needed the identical block.
import { readFileSync, existsSync } from "node:fs";

export function loadEnv() {
  for (const file of [".env", ".env.production", ".env.local", ".env.production.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)?\s*$/);
      if (!match) continue;
      const [, key, rawValue = ""] = match;
      if (process.env[key] === undefined) {
        process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    }
  }
}
