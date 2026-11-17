import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
const root = 'C:/develop/workspace/AI-writer'
const trees = ['develop','wt-p56','wt-p51','wt-docfix','wt-3','wt-2','wt-1','night-probe','test-master']
const at = new Date('2026-11-17T23:30:00+08:00')
for (const t of trees) {
  const p = path.join(root, t, 'scripts/workbuddy/model-policy.mjs')
  if (!existsSync(p)) { console.log([t, 'NO-FILE', '-', '-', '-', '-'].join(' | ')); continue }
  const buf = readFileSync(p)
  const md5 = createHash('md5').update(buf).digest('hex')
  const m = await import('file:///' + p.replace(/\\/g, '/') + '?v=' + Date.now())
  let pick
  try { pick = JSON.stringify(m.pickModel(at)) } catch (e) { pick = 'ERR:' + e.message }
  const allowed = JSON.stringify(m.ALLOWED_MODELS)
  const dis = String(m.HY4_DISABLED)
  console.log([t, md5, 'HY4_DISABLED=' + dis, 'ALLOWED=' + allowed, 'pick(23:30)=' + pick].join(' | '))
}
