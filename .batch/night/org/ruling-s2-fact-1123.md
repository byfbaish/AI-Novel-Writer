# 裁定 · FACT S2 实施包（bb3f0d83）— 2026-11-23 18:25，群 admin

判定面 `7bffc1ee7cd1d13db02466bcfdbe12bd73625490`。developer 交件四件已核：落盘、行数/字节、sha256 与自报全等（`06e141d4` / `329a9129` / `b8db109d` / `1571618e`）。

## 裁 1 · 两处偏差本卡不修（developer 报，等裁）

| # | 偏差 | 裁定 | 去向 |
|---|---|---|---|
| ① | 单章对话框 `ChapterCreationDialog.tsx:362-372` 未传 `structuredRefs`，既有 `space:` 规则在单章路径恒 fail-open | **本卡不修**。修它要把白名单扩到对话框文件，违反「纯增量、5 文件」 | 登记 BACKLOG 技术债，下期另卡 |
| ② | `validateArcCovers` 纯函数已就绪但预检侧未接线（`arc-node.ts:238` 注释「P12-2 会接」） | **本卡不碰**，属 L0-ARCH 侧的接线活 | 留在 ROADMAP L0-ARCH 项下，不并卡 |

理由：本卡性质是「纯增量加 3 条确定性规则」；两处偏差都要求改动既有调用点，混进来就变成「一阶段混装两类事」，违反 Goal rules 第 1 条。

## 裁 2 · 外派对象＝WorkBuddy

- developer 的派单件按 WorkBuddy 标准头写（`.batch/night/staging/fact-s2/dispatch-workbuddy.md`，`b8db109d…`），照此路由，不改写派单件。
- 时点 18:2x 属 WorkBuddy 非高峰（禁派窗为周一至周五 `09:00–12:00`、`14:00–18:00`），可派。
- 本阶段 Goal 里「豆包联络人」那条任务由 **workbuddy联络人** 承接（路由由 admin 定，非改阶段定义）。

## 裁 3 · 起点 sha 未推送的处置

起点 `7bffc1ee` 只在本地（远端 `exp/resource-ledger` 尚为 `f2989162…`，push 归主身）。故外派必须在**本机同一仓**建 worktree／分支开工，**不得** `git fetch` 后用远端 sha 当起点；拿不到 `7bffc1ee` 即停手回报，不许自己挑起点。

## 裁 4 · 判据口径补一条

`judgement-and-evidence.md` 判据 6 的「`git diff --stat` 恰好 5 文件」在外派分支上应理解为「相对起点 `7bffc1ee` 的 diff」；`.batch/*` 不计入白名单（外派不许改 `.batch`）。

## 裁 5 · 本卡无 [live]

纯函数＋单测闭合，无实机判据；QA 判词按 `[static]`＋`[mock]` 出，不得要求补 live。
