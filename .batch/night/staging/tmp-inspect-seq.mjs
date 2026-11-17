import { readFileSync } from 'node:fs';
const lines = readFileSync('.batch/night/staging/tmp-c9ff5961.jsonl', 'utf8').split('\n').filter(Boolean);
const lo = Number(process.argv[2] ?? 312);
const hi = Number(process.argv[3] ?? 340);
for (const l of lines) {
  let o; try { o = JSON.parse(l); } catch { continue; }
  const s = o.seq; if (!(s >= lo && s <= hi)) continue;
  const t = o.type; let brief = '';
  if (t === 'tool/call') brief = (o.data.name ?? '') + ' ' + String(o.data.arguments ?? '').slice(0, 180);
  else if (t === 'tool/result') brief = String(o.data?.message?.content?.[0]?.text ?? '').slice(0, 260).replace(/\n/g, ' | ');
  else if (t === 'assistant/message') {
    const c = o.data?.message?.content ?? [];
    brief = c.map((x) => x.type === 'text' ? 'TEXT:' + x.text.slice(0, 160) : x.type === 'tool-call' ? 'TOOL:' + x.name : x.type === 'reasoning' ? 'R' : x.type).join(' ');
  }
  console.log(s, t, brief);
}
