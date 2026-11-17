# P45-fix 首验报告（只重验第 ④ 条）

- 判定对象：`15e9d835a6c1816f42cb6eb2d16693790bacdfa5`「docs: fix settings card entry wording」，父 `87782339a5cb8d3c6786548f93d355b14a2dea35`
- 派验单：`.batch/night/review-requests/P45-fix.md`（664B / `A76D11919F4164F25F56F038E250768E`）
- 口径：只重验首验第 ④ 条（入口措辞）；其余七条不重验，但两文件/两行之外出现任何改动即不通过
- 环境：`C:\develop\workspace\dsh-handoff-relay`，`master`，2026-11-14 22:42

## 1. 改动面（与派验单一致才继续）

```
git log --oneline -3
15e9d83 docs: fix settings card entry wording
8778233 docs: align README with 0.5.0 and settings card entry
8df4e76 feat: probe directories via main-process route

git status --porcelain            → 空

git diff --numstat 8778233..HEAD
1	1	README.md
1	1	README.zh-CN.md

git diff --name-only 8778233..HEAD
README.md
README.zh-CN.md
```

`git diff 8778233..HEAD` 全文恰两处 `-`/`+`：
- `README.md:243`：`-README page → “Included components” at the bottom →` / `+README page → in the “Components” section →`
- `README.zh-CN.md:207`：`-…→ 页面最下方「包含的组件」→` / `+…→ 页面里「包含的组件」一节 →`

⇒ 无第三处改动；B9 两行（`README.md:246` `target session (text input`、`README.zh-CN.md:209`「目标会话（文本输入…」）未被碰——diff 里不出现。

## 2. 第 ④ 条逐项

| 项 | 判据 | 实测 | 结论 |
|---|---|---|---|
| 4a 中文不得出现「最下方」 | 0 命中 | `Select-String -SimpleMatch "最下方"` → 0 命中（两份 README） | 通过 |
| 4b 英文不得是 `Included components` | 0 命中 | 两份 README 0 命中；宿主包 `pm-client.js` 全文件亦 0 命中 | 通过 |
| 4c 英文必须是 `Components` | 宿主英文标签 `partsLabel: "Components"`（`C:\develop\workspace\tmp\pm-client.js:467`） | `README.md:243` 现写 `in the “Components” section` | 通过 |
| 4d 中文标签「包含的组件」 | 宿主中文标签 `pm-client.js:173` `partsLabel: "包含的组件"` | `README.zh-CN.md:207` 现写 `页面里「包含的组件」一节` | 通过 |
| 4e 不得写「最下方 / at the bottom」 | 0 命中 | `at the bottom` 两份 README 0 命中 | 通过 |

补充（入口位置仍成立）：宿主包详情页顺序为 文档 → 包配置 → `RowsSection`（包含的组件，`pm-client.js:6024`）→ 版本信息（`:6034`）→ 来源信息（`:6043`），所以「最下方」确属错误表述，改为「页面里…一节」正确。

## 3. 交付物与信号对账

- 提交：`15e9d83`，父 `8778233`，porcelain 空 ✔
- 报告：`.batch/night/staging/p45-fix-report.md`，2,554B / MD5 `A7C1B8F920721BCBBA4128D61EF11E15` / 22:40:37 / 末行 `<!-- DONE -->` ✔
  - 备注（不拦）：联络人回执写的是 `p45-readme-fix-report.md`，实际文件名为 `p45-fix-report.md`；字节、MD5、时间全对，属笔误。
- 信号：`delivered` 下 `p45-readme-050-fix.done` 165B / 22:40:54，源目录已清空（大肥鱼独立复核，我不重复）

## 4. 备注（不拦）

- 两份 README 仍留「目标会话（文本输入）」表述（`README.md:246`、`README.zh-CN.md:209`），与本版选择器卡片自相矛盾——按派验单不得在本卡修，已落 backlog B9。
- 本卡只改文档，不涉及代码，未重跑 `node index.test.mjs`（派验单明确要求不重跑）。

## 判定

**P45-fix 第 ④ 条：通过。** 两处措辞与宿主实际标签一致，改动面恰为两行、无越界改动。建议负责人终审后进入 tag 流程。

<!-- DONE -->
