# S5 · D15 apply 外派件（apply 序第 3 张，测试 only）

> 头件三段（§0／§0.1／§0.2）逐字引自 `.batch/night/staging/ext-dispatch-header.md`（31 行／1,939B／`e3f19e7d…`），缺段即退回。
> 头件以盘上现版为准：现版 `ext-dispatch-header.md`＝33 行／2,593B／`4184bad1…`（21:0x 新四行回执＋模式闸），本件所引三段取 21:0x 前版；回执请贴 `sha256sum ext-dispatch-header.md` 现场读数。

## 0 必读与确认（先回三行，再开工）

开工前必读：①仓内 `AGENTS.md`；②`README.md`；③`docs/agents/worktree-parallel.md`；④本卡相关通道件 `docs/agents/{copilot,workbuddy,doubao,task-board}-channel.md` 中与本次任务对口的一份；⑤派单正文点名的卡面或设计稿。

回三行再动手：

1. 读了哪几份（路径）
2. 各自当前版本或日期
3. 据此要遵守的三条口径

缺这三行，我不认这件已开工。

## 0.1 跨 agent 红线（机器注入，直接确认，不要为此去读文档）

- 不碰宿主设置（音量／亮度／电源／网络／时区／输入法／通知），不装卸软件，不改注册表与服务启动项，不弹窗、不抢焦点。
- 不 `pnpm install`，不切 node ABI，不起 Electron 实机，不跑全量测试，不跑 `test:browser`／`test:node`；自测只准文件级：`node node_modules/vitest/vitest.mjs run <单文件>`，或派单点名的 `pnpm test <单文件>`。
- 只改本卡白名单文件，不新增文件，不动 `.batch/*` 任何件；不 push 到 mainline，不 tag，不 `git add -f`，不 `--no-verify`；分支与 push 权限以派单明写为准。
- 不改删除语义，不扩白名单，不串别的卡；**一卡一会话**，做完即停，不在同一会话里接下一张。
- 不把「待验」写成「已证实」；无证据不下结论；报告里不许出现「已修好」这类措辞，除非派单明写允许落地。

## 0.2 回执头（缺则判可疑）

```
From: D15-apply · WorkBuddy
To: 大肥鱼@主身
卡号：S5-D15-apply｜会话标识：<新会话首次时间或会话 id>｜起点：17794aa9
```

回执投**绝对路径** `C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner\`（不是 worktree 里的同名目录，relay 只看 develop 那棵）。

## 1 边界（本件专属，叠加在 §0.1 之上）

- 起点 `17794aa9`（＝主线 `exp/mainline-1119` HEAD ＝ `ls-remote exp/resource-ledger`，20:54 复核）：`git worktree add <dir> 17794aa9` 后 `git switch -c card/s5-d15-overlap-tests`；**不 commit、不 push、不动 develop 主区**。起点只写主线头，不写任何卡分支提交（D18 的 `7b48f074` 会白带 28/6）。
- **只改 `src/shared/__tests__/volume-structure.test.ts` 一个文件**；源码 `volume-structure.ts`、`volume-unit-overlap.ts`、`volume-warning-summary.ts` 一律不动（本卡「锁住现状」，不是改现状）。
- 既有断言一条不改（`volume-warning-summary.test.ts:28` 也不动）；不加新文件、不动 `electron/`。
- `VOLUME_UNIT_INVERTED` 补出口：**不做**（已裁定 D15-② 另开卡）。

## 2 需求说明（照此可干）

在 `src/shared/__tests__/volume-structure.test.ts` 的 `:235` 之后插入两例（沿用该文件既有夹具写法）：

1. **相接不误报**：某卷单元区间 `7-9` 与 `10-10`（端点相接不相交）⇒ `warnings` 里**没有** `VOLUME_UNIT_OVERLAP`。依据：`volume-unit-overlap.ts:34-38` 用闭区间 `lo <= hi` 求交，`10 <= 9` 为假 ⇒ 无交集；章号文本由 `volume-structure.ts:144-158` 连续输出。
2. **全等重叠只计一次**：两单元区间完全相同（如都 `5-8`）⇒ 该卷该对单元只产生 **1 条** `VOLUME_UNIT_OVERLAP`（`volume-unit-overlap.ts:74-85` 只产 1 条、`:96-104` 按「覆盖单元集合」只归 1 组）。

断言是「锁住现状」的写法：第一例断言无 overlap 警告；第二例断言该 marker 计数 `=== 1`（不是 `>= 1`）。两例都把实际 `warnings` 数组原文贴进回执。

## 3 验收标准

- 命令与末行都进回执：`pnpm test src/shared/__tests__/volume-structure.test.ts; echo EXIT=$?`，重定向存 `C:\tmp\s5-outbound\D15-apply\test-raw.txt`。
- 门槛：汇总行 `Tests 32 passed (32)`（现文件 `grep -c "it("` = 30，+2 = 32）＋ 末行 `EXIT=0`。缺末行 `EXIT=` 一律不算齐。
- 产物三件：`test-raw.txt`（含末行 `EXIT=`）、`git diff > d15.patch`、`git status --porcelain` 原文（只应 1 行 `M`）。
- 报三行读数：`wc -lc test-raw.txt`、`sha256sum d15.patch`、`git rev-parse --short HEAD`。

## 4 判据对照（只这两行，不许加行）

| 卡面判据（阶段卡 `:18`／`:19`） | 本卡能判否 | 证据来源 |
|---|---|---|
| D15-1 卷内单元区间重叠 ⇒ 报 `VOLUME_UNIT_OVERLAP`、合法样态不报 `[static]` | 能 | 新增两例原文＋`Tests 32 passed` |
| D15-2 面板消费该告警成句、不重复计数（`summarizeVolumeWarnings`）`[static]` | 能（代码＋既有用例） | `volume-warning-summary.ts:32-54`＋`volume-warning-summary.test.ts:21-29`；本卡不改它，只引用 |
| 面板成句组件级用例／实机 | **不在本卡**（D15 不占实机证据集） | — |

## 5 回执篇幅

≤300 字：结论一行＋`Tests 32 passed` 一行＋`EXIT=` 一行＋patch 路径一行＋`HEAD` 一行。长内容落 `C:\tmp\s5-outbound\D15-apply\report.md`，群里只贴路径。
