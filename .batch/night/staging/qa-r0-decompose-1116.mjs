import fs from 'node:fs';
const p = 'C:/Users/<用户名>/.dsh/bot/ledger/group-session-4f78136d-2080-4806-ba83-0e5295209594.jsonl';
const st = +new Date('2026-11-16T12:00:00+08:00');
const en = +new Date('2026-11-16T18:30:00+08:00');
const A = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
  .map(l => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean).filter(o => o.time >= st && o.time <= en);
const cnt = (arr) => arr.length;
const noat = (arr) => arr.filter(o => !/@[^\s]+/.test(o.text || '')).length;
console.log('窗口全部记录', cnt(A));
const hasText = A.filter(o => typeof o.text === 'string');
console.log('有 text 字段', cnt(hasText));
const nonEmpty = hasText.filter(o => o.text.trim());
console.log('text 非空', cnt(nonEmpty), '无@', noat(nonEmpty), '率', (100 * noat(nonEmpty) / cnt(nonEmpty)).toFixed(2) + '%');
const noUB = nonEmpty.filter(o => o.who !== 'User' && o.who !== 'DS Bot');
console.log('再剔 User/DSBot', cnt(noUB), '无@', noat(noUB), '率', (100 * noat(noUB) / cnt(noUB)).toFixed(2) + '%');
// 有 text 但 who 为 DS Bot / User
const ub = nonEmpty.filter(o => o.who === 'User' || o.who === 'DS Bot');
console.log('其中 User/DSBot', cnt(ub));
// 事件类型分布
const ev = {};
for (const o of noUB) ev[o.event || '(none)'] = (ev[o.event || '(none)'] || 0) + 1;
console.log('event 分布', JSON.stringify(ev));
// 大肥鱼口径猜测：含空 text 的记录
const allWithTextAny = hasText;
console.log('把空 text 也计入的分母', cnt(allWithTextAny), '无@', noat(allWithTextAny), '率', (100 * noat(allWithTextAny) / cnt(allWithTextAny)).toFixed(2) + '%');
