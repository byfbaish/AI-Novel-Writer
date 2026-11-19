// no-at-count.v2.mjs — 无@率唯一出处（大肥鱼维护，2026-11-16）
// 口径：同源 bot ledger；分母＝kind 不在系统标记集合且 text 非空的记录（真发言）；
//       不剔除纯 [PASS]（其仍属发言，但窗口内为 0）；不按注入副本去重；窗口按记录 time。
import { readFileSync } from 'node:fs';
const LEDGER = process.env.LEDGER || 'C:/Users/<用户名>/.dsh/bot/ledger/group-session-4f78136d-2080-4806-ba83-0e5295209594.jsonl';
const MARKERS = new Set(['notice','done','resumed','cut','lookup','approval','stopped']);
const win = process.argv[2] || ''; // e.g. 12:00-18:30
const day = process.argv[3] || new Date().toLocaleDateString('sv-SE'); // 本地日期 YYYY-MM-DD
const rows = readFileSync(LEDGER,'utf8').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);
const speech = rows.filter(d => d.event === undefined && typeof d.text === 'string' && d.text.trim() && !MARKERS.has(d.kind));
function inWin(d){ const t=new Date(d.time); if(t.toLocaleDateString('sv-SE')!==day) return false; if(!win) return true;
  const [a,b]=win.split('-'); const p=n=>{const[h,m]=n.split(':').map(Number); return h*3600+m*60};
  const secs=t.getHours()*3600+t.getMinutes()*60+t.getSeconds(); return secs>=p(a)&&secs<=p(b);}
function stat(list){ const n=list.length, noAt=list.filter(d=>!d.text.includes('@')).length; return {n,noAt,pct:+(n? noAt/n*100:0).toFixed(2)}; }
const winList = speech.filter(inWin);
const per = {};
for(const d of winList){ const k=d.who||'?'; per[k] ??= []; per[k].push(d); }
const out = { day, window: win||'ALL', all: stat(speech), inWindow: stat(winList),
  byBot: Object.fromEntries(Object.entries(per).sort((a,b)=>b[1].length-a[1].length).map(([k,v])=>[k,stat(v)])) };
console.log(JSON.stringify(out,null,1));
