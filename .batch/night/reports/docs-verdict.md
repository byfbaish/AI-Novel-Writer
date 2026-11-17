# docs 收口终审（11-13 06:52）

判定：**PASS**（`e114e44`）

依据（我自己核过一次，未让 QA 复跑：纯文档改动，无可执行逻辑）：
- `git log --oneline -4`：`e114e44 docs: add relay origin story and design rationale` ← `5b69035` ← `fe19581`
- `git show --numstat --format=` 恰三件：`13 1 README.md`、`13 1 README.zh-CN.md`、`33 0 docs/why-relay.md`
- `docs/why-relay.md` MD5 `8F85F49F514F3FBB70A094A55F2A59DA`，与仓外草稿逐字节相同
- `git status --porcelain` 空；已提交未推送（符合「推送等重启后统一」的安排）
- 脱敏复核（README.md + README.zh-CN.md + docs/why-relay.md）：`C:\`、`C:/`、`.dsh`、`.batch`、`session-<hex>`、用户名、项目名、「负责人」「主人」→ **0 命中**
- 插入位置：ZH `## 为什么叫 relay` 在 L57（`## 安装` 前）；EN `## Why "relay"` 在 L71（`## Install` 前），双语对称

两点记录不拦：
1. `docs-merge` 的 commit 不是越线：卡面第③步明确写了 `git add` + `git commit`；与群里「我统一提交」冲突是我表述的问题，锅算我的。
2. 它把卡面里 `session-xxxx` 占位改写成 `'<session id>'` 以满足 `session-` 零命中判据——语义未变，实际正文里 `session` 字样 0 处，可接受。

未做：push、重启、重接 watch。等主人 08:50 停止/唤醒方案（A 休眠+09:00 唤醒 / B 整夜开机）定后，明早统一重启一次，再由 developer 重填 7 条 `targetSessionId` 并复验两条桥接。
