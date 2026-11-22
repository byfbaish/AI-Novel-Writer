# 卡草案 · D5b 大纲侧模板改写（档 C）｜不进 S5，排额度重置后

> 状态：**草案**（项目总负责人 2026-11-22 20:2x 起草，按主身裁定另行立项；本阶段不派、不投、不开分支）。
> 立项理由：D5 走档 A 零改（`s5-stage-card.md` §三），大纲侧 7 行 20 处缺口属**同型缺陷、另一处源头**，不在 D5 判定面内。
> 原始引入：`bb169361`（2026-10-18，P12-1「大纲每章声明『覆盖：<结构位ID>』」）；D5 提交 `4a602479`（2026-11-05）只清理了 `plot_structure` 模板并接守卫。两者均为 `17794aa9` 祖先，P12-1 在前、D5 在后 ⇒ **不是 D5 做漏**。

## 1. 范围（只这一处）
- 文件：`src/services/builtin-prompt-templates.ts`（行号以 `17794aa9` 为准）
- 行：`:937`、`:947`、`:949`、`:950`、`:953`、`:955`、`:962`（情节大纲 / `synopsis`，共 7 行 20 处 `<…>`）
- 口径：把 `<…>` 改成「字段名：内容该是什么」的**格式说明改写**，不新增禁令（`prompt-clause-admission.md` 三问不触发；改写天然是正面清单，AV 判据不受影响）。

## 2. 提案（不重写，直接引）
- 逐行判法表：**D5 报告 §2.3 那张表**（`C:\tmp\s5-outbound\D5\report.md`，179 行 / 18,136B / `5184f4c1…`），7 行逐条给出「改后该写什么」。
- 不建议档 B：`<n>`/`<N>` 记号与守卫口径天然冲突，档 B 只多加一层告警，抄进正文的问题依旧（报告 §2.3 末段）。

## 3. 判据（草案，立项时按卡面模板补齐分层标签）
1. `[static]` 上述 7 行内 `<…>` 命中数为 0：`awk 'NR>=930&&NR<=970' src/services/builtin-prompt-templates.ts | grep -o '<[^<>]\+>' | wc -l` → `0`。
2. `[static]` 改写后仍能过语言闸门：`pnpm test src/services/__tests__/prompt-language-contract.test.ts`，贴汇总行与末行 `EXIT=`。
3. `[static]` 未动其余模板段：`git diff --numstat <base>..HEAD -- src/services/builtin-prompt-templates.ts` 行数落在 7 行改写区间内，`:680`/`:1076`/`:1161` 不动（另一批，超出本卡）。
4. `[live]` 一次真实大纲生成、产物占位符为 0（单实例，`instancesThisRun=1`、`exitCode=0`、`leftover=0`）。

## 4. 不许做
- 不改 `src/shared/arc-placeholder-guard.ts` 判定口径；不把告警改阻断。
- 不动 `:680`（world_building）、`:1076`/`:1161`（chapter_blueprint）——另卡另议。
- 不扩白名单、不新增依赖、不改 `docs/adr/`、不动删除语义。

## 5. 外派位
- 可外派（纯模板文本改写＋单测），档 C；派单前须回读 `docs/agents/doubao-channel.md`／`workbuddy-channel.md`。
- 外派边界按 11-22 20:2x 新口径：只限 `ext/d5b-<豆包|wb>` 分支，不推 `exp/resource-ledger`、不开自动合并；无凭据退交 `.patch` 到 `staging/`；一卡一会话。

## 6. 排期
- **不进 S5**；S5 只做 D5（档 A 零改验收）／D15／D18。
- 顺序：额度重置后 → D5b → D10b／D4b（按主身既定顺序 D5→D15→D18→D10b→D4b，D5b 插入其后由主身定档）。
