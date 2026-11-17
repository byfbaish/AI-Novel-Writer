import fs from 'fs';
import path from 'path';
const f=process.argv[2]||'C:/Users/<用户名>/.dsh/bot/ledger/group-session-4f78136d-2080-4806-ba83-0e5295209594.jsonl';
const lines=fs.readFileSync(f,'utf8').split('\n').filter(Boolean);
const t0=new Date('2026-11-16T12:00:00+08:00').getTime();
const t1=new Date('2026-11-16T18:30:00+08:00').getTime();
let all=[],inWin=[];
for(const l of lines){let o;try{o=JSON.parse(l)}catch{continue}
  if(typeof o.text!=='string') continue;
  if(o.who==='DS Bot') continue;
  all.push(o);
  if(o.time>=t0&&o.time<t1) inWin.push(o);
}
const hasAt=s=>/@[^\s@]+/.test(s.trim());
const pass=s=>s.trim().replace(/\s/g,'')==='[PASS]';
function stat(arr){const n=arr.length;let noAt=0,noAtNoPass=0;
 for(const o of arr){if(!hasAt(o.text)){noAt++; if(!pass(o.text)) noAtNoPass++;}}
 return {n,noAt,pct:(noAt/n*100).toFixed(2),noAtNoPass,pct2:(noAtNoPass/n*100).toFixed(2)};}
console.log('ALL window-less', stat(all));
console.log('WINDOW 12:00-18:30', stat(inWin));
const byWho={};
for(const o of inWin){byWho[o.who]=(byWho[o.who]||0)+1}
console.log(byWho);
// our own messages
console.log('mine inWin', inWin.filter(o=>o.who.includes('项目总负责人')||o.who.includes('AI writer总负责人')).length);
