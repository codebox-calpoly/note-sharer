#!/usr/bin/env node
/**
 * Fetches 2026-2028 Cal Poly catalog department pages and extracts ONLY the
 * bolded line for each course: "CourseName (N units)" (everything after the
 * course number). Discovers department links from the catalog index for full coverage.
 * Writes data/catalog/course-titles.json.
 * Run: node scripts/fetch-course-titles.mjs
 */

const CATALOG_BASE = "https://catalog.calpoly.edu/courses/";
const INDEX_URL = "https://catalog.calpoly.edu/courses/";
const MAX_RETRIES = 3;
const DELAY_MS = 150;

// Bolded line: DEPT + space + NUMBER (4 digits + optional L) + CourseName + (N units) — no space between number and name in HTML
const BOLDED_COURSE_REGEX = /([A-Z]{2,5})\s+(\d{4}[A-Z]?)([^\d(]*?)\s*\((\d+(?:-\d+)?)\s*units?\)/g;

function parseBoldedTitlesFromText(text) {
  const map = new Map();
  let m;
  BOLDED_COURSE_REGEX.lastIndex = 0;
  while ((m = BOLDED_COURSE_REGEX.exec(text)) !== null) {
    const dept = m[1].trim();
    const num = m[2].trim();
    let name = m[3].trim();
    const units = m[4].trim();
    name = name.replace(/\*+$/, "").replace(/^\*+/, "").trim();
    if (!name || name.length > 120) continue;
    const code = `${dept} ${num}`;
    const subline = `${name} (${units} units)`;
    if (!map.has(code)) map.set(code, subline);
  }
  return map;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { "User-Agent": "PolyPages-Bot/1.0" } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

async function fetchWithRetry(url) {
  let lastErr;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const html = await fetchPage(url);
      return html;
    } catch (err) {
      lastErr = err;
      if (i < MAX_RETRIES - 1) await sleep(1000 * (i + 1));
    }
  }
  throw lastErr;
}

/** Extract department slugs from catalog index (links like /courses/aero/ or full URL). */
function extractDepartmentSlugs(html) {
  const slugs = new Set();
  const re = /(?:catalog\.calpoly\.edu)?\/courses\/([a-z0-9]+)\//gi;
  let m;
  while ((m = re.exec(html)) !== null) slugs.add(m[1].toLowerCase());
  return [...slugs].sort();
}

async function run() {
  const allEntries = new Map();
  allEntries.set("TEST 000", "TEST COURSE (0 units)");

  // Discover all department slugs from the catalog index
  process.stderr.write("Fetching catalog index... ");
  let slugs;
  try {
    const indexHtml = await fetchWithRetry(INDEX_URL);
    slugs = extractDepartmentSlugs(indexHtml);
    process.stderr.write(`${slugs.length} departments found.\n`);
  } catch (err) {
    console.error("Failed to fetch index:", err.message);
    process.exit(1);
  }

  const failed = [];
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const url = `${CATALOG_BASE}${slug}/`;
    try {
      const html = await fetchWithRetry(url);
      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const parsed = parseBoldedTitlesFromText(text);
      for (const [code, subline] of parsed) {
        if (!allEntries.has(code)) allEntries.set(code, subline);
      }
      process.stderr.write(".");
      await sleep(DELAY_MS);
    } catch {
      failed.push(url);
      process.stderr.write("x");
    }
  }
  if (failed.length) console.error("\nFailed URLs:", failed.join(", "));

  const codes = [...allEntries.keys()].sort((a, b) => {
    const [deptA, numA] = a.split(/\s+/);
    const [deptB, numB] = b.split(/\s+/);
    if (deptA !== deptB) return deptA.localeCompare(deptB);
    return parseInt(numA, 10) - parseInt(numB, 10);
  });

  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.join(__dirname, "../data/catalog");
  fs.mkdirSync(outDir, { recursive: true });
  const entries = Object.fromEntries(codes.map((code) => [code, allEntries.get(code)]));
  const outPath = path.join(outDir, "course-titles.json");
  fs.writeFileSync(outPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  console.error(`\nWrote ${codes.length} course titles to data/catalog/course-titles.json`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
