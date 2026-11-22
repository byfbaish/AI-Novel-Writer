> **作废（主身 11-22 20:2x 裁）：D5 走档 A 零改，本件不再投、不作为实施件；已投那件跑完交报告即收。**

# S5 外派件 · D5（模板尖括号占位符（模板或机检至少一侧闭环））

- 需求：D5 只做「模板尖括号占位符（模板或机检至少一侧闭环）」，产出三样：根因、改法提案、判据对照表。不落地、不 commit、不 push、不动 `develop` 主区。
- 起点：`17794aa9`（本件所有行号以该提交为准；先按内容核对，漂移以内容为准并写明实际行号）。
- 派给：WorkBuddy
- 产物落 `C:\tmp\s5-outbound\D5\`，回执 `.batch\night\bridge\to-owner`，回执只写提案路径与自测结论，不复述需求。

## 一、根因（文件:行）
- `src/shared/arc-placeholder-guard.ts:32` `export function findAngleBracketPlaceholders(text: string): PlaceholderHit[]` —— 纯函数机检**已存在**（`[已证实]`）。
- `src/shared/__tests__/arc-placeholder-guard.test.ts:5,16,38` 已有用例（含「不误报」那条 `toEqual([])`）（`[已证实]`）。
- 待验：写库路径上的调用点是否还在、是否覆盖卷/单元结构产物（`[待验]`，缺陷稿记 `architecture.command.ts:3228–3236` 一带，实读为准）。
- 待验：模板侧输出格式段是否仍用 `<…>` 描述字段（`[待验]`，读 `src/services/builtin-prompt-templates.ts` 对应段；改模板前先读 `docs/design/prompt/prompt-clause-admission.md`）。

## 二、改法提案（不落地，可附 diff 片段）
- 若两侧都已有：提案只需给出「还差哪一侧的接线」与最小补丁，不要重写机检、不要改判据。
- 若模板侧仍用 `<…>`：给「字段名：内容该是什么」的替换写法（给判法不给例子），并列出会被影响的模板段行号。
- 若写库路径未接守卫：给出唯一调用点与调用时机（写库前、只告警不阻断），不改删除语义。

## 三、卡面判据对照表
| 判据 | 证据来源 | 能判否 | 缺什么 |
|---|---|---|---|
| 机检对样例命中、对合法尖括号不误报 | `arc-placeholder-guard` 单测原文 | 能 | — |
| 守卫接在写库路径上（非只有导出） | `grep -n` 调用点原文 | 能 | 需实际调用点行号 |
| 一次真实生成的产物占位符为 0 | 群内那一次实机 evidence | 不能（外派禁实机） | 由群内实机补 |

## 四、不许做
- 不改 `src/shared/arc-placeholder-guard.ts` 的判定口径（命中集合、去重、返回结构）。
- 不动 `writeArchToDb` 的删除/覆盖语义；守卫只告警。
- 不扩白名单、不新增依赖、不改 `docs/adr/`。

## 五、外派边界（主人 2026-11-22 20:2x 放宽，覆盖上文「不 commit／push」）
- 外派可 commit／push／开 PR，但只限自己的 `ext/<卡号>-<豆包|wb>` 分支；不推 `exp/resource-ledger`、不开自动合并。拿不到凭据就退成交 `.patch` 到 `staging/`，不经 developer 中转。
- 开工先读仓内 `AGENTS.md`、`README.md`、`docs/agents/` 相关手册；这些规则对你同等约束，冲突时以仓内文件为准。
- 一卡一会话：本会话只做本卡，做完即停，不接着做下一张卡，不复用本会话做别的事。
- PR 描述四样齐：改动 `文件:行`、根因（标已证实/待验）、自测命令原文＋`EXIT=`、卡面判据对照表。
