# FACT · 判据与取证（S2 第一步 · 交 QA 用）

- 卡号：`bb3f0d83-3f24-43a9-977d-8ef6b4e8eb9b`
- 判定面：`7bffc1ee7cd1d13db02466bcfdbe12bd73625490`（分支 `exp/mainline-1119`；`git ls-remote origin refs/heads/exp/resource-ledger` = `f2989162…`，**不是**同一 ref，写在这里免得后人以为对不上）
- 分层口径：`[static]`＝读码/grep/diff 可判；`[mock]`＝单测（不起实机）；本卡**没有 `[live]` 判据**（纯函数 + 单测即可闭合，卡面「纯增量」且不新增流程）

## §1 判据（6 条）

| # | 层 | 判据 | 取证命令（原文） | 通过条件 |
|---|---|---|---|---|
| 1 | static | 新增判定是**纯函数、无 IO** | `grep -n "ipc\|fs\|node:" src/shared/space-time-consistency.ts` | 零命中 |
| 2 | static | `space:` 键**逐字节未变**（存量豁免不能失效） | 看回执第 4 项两行字面量 + 用例 `hash 回归` | 改造前采集值与改造后输出**字符串相等**，且该用例绿 |
| 3 | static | 新规则键**独立前缀**，与 `fact:` / `space:` 隔离 | 用例 `键隔离`（R 组第 4 行） | `slotStableFactKey` 输出以 `slot:` 开头且 ≠ 同入参的 `spaceTimeStableFactKey` |
| 4 | mock | 三条规则**正负向都判对** | `pnpm test src/shared/__tests__/space-time-consistency.test.ts src/shared/__tests__/consistency-preflight-space-time.test.ts` | 末行 `Tests N passed (N)`，`EXIT=0`；R1/R2/R3 各有 ≥1 正向与 ≥2 负向用例 |
| 5 | mock | **旧项目零误报** | 同 #4 的负向组 | 世界观无机读行 ⇒ R1/R2 0 条；单章无 `attacks` ⇒ R3 0 条；`hours=none`、按月窗口、非法钟点 ⇒ 0 条 |
| 6 | static | **未越界**：只改 5 个白名单文件；面板/coverage/提示词/调用点零 diff | `git diff --stat` + `git diff -- src/shared/consistency-preflight.ts \| grep -n "ConsistencyPreflightCoverage"` | `git diff --stat` 恰好 5 文件；第二条 grep 零命中；`git status --porcelain` 空 |

关卡另附：`pnpm check:fast` 必须 `EXIT=0`（typecheck + 文档检查）。

## §2 evidence 字段（QA 判词里必须出现这些键）

```json
{
  "card": "bb3f0d83-3f24-43a9-977d-8ef6b4e8eb9b",
  "judgementSha": "7bffc1ee7cd1d13db02466bcfdbe12bd73625490",
  "applySha": "<外派交付的 commit>",
  "filesChanged": 5,
  "spaceKeyBefore": "<改造前采集的 space:… 字面量>",
  "spaceKeyAfter": "<改造后实际输出>",
  "spaceKeyUnchanged": true,
  "rules": ["slot:unregistered-slot-space", "slot:slot-outside-window", "slot:slot-attacked-twice"],
  "testSummaryLine": "Tests <N> passed (<N>)",
  "testExitCode": 0,
  "checkFastExitCode": 0,
  "preflightPureGrepHits": 0,
  "coverageDiffHits": 0,
  "porcelainLines": 0,
  "knownGaps": [
    "R3 不进 ConsistencyPreflightCoverage：设定层 0 条机读行或本章无 attacks 时，'没重复'与'没判'同形",
    "按月窗口（hours=每月D日…）R2 显式不判，与既有 space:undecidable-time 口径一致",
    "单章对话框未传 structuredRefs 导致既有 space: 规则在单章路径 fail-open —— 既有偏差，本卡不修"
  ]
}
```

## §3 判 pass 前三核（缺一不许判 pass）

1. **删断言变红**：把 R2 正向用例的期望改成 `[]`（或删掉 `findSlotAttackConflicts` 的窗口比较那两行），重跑必须变红，然后改回来再跑绿 —— 证明用例真的在测东西，不是空转。
2. **逐条对白名单**：`git diff --stat` 的 5 个路径与你写进 evidence 的 `filesChanged` 必须一一对上，多一个文件即退回。
3. **命令原文**：evidence 里的每条命令都要有**原文 + 末行**（`Tests N passed (N)` / `EXIT=0`），只写「已通过」不算证据。

## §4 退回条件（任一条即打回，不进入复判排期）

- 出现第 6 个文件，或改了 `findSpaceTimeConflicts` / `parseSpaceRules` / `ConsistencyPreflightCoverage` 的任何一行
- `space:` 键发生变化（哪怕只多一个字符）——存量豁免会静默失效，这是本次最大的回归面
- 用 `-t` 过滤跑单测，只贴部分用例结果
- 报告里出现「已修好」「应该没问题」这类无证据措辞
- 新增了文件（比如另建一个 `slot-rules.ts`）——本卡白名单不含新增文件
