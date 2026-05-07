/**
 * Parses the extracted catalog text and outputs a JSON array of courses
 * with department, code, name, and description.
 * Run from frontend: node scripts/parse-catalog.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, '../../docs/catalog-extracted.txt');
const outputPath = path.join(__dirname, '../../docs/catalog-parsed.json');

const text = fs.readFileSync(inputPath, 'utf8');

// Match: DEPT 123. Course Title. X units  (or X-Y units)
// Capture position so we can extract the description text between entries
const courseRegex = /\b([A-Z]{2,6})\s+(\d{1,4}[A-Z]?)\.\s+([^.]+?)\.\s+([\d][\d\-]* units)/g;

// First pass: collect all matches with their index positions
const matches = [];
let match;
while ((match = courseRegex.exec(text)) !== null) {
  matches.push({
    dept: match[1],
    number: match[2],
    title: match[3].trim().replace(/\s+/g, ' '),
    index: match.index,
    endIndex: match.index + match[0].length,
  });
}

// Second pass: extract description as text between end of this entry and start of next
const courses = [];
const seen = new Set();

for (let i = 0; i < matches.length; i++) {
  const m = matches[i];
  const code = `${m.dept} ${m.number}`;

  // Description runs from end of the header line to start of next course entry
  const descEnd = i + 1 < matches.length ? matches[i + 1].index : text.length;
  let rawDesc = text.slice(m.endIndex, descEnd);

  // Clean up: remove "Term Typically Offered" line, page headers, collapse spaces, fix ligatures
  rawDesc = rawDesc
    .replace(/PDF of \d{4}-\d{4} Catalog\s+\d+/g, '')
    .replace(/\d+\s+[A-Z][a-z]+ [A-Z]+\s+\([A-Z]+\)/g, '')
    .replace(/Term Typically Offered:[^.]+\./g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+fi\s+/g, 'fi ')
    .replace(/\s+fl\s+/g, 'fl ')
    .replace(/thefi /g, 'the fi')
    .trim();

  // Truncate to 600 chars if too long, add ellipsis
  const description = rawDesc.length > 600 ? rawDesc.slice(0, 600).trim() + '…' : rawDesc || null;

  if (!seen.has(code)) {
    seen.add(code);
    courses.push({
      department: m.dept,
      code,
      name: m.title,
      description: description || null,
    });
  }
}

// Sort by department then course number
courses.sort((a, b) => {
  if (a.department !== b.department) return a.department.localeCompare(b.department);
  return a.code.localeCompare(b.code);
});

fs.writeFileSync(outputPath, JSON.stringify(courses, null, 2));
console.log(`Parsed ${courses.length} courses → docs/catalog-parsed.json`);

// Show a sample
console.log('\nSample entry:');
console.log(JSON.stringify(courses[0], null, 2));

// Dept summary
const deptCounts = {};
for (const c of courses) {
  deptCounts[c.department] = (deptCounts[c.department] || 0) + 1;
}
const sorted = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
console.log(`\nTotal departments: ${sorted.length}, total courses: ${courses.length}`);
