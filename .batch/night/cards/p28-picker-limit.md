# P28 · 会话选择器收口：默认 10 条 + 查看更多 + 限高滚动

- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 起点：`beb0af2fbd98`（P27 终审 PASS 后）
- 估时：30 分钟
- 来源：主人 11-14 08:5x 真机反馈「会话列表默认全量展开太长」

## 一、必做（只动 `client.js` 与 `index.test.mjs`）

1. 搜索框**常驻**在会话列表上方（不是点开才出现）；行为不变：即时过滤、按显示名匹配。
2. 列表默认最多渲染 **10 条**；命中总数 > 10 时，底部出现一行按钮「查看更多（共 N 条）」，点开渲染全部；再点变「收起」。
3. 列表容器限高：`max-height: 320px; overflow-y: auto`（内联 style，不引 CSS 文件、不加依赖）。
4. 搜索词变化时，展开状态回到「折叠（前 10 条）」，避免搜索后仍停在长列表。
5. 空结果文案保持现状，不改字。

## 二、禁动区

- `index.js` 一个字节不动；写回路径（`controller.mutate` / `set`）不动；三列结构与行内文案不动；`inject` 数组不动。
- 不新增依赖、不引样式表、不改 `package.json`。
- 不碰 `cordis.patch.yml`、不碰在用 profile。

## 三、测试（`index.test.mjs`）

- 现有 135/135 全绿。
- 新增三条（用桩会话数据，12 条以上）：
  a) 默认渲染的会话行数 = 10，且底部出现「查看更多（共 N 条）」；
  b) 点「查看更多」后渲染行数 = N；
  c) 容器节点 style 含 `max-height` 与 `overflow-y`（或 `overflow`）值。
- 反证：把 10 改成 12 之外的大数（如 999）后，用例 a 必须红。

## 四、交付要求

1. 提交 `feat:` 前缀，`git add` 点名文件、禁 `-A`。
2. 回执贴 `git log --oneline -2`、`git status --porcelain`（空）、`git show --numstat HEAD`、`node index.test.mjs` 末行总条数。
3. 报告 `.batch/night/reports/p28-picker-limit.md`，末行 `<!-- DONE -->`。
4. 报告落盘同一分钟内写 `.batch/night/signals/doubao/p28-picker-limit.done`。

## 五、QA 判据

- C1 只含 `client.js`、`index.test.mjs`；`index.js` blob 与 `beb0af2` 相同。
- C2 默认 10 条 + 查看更多 + 限高三样都在，且展开/收起真跑。
- C3 反证真红（不是断言文案）。
- C4 测试全绿且总数 > 135。
## 六、投递指令（联络人 2026-11-14 08:5x 投前核对）

投前基线（我实跑）：仓库 `C:\develop\workspace\dsh-handoff-relay` 的 `HEAD=beb0af2fbd98`（P27 后）、`git status --porcelain` 空、`node index.test.mjs` = `TOTAL: 135/135 PASS / RESULT: PASS`。

1. **只动** `client.js` 与 `index.test.mjs`；`index.js` 一个字节不动，`inject` 数组、写回路径、三列结构与行内文案都不动。
2. 限高用内联 style，不引 CSS 文件、不新增依赖。
3. 列一下把 10 改成别的值会红哪条用例（反证方向写清），别只断言文案。
4. **信号文件**（交付的一部分）：报告落盘后同一分钟内写
   `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p28-picker-limit.done`
   （三行：报告路径 / 提交 SHA / `<!-- DONE -->`）；写不进立刻在回执里说「信号未写 + 原因」。
5. 回执须含：`git log --oneline -2`、`git show --numstat HEAD` 原文、`node index.test.mjs` 末行总条数、porcelain。
6. 交付后不要再往这张卡上加提交；报告数字以最终 HEAD 为准。

回执照旧四行 + 模型芯片 + HEAD/字节/MD5。
