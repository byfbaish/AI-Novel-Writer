# 夜跑 11-11 · WB-1 单测夹具补 M29 三列（execution_owner）

你是 WorkBuddy。本卡由 Lead 通过外部看板派发。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线 `5e031021`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：45 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只改本卡点名的测试文件；不碰 `develop` / `wt-1` / `wt-3`；不改生产代码、不改迁移、不改断言。
2. 只跑单测：`node node_modules/vitest/vitest.mjs run <单文件>`；禁 `pnpm dev` / `pnpm test` 全量 / `test:browser` / `test:node`。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告一个文件。
5. 遇确认框/提权弹窗 → 立刻 `BLOCKED`，附弹窗原文。

## 背景（已由上游取证）
`electron/services/__tests__/generation-run-service.test.ts` 用 `db.exec(M01_GENERATION_SQL)` 建表（见该文件 `:5` import、`:17/:173/:227/:268/:292` 调用），但 `electron/repositories/generation-run-repository.ts:338` 的 INSERT 列清单含 `execution_owner, execution_epoch, lease_expires_at` —— 这三列由后续迁移（M29）加到 `generation_runs`，M01 的 DDL 里没有。于是该测试文件在干净库上必然失败。

## 任务
1. 先复现：`node node_modules/vitest/vitest.mjs run electron/services/__tests__/generation-run-service.test.ts`（cwd = wt-2），贴失败断言原文与通过/失败数。
2. 用 `git grep -n "execution_owner" -- electron/migrations electron/repositories` 定位 M29 迁移文件与列定义，读它的 DDL 片段。
3. 只改测试夹具：让该文件的建表把 `generation_runs` 补到与当前 schema 一致 —— 推荐直接 import 该迁移暴露的 SQL 常量（若迁移没有导出 SQL 常量，就在测试内 `db.exec` 一段最小 ALTER/建表补齐，并在报告里说明为什么选这条路）。
4. 禁止：改断言、改生产 repository、改迁移文件、改其他测试文件。
5. 复跑第 1 步命令，应全绿；再跑 `pnpm typecheck` 记录退出码。
6. 复跑同目录相邻的 `electron/services/__tests__/generation-run-service.call-timeout.test.ts`，确认没被连带弄红。

## 验收
- 该文件全绿（贴真实通过数）；typecheck 退出码 0；call-timeout 文件不被连带弄红。
- 若「补夹具必须动生产契约/迁移」→ 停手，报告写 `BLOCKED` 并给证据（文件:行号 + 原文）。

## 交付
报告四段（改动清单 / 执行记录 / 原始输出 / 未做项），末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent workbuddy:worker
```
