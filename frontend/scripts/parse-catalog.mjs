/**
 * Parses the extracted catalog text and outputs a JSON array of courses.
 * Run from frontend: node scripts/parse-catalog.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, '../../docs/catalog-extracted.txt');
const outputPath = path.join(__dirname, '../../docs/catalog-parsed.json');

const text = fs.readFileSync(inputPath, 'utf8');

// Match patterns like: AERO 121. Aerospace Fundamentals. 2 units
// or: CSC 101. Fundamentals of Computer Science. 4 units
const courseRegex = /\b([A-Z]{2,6})\s+(\d{1,4}[A-Z]?)\.\s+([^.]+?)\.\s+[\d\-]+ units/g;

const courses = [];
const seen = new Set();

let match;
while ((match = courseRegex.exec(text)) !== null) {
  const dept = match[1];
  const number = match[2];
  const title = match[3].trim().replace(/\s+/g, ' ');
  const code = `${dept} ${number}`;
  const key = code;

  if (!seen.has(key)) {
    seen.add(key);
    courses.push({ department: dept, code, name: title });
  }
}

// Sort by department then course number
courses.sort((a, b) => {
  if (a.department !== b.department) return a.department.localeCompare(b.department);
  return a.code.localeCompare(b.code);
});

fs.writeFileSync(outputPath, JSON.stringify(courses, null, 2));
console.log(`Parsed ${courses.length} courses → docs/catalog-parsed.json`);

// Print department summary
const deptCounts = {};
for (const c of courses) {
  deptCounts[c.department] = (deptCounts[c.department] || 0) + 1;
}
const sorted = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
console.log('\nTop departments by course count:');
sorted.slice(0, 20).forEach(([dept, count]) => console.log(`  ${dept}: ${count}`));
console.log(`\nTotal departments: ${sorted.length}`);
