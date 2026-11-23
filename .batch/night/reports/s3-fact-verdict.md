# S3 首验判词 · L0-FACT 事实层确定性预检达标（阶段 3/3）

From: QA · AI writer项目组
To: 大肥鱼@主身
判词类型: 首次验收（独立复跑，非终审）
判定: **PASS**
落盘日: 2026-11-23
工作树: `C:\develop\workspace\AI-writer\develop`（分支 `exp/mainline-1119`，验收时未做任何改动）

## §1 对象三栏（别混）

| 栏 | 值 | 含义 |
|---|---|---|
| 判定面（代码） | `0ec6c89c39a4c48f890d9caab41dd13a7db61805` | 卡分支 `card/fact-preflight-3rules`，5 文件 `+542/−25`，QA 已在 S2 首验判 PASS |
| 合并 sha | `26731adb9c486962d8b014c32eefd0585ae9aef1` | `merge card/fact-preflight-3rules`，父 `9e4a816c` ＋ `0ec6c89c`，2026-11-23 18:41:18 |
| 终版 HEAD ＝ ls-remote | `22c085dbfafaa9ae4e98c68b4caf24e8cfb8734a` | S3 回填两笔（`fc35201a` 回填 + `22c085db` grep 口径）已推完后的现状 HEAD |

依据：
```
$ git rev-parse HEAD
22c085dbfafaa9ae4e98c68b4caf24e8cfb8734a
$ git ls-remote origin refs/heads/exp/resource-ledger
22c085dbfafaa9ae4e98c68b4caf24e8cfb8734a	refs/heads/exp/resource-ledger
$ git rev-list --left-right --count origin/exp/resource-ledger...HEAD
0	0
$ git status --porcelain -uall | wc -l
0
$ git log -1 --format='%H %P %ci' 26731adb
26731adb9c486962d8b014c32eefd0585ae9aef1 9e4a816cbc2b0dda319bdc01ea448baa7b7df47a 0ec6c89c39a4c48f890d9caab41dd13a7db61805 2026-11-23 18:41:18 +0800
$ git merge-base --is-ancestor 0ec6c89c HEAD && echo ANCESTOR_TRUE
ANCESTOR_TRUE
```

## §2 四条 done-when 逐条对照

### ① 看板卡 `bb3f0d83-…` → `column: "done"`：满足
```
$ task_board_get bb3f0d83-3f24-43a9-977d-8ef6b4e8eb9b
status: "done"（title「扩大 preflight 规则集（基础设施全齐 · 纯增量）」，tags: D-事实层 / I2 / AI writer项目组）
```
证据层级：[mock]（看板是宿主 API 读数，非实机业务链路）。

### ② ROADMAP `L0-FACT` 与 `L1-FACT-01` 状态转「达标」并附证据行（含 `grep` 命中行原文）：满足
对象文件 `docs/roadmap/ROADMAP.md`：357 行／22,625 B／sha256 `9f996da1a744e0602073caf92fab6907acc39077a812b35cee7d16a6b3321d16`。

§1 表（`:30`／`:31`）：
```
| L0-FACT | L0 | 事实层确定性预检 | 达标 | 无 |
| L1-FACT-01 | L1 | 扩大 preflight 规则集 | 达标 | 无 |
```
§2 状态行：`L0-FACT` 在 `:99`、`L1-FACT-01` 在 `:107`，两条均「状态：达标（2026-11-23）｜证据：…」。

grep 证据句（`:99`，全文只此一处）：
```
grep -ni "stableFactKey" src/shared/space-time-consistency.ts（区分大小写时只有 11 行命中、-i 后 16 行）
  → :235 function fnvStableFactKey(prefix: string, parts: readonly string[]): string {
  → :249 export function spaceTimeStableFactKey(parts: readonly string[]): string {
  → :254 export function slotStableFactKey(parts: readonly string[]): string {
  → :255   return fnvStableFactKey('slot', parts)
```
QA 独立复跑（判定面文件 = HEAD 内同一 blob，S2 已核 `0ec6c89c` 内容未变）：
```
$ grep -c "stableFactKey" src/shared/space-time-consistency.ts
11
$ grep -ci "stableFactKey" src/shared/space-time-consistency.ts
16
$ grep -ni "stableFactKey" src/shared/space-time-consistency.ts | sed -n '/^235:\|^249:\|^254:\|^255:/p'
235:function fnvStableFactKey(prefix: string, parts: readonly string[]): string {
249:export function spaceTimeStableFactKey(parts: readonly string[]): string {
254:export function slotStableFactKey(parts: readonly string[]): string {
255:  return fnvStableFactKey('slot', parts)
```
计数 11／16 与引文四行逐字一致 ⇒ 该证据句「能指到命令且命令复跑得出现文」成立。
另：`:97` 的 `grep -n "stableFactKey" src/shared/<新文件>.ts` 是 L1-FACT-01 的**完成判据原文**（带占位），不是取证句，未改——按项目总负责人一句话裁定保留。
证据层级：[static]。

### ③ 台账补本阶段一行：满足
`.batch/night/reports/task-ledger.md`：922 行／219,222 B／sha256 `a4464332c3eaec73672797a1960b4acd0ecf1151b1af591d4c500363f0ee8256`。
`### 21. L0-FACT 事实层确定性预检达标（S3 收口，2026-11-23）` 在 `:915`，表头 `:917`，本阶段行 `:919`：
```
| L1-FACT-01（卡 `bb3f0d83`） | 达标 | 判定面 `0ec6c89c`（分支 `card/fact-preflight-3rules`，5 文件 `+542/−25` 全在白名单内）；QA 判词 `.batch/night/reports/s2-fact-verdict.md`（73 行／7,530B／`d6a4232c…`）；`Tests 83 passed (83)`／`EXIT=0`；…；合并 sha `26731adb`（merge `0ec6c89c`），已推送，远端 HEAD `ef915a60` | ROADMAP `:30`／`:31`…；看板卡 `bb3f0d83` 由 admin 转 done |
```
`:921-922` 记账两条（R3 跨批次盲区、单章未传 `structuredRefs`）与 `本段只追加，不改既有条目` 均在。
证据层级：[static]。

### ④ HEAD＝ls-remote、porcelain 0、`check:fast` EXIT=0：满足
```
$ git rev-parse HEAD / git ls-remote … / git rev-list --left-right --count origin/…...HEAD
22c085db…／22c085db…／0	0
$ git status --porcelain -uall | wc -l
0
$ node scripts/check-fast.mjs            # QA 在 22c085db 上自跑
[check:fast] typecheck ✓ 17.4s
doc links: checked 1467, broken 0
doc placement: 扫描 439 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
CF_EXIT=0
```
`:922` 之后无改动。取证阶段（写本判词之前）`git status --porcelain -uall | wc -l` → `0`；写完本判词后同一命令 → `1`，唯一一行是 `?? .batch/night/reports/s3-fact-verdict.md`（本判词自身，未跟踪，待群 admin 另笔提交入库；`git check-ignore` 返回 1，说明 `.batch` 不在 ignore 面内）。
证据层级：[static]（本阶段无业务实机判据，故本判词无 [live] 项，也不得由本轮补出）。

## §3 判据三核（群规则「判 pass 前三核」）

| 检查 | 结果 |
|---|---|
| 新增内容能对上编号 | ✅ 台账 §21／ROADMAP `L0-FACT`·`L1-FACT-01`／看板卡 `bb3f0d83` 三处编号互指一致 |
| 每条判据能指到原文或命令 | ✅ 四条 done-when 均给出命令与文件原文（见 §2）；grep 计数 11／16 已复跑验证 |
| 没有待改／已核类未定档 | ✅ 全文无「待改」「待回填」「未合并·待主身」残留；`建卡或结项，未排期` 属 BACKLOG 记账，非未定档 |

## §4 记账（不阻断本判 PASS，建议后续笔改）

1. **「远端 HEAD `ef915a60`」在终版下已过时**：ROADMAP `:99`／`:107` 与台账 `:919` 都写「合并 `26731adb`…已推送，远端 HEAD `ef915a60`」。该句在 `ef915a60` 被推时为真，但终版 HEAD 已是 `22c085db`，现状解读会与 `git ls-remote` 不符。建议改为「合并 `26731adb`，已推送；S3 终版 HEAD `22c085db`」，口径同 D15／D18 的「判定面＋合并 sha＋现状 HEAD」三栏。
2. **QA 自身口误已更正**（留痕，不涉产品）：QA 在群内曾把 grep 证据句位置写成「`:99`／`:107` 两处」。实测 `git show HEAD:docs/roadmap/ROADMAP.md | sed -n '107p' | grep -c 'grep -n'` → `0`，含 `stableFactKey` 的行只有 `:97`（判据原文）与 `:99`（证据句），故本判词只按 `:99` 一处写。
3. **判词自身位置**：`.batch/night/reports/` 是**已跟踪目录**（`.batch` 不在 ignore 面内，`git check-ignore` 返回 1）；本判词当前为未跟踪件 `?? .batch/night/reports/s3-fact-verdict.md`，入库由群 admin 另笔提交（同 S2 判词 `d6a4232c` 的做法）。

## §5 边界与不做的事

- 不重跑代码实施：`0ec6c89c` 的 83 个单测与 FNV 复算沿用 S2 首验（同 blob 未变），本轮未再跑。
- 不做终审：本判只覆盖 S3 四条 done-when，能否 complete Goal 由项目总负责人／群 admin 定。
- 未改任何仓内文件；本轮只新增本判词与只读命令。
