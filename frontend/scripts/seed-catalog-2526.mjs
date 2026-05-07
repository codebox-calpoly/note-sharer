#!/usr/bin/env node
/**
 * Seeds the 2025-2026 catalog courses from docs/catalog-parsed.json.
 * Run from frontend: node scripts/seed-catalog-2526.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "../.env.local");
  const envFile = fs.existsSync(envPath) ? envPath : path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) return;
  const raw = fs.readFileSync(envFile, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "").replace(/\r$/, "");
  });
}
loadEnvLocal();

// 2025-2026 academic year terms
const CATALOG_TERMS = [
  { term: "Fall",   year: 2025 },
  { term: "Winter", year: 2026 },
  { term: "Spring", year: 2026 },
  { term: "Summer", year: 2026 },
];

const CATALOG_YEAR = 2526; // represents 2025-2026

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const catalogPath = path.join(__dirname, "../../docs/catalog-parsed.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  console.log(`Loaded ${catalog.length} courses from catalog-parsed.json`);

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let total = 0;
  const batchSize = 100;
  const errors = [];

  for (const { term, year } of CATALOG_TERMS) {
    console.log(`\nSeeding ${term} ${year}...`);
    for (let i = 0; i < catalog.length; i += batchSize) {
      const chunk = catalog.slice(i, i + batchSize);
      const rows = chunk.map((c) => {
        // Extract numeric part from code like "AERO 121" -> 121
        const numMatch = c.code.match(/\s(\d+)/);
        const courseNumber = numMatch ? parseInt(numMatch[1], 10) : 0;
        return {
          department: c.department,
          course_number: courseNumber,
          title: c.name,
          description: c.description ?? null,
          term,
          year,
          catalog_year: CATALOG_YEAR,
          is_active: true,
          tags: [],
        };
      });

      const { error } = await supabase.from("courses").upsert(rows, {
        onConflict: "department,course_number,term,year,catalog_year",
      });

      if (error) {
        errors.push(`${term} ${year} batch ${i}: ${error.message}`);
        process.stderr.write("x");
      } else {
        total += rows.length;
        process.stderr.write(".");
      }
    }
  }

  console.log(`\n\nDone. Rows upserted: ${total}`);
  if (errors.length > 0) {
    console.error(`\n${errors.length} errors:`);
    errors.forEach((e) => console.error(" -", e));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
