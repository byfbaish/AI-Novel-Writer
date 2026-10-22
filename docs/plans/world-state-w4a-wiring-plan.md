# W 线接续实施计划（作者已批准 2026-10-22）

> 依据：docs/handoffs/2026-10-22-world-state-w4-handoff.md · docs/design/architecture/world-state-review-and-wiring-plan.md §17–§19
> 分支：exp/world-state

## 目标与验收
1. **§11.7 五维齐备性检查**：世界观写库成功后，缺维/缺「起点：」行在步骤日志可见（不阻断、不改正文）；五维齐全不显示；存量手工补第 5 维不误报。
2. **W4a 三段流水线**：orphan 名字经「补全→提案→确认」落成字段非空的卡；结构上不可能产出空壳卡；写路径仍只有 approve→commitCharacterIdentities。
3. **W5 只读视图**：归位表（orphan/ambiguous/anchored/carded）+ 日序轴 + 角色六槽/来源 + 连续性事实；无 UPDATE/INSERT；story_day_offset NULL 显示「日序未知」不是 0。

不做：W4b schema、C1 一人多身份、正文抽名、归位表持久化、ambiguous 自动消解、任何迁移/新列/新表。

## 顺序
① §11.7（独立）→ ② 归位表读取（纯读）→ ③ 流水线（source/proof/stage/approve/命令）→ ④ W5 视图（W4a 唯一出口）。

## 阶段 1 · §11.7
- 新 src/shared/worldbuilding-completeness.ts：识别五维标题（兼容 `### N.【…】` / `## 标题` / 英文；照 architecture-projection.ts:47-55 与 space-constraints.ts:40-42 写法），第 5 维再查「起点：」行；返回 { missing, missingStartLine, unreadable }；`describeWorldBuildingCompleteness(result, language)` 措辞照 consistency-preflight.ts:256。
- 接线：src/services/workflows/commands/architecture.command.ts GenerateWorldBuildingCommand，writeArchToDb('worldbuilding', …) 成功且现有 callbacks.log 之后，追加 callbacks.log(描述)；不 throw/不改 result/不改 partial。
- 测试：zh 三维缺 4/5；五维齐备为空；缺起点行；标题变体；空文本 unreadable；英文。

## 阶段 2 · 归位表读取
- 新 electron/services/world-state-read.ts：readWorldState(db) 组装 W5；readCastLedger(db)：
  - characters：直接查 characters(character_id,name,retired) + character_aliases(全部行)，不用 CharacterRosterRepository.read（排除 retired、别名不全）。
  - anchors：CharacterCastDecisionRepository.current(db) 中 action==='register'；无 M08 表时 []。
  - mentions：review-state-delta（review-cycle-repository 新增 listCurrentReviewStateDeltaMentions(db)：每章最新 finalized 草稿，readReviewStateDeltaForDraft 且 status==='ok' && sameContent===true 才采信）；finalized-proposal（summary_snapshots.character_state_candidates[].characterName，章号=chapter_number）；blueprint（blueprints.characters JSON，章号=chapter_number；坏 JSON 跳过并计数）。
  - buildCastLedger + counts + unreadableMentions。
- 新 src/shared/world-state-view.ts（WorldStateView / 章节 / 角色状态 / 观测 / 连续性事实 / CastLedgerView；事实类型以 FinalizedContinuityProjection 为准）。
- src/shared/ipc-channels.ts 加 'world-state:read'（args [expectedProjectPath]）；electron/controllers/db-controller.ts 注册（assertRequiredExpectedProjectPath 后 readWorldState；未打开库返回空视图）。
- 章节轴用 SummaryRepository.listFinalizedContinuityBefore（storyDayOffset NULL 原样透传）；角色 currentState 为 null 显示未观测。
- 测试：三来源、别名、退休、锚点、ambiguous、sameContent=false 跳过、坏 JSON 计数、M08 前库；db-controller-project-context.test.ts 加该通道。

## 阶段 3 · W4a 流水线
### 设计裁决（与设计稿 A1 的差异）
设计稿写 `{ kind:'cast-ledger', names }`；实现改为 **先生成后 stage**，source = `{ kind:'cast-ledger', names, handle, artifacts: [{artifactId,revision,textHash}] }`。
理由：readEnvelope 每次重算 sourceProof 并深比较（character-proposal-service.ts:139-166），改 source 即改 proposalBatchId（:446）⇒ 旧批次永远 pending（判据 CX）；items 只能由 proof 派生（:203-223）。先补全再 stage ⇒ 不存在只带名字的可批准批次 ⇒ 结构性消除空壳卡。
附带：detail 产物 `currentState` 不写入新卡（CharacterStaticFields 无此字段；decodeCharacterDetails 也压成 updatedAtChapter=0）⇒ 新卡「未观测」，不伪造第 0 章状态。

### 类型与解析
- src/shared/character-proposal.ts：CharacterProposalSource 加 cast-ledger 档；CharacterProposalHistoryEntry.sourceGroup 加 'cast-ledger'。
- 新 src/shared/cast-ledger-completion.ts：parseCastLedgerCompletion(artifactTexts, expectedNames)：extractSingleCompleteJsonObject + decodeCharacterDetails；每 entry validateCharacterDetail + 名字逐字命中；合并后名字集合必须恰好相等（缺/多/重复 → CHARACTER_CAST_LEDGER_NAMES_MISMATCH）；产出 CharacterProposalItem（selectionKey 'cast-ledger:'+identityKey，sourceId 'cast-ledger:'+name，fields 去 slotId/currentState，relationships []）。

### 证明层
- 新 electron/services/cast-ledger-generation-proof.ts（照 legacy-roster-generation-proof.ts）：
  - source 键白名单 ['kind','names','handle','artifacts']；handle 键白名单 ['projectId','epoch','rootActionId','runId']；校验 projectId/rootActionId/epoch。
  - run.binding.sourceManifest.operation === 'cast-ledger-character-completion'；authorInputs 的 text 集合 === source.names 集合。
  - artifacts 1..64 唯一；每条 generation_artifacts + receipt（revision/textHash/textHash(text)、无 failureCode、status settled|unknown、finishReason 'stop'）。
  - proof：items、provenance {kind:'generated', modelRevision: manifest.modelReceipt.modelRevision, source:{projectId, epoch, sourceId: runId, revision:0, contentHash: sourceHash}}，sourceHash = textHash(JSON.stringify([canonicalSource, items]))；返回 { proof, currentHandle }。
- generation-character-proposal-proof.ts:68-87 分派加 cast-ledger。
- 错误码（CHARACTER_ 前缀可透出）：CHARACTER_CAST_LEDGER_SOURCE_INVALID / _ARTIFACT_INVALID / _NAMES_MISMATCH / _NAMES_REQUIRED / _PENDING_CONFLICT。

### 服务接线
- character-proposal-service.ts：stage() cast-ledger 分支（proof 归一化 + 同 names 集合的 pending 批次直接复用；相交但集合不同 → CHARACTER_CAST_LEDGER_PENDING_CONFLICT）；approve action 映射加 cast-ledger → 'adopt-generated'（:543-545）；historyLabel 加「来自归位表补全」；findCharacterProposalEvidence 直接委托 prove。
- main-generation-owner.ts:1263-1274 approve 的 handle 解析加 cast-ledger → readCastLedgerGenerationProof(...).currentHandle。
- src/services/character-proposal-history-client.ts:44/53 加 sourceGroup + label；character-proposal-preview.ts:48 加预览说明。

### 命令与工作流
- 新 src/services/workflows/commands/cast-ledger-completion.command.ts（照 character-card-generation.command.ts:33-116）：
  - executeWithGenerationRuntime('character-architecture', …, { operation:'cast-ledger-character-completion', promptKeys:['character_dynamics'], skillStages:['planning'], output:'structured-data', authorInputs: names.map((n,i)=>({id:`cast-ledger:name:${i}`, text:n})) })
  - 内部：requireWorkflowProjectSession；ipc 读 db:project-core-get / db:character-get-all / db:blueprint-get-all 组上下文；命中名字仍 orphan 才保留（stage 前过滤），剔除后为空优雅收场。
  - createStructuredBatchExecutor（照 architecture.command.ts:1790-1887）：最小 manifest [{slotId:'cast-1',name}]；detailSystem/detailContract/detailTask（src/services/prompt-language.ts:60-137 characterArchitecturePrompts）；decodeCharacterDetails；validateItem=validateCharacterDetail+名字在集合内；injectWritingSkillIntoSession(…,'planning')；maxBatchItems=CHARACTER_DETAIL_BATCH_SIZE。
  - 产物：receipt.attempts[].visibleArtifact 收集；要求 context.mainGenerationRunHandle + 至少一个 artifact，否则 CHARACTER_CAST_LEDGER_ARTIFACT_INVALID。
  - stage：ipc 'character-proposal:stage' 传 source；写 context.data.characterProposalBatch；callbacks.setProgress(100)。
- 新 src/services/workflows/cast-ledger-completion-workflow.ts：两段式（step1 命令；step2 requiresConfirmation 复用 CommitPlanningMaterialCharactersCommand + REFRESH_RESOURCE）。
- 入口在 W5 orphan 行：模型披露确认（照 CharacterCardGenerateButton.tsx:102-107）后 startWorkflow。

### 测试
src/shared/__tests__/cast-ledger-completion.test.ts、electron/__tests__/cast-ledger-generation-proof.test.ts、electron/__tests__/character-proposal-cast-ledger.test.ts、workflows 命令测试（名字剔除/无产物/stage 形状）。

## 阶段 4 · W5 视图
- 导航：src/stores/layout-store.ts:4 SidebarView 加 'worldstate'；src/components/layout/LeftToolWindowBar.tsx:22-26 sidebarActivities 加 { id:'worldstate', icon: Gauge, zh:'世界状态', en:'World state' }；Sidebar.tsx:34-56 加 viewTitle + render。
- 新 src/components/panels/sidebar/WorldStateView.tsx：调 'world-state:read'；四区（归位表 / 日序轴 / 角色六槽+provenance / 连续性事实）；orphan 两动作（补齐并建卡 / 提示去角色管理页登记锚点）；ambiguous 只列卡名；NULL 显示未知；unreadableMentions 显式提示。
- 硬边界：组件只允许 'world-state:read' + workflow 启动；无 approve、无写仓库。
- browser 测试：WorldStateView.browser.tsx（NULL→未知、orphan 排序、未配置模型不启动、只调用只读通道）。

## 验收
- 自动：ELECTRON_RUN_AS_NODE=1 <electron.exe> vitest.mjs run <新测试 + db-controller-project-context>；pnpm typecheck；组件测试。
- 手工：三维项目提示缺维、五维不提示；蓝图加两个名字→W5 orphan→补齐并建卡→字段非空→回 W5 消失；重复点复用同一 pending 批次；日序未知/未观测显示正确。
- 已知基线噪声（非本线）：视觉保真 2 例、package-contract GPU 2 例、main-generation-owner 全量超时、safe-delete 阈值 50。

---

## 实施结果（2026-10-22 · 四阶段全部完成）

| 阶段 | 结果 |
|---|---|
| ① §11.7 | `src/shared/worldbuilding-completeness.ts`（19 例）+ `architecture.command.ts` 写库后一行日志 |
| ② 归位表读取 | `electron/services/world-state-read.ts`（8 例）+ `src/shared/world-state-view.ts` + `world-state:read` 通道（db-controller 36 例含新通道） |
| ③ 流水线 | `src/shared/cast-ledger-completion.ts`（14）· `electron/services/cast-ledger-generation-proof.ts`（12）· `character-proposal-service` cast-ledger 分支（6）· `cast-ledger-completion.command.ts`（8）· `cast-ledger-completion-workflow.ts`（5） |
| ④ W5 视图 | `WorldStateView.tsx` + `world-state-view-model.ts`（19）+ render（3）+ browser（4） |

`pnpm typecheck` exit 0；定向 11 文件 134 例 + browser 4 例全绿。

### 与计划的偏差

1. **阶段 3 的 source 形状按「设计裁决」实施**（先生成后 stage，含 handle/artifacts），而非「只传 names」。
2. 阶段 4 的 `SidebarView` id 用 `'world-state'`、图标用 Compass（计划写 `'worldstate'` + Gauge）—— 内部命名，语义不变。
3. 阶段 3 的 `CHARACTER_DETAIL_BATCH_SIZE` 在 `architecture.command.ts` 未导出 ⇒ 新命令本地声明同值常量 3。
4. 阶段 4 计划里的「ambiguous 只列卡名」实现为「只列命中卡数」（`命中 N 张卡`）：视图层拿不到卡名（`WorldStateView` 的归位表条目只带 `characterIds`），不为此新增查询。
5. 手工验收（真实模型跑一遍）未在本轮执行，留待下一轮。

细则（裁决理由、偏差全表、验证命令、下一步）在交接文档 `docs/handoffs/2026-10-22-world-state-w4-handoff.md` §7。
