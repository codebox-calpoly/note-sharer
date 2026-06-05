#!/usr/bin/env node
/**
 * Fetches Cal Poly department catalog pages, parses course listings, and writes
 * frontend/data/catalog with real courses (plus TEST COURSE).
 * Run: node scripts/build-calpoly-catalog.mjs
 */

const CATALOG_BASE = "https://catalog.calpoly.edu/courses/";
const DEPT_SLUGS = [
  "aero", "agb", "agc", "aged", "ag", "asci", "ant", "arce", "arch", "art", "astr", "athl", "bio", "bmed", "brae", "bot", "bus", "che", "chem", "cd", "chin", "crp", "ce", "cla", "coms", "cpe", "csc", "com", "cm", "cep", "cru", "ci", "dsci", "danc", "dat", "data", "dl", "esm", "ersc", "eco", "econ", "educ", "elap", "ee", "em", "eng", "engr", "epo", "et", "egl", "engl", "edes", "enve", "esci", "es", "eim", "fpe", "ff", "fdsc", "fsn", "fr", "geog", "geol", "ger", "gma", "gov", "gs", "gsa", "gsb", "grc", "hlth", "hcsa", "his", "hist", "hnrs", "hnrc", "hum", "ime", "itp", "isla", "ibl", "ital", "jpns", "jour", "kine", "la", "lan", "law", "ldr", "laes", "ls", "lib", "mgt", "msci", "mpm", "mate", "math", "mth", "me", "mcro", "msl", "mu", "nr", "nau", "nsc", "nutr", "ocn", "phil", "pe", "psc", "phy", "phys", "plsc", "pols", "psy", "rels", "scm", "soc", "ss", "span", "sped", "stat", "th", "tem", "univ", "wvit", "wgqs", "wlc",
];

// Match: DEPT + space + 4-digit NUMBER (optional letter) + optional space + TITLE + (N units)
// Use 4 digits to avoid matching "Formerly DEPT 121" etc. in body text.
const COURSE_REGEX = /([A-Z]{2,5})\s+(\d{4}[A-Z]?)(?:\s+)?(.+?)\s*\(\d+(?:-\d+)?\s*units?\)/g;

function parseCoursesFromText(text) {
  const courses = [];
  let m;
  COURSE_REGEX.lastIndex = 0;
  while ((m = COURSE_REGEX.exec(text)) !== null) {
    const dept = m[1].trim();
    const num = m[2].trim();
    let title = m[3].trim();
    // Trim trailing asterisks and clean title
    title = title.replace(/\*+$/, "").trim();
    if (!title) continue;
    const code = `${dept} ${num}`;
    courses.push({ department: dept, code, name: `${code} - ${title}` });
  }
  return courses;
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { "User-Agent": "PolyPages-Bot/1.0" } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

async function run() {
  const coursesByKey = new Map();
  const allCourses = [];

  allCourses.push({ department: "TEST", code: "TEST 000", name: "TEST COURSE" });

  for (const slug of DEPT_SLUGS) {
    const url = `${CATALOG_BASE}${slug}/`;
    try {
      const html = await fetchPage(url);
      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const parsed = parseCoursesFromText(text);
      for (const c of parsed) {
        const key = `${c.department}-${c.code}`;
        if (!coursesByKey.has(key)) {
          coursesByKey.set(key, true);
          allCourses.push(c);
        }
      }
      process.stderr.write(".");
    } catch (err) {
      console.error(`\nFailed ${url}:`, err.message);
    }
  }

  // Sort: TEST first, then by department, then by course number
  allCourses.sort((a, b) => {
    if (a.department === "TEST" && b.department !== "TEST") return -1;
    if (b.department === "TEST" && a.department !== "TEST") return 1;
    if (a.department !== b.department) return a.department.localeCompare(b.department);
    const numA = (a.code.match(/\d+/) || [""])[0];
    const numB = (b.code.match(/\d+/) || [""])[0];
    return parseInt(numA, 10) - parseInt(numB, 10);
  });

  const deptCodes = [...new Set(allCourses.map((c) => c.department))].filter((d) => d !== "TEST").sort();
  deptCodes.unshift("TEST");

  const fs = await import("fs");
  const dataDir = new URL("../data/catalog/", import.meta.url);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    new URL("department-codes.json", dataDir),
    `${JSON.stringify(deptCodes, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    new URL("placeholder-courses.json", dataDir),
    `${JSON.stringify(allCourses, null, 2)}\n`,
    "utf8",
  );
  console.error(`\nWrote ${allCourses.length} courses to data/catalog/placeholder-courses.json`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
