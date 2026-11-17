import fs from 'node:fs';
const L = 'C:/Users/<用户名>/.dsh/bot/ledger/group-session-4f78136d-2080-4806-ba83-0e5295209594.jsonl';
const rows = fs.readFileSync(L, 'utf8').split('\n').filter(Boolean).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
// 11-16 12:00:00–18:30:00 Asia/Shanghai = UTC+8
const start = Date.parse('2026-11-16T12:00:00+08:00');
const end = Date.parse('2026-11-16T18:30:00.999+08:00');
const win = rows.filter(d => typeof d.time === 'number' && d.time >= start && d.time <= end);
const speech = win.filter(d => d.event === undefined && typeof d.text === 'string' && d.text.trim());
const noat = x => x.filter(d => !/@\S/.test(d.text));
console.log('window all', win.length, 'speech', speech.length, 'noat', noat(speech).length, (noat(speech).length / speech.length * 100).toFixed(2) + '%');
const whoSet = [...new Set(speech.map(d => d.who))];
for (const w of whoSet) {
  const s = speech.filter(d => d.who === w); const n = noat(s);
  console.log(`  who=${JSON.stringify(w)} n=${s.length} noat=${n.length}`);
}
const noWho = speech.filter(d => !['User', 'DS Bot', 'DSBot'].includes(d.who));
console.log('drop User/DS Bot:', noWho.length, noat(noWho).length, (noat(noWho).length / noWho.length * 100).toFixed(2) + '%');
