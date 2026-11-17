# P34 终审（编辑动作计数可行性）

> 判：AI writer总负责人 · 2026-11-14 15:2x
> 报告：`.batch/night/reports/p34-edit-count-feasibility.md` 11,662B / MD5 `EB9B9AB9F270C27CC5322FD9E69B1FB5`
> 证据：workbuddy联络人 抽查 5 处（4 命中 1 偏移）+ 我核 3 处（`CodeMirrorEditor.tsx:802`、`electron\controllers\db-controller.ts:1207`、`src\components\editor\DraftEditor.tsx:876`）

## 判定：PASS

「A2/A3 现在验不了」成立。作者改字只有一条落盘链（编辑态 → `db:draft-update-content` → 旧正文就地覆盖），无历史、无轨迹；定稿走另一条链只留一章一行终态快照。

## 两处证据校准（记账，不改结论）

1. 卡面背景「`editCount|edit_count|manualEdit|改动字数|reviewEdit` 全库 0 命中」表述不准：`src/`+`electron/` 实测 10 条命中，全在 `electron\repositories\character-roster-repository.ts`（`isManualEditIntent` `:166` 等），是人物名册的手动编辑意图，与正文计数无关。以后写「同义键 0 命中；`manualEdit*` 仅出现在人物名册」。
2. 报告引 `DraftEditor.tsx:873-877` 承载 `updateTabContent`，精确点是 `:876`（`:873` 是 `onChange` 块起点）。

## 口径裁定（三条，写进 G-A）

- **A3 主口径＝乙（改动千字率）**：必须在保存时刻算（事后不可重建），落点在 `db:draft-update-content` 覆盖前读旧正文做 diff。
- **A2 副口径＝甲（动作数）**，但**必须带来源标记**：`update-content` 现在会被「AI 按意见修稿」复用，混入后数字就废了。所以调用的 envelope 必须新增 `origin: 'human' | 'ai'`，**缺省按 `ai` 计**（保守：宁可少记人工，不可把 AI 改动算成作者劳动）。
- **丙（保存次数）只作调试读数**，不作判据。

## 两条边界裁定

1. 「定稿编辑」定义为**草稿态正文**（draft content），到定稿快照为止；定稿后对物理文件的手改不计（另一条链、极少数）。
2. 迁移一律不得改动既有表的既有列语义；新增计量落点按仓库既有 migrations 机制做，禁另造第三套。

## 后续

接线作为 G-A 的前置工序开卡（P35）。接线完成前，G-A 仍判「部分可验」，A2/A3 不作为通过条件。

<!-- DONE -->
