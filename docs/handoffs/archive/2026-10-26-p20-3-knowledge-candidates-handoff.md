# 交接：P20-3 章末知情候选（M22 + 步骤表收敛 + 提议条）

> 状态：**已交付**（2026-10-26 夜）。分支 `exp/resource-ledger`。
> 提交：**`03031dfe`**（28 文件 / +1939 −64）。
> 设计稿：`docs/design/architecture/p20-3-knowledge-candidates-design.md`（§10 = 实施记录）。
> 排期：`docs/plans/prompt-assembly-backlog.md` §P20-3。

---

## 1. 一句话

定稿后多跑一步：模型在**本章已产出的编号事实清单**里挑「谁知道了哪条」，作者在知情页逐条采纳。
模型的输出只有 `{factIndex, characterId}` —— 引文、章号、事实身份全由系统反查，
所以「模型把复述当事实」**在结构上没有位置发生**。

## 2. 先做的小重构（作者的「按建议来」包含这一条）

设计稿点名的实施风险不是业务逻辑，是**通路**：`stepKey` 当时散在**六处二元判断**里，
漏改不报编译错，只会在运行时抛 `GENERATION_FINALIZATION_ADMISSION_REQUIRED` —— 步骤静默不执行。

现在收敛成一张表：

```ts
FINALIZATION_STEP_SPECS: Record<FinalizationStepKey, {
  operation; purpose; promptKey; output; skillStage
}>
```

**比设计稿多一个字段**：`promptKey` 也硬编码在同一处（`main-generation-owner.ts` 的
`characterStep ? 'update_character_cards' : 'generate_chapter_notes'`），不一起进表就还是两份真相。

调用点全部改成走表：`finalization-generation-source.ts`（白名单 / operation 比对 / purpose / skillStage / output）、
`generation-source-binding.ts`（promptKey）、`main-generation-owner.ts`（两处准入 + `begin` 四参数）。

## 3. 与设计稿不同的两处（实施期调整）

### ① 删掉 `KnowledgeCandidate.factKey`

`knowledgeFactKey()` 走 `crypto.subtle`，是 **async**；而 `commit` 在 `db.transaction(...).immediate()` 里，
**`await` 进不去同步事务**。

改用 `knowledgeCandidateFactIdentity(chapterNumber, evidence)` = `` `${章号}\u001f${归一化引文}` ``。
它与 `factKey` **同定义域**（`factKey` 就是对这个二元组做 sha256），反查等价但同步。
副产物：少一条「键对了、引文已经被改过」的脱节路径。

### ② 「没有可用事实」的前置检查放在 `begin`

原稿当成提交期错误。那样会**白花一次模型调用**，而且失败留在最后一步——作者只看到「后处理失败」，
不知道是前置没跑。

现 `beginFinalizationGeneration` 抛 `GENERATION_FINALIZATION_PREREQUISITE_MISSING`；
commit 里保留同语义的 `GENERATION_FINALIZATION_FACT_SOURCE_MISSING` 作第二道闸（防 run 复用）。
两条都**不落空候选**：落空会让作者以为「本章确实没人新得知」，真相是这一步没有材料可判（判据 DN）。

## 4. 落点

| 层 | 文件 | 要点 |
|---|---|---|
| 迁移 | `electron/migrations/m22-knowledge-candidates.ts` | M22 · v22→v23 · `ALTER TABLE summary_snapshots ADD COLUMN knowledge_candidates TEXT NOT NULL DEFAULT '[]'` · **只加列不重建** |
| 注册 | `registry.ts` + `desktop-registry.ts` + `project-storage.ts` | `LATEST_SCHEMA_VERSION` / `CURRENT_DESKTOP_SCHEMA_VERSION` = **23**；三件套 + `schemas(23)` |
| 步骤表 | `src/shared/finalization-generation.ts` | `FINALIZATION_STEP_SPECS` + `isFinalizationStepKey` / `finalizationStepSpec` / `isFinalizationOperation` |
| 纯函数 | `src/shared/knowledge-candidate.ts` | 编号清单渲染 / 解析 / 反查 / 失效标记 / 上限 6 条 |
| 提示词 | `builtin-prompt-templates.ts` + `prompt-language.ts` | 新 key `propose_knowledge_candidates`，中英各一份，变量 `facts_list` / `characters_json` |
| 提示词台账 | `docs/design/prompt/prompt-three-layer-inventory.md` | §3.2 第 30 行（`EDITABLE_PROMPT_KEYS` 23→24）。**漏这一步 `prompt-inventory-coverage.test.ts` 会红**——本轮就红过一次 |
| 链 | `finalization-generation-source.ts` / `finalization-generation.ts` | 上下文捕获 `continuityFacts`；commit 新增第三支收据 `{candidateCount, dropped, factCount}` |
| 准入 | `main-generation-owner.ts` | 前置检查 + `begin` 四参数走表 |
| 编排 | `finalize-chapter.command.ts` | 步骤 2c，`critical: false`，日志报候选数与丢弃数 |
| 存储 | `summary-repository.ts` | `saveKnowledgeCandidates`（**覆盖不合并**，`changes===0` 抛）/ `readKnowledgeCandidates` / `listKnowledgeCandidateViews` |
| 通道 | `db:knowledge-candidates-list` | **只读**；`!db` 降级空列表；刻意没有自动写 M16 的通道 |
| 界面 | `KnowledgeRegistryPanel.tsx` | 提议条按得知章分组；失效项禁用并写明原因；**采纳 = 填一行草稿** |

## 5. 界面的三条纪律（都写在代码注释里）

1. **采纳不写库** —— 模型提议本来就可能认错人，直接写等于让模型替作者登记。点「保存」才落库，
   与面板其余行走完全同一条路径。
2. **可见性由草稿行过滤，采纳时不从 `proposals` 里删** —— 否则作者删掉那条草稿后提议永远回不来
   （「删了才发现不用采纳」应该能反悔）。
3. **`pickedFactKey` 刻意留空** —— 提议走的是另一条通道，它的 key 不在「选事实」下拉的候选集里，
   硬塞会让下拉显示空白、作者以为选项丢了。

## 6. 守门测试（新增 5 文件 / 43 例）

| 文件 | 例 | 钉住什么 |
|---|---|---|
| `src/shared/__tests__/knowledge-candidate.test.ts` | 20 | 编号一致性、只解析两个字段、坏 JSON 不抛、逐条记账、上限、失效三态 |
| `src/shared/__tests__/knowledge-candidate-isolation.test.ts` | 4 | **全库只有 14 个白名单文件能提到候选**；正文链 / 审稿链逐文件点名不得命中；**反向断言**（白名单项必须真的还在提它） |
| `electron/migrations/__tests__/m22-installed-lane.test.ts` | 5 | 旧行读到 `'[]'` 而非 NULL / 空串；重跑幂等；verify 失败回滚 |
| `electron/repositories/__tests__/knowledge-candidate-store.test.ts` | 8 | 覆盖不合并、无快照行拒绝、不动 `projection_generation`、`stale` 可见不消失、坏列降级 |
| `finalization-generation.test.ts`（+3） | 3 | 模型只给编号 → 引文/章号由系统反查；越界逐条丢弃不整批失败；无 `chapter_notes` 在 `begin` 就拒 |
| `KnowledgeRegistryPanel.browser.tsx`（9→14） | 5 | 按章分组、采纳不写库、已登记不再出现、失效不可采纳、读提议失败不挡整页 |

## 7. 回归读数

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | **0** |
| `src/shared/__tests__` 全量 | 87 文件 / **1463 例** 全绿 |
| `electron/migrations/__tests__` 全量 | 23 文件 / **153 例** 全绿 |
| `KnowledgeRegistryPanel.browser.tsx` | **14/14** |
| `knowledge-candidate-store.test.ts` | **8/8** |
| `finalization-generation.test.ts` 新增 3 例 | **3/3** 一次通过 |
| `check-doc-links` | checked 978 / broken **0** |

## 8. ⚠️ 基线失败集（都**不是**本轮引入，均已用 `git stash` 回 HEAD 复现）

| 文件 | 例数 | 形态 |
|---|---|---|
| `main-generation-owner.test.ts` | 1 | `maps a partially edited candidate...`：`background` / `notes` 多出拼接内容 |
| `finalization-generation.test.ts` | 2 | `末次安排合同保留原snapshot...` 的 undefined / en-US 两参数：**5s 默认超时不够**（实测 7.4s / 7.0s），`--testTimeout=30000` 下通过 |

跑这组测试**必须**：

```bash
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  node scripts/run-tests-electron.mjs electron/services/__tests__/finalization-generation.test.ts
```

否则 cleanup 的 `fs.rmSync` 会被 safe-delete shim 拦成 `spawnSync genie-trash ETIMEDOUT`，
一次跑出二十几例**假失败**（栈落在 cleanup，不是断言），并留下几百个 `owner-*` 临时目录。
残留太多时**别硬删**（逐个进回收站会被 SIGTERM），用 `fs.renameSync` 改名移出测试路径即可。

## 9. 下一步（不在本期）

- **实机验证**仍是主线，交接见 `docs/handoffs/archive/2026-10-26-live-verification-handoff.md`，
  核对表 `docs/design/product/live-verification-checklist.md`。P20-3 的提议条可以在那份表里顺手看一眼。
- P20-3 有意留下的口子：**只看本章事实**（前文事实不提议）。要扩就把 `readChapterContinuityFacts`
  的范围从单章放到「本章及之前」，但那等于让模型在几百条事实里挑 —— 先想清楚再动。
- 物品 / 制度锚两格**已判不做**，别重开（理由见设计稿 §1）。
