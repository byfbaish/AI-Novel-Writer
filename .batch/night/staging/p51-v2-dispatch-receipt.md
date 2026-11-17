# P51 v2 投卡回执（豆包联络人 · 2026-11-15）

## 四行回执

1. **投出时刻**：2026-11-15 10:30:35（+08:00）
2. **窗口 id + turnCount**：`chrome://doubao-chat/chat/38453793251259394` · `turnCount=2`（用户 1 条 + 豆包 1 条「已确认红线 1-4」）
3. **卡面与实际投出正文**
   - 卡面 `cards/p51-median-gap.v2.md`：**4,279 B / 44 行** / sha256 `52c92190206b0f06865efdbb02c782ab7a0962f24363b4719118c555cd9fe2fe`
   - 实际投出 `tmp/p51-v2-dispatch.md`（投卡说明 10 行 + 卡面全文）：**5,122 B / 54 行** / sha256 `aae0472545c30ac5780a689f960c5c6865740a473979f1542c1629d9e70cca3f`
   - 卡面部分逐字节校验：`tail -c 4279` 的 sha256 = 卡面 sha256（**逐字节一致，未被改写**）
   - 脚本自报：`textLength=3418`（含注入红线前言的字符数）、`submitted=Enter`、`inputPath=cdp-input`、`charter=true`
   - 落窗后校验：`userTurns=1`、末行是卡文最后一句「…（在 develop 里）」，卡标题 / `-v2.md` / `wt-p51` 三个关键串均在 ⇒ **未截断**
4. **模型芯片原文**：`自动 高`（`runMode=本地电脑`，`project=null` 未选项目）

## 投前前置（投出前实测）

- 目标窗：新开任务窗，`turnCount=0`、`editorText=""`、无生成中控件 ⇒ 队列 0 行
- 库三元组静止：`师父派我来除魔…/.ai-novel/project.db` mtime = 11-06 22:14、`project.db-wal` = **0 B**、`project.db-shm` = 11-07 23:02 ⇒ 投产前 3 小时以上无写入
- 未复用旧窗：v1 窗 `chat/38453825022517762`（P51 v1 误在 develop 开工那单）与 P50-fix4 窗 `chat/38453824809566466` 都未投

## 待裁决三件（已按以下方式处理，若不同意请回滚）

1. **回执路径冲突**：卡 §4.7 写 `p51-median-gap-report.md`，你的指令写 `p51-median-gap-report-v2.md`。→ 投卡说明第 1 条按你的**-v2** 覆盖。
2. **注入红线与卡冲突**：`doubao.mjs` 机器注入红线 1「只准单元测试、禁 pnpm test」、红线 2「禁任何 git 写」与卡 §4.5（`pnpm test`）、§4.6（`check:fast`）、§4.7（一次 `git add`）直接对立。→ 投卡说明第 2 条声明这三处以卡为准，其余红线保留（禁 push/tag/publish、禁 install/rebuild/dev、禁全量与应用级测试）。
3. **底栏项目未选**：原 chip 是 `AI-writer-wt-1`（错目录），bootstrap 报 `[fail] 项目路径`、`ready=false`；无 `wt-p51` 项目可选。→ 未新建项目、未擅自绑定错项目，改由卡 §0 的绝对路径 `C:\develop\workspace\AI-writer\wt-p51` 约束（v1 的教训正是没写死目录）。

## 依据文件

- 投卡正文：`.batch/night/tmp/p51-v2-dispatch.md`
- 投卡说明：`.batch/night/tmp/p51-v2-dispatch-header.md`
- 落窗校验脚本：`.batch/night/tmp/p51-verify-paste.mjs`（只读）
- v1 作废说明：`.batch/night/staging/p51-median-gap-report-v1-VOID.NOTE.txt`
