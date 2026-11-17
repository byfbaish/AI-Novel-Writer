# wake-later 首验（QA）

> 状态：已裁定（2026-11-13 · 六条判据全过，PASS；两条「记」不影响判定）· 日期：2026-11-13

## 结论

**PASS**。六条判据逐条实测通过；未提交、工作区脚本与派验单一致。

两条「记」（不影响本次判定，下次改脚本时一并处理）：① 回退路径只点名「无 WakeToRun」，没点名「RunLevel 降为 LIMITED」；② 本机电源策略 AC=「仅限重要」/DC=「禁用」，睡眠唤醒在策略层就不成立（脚本已正确告警）。

## 交付物核对

| 项 | 派验单 | 实测 |
|---|---|---|
| `scripts/dsh/wake-later.ps1` | 17,508B | 17,508B ✓ |
| SHA256 | `3781841D…FFA2804` | `3781841DEEE104125390DF75494D4AF06F0F485564F3323C12DDECAC2FFA2804` ✓ |
| mtime | 21:52:43 | 21:52:43 ✓ |

## 判据逐条

### 1. `-DryRun` 写 1 个 `.md`，含文本与 `<!-- DONE -->` —— 过

`-DryRun -Dir <tmp> -Text "QA dryrun probe"` → exit 0，生成 `wake-dry-20261113-215931.md`（34B），内容 `QA dryrun probe` + 空行 + `<!-- DONE -->`。默认文件名带时间戳（`wake-later.ps1:261`），不会撞名。

### 2. `-LogonType Interactive` 真建 2 分钟后任务，`-List` 可见 → 到点落件 → 自删 —— 过

- 21:59:48 创建 `dsh-wake-20261113-2201-1270 @ 22:01 (WakeToRun + StartWhenAvailable + Interactive/Limited)`，exit 0，目标目录为临时目录 `%TEMP%\dsh-wake-qa`（未碰生产 watch 目录）。
- `-List` 立即可见：`Ready | 2026-11-13 22:01:00`。
- **22:01:00** 准点生成 `dsh-wake-20261113-2201-1270.md`（37B，内容含 `QA real task probe` + `<!-- DONE -->`）。
- 触发后 `Get-ScheduledTask dsh-wake-*` 为**空**，自删生效（`wake-later.ps1:245-252` 的 `-Fire` + `-TaskName` 组合）。
- 本次全程**未重启宿主**，符合「验收不含重启」。

### 3. `-At` 早于当前 ⇒ exit 2 且不建任务 —— 过

`-At "2026-11-13 20:00"`（当时 21:59:31）→ `Write-Error: -At 必须晚于当前时间…`，exit **2**；随后 `-List` 为空，未创建任何任务（判断在注册之前，`wake-later.ps1:275-278`）。

### 4. `-Remove` 后 `-List` 消失 —— 过

建 `dsh-wake-20261113-2330-7485` → `-Remove` 输出「已删除任务」→ `-List` 为空；重复 `-Remove` 同名 ⇒ exit **1** +「任务不存在，无法删除」（`wake-later.ps1:205-218`），不静默成功。

### 5. 重点核：「schtasks，无 WakeToRun」降级路径是否会被默认参数静默走到 —— 过（非静默，且默认不可达）

- **默认参数下不可达**：`-LogonType S4U` 且非提升时，`wake-later.ps1:301-305` 在注册前就 `exit 1`，回退段永远进不去。
- 回退段（`:330-364`）只在 `Register-ScheduledTask` 抛错时进入（`:322` → `:326` catch），且**有两条明确告警**：
  - `:332` `Write-Warning("Register-ScheduledTask 失败，回退 schtasks：" + 原始错误)`；
  - `:358` 输出 `已创建任务（schtasks，无 WakeToRun）：<名> @ <时间>`。
- 结论：不是静默降级。

### 6. 默认 `-LogonType S4U` 非提升下报「权限不足」exit 1，不硬试不自动降级 —— 过

exit **1**，报错原文含「完整性级别 Mandatory Label\Medium Mandatory Level Label S-1-16-8192；Administrators BUILTIN\Administrators Alias S-1-5-32-544 Group used for deny only」「未尝试注册，也未自行降级」，并给出二选一处置。`-List` 仍为空，证明没有尝试注册。

## 记（不拦）

1. **回退段的 RunLevel 降级未点名**：`:351` `schtasks ... /RL LIMITED` 写死，未跟随 `-LogonType`；`:332`/`:358` 两条告警只说明了「schtasks / 无 WakeToRun」，没有说「运行级别从 Highest 降到 LIMITED」。建议在 `:332` 的文案里补半句，或 `:351` 按 `$LogonType` 分派 `/RL`。
2. **电源策略使「睡眠唤醒」在策略层不成立**：本机实测 `powercfg /q SCHEME_CURRENT SUB_SLEEP bd3b718a…` → AC=2（仅限重要）、DC=0（禁用）。脚本在建任务前已正确告警（`:125-128`），行为无误；但这意味着**即使机器睡眠，普通计划任务大概率不会被唤醒**，要验「睡眠到点能醒」必须先 `powercfg /setacvalueindex … 1` 再 `setactive`，否则验不出东西、也不能据此判红。

## 顺带核到

- 报告 `.batch/night/reports/wake-later.md` 9,702B，末行 `<!-- DONE -->`；其中 `:92` 明写「睡眠唤醒未验」、`:116-117` 明写 S4U 未按规格注册及原因 —— 与实测一致，没有把未验写成已验。
- 脚本未提交（`git status` 中为未跟踪/未 add 状态由负责人执行 `git add`），与派验单 `gitCommitted: false` 一致。

<!-- DONE -->
