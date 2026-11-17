// pointer-metrics.mjs — 指针化三项指标基线（developer，2026-11-16）
// 口径完全复用 staging/no-at-count.v2.mjs（大肥鱼维护）：同源 bot ledger、
// 分母＝kind 不在系统标记集合且 text 非空的记录（真发言）、不剔纯 [PASS]、不去重、窗口按记录 time。
// 指标：H=含 32 位 hex 哈希；S=含字节/行数量值；O=含旧回合/过期/作废/撤回。
import { readFileSync } from 'node:fs';
const LEDGER = process.env.LEDGER || 'C:/Users/<用户名>/.dsh/bot/ledger/group-session-4f78136d-2080-4806-ba83-0e5295209594.jsonl';
const MARKERS = new Set(['notice','done','resumed','cut','lookup','approval','stopped']);
const win = process.argv[2] || '';
const day = process.argv[3] || new Date().toLocaleDateString('sv-SE');
const rows = readFileSync(LEDGER,'utf8').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);
const speech = rows.filter(d => d.event === undefined && typeof d.text === 'string' && d.text.trim() && !MARKERS.has(d.kind));
function inWin(d){ const t=new Date(d.time); if(t.toLocaleDateString('sv-SE')!==day) return false; if(!win) return true;
  const [a,b]=win.split('-'); const p=n=>{const[h,m]=n.split(':').map(Number); return h*3600+m*60};
  const secs=t.getHours()*3600+t.getMinutes()*60+t.getSeconds(); return secs>=p(a)&&secs<=p(b);}
const RE_HASH = /\b[0-9a-fA-F]{32}\b/;
const RE_SIZE = /\d+\s*(?:B|字节|行)\b|\bbytes=|\blines=/;
const RE_STALE = /旧回合|过期|作废|撤回|已失效/;
const winList = speech.filter(inWin);
const pick = (re) => winList.filter(d => re.test(d.text)).length;
const pct = (n) => +(winList.length ? n / winList.length * 100 : 0).toFixed(2);
const out = {
  day, window: win || 'ALL',
  N: winList.length,
  noAt: winList.filter(d=>!d.text.includes('@')).length,
  hash: { n: pick(RE_HASH), pct: pct(pick(RE_HASH)) },
  size: { n: pick(RE_SIZE), pct: pct(pick(RE_SIZE)) },
  stale:{ n: pick(RE_STALE), pct: pct(pick(RE_STALE)) },
};
console.log(JSON.stringify(out, null, 1));
