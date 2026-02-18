import fs from 'node:fs';
import path from 'node:path';

const datasetPath = path.resolve(process.cwd(), 'src/data/doa_dzikir.json');
const raw = fs.readFileSync(datasetPath, 'utf8');
const data = JSON.parse(raw);

const rows = [
  ...(data?.items || []),
  ...(data?.collections?.al_matsurat?.pagi || []),
  ...(data?.collections?.al_matsurat?.petang || []),
  ...(data?.collections?.wirid_tahlil || []),
  ...(data?.collections?.bilal_tarawih || []),
  ...(data?.collections?.asmaul_husna || []),
];

const broken = rows.filter((row) => {
  const arab = String(row?.arab || '').trim();
  if (!arab) return true;
  const questionCount = (arab.match(/\?/g) || []).length;
  const arabicCount = [...arab].filter((ch) => /\p{Script=Arabic}/u.test(ch)).length;
  return questionCount >= 3 || arabicCount === 0;
});

const asmaulCount = Array.isArray(data?.collections?.asmaul_husna) ? data.collections.asmaul_husna.length : 0;
if (asmaulCount < 99) {
  broken.push({ id: 'asmaul_husna', arab: '' });
}

if (broken.length > 0) {
  console.error(`[doa-dataset] invalid rows: ${broken.length}`);
  process.exit(1);
}

console.log('[doa-dataset] validation passed');
