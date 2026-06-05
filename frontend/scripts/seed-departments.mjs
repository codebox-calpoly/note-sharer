#!/usr/bin/env node
/**
 * Seeds the departments table from frontend/lib/calpoly-departments.ts.
 * Loads SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local if present.
 * Run from frontend: npm run db:seed-departments
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  raw.split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  });
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { CALPOLY_DEPARTMENTS } = await import("../lib/calpoly-departments.ts");
  const departments = CALPOLY_DEPARTMENTS.map((department) => ({
    code: department.code,
    name: department.name,
    aliases: department.aliases,
    is_active: true,
  }));
  const { error } = await supabase.from("departments").upsert(departments, {
    onConflict: "code",
  });

  if (error) {
    console.error("Upsert error:", error.message);
    process.exit(1);
  }

  console.error("Department seed done. Rows upserted:", departments.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
