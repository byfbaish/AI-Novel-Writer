# D18b ＋ D5-3 实机取证报告（单实例串跑）

- 取证树：`C:\develop\workspace\AI-writer\wt-d18`，HEAD `7b48f074`，porcelain 0
- 运行脚本：`C:\tmp\s5-outbound\d18b\workbuddy\run-live.mjs`（仓外，未入库；仓内生产码零改动、零 commit/push）
- runId：`aeddad33-cf5`；instancesThisRun=1；进程退出码 exitCode=0；残留 Electron=0
- `tasklist | grep -ci electron` 原文读数：`0`

## 为什么用 wt-d18

| 树 | HEAD | dist 时间 | 结论 |
|---|---|---|---|
| wt-2 | `89ec7014` | — | 不可用：`project:open` 报 better-sqlite3 `NODE_MODULE_VERSION 127`，需 145 |
| develop | `85d209e9` | 11-22 13:21 | 不可用：代码提交 `b9bdcba3` 在 19:04，dist 落后于代码，不作证据树 |
| wt-d18 | `7b48f074` | 11-22 21:06 | 采用：dist 晚于提交、含 partial_arch 读取、electron-as-node 下 better-sqlite3 OK |

## D18b（证据：`evidence/evidence-d18b.json`，sha256 `6dbd9cb8fa6281dd3f5b01c15157debdea1639903804419102f09f616c173588`）

| 键 | 值 |
|---|---|
| generateOpened | true |
| clickAiOk | true |
| archDialogTitleSeen | true（「AI 生成故事架构」） |
| gapTextSeen | false（`/单元定位失败\|没读到.*partial_arch\.json/` 未命中，截取原文为空） |
| archDialogClosed | true |
| seedSha256 | `08bf7cf1caa0878ac2cce1cf32476de169bda4be7c26655a08249398b6c077b5`（来源 sha256sum） |
| instancesThisRun | 1 |
| exitCode | 0 |
| leftoverElectronProcesses | 0 |
| tasklistGrepCount | "0" |
| treeHead | 7b48f074 |

判据对照：点「AI 生成」→ 架构对话框打开、且没有出现「单元定位失败：已覆盖第 0 章」⇒ D18b 通过。未点「开始生成」，故无额外模型请求。

## D5-3（证据：`evidence/evidence-d5.json`，sha256 `3de8d0183d7cbd6b748e11139572d9af1230cb8455d0ed9fbc18f5acb2fc00f6`）

入口：`entry=arch-dialog-plotStructure-only` —— 架构生成对话框只勾「卷 / 单元结构」，其余四项为「保留」。
流程：点「AI 生成」→ 弹窗内只留 plotStructure 勾选（`selectionAfter` 里仅该行 checked=true、tag=将覆盖）→ 点「确认生成（1/5）」→ 失效清单闸门点「继续」→ 拦截 prompt → 桩返回 full-prompt-echo → DB 读回。

| 键 | 值 | 判据 |
|---|---|---|
| chatCalls | 1 | 一次生成一次请求 |
| promptChars | 5,628 | — |
| promptPlaceholderHits（R1） | 0 | ≤ 0 通过 |
| echoMode / echoChars（R2） | full-prompt-echo / 5,628 | echo hits = 0（echo 即 prompt 全文，R1 为 0 则 R2 为 0） |
| planBeforeChars | 127 | 段前重置为短夹具 |
| planChars | 5,640 | 差值 12 字＝管线前置的 `# 卷 / 单元结构\n\n` |
| planChanged | true | 本仓落库确由本次生成产生 |
| planContainsEchoHead | true | 落库正文首段即 echo 首段 |
| dbReadbackPlaceholderHits（R3） | 0 | ≤ 0 通过 |
| physicalModelRequests | 0 | 全程零外部请求（非目标 URL 或计一次并抛 EXTERNAL_FETCH_REFUSED） |
| instancesThisRun / exitCode / leftoverElectronProcesses | 1 / 0 / 0 | — |
| tasklistGrepCount | "0" | 原文 |

守卫口径：`/<([^<>]+)>/g`（`src/shared/arc-placeholder-guard.ts:32-50`），脚本内嵌等价实现并注 `guardSourceRef`。
收口口径（按 collab-rules 分层纪律）：判词只写「按守卫无界正则口径复核，R1/R2/R3 三处 hits 均为 0」＋边界声明「判不了真实模型是否自写尖括号，桩返回的是 prompt 全文 echo」。

## seed 改动（必须披露）

原 seed 不满足「卷 / 单元结构」生成前置 `core.premise ≥50 字`、`core.worldbuilding ≥50 字`（`src/services/workflows/commands/architecture.command.ts:3174-3182`），第一次运行被前置拦下。本次在原 seed 基础上补足三列，均属夹具、不涉判据前提值：

- `project_core.premise`：41 → 82 字
- `project_core.worldbuilding`：0 → 54 字
- `project_core.characters_arch`：0 → 75 字

`partial_arch.json` 未动，seed 指纹不变（`08bf7cf1…`）。D5 段起始另把 `plot_structure_plan` 重置为 127 字短夹具，使 `planChanged` 可判定。

## 已知偏差（三条，均不影响判据键）

1. `evidence-d5.json` 的继承字段 `card` 仍为 `"D18b"`（基础块未覆盖）。D5 身份以 `entry=arch-dialog-plotStructure-only` 与 `note` 为准，判据键无误。
2. `seedSha256` 只覆盖 `partial_arch.json`，不含 `.ai-novel/project.db`（DB 内的 premise/worldbuilding 补足不在该指纹内）。
3. `planEqualsEcho=false` 属预期：差值恰为 12 字（`# 卷 / 单元结构\n\n`），非内容丢失。

## 现场状态

- wt-d18 `git status --porcelain` 0 行；develop `git status --porcelain -uall` 3 行＝本报告目录下 evidence 三个文件（`.batch/` 被 `.gitignore` 忽略，不阻提交）
- 残留进程：`tasklist | grep -ci electron` = 0

## 复核命令

```bash
cd /c/develop/workspace/AI-writer/wt-d18 && git status --porcelain | wc -l && git rev-parse --short HEAD
cd /c/develop/workspace/AI-writer/develop && sha256sum .batch/night/staging/d18b/evidence/*
tasklist | grep -ci electron
```
