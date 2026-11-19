// no-at-count.v3.mjs — 无@率唯一出处（大肥鱼维护，2026-11-16 20:45）
// 分母口径 B：ledger 中 event 缺省、text 去空白后非空（即「有正文的记录」），不按 kind 过滤；
//   理由：done/resumed/cut 等系统标记多为空正文，无正文者不构成「发言」，不该计分子也不该计分母。
// 不按注入副本去重；窗口按本地日期＋时分。用法：node no-at-count.v3.mjs 12:00-18:30 [YYYY-MM-DD]
import { readFileSync } from 'node:fs';
const LEDGER = process.env.LEDGER || 'C:/Users/<用户名>/.dsh/bot/ledger/group-session-4f78136d-2080-4806-ba83-0e5295209594.jsonl';
const win = process.argv[2] || '';
const day = process.argv[3] || new Date().toLocaleDateString('sv-SE');
const rows = readFileSync(LEDGER,'utf8').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);
const speech = rows.filter(d => d.event === undefined && typeof d.text === 'string' && d.text.trim());
function inWin(d){ const t=new Date(d.time); if(t.toLocaleDateString('sv-SE')!==day) return false; if(!win) return true;
  const [a,b]=win.split('-'); const p=n=>{const[h,m]=n.split(':').map(Number); return h*3600+m*60};
  const s=t.getHours()*3600+t.getMinutes()*60+t.getSeconds(); return s>=p(a)&&s<=p(b); }
const st = l => { const n=l.length, k=l.filter(d=>!d.text.includes('@')).length; return {n,noAt:k,pct:+(n? k/n*100:0).toFixed(2)}; };
const w = speech.filter(inWin);
const per={}; for(const d of w){ (per[d.who||'?'] ??= []).push(d); }
console.log(JSON.stringify({day,window:win||'ALL',all:st(speech),inWindow:st(w),
 byBot:Object.fromEntries(Object.entries(per).sort((a,b)=>b[1].length-a[1].length).map(([k,v])=>[k,st(v)]))},null,1));
