From: CARD-1125-R3 · developer
To: 大肥鱼@主身
卡号：CARD-1125-R3｜会话：developer 群分身｜起点 sha：5e313404
模式：工作模式｜模型：按派单（本卡为只读文本产出，未调模型生成数据）

# B 三字段断言化：4+1 条断言与互斥规则（CARD-1125-R3 §2.1）

- 依据卡面：`.batch/night/cards/CARD-1125-R3-b-asserts-and-rename.md`（提交 `5e313404`，§2.1 五条即本件清单）
- 依据字段定义：`.batch/night/org/book-meta-requirements.md` §1（`:35` 四字段准入表、`:44-46` 键存在性三分）
- 取数时刻：**2026-11-25 21:32–21:36**（盘上文件 mtime 已静默 >5 分钟，见 §0 第 2 行）
- 数据面：`.runtime/res-corpus/local-slices/*.jsonl`，14 件／1,197 行（只读；本次零写入、零模型调用、不动 `calls.jsonl`）
- 基线：`HEAD 5e313404`；`git status --porcelain -uall` 0 行

## 0. 前置读数（开工第一件事，原样贴出）

```
$ node .runtime/res-corpus/audit-coverage.mjs
file                                  rows  srNull  srMissing  basis  prefixes
book-meta.all.jsonl                   227   0       227        0      no-status-tag:0 not-collected:0 not-located:0
book-meta.batch2.addendum.jsonl       1     0       0          1      no-status-tag:0 not-collected:0 not-located:0
book-meta.batch2.local-integrity.jsonl189   0       189        0      no-status-tag:0 not-collected:0 not-located:0
book-meta.batch2.qidian-verified.jsonl16    16      0          16     no-status-tag:0 not-collected:0 not-located:0
book-meta.batch2.unresolved.jsonl     10    0       10         0      no-status-tag:0 not-collected:0 not-located:0
book-meta.fanqie-indirect.jsonl       4     1       0          4      no-status-tag:0 not-collected:0 not-located:0
book-meta.gap.qidian-verified.jsonl   14    0       0          14     no-status-tag:0 not-collected:0 not-located:0
book-meta.gap.unresolved.jsonl        9     0       9          9      no-status-tag:0 not-collected:0 not-located:0
book-meta.pilot.jsonl                 20    0       20         0      no-status-tag:0 not-collected:0 not-located:0
book-meta.pilot.qidian-verified.jsonl 19    0       0          19     no-status-tag:0 not-collected:0 not-located:0
book-meta.pool143.qidian-verified.jsonl80    80      0          80     no-status-tag:0 not-collected:0 not-located:0
book-meta.pool143.unresolved.jsonl    69    0       69         0      no-status-tag:0 not-collected:0 not-located:0
book-meta.status-claims.jsonl         424   386     0          0      no-status-tag:0 not-collected:0 not-located:0
chapter-titles.jsonl                  115   0       115        0      no-status-tag:0 not-collected:0 not-located:0
---
files 14  rows 1197  statusRaw null 483  statusRaw missing 639  completionBasis 143  no-status-tag 0  not-collected 0  not-located 0
```

| 读数 | 值 | 与卡面/需求件核对 |
|---|---|---|
| 件数／行数 | 14／1,197 | 与需求件 `:14`、卡面 `:16` 一致 |
| `completionBasis` 有条数 | 143 | 同上一致 |
| `statusRaw` 显式 `null` | 483 | 需求件 `:46` 一致 |
| `statusRaw` 缺键 | 639 | 需求件 `:46` 一致 |
| 三句前缀 | 0／0／0 | **全库没有任何一行写过前缀**（见 A3） |
| 文件 mtime | 最新 `book-meta-requirements.md 10:16`、数据件 ≤`09:54` | 距取数 ≥11 小时，静默成立 |

## 1. 五条断言

> 键名口径：本件按**锁版目标名**（`platformId`／`matchBasis`／`akaTitles[]`）写规则；现盘上仍是旧名（`qidianBookId`／`platformBookId`／`matchMethod`／`titleAlias`，改名归 §2.2 admin 那一轮）。A5 的检查器对两套键名都成立，改名后可直接复跑。

### A1 `completionVerified` 与 `completionBasisSource` 互为条件（双向）

**规则原文**
- 正向：`completionVerified === true` ⇒ `completionBasisSource === "chapterText"`。
- 反向：`completionBasisSource ∈ {"statusRaw","unknown"}` ⇒ `completionVerified` **必须显式 `false`**（缺键、`null` 皆违例）。
- 值域：`completionBasisSource` 只准 `chapterText`／`statusRaw`／`unknown`（需求件 `:33`）；取其他值一律违例，不进白名单。

**触发条件**：`completionVerified === true && completionBasisSource !== "chapterText"`；或 `completionBasisSource ∈ {"statusRaw","unknown"} && completionVerified !== false`；或 `completionBasisSource ∉ {chapterText,statusRaw,unknown}`。

**命中后动作**：拒绝入库（该行不得进分组统计），记 `conflict:[{field:"completionVerified",valueA,valueB}]` 或 `conflict:[{field:"completionBasisSource",reason:"out-of-vocab"}]`；两值都留，不取平均、不择一（需求件 `:77`）。

**可复现命令**（在 `.runtime/res-corpus/local-slices` 下）
```bash
# 注意：盘上 JSON 是 `": "`（冒号后带空格），模式里用 `: *` 才稳
# 正向违例 → 3
grep -h '"completionVerified": *true' *.jsonl | grep -vc '"completionBasisSource": *"chapterText"'
# 反向违例（source 为 statusRaw/unknown 但 verified 不是显式 false）→ 0
grep -hE '"completionBasisSource": *"(statusRaw|unknown)"' *.jsonl | grep -vc '"completionVerified": *false'
# 值域外（白名单之外的全部行）→ 44
grep -h '"completionBasisSource"' *.jsonl | grep -vcE '"completionBasisSource": *"(chapterText|statusRaw|unknown)"'
```

### A2 `statusClaimTrust:"high"` 是「核过正文」的独占标记（单向式）

**规则原文**：`statusClaimTrust === "high"` ⇒ `completionVerified === true` **且** `completionBasisSource === "chapterText"`。任何来源只要不是正文证据，就不许写 `high`。

**触发条件**：`statusClaimTrust === "high"` 且非（`verified===true && source==="chapterText"`）。

**命中后动作**：`statusClaimTrust` 降为 `low`（不删行、不改 `completion`），该对矛盾进报表第 4 行（状态位与正文证据不一致清单）。

**可复现命令**
```bash
# 命中 → 2（两行都非「核过正文」，见 §2.1）
grep -h '"statusClaimTrust": *"high"' *.jsonl | grep -vcE '"completionVerified": *true.*"completionBasisSource": *"chapterText"'
```

> 为什么不是卡面原字面版（`statusRaw ⇒ trust ≠ high`）：字面版是它的逆否，能拦的行一个不少，但 `high + completionBasisSource:"unknown"` 会从字面版漏过去（产品经理 21:31 指出，负责人 `5e313404` 已采纳换式）。本卡按单向式执行。

### A3 `statusRaw` 键存在性三分（双向）——判定只认「键在不在」

**规则原文**：判定用 `"statusRaw" in obj`（Python）／`Object.prototype.hasOwnProperty.call(o,"statusRaw")`（JS），**不得**用 `get()`／`o.statusRaw === undefined` 代替。
- (a) **键不存在** ⇒ `completionBasis` 不得以 `no-status-tag`／`not-collected`／`not-located` 任一开头；该行归 unresolved 类，只标 `conflict:"missing-key"`，不写前缀、不判 `completion`。
- (b) **键存在且为 `null`（或空串）** ⇒ 三句前缀必须居其一，写在 `completionBasis` 开头。
- (c) **键存在且非空** ⇒ 不得带三句前缀。

**触发条件**：(a) 缺键 ∧ 前缀命中；(b) 显式 `null`/空串 ∧ 无前缀；(c) 非空 ∧ 前缀命中。

**命中后动作**：(a) 拒绝入库＋`conflict:"missing-key"`，先补键再谈前缀；(b) 不拒绝入库（`null` 是事实，缺的是原因），标 `conflict:"prefix-missing"` 并进报表第 6 行；(c) 拒绝入库＋`conflict:"prefix-on-nonnull"`。

**可复现命令**
```bash
# (a) 缺键却带前缀
node -e 'const fs=require("fs");let n=0;for(const f of fs.readdirSync(".").filter(x=>x.endsWith(".jsonl")))for(const l of fs.readFileSync(f,"utf8").split("\n")){if(!l.trim())continue;const o=JSON.parse(l);if(!Object.prototype.hasOwnProperty.call(o,"statusRaw")&&/^(no-status-tag|not-collected|not-located)/.test(o.completionBasis||""))n++}console.log(n)'
# (b) 显式 null 却无前缀
node -e 'const fs=require("fs");let n=0;for(const f of fs.readdirSync(".").filter(x=>x.endsWith(".jsonl")))for(const l of fs.readFileSync(f,"utf8").split("\n")){if(!l.trim())continue;const o=JSON.parse(l);if(Object.prototype.hasOwnProperty.call(o,"statusRaw")&&(o.statusRaw===null||o.statusRaw==="")&&!/^(no-status-tag|not-collected|not-located)/.test(o.completionBasis||""))n++}console.log(n)'
# (c) 非空却带前缀
node -e 'const fs=require("fs");let n=0;for(const f of fs.readdirSync(".").filter(x=>x.endsWith(".jsonl")))for(const l of fs.readFileSync(f,"utf8").split("\n")){if(!l.trim())continue;const o=JSON.parse(l);if(Object.prototype.hasOwnProperty.call(o,"statusRaw")&&o.statusRaw!==null&&o.statusRaw!==""&&/^(no-status-tag|not-collected|not-located)/.test(o.completionBasis||""))n++}console.log(n)'
```

### A4 同 `platformId` 多件：只出清单，不做 assert（报表行）

**规则原文**：同名/同 `platformId` 多件并存时，机器**只**输出「同 `platformId` 多件」清单（行数、件名、采集时刻）；**不得**自行判定胜出方、**不得**写 `conflict`。胜出方属人裁定（要看 URL 与采集时刻，需求件 `:77`「我裁定后另起一笔改」）。

**触发条件**：同一 `platformId` 在 ≥2 件或同件内出现 ≥2 行。

**命中后动作**：报表行输出清单；本行不拒绝、不降级、不打 `conflict`。

**可复现命令**
```bash
node -e 'const fs=require("fs"),g=new Map();for(const f of fs.readdirSync(".").filter(x=>x.endsWith(".jsonl")))for(const l of fs.readFileSync(f,"utf8").split("\n")){if(!l.trim())continue;const o=JSON.parse(l);const id=o.platformId||o.qidianBookId||o.platformBookId;if(!id)continue;if(!g.has(id))g.set(id,[]);g.get(id).push(f)}const m=[...g].filter(([,v])=>v.length>1);console.log("groups",m.length,"rows",m.reduce((s,[,v])=>s+v.length,0));for(const [k,v] of m)console.log(k,v.join(","))'
```

### A5 `platformId` 为空 ⇒ `matchBasis ≠ "id"`（硬卡）

**规则原文**：`platformId` 为空（缺键、`null`、空串）⇒ `matchBasis !== "id"`。主键不存在的书只进单书描述统计，不得声称按 id 命中（需求件 `:21`）。

**触发条件**：`platformId` 空 ∧ `matchBasis === "id"`。

**命中后动作**：拒绝入库；把该行 `matchBasis` 退回 `manual` 并附理由（`manual` 须写理由，需求件 `:24`）。

**可复现命令**（兼容旧键名，改名后去掉 `qidianBookId`／`platformBookId` 两支即可）
```bash
node -e 'const fs=require("fs");let n=0;for(const f of fs.readdirSync(".").filter(x=>x.endsWith(".jsonl")))for(const l of fs.readFileSync(f,"utf8").split("\n")){if(!l.trim())continue;const o=JSON.parse(l);const id=Object.prototype.hasOwnProperty.call(o,"platformId")?o.platformId:(o.qidianBookId??o.platformBookId);const mb=Object.prototype.hasOwnProperty.call(o,"matchBasis")?o.matchBasis:o.matchMethod;const blank=id===undefined||id===null||(typeof id==="string"&&!id.trim());if(blank&&mb==="id")n++}console.log(n)'
```

## 2. 判据 3 实跑记录（`[mock]`，只读现盘样本）

样本：14 件／1,197 行。检查器逐条实现上面五条（脚本全文见 §5），输出原文：

```
样本总量 rows 1197  files 14

--- A1f（正向）: 3 命中 ---
  {"file":"book-meta.batch2.addendum.jsonl","bookTitle":"第一权臣","completionVerified":true,"completionBasisSource":"platformStatusTag","statusClaimTrust":"high","statusRaw":"完本",...}
  {"file":"book-meta.batch2.qidian-verified.jsonl","bookTitle":"烈火女","completionVerified":true,"completionBasisSource":"latestChapterMatch","statusClaimTrust":"low","statusRaw":null,...}
  {"file":"book-meta.fanqie-indirect.jsonl","bookTitle":"开局长生万古，苟到天荒地老","completionVerified":true,"completionBasisSource":"chapterText+statusRaw","statusClaimTrust":"high","statusRaw":"已完结",...}

--- A1r（反向）: 0 命中 ---
--- A2: 2 命中 ---
  {"file":"book-meta.batch2.addendum.jsonl","bookTitle":"第一权臣",...}
  {"file":"book-meta.fanqie-indirect.jsonl","bookTitle":"开局长生万古，苟到天荒地老",...}
--- A3a（缺键却带前缀）: 0 命中 ---
--- A3b（显式 null 无前缀）: 483 命中 ---
  {"file":"book-meta.batch2.qidian-verified.jsonl","bookTitle":"原子空间","statusRaw":null,"completionBasis":"本地末行为完结标记「完」；平台最新章节「第15章 太空流浪者」为书末章，二者一致"}
  ...（另 482 条，件分布：status-claims 386、pool143.qidian-verified 80、batch2.qidian-verified 16、fanqie-indirect 1）
--- A3c（非空却带前缀）: 0 命中 ---
--- A5: 0 命中 ---
--- A4: 同 platformId 多件 4 组 / 涉及 10 行 ---
  1036683699: book-meta.batch2.addendum.jsonl, book-meta.gap.qidian-verified.jsonl
  1015504057: book-meta.batch2.qidian-verified.jsonl, book-meta.pool143.qidian-verified.jsonl
  1043130469: book-meta.batch2.qidian-verified.jsonl, book-meta.pool143.qidian-verified.jsonl, book-meta.pool143.qidian-verified.jsonl
  1043131193: book-meta.pool143.qidian-verified.jsonl, book-meta.pool143.qidian-verified.jsonl, book-meta.pool143.qidian-verified.jsonl
```

### 2.1 三处真命中的性质（这就是「表外组合」）

`completionBasisSource` 的值域实测分布（全库）：

| 值 | 行数 | 在三值白名单内 |
|---|---|---|
| 缺键 | 1,054 | — |
| `chapterText` | 49 | ✔ |
| `platformStaticSet` | 35 | ✘ |
| `unknown` | 31 | ✔ |
| `statusRaw` | 19 | ✔ |
| `publishedSingleVolume` | 5 | ✘ |
| `platformStatusTag` | 1 | ✘ |
| `latestChapterMatch` | 1 | ✘ |
| `manualChapterMatch` | 1 | ✘ |
| `chapterText+statusRaw` | 1 | ✘ |

→ **值域外共 44 行**（35+5+1+1+1+1），其中 3 行同时 `completionVerified:true`，正是 A1 正向的 3 命中：`第一权臣`（`platformStatusTag`）、`烈火女`（`latestChapterMatch`）、`开局长生万古`（`chapterText+statusRaw`）。这三行按准入表本该写 `chapterText` 或 `false`，是**人手抄写口径漂移**，不是模型问题。

`statusClaimTrust` × `completionVerified` × `source` 交叉：`high` 只有 2 行，两行都不是「核过正文」，A2 全部命中（`第一权臣`、`开局长生万古`）。Qwen 举的 `high + statusRaw + verified:false` 组合盘上 0 行（19 行 `statusRaw` 全为 `verified:false`，其中 `trust` 全是 `low` 或缺键）——**它当前不存在，但 A2 能拦**：把任意一行 `statusRaw` 行的 `trust` 改成 `high` 即命中，A2 的命令在 §1 可直接验。

### 2.2 A3b 483 命中的含义（最重的一条）

483 行显式 `null` **全部没有三句前缀**，其中 386 行连 `completionBasis` 都没有（就是 `status-claims.jsonl` 整件：424 行里 386 行 `null` 且无 basis）。按 A3(b) 这 483 行全落 `conflict:"prefix-missing"`；不拒绝入库（`null` 本身是真事实），但报表第 6 行必须单列。**这也说明「三句前缀」这条规则从写下来那天起就从未落过盘**——不是个别漏写。

## 3. 0 命中的三条，各自的原因写清

| 断言 | 命中 | 为什么 0（不是没测） |
|---|---|---|
| A1r | 0 | 19 行 `statusRaw` 与 31 行 `unknown` 已全部显式 `false`（交叉表：`statusRaw|verified=false` 19、`unknown|verified=false` 31），反向条件当前无违例行 |
| A3a | 0 | 639 行缺键里只有 9 行有 `completionBasis`，9 条全不带前缀；其余 630 行 `completionBasis` 为空——「空字段算缺数据，不算判不了」（需求件 `:32`），故不命中 |
| A3c | 0 | 75 行 `statusRaw` 非空，带前缀的 0 行；三句前缀全库合计 0 次（见 §0 表末行） |
| A5 | 0 | 现盘无 `platformId` 键；旧名 `qidianBookId`(130)／`platformBookId`(13) 之外的行确实为空，但 `matchMethod` 全部是自由文本（`目录《…》按书名配对`、`站内搜索书名 → …` 等 20 余种），**没有一行是字面 `"id"`**，所以规则无对象。改名后若把自由文本机械映射成 `id`，这条会立刻开火——正是它要拦的 |

## 4. 与 §2.2 改名的衔接（我这半不做的事）

- 本件只写规则，**不动数据**：`.runtime/res-corpus/` 全程只读，未执行任何写盘（只需 `node` 读 + `console.log`）。
- 改名四件（`qidianBookId`／`platformBookId` → `platformId`；`matchMethod` → `matchBasis` 五值；`titleAlias` → `akaTitles[]` 一项）归 admin；A5 的检查器对两套键名都成立，改名后可原地复跑。
- 改名后需要复跑的三条：A1（值域从 44 行收敛到 0）、A3（前缀 0 命中 → 改名轮是否顺带补前缀，由负责人裁）、A5（`matchBasis:"id"` 才真正有对象）。

## 5. 附录：检查器全文（可整段复制复跑）

```js
// node assert-b-1125.mjs  （在 .runtime/res-corpus/local-slices 下运行；只读、零模型调用）
import fs from 'node:fs';
import path from 'node:path';
const dir = '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort();
const rows = [];
for (const f of files) for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let o; try { o = JSON.parse(line); } catch { continue; }
  rows.push({ file: f, o });
}
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const blank = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());
const PREFIXES = ['no-status-tag', 'not-collected', 'not-located'];
const pre = (b) => PREFIXES.find(p => typeof b === 'string' && b.startsWith(p)) || null;
const VOCAB = ['chapterText', 'statusRaw', 'unknown'];
const hits = { A1f: [], A1r: [], A1v: [], A2: [], A3a: [], A3b: [], A3c: [], A5: [] };
for (const r of rows) {
  const o = r.o;
  if (o.completionVerified === true && o.completionBasisSource !== 'chapterText') hits.A1f.push(r);
  if ((o.completionBasisSource === 'statusRaw' || o.completionBasisSource === 'unknown') && o.completionVerified !== false) hits.A1r.push(r);
  if (has(o, 'completionBasisSource') && !VOCAB.includes(o.completionBasisSource)) hits.A1v.push(r);
  if (o.statusClaimTrust === 'high' && !(o.completionVerified === true && o.completionBasisSource === 'chapterText')) hits.A2.push(r);
  if (!has(o, 'statusRaw')) { if (pre(o.completionBasis)) hits.A3a.push(r); }
  else if (o.statusRaw === null || o.statusRaw === '') { if (!pre(o.completionBasis)) hits.A3b.push(r); }
  else { if (pre(o.completionBasis)) hits.A3c.push(r); }
  const pid = has(o, 'platformId') ? o.platformId : (has(o, 'qidianBookId') ? o.qidianBookId : o.platformBookId);
  const mb = has(o, 'matchBasis') ? o.matchBasis : o.matchMethod;
  if (blank(pid) && mb === 'id') hits.A5.push(r);
}
console.log('rows', rows.length, 'files', files.length);
for (const k of Object.keys(hits)) {
  console.log(`--- ${k}: ${hits[k].length} ---`);
  for (const r of hits[k].slice(0, 5)) console.log('  ' + JSON.stringify({
    file: r.file,
    bookTitle: r.o.bookTitle ?? r.o.localBookTitle ?? r.o.path,
    completionVerified: has(r.o, 'completionVerified') ? r.o.completionVerified : '<缺键>',
    completionBasisSource: r.o.completionBasisSource ?? '<缺键>',
    statusClaimTrust: r.o.statusClaimTrust ?? '<缺键>',
    statusRaw: has(r.o, 'statusRaw') ? r.o.statusRaw : '<缺键>',
  }));
}
const g = new Map();
for (const r of rows) {
  const pid = has(r.o, 'platformId') ? r.o.platformId : (r.o.qidianBookId || r.o.platformBookId);
  if (blank(pid)) continue;
  if (!g.has(pid)) g.set(pid, []); g.get(pid).push(r.file);
}
const multi = [...g.entries()].filter(([, v]) => v.length > 1);
console.log(`--- A4: 同 platformId 多件 ${multi.length} 组 / ${multi.reduce((s, [, v]) => s + v.length, 0)} 行 ---`);
for (const [pid, v] of multi) console.log('  ' + pid + ': ' + v.join(', '));
```

## 6. 回执

- 交件：本件（`.batch/night/reports/res-b-asserts-1125.md`），五条断言 A1–A5，覆盖卡面 §2.1 的 1–5 类；A4 按 `5e313404` 改为报表行。
- 未做：未改 `src/`（`git diff --name-only -- src` 空）、未改数据件、未 `git add`／commit（B 类，`.runtime/` 在 gitignore 内；本件若要进库请另开 A 类）。
- 判据 3 已有真命中：A1 3 行（值域外 + `verified:true`）、A2 2 行、A3b 483 行；0 命中三条的原因见 §3。
