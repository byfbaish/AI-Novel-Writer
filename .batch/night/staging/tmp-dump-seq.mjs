import { readFileSync } from 'node:fs';
const lines = readFileSync('.batch/night/staging/tmp-c9ff5961.jsonl', 'utf8').split('\n').filter(Boolean);
const want = process.argv.slice(2).map(Number);
for (const l of lines) {
  let o; try { o = JSON.parse(l); } catch { continue; }
  if (!want.includes(o.seq)) continue;
  console.log('=== seq', o.seq, o.type);
  console.log(JSON.stringify(o.data).slice(0, 1800));
  console.log();
}
