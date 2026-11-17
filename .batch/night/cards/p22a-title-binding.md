# P22a · 会话绑定改成「标题优先、id 兜底」（host 侧）

- 派卡：AI writer总负责人（2026-11-15）
- 执行：豆包（经豆包联络人）
- 估时：60 分钟
- 仓库：`C:\develop\workspace\dsh-handoff-relay`，起点 HEAD 以投卡时 `git rev-parse --short=12 HEAD` 为准（P21 之后）
- 事实依据：`.batch\night\reports\p22-ui-feasibility.md`（developer 11-15）

## 目标

让 watch 绑会话不再依赖「重启后可能失效的实例 id」。绑定以**标题**为主、id 作校验兜底，重启后自动按标题解析，不需要人工重接。

## 必做

1. **配置语义**（保持向后兼容，不破坏现有 7 条 watch 的 `targetSessionId`）：
   - 一条 watch 的绑定字段允许三种组合：只有 `targetSessionId`（旧形态，行为不变）/ 只有 `targetTitle` / 两者都有（`targetTitle` 优先，`targetSessionId` 仅作兜底校验）。
   - 「两个都填就整条跳过」的旧规则（现 `index.js:964`）改为：两者都有时按标题优先，不再跳过。
   - **不新增任何 schema 字段**（含 `targetCwd` 一律不引入）。

2. **解析顺序**（每次投递前解析，不缓存长期结果）：
   a. 有 `targetTitle` → 用 `sessionTitle` 服务的标题匹配，`exact` 为 true 时完全相等、false 时包含。
   b. 标题没命中或命中多条 → 若给了 `targetSessionId`，按 id 精确命中。
   c. 都不中 / 仍多义 → warn（必须带 watch 的 `dir` 与绑定值原文），该条不投，其余 watch 照常。**不按 cwd 猜、不按 id 猜**（`index.js:790` 本就不按 cwd 兜底）。
3. **`exact` 默认值改为 true**（保持可配置）。注意：这是行为变更，须在 README 的配置说明里写一句默认值。

4. **测试**：新增/调整用例覆盖——①只有 id（旧形态，行为不变）②只有标题、exact=true 命中 ③exact=false 包含命中 ④标题多义 → warn 且不投（不按 cwd 也不按 id 猜）⑤标题失配但有 id → 用 id 投（标题失配且有多义时不走 id 兜底）⑥两者都不中 → warn 且不投。旧用例若断言「两个都填就跳过」，改为新语义并在报告里贴出改动前后原文。
## 明令不动

- `client.js` 一行不动（P22b 才动）。
- 写回通道不新增：仍然只经 `configForms` 保存落 `cordis.patch.yml`。
- 不新增依赖、不改 `inject`（仍 `['agents']`）、不动 schema 里已有字段名。

## 验收判据

- P1 `node index.test.mjs` 全绿，贴末行原文；通过数 ≥ 现有基线（现为 `TOTAL: 117/117 PASS`）。
- P2 六类新用例逐条存在，贴用例名与断言行号。
- P3 `grep -n "targetTitle" index.js` 命中 ≥1，`grep -n "targetCwd" index.js` 命中 0，各贴原文。
- P4 `git diff --stat` 只含 `index.js`、`index.test.mjs`（README 由 P22b 同批改）。
- P5 porcelain 清。

## 交付

报告 `.batch\night\reports\p22a-title-binding.md`：解析顺序的伪代码/关键行号、六类用例原文、P1–P5 命令与原始输出、`git rev-parse --short=12 HEAD` 原文。末行 `<!-- DONE -->`。

**交付信号（漏做即等于没交付）**：报告落盘后另写一个文件
`C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p22a-title-binding.done`，
内容一行：`p22a <报告绝对路径> HEAD=<12 位>`。写完不要再改、不要移走（relay 会把它搬走并唤醒联络人）。
注意：报告里的 `<!-- DONE -->` 只是文本标记，relay **不读**报告内容，只认 `signals\doubao\` 下落的文件。
