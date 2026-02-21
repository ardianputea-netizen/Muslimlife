import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['components', 'context', 'lib'];
const files = ['App.tsx', 'index.css'];

const walk = (dir) => {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|css)$/.test(full)) continue;
    if (/\.d\.ts$/.test(full)) continue;
    files.push(full.replace(/\\/g, '/'));
  }
};

for (const root of roots) {
  walk(root);
}

const banned = [
  /\bbg-white\b/g,
  /\btext-black\b/g,
  /\bborder-gray-(?:50|100|200|300|400|500|600|700|800|900)\b/g,
  /\bbg-gray-(?:50|100|200|300|400|500|600|700|800|900)\b/g,
  /\bplaceholder-gray-(?:50|100|200|300|400|500|600|700|800|900)\b/g,
];

const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of banned) {
    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      const index = match.index ?? 0;
      const line = content.slice(0, index).split('\n').length;
      violations.push(`${file}:${line} -> ${match[0]}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Theme guard failed. Found banned hardcoded classes:');
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Theme guard passed.');
