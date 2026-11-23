# S5 收口件 · D5／D15／D18（2026-11-23，一页）

## 结论
S5 按「**2 ✅ ＋ 1 部分收口**」收口：**D5 ✅**、**D15 ✅**、**D18 部分收口**（判据 1/2/3 `[static]` 过，判据 4 `[live]` 未取证，转 S6）。

| 卡 | 结论 | 判定面 sha | 证据 |
|---|---|---|---|
| D5 | ✅ PASS（3 条判据：2 `[static]`＋1 `[live]`，档 A 零改） | `7b48f074`（未合并·待主身） | QA 判词 §2 |
| D15 | ✅ PASS（2 条 `[static]`；QA 独立复跑 `Tests 32 passed (32)`、`EXIT=0`） | `f95ed1da`（未合并·待主身） | QA 判词 §3 |
| D18 | 部分收口（判据 1/2/3 `[static]` 过；判据 4 `[live]` 未取证） | `7b48f074`（未合并·待主身） | QA 判词 §4/§5 |

## 一次实机（单实例）
`aeddad33-cf5`：`instancesThisRun=1`、`exitCode=0`、`leftoverElectronProcesses=0`、`tasklist | grep -ci electron` 原文 `0`。取证工作树 `wt-d18`（HEAD `7b48f074`，dist 21:06 晚于提交）；`wt-2` 的 `better-sqlite3` ABI 127≠145、develop dist 落后，二者均不可作取证树。

## D18 判据 4 的去向（admin 裁定，2026-11-23）
本阶段实机只到 arch 段（无 `hookInput`／finalize 键），判据 4「定稿后 `[hook-unplanted]` 出现恰一次」`[live]` 未取证。admin 采 QA 方案 ②：**转 S6**，定向定稿段取证，由主人点头后再跑。判据不降级、不移出缺陷稿、`D18b`（arch 前置闸补验）不顶替；D18 在缺陷稿保持 🟡，不写 ✅。

## 四条偏差（按判词 §6 采纳，逐条留痕）
1. `evidence-d5.json` 的 `card` 仍写 `D18b`：D5 身份以 `entry` 认定，采信不重跑。
2. `seedSha256` 只担保 outline 侧（`partial_arch.json` `08bf7cf1…`）：缺陷稿与台账不得写「seed 全量被指纹担保」。
3. `planEqualsEcho=false` 差 12 字＝管线前置标题 `# 卷 / 单元结构\n\n`，非内容丢失。
4. seed 补 premise 82／worldbuilding 54／characters_arch 75 属夹具必要性（被 `architecture.command.ts:3174-3182` 的 ≥50 字前置拦下），判据前提未动、`partial_arch` 指纹不变。

## 收口必写句（原文，缺此句不收口）
1. 大纲侧 `:937/947/949/950/953/955/962` 共 7 行 20 处缺口由 P12-1（`bb169361`，2026-10-18）引入，早于 D5，不是 D5 做漏（按守卫口径 `/<([^<>]+)>/g` 复核＝7 行 20 处）。
2. B 环节无生产判据是裁定 ⑩，不是遗漏；D18 未落地部分＝输入材料减法，归 D18-① 待办。
3. D18 判据 3 只判第 6 章两向；**第 5／7 章未验，待作者库导出真实文本后补验**（不得写「5／7 章不误标已验」）。

## 看板与台账
- 看板：D5 `d8371b26` → done（「S5 收口」）；D15 `61ac055f` → done；D18 `2b7eb20d` 留 todo（「S6 待复验·判据 4 缺定稿段证据」）。
- 缺陷稿回写：`:70`（D5）、`:74`（D15）、`:80`（D18），并覆盖 `docs/plans/prompt-assembly-backlog.md` 现值索引 `:128`／`:135`／`:141`。
- 合并 sha：三卡均「未合并·待主身」；合并与 push 只由主身做。

## 依据
- `.batch/night/reports/s5-d5-d15-d18-verdict.md`（138 行／16,541B／`3695dc7f…`，入库 `2684206e`）
- `.batch/night/org/ruling-s5-d18-carry-1123.md`（`8d957b81b593…`，提交 `8508bff3`）
- 证据四件：`.batch/night/staging/d18b/`（report `1537f103…`、d18b `6dbd9cb8…`、d5 `3de8d018…`、final.png `009c9733…`），入库 `b397e478`
