#!/usr/bin/env node
/**
 * Gera types/database.generated.ts via Supabase Management API (HTTP).
 * Sem Docker. Requer SUPABASE_ACCESS_TOKEN no .env.local (gere em
 * https://supabase.com/dashboard/account/tokens).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const ref = env.SUPABASE_PROJECT_REF;
const token = env.SUPABASE_ACCESS_TOKEN;

if (!ref) {
  console.error("✗ SUPABASE_PROJECT_REF ausente em .env.local.");
  process.exit(1);
}
if (!token) {
  console.error(
    "✗ SUPABASE_ACCESS_TOKEN ausente em .env.local.\n" +
      "  Gere um em https://supabase.com/dashboard/account/tokens",
  );
  process.exit(1);
}

const url = `https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`;

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});

if (!res.ok) {
  console.error(`✗ ${res.status} ${res.statusText}`);
  console.error(await res.text());
  process.exit(1);
}

const { types } = await res.json();
writeFileSync("types/database.generated.ts", types);
console.log("✓ types/database.generated.ts gerado.");
