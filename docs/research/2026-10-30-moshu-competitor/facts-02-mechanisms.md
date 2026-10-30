# 墨枢 · 关键机制与契约常量

> 状态：事实梳理（2026-10-30）· 配套 [`assessment.md`](assessment.md) · 上承 [`facts-01-architecture.md`](facts-01-architecture.md)
> 本文只记**机制怎么做、常量是多少、以及自述与代码的落差**。行号相对原件解包根 `moshu-main/server/`。
> 标注约定：✅ = 代码已交叉验证 ／ 📄 = 仅见于文档自述，抽样未证实 ／ ⚠️ = **文档与代码不一致**

---

## 1. 四层上下文预算 ✅

`memory/assembler.py`

| 层 | key | 预算 | 内容 |
|---|---|---|---|
| L1 | `resident` | 40,000 | `codex_entries.resident = true` 的设定条目，**全量**加载 |
| L2 | `retrieved` | 40,000 | 非 resident 条目，精确别名 + pgvector 召回 |
| L3 | `summary` | 56,000 | 章摘要 / 卷摘要（`document_summaries`） |
| L4 | `adjacent` | 72,000 | 最近正文 |

- 常量位置：`:165-168`；层权重 `{"resident": 40, "retrieved": 40, "summary": 56, "adjacent": 72}`（`:130`），空余预算按此比例借出。
- 硬顶：`max_context_tokens = 208_000`（`:95`），注释原文「208K is the tested material ceiling. Larger provider windows do not silently increase cost and latency until they have their own evals.」（`:108-111`）
- 可用额公式：`model_window − reserved_output(32k) − safety_margin(16k)`（`:105`）
- 四档：`ContextMode = Literal["smart", "fast", "standard", "deep"]`（`:85`）；`smart` 按材料量在 64k/128k/208k 弹性。
- `ContextLayer` 带 `trim_reason`，装配结果可解释到"这一层为什么被裁"（`:72-82`）。
- 装配结果 `AssembledContext` 暴露 `layer1_resident / layer2_retrieved / layer3_summary / layer4_adjacent` 四字段，直接进 `PromptPackage.layer_report` 给前端看。

**设计意图（文件头原话）**：「装配顺序和字节稳定性直接影响 prompt cache 命中率」。

---

## 2. Claim 模型：一致性的原子单位 📄（schema 已建 ✅）

`consistency_claims`，文档 §4.3 定义，`db/models_consistency_extended.py` 落地：

| 字段 | 语义 | 值得注意处 |
|---|---|---|
| `subject_entry_id` / `subject_text` | 已解析实体 / 未解析时的原文 | **允许解析失败**，不因此丢弃 claim |
| `predicate` | 受控键：`location` / `alive` / `owns` / `knows` / `ability_level` | 受控词表，不是自由文本 |
| `object_type` / `object_value` / `object_entry_id` | 标量或另一实体 | |
| `polarity` | 肯定/否定 | 否定是一等公民 |
| `certainty` | `explicit` / `inferred` / `uncertain` | **uncertain 不产生 high severity** |
| `source_kind` | `codex` / `body` / `outline` / `resolution` | 四类来源分开记账 |
| `chapter_id` / `body_rev` / `outline_rev` | **来源版本三件套** | claim 绑版本，不绑"当前" |
| `timeline_id` / `story_order` | 可空；`numeric(24,8)` 稀疏值 | **故事时间 ≠ 章节序号** |
| `valid_from_order` / `valid_to_order` | 事实有效区间 | 时态区间，不是快照 |
| `extractor_version` / `confidence` | 可重跑、可校准 | |
| `fingerprint` | 规范化 claim 哈希 | 去重键 |
| `status` | `candidate` / `accepted` / `rejected` / `superseded` | **旧版本不删除，只 superseded** |

唯一键：`(source_kind, chapter_id, source_rev, fingerprint, extractor_version)`。

**核心命题（文档 §4.3 首句）**：每条 claim 是「**某来源声称某事实**」，不是直接覆盖设定库。这是它整个设计的地基——事实有来源、有版本、有极性、有确定性、有时效区间，所以才能"改一章只重算受影响的"。

---

## 3. 故事时间与章节序号的分离 📄

这是它比多数同类产品做对的一件事：

- `story_events.story_order numeric(24,8)` 是**故事世界里的顺序**，不是"第几章"。
- 「插章、拆章或移动章节不会重排已有事件」。
- 「两个已确认事件之间用**稀疏中点**分配顺序值；空间不足时只重排同一 `timeline_id` 的事件和状态区间，单事务完成」。
- 倒叙 = 故事顺序与章节 `idx` 的**差值**，不能用 `idx` 代替。
- 无法可靠确定 ⇒ 保持 NULL，只进待确认列表，**不跑依赖时序的硬规则**。
- 多线叙事按 `timeline_id` 隔离，只有存在已确认跨线锚点时才比较。

落地：`services/timeline.py`（560 行）+ `services/temporal_reflow.py` + `services/temporal_decisions.py`。确定性解析只支持 ISO-8601 形状与有限相对表达（`次日`/`过几日`/`一个月后`/`半小时后`），模糊区间必须作者定点。

---

## 4. 七类确定性规则 ✅

`services/rule_scanner.py`，逐个函数已核：

| # | 规则 | 函数行号 | `issue_type` |
|---|---|---|---|
| 1 | 生死冲突（时间线区间重叠） | `:641` | `alive_conflict` |
| 2 | 物品归属冲突（同时刻不同归属） | `:692` | `ownership_conflict` |
| 3 | 知情边界违规（先用后知） | `:751` | `knowledge_boundary` |
| 4 | 同一具名事件的可靠时间锚点冲突 | `:801` | `timeline_conflict` |
| 5 | 能力边界（先使用、后获得） | `:836` | `ability_boundary` |
| 6 | 双重地点（同一可靠时刻） | `:890` | `location_conflict` |
| 7 | 伏笔逾期（进度超过预计回收章未回收） | `:950` | `foreshadow_overdue` |

三条工程细节：

- **timeline-aware**：`story_order` 为 NULL 时**跳过**需要时序的规则，不猜。
- **fingerprint 去重**：`compute_issue_fingerprint(issue_type, identity_keys)`（`:489`），SHA-256(排序后的证据键)。
- **不变证据重扫幂等**：指纹已知且证据未变 ⇒ **完全不写行**（`7af84ac`）。作者标 `false_positive` 的不会被重扫复活。
- **影响集裁剪**：按新旧实体 ID / 未解析主体 / 谓词族召回关联 claim，**超过 500 键自动退回全项目扫描**，返回 `claims_scanned` + `scan_scope` 供观察降级（`:298`）。

---

## 5. 证据锚点契约 ⚠️（规范完整，实现断了一环）

文档 §4.4 规定的锚点五件套：

| 项 | 规范 | 代码状态 |
|---|---|---|
| `paragraph_id` | 单个 ProseMirror 文档内唯一，跨普通编辑稳定 | ✅ 已写入（`rule_scanner.py:1241`） |
| `start_offset` / `end_offset` | **UTF-16 code unit**，与浏览器/ProseMirror 坐标一致 | 📄 列未见于写入路径 |
| `quote` | 原文摘录 | ✅ 已写入（`:1242`、`:1293`） |
| `quote_hash` | **`SHA-256(UTF-8(NFC(quote)))`**，不折空白、不换标点 | ⚠️ **列已建（`models_consistency_extended.py:331`、`001_initial.py:635`），全库 `services/` 零写入** |
| `anchor_version` | 为将来换坐标算法留位 | 📄 同上 |

`guard_issue_evidence.side` 三值：`expected` / `actual` / `context`。

**为什么这条落差重要**：`quote_hash` 的唯一用途是"判断这条证据指向的原文是否还是同一段"。没有它，正文改版后只能靠 `body_rev` 判 stale，无法判「新版本里这句话**字面未变**」⇒ 每次保存都会把证据整体标 stale。它的 IMPLEMENTATION_STATUS 确实只写了"✅ 证据锚点写入"，没写"哈希校验"——**两份文档分工是诚实的，但不交叉验证就会误判**。

---

## 6. 检索分层 📄（文档五级，代码确认到第二级）

文档 §7 的五级降级（成本/确定性从低到高）：

| 级 | 手段 | 代码状态 |
|---|---|---|
| 1 | 显式 `CodexRef` + 中文别名 NFC 规范化后等值命中 | ✅ `services/retrieval.py:154 resolve_entity_by_alias_l2`、`:190 _resolve_exact_entity_l2` |
| 2 | 全文候选：别名子串、**BM25 / trigram** 找拼写变体 | ⚠️ **零实现**：全库 grep `trigram|bm25` 仅命中 `_cosine_similarity`；文档 §12 将它列为 **P1** 未做 |
| 3 | SQL 时态规则（受控 predicate） | ✅ 见 §4 |
| 4 | 向量兜底：pgvector `<=>` top-k，按项目/类型/章节范围过滤 | ✅ `retrieval.py:225 retrieve_similar_entities_l3`、`:293 cosine_distance` |
| 5 | LLM 仲裁：`conflict` / `no_conflict` / `uncertain` | ✅ `services/arbitration.py` |

两条纪律（文档 §7 原话）：

- 「向量相似**不能**作为冲突证据」—— 向量只负责"找出候选"。
- 「生成侧追求**相关且有用**，Guard 侧追求**可证实且可复现**。两者不能共用一个未经区分的 top-k 结果。」

---

## 7. 创作侧：章内五拍 + 8 变体引擎 + LRU 去重 ✅ ★

这是它**唯一有实质内容的创作机制**，也是最值得对照的一处。`services/writing_skills.py`（529 行）。

### 7.1 章内"五拍戏剧蓝图"（按百分比定位）

由 `_build_chapter_blueprint` 生成，原文照录（`writing_skills.py:257-270`）：

```
【本章五拍戏剧蓝图｜只用于写作前内部规划，不得把拍名或自评写进正文】
章节功能：{engine}；冲突载体：{carrier}。
章纲锚点：以已注入的本章章纲中的具体人物、地点和目标为事实锚点
近期已用结构：{最近 4 章的 engine/hook}
1. 入场压力（前10%）：让具体人物在正在做的事上立刻遇到可见阻力，禁止先讲背景。
2. 对手升级（约25%-45%）：有自身利益的对手主动加码，改变条件或夺走一项资源。
3. 策略失效（约55%-70%）：用一个可观察事件击穿主角原计划，不能只靠'却/突然'宣布变化。
4. 选择与代价（约70%-90%）：主角亲自选择较坏的两个选项之一，立即失去关系、资源、名誉、时间或安全中的至少一项。
5. 章尾追读债（最后一小段）：{hook_shape} 只留下一个下一章必须回答的具体问题；不总结、不预告、不把钩子解释完。
去重要求：不能复用近期章节的开场压力、冲突载体、破局方式、代价来源或钩子落点；即使事实相近，也要换人物关系或行动机制。
落笔前默写五拍的具体人物/对象/动作，正文只呈现故事，不得输出'开场压力、策略失效、钩子'等工程标签。
```

**三个设计选择值得记**：

1. **拍子放在章内，不放卷纲层**。它没有"卷级节拍"，卷只是容器。所以永远不会出现"一拍一句话撑爆卷纲"的问题——因为拍子根本不进卷纲。
2. **百分比是硬定位**（前10% / 25-45% / 55-70% / 70-90% / 最后一段），不是"大约要有个转折"。这让我方 `story-beat-library` 的"拍子到单元层为止"结论有了一个反向样本：**章内可以给结构，但给的必须是章内结构**。
3. **末句防泄漏**：「不得把拍名或自评写进正文」「不得输出'开场压力、策略失效、钩子'等工程标签」。这是从实测失败反推的条款——模型会把工程标签抄进正文（正对我方"例子会被逐字抄成内容"的同一条病）。

### 7.2 八个"故事引擎"（`CHAPTER_VARIATION_CATALOG`）

每条 5 字段：`engine` / `carrier` / `hook` / `hook_shape` / `instruction`。

| engine | carrier（冲突载体） | hook（钩子类型） |
|---|---|---|
| 公开对峙 | 名誉与围观者的判断 | 倒计时 |
| 移动追索 | 正在转移的人、物或路线 | 未完成动作 |
| 关系交换 | 盟友的援手与附带条件 | 关系威胁 |
| 资源争夺 | 正在减少的粮、钱、位置或时间 | 两难选择 |
| 身份错位 | 与身份或旧记录矛盾的证物 | 身份偏差 |
| 密室调查 | 受限空间里的证据缺口 | （证据缺口类） |
| 对手先手 | — | — |
| 情绪决裂 | — | — |

文件注释原文：「These are deliberately different story engines, rather than cosmetic scene labels.」

### 7.3 去重是**确定性 LRU**，不靠模型自觉

`_select_variation_profile`（`:101-190`）按 `(engine 用过的次数, 是否等于上一章, hook 用过的次数)` 三元组排序取最小 ⇒ **least-recently-used 的 engine+hook 组合**。

三条注释值得抄：

> Keeping the choice in one place is important: the prompt contract and the internal five-beat blueprint must describe the same chapter, otherwise a model can satisfy one and accidentally ignore the other.

即：**"选哪个引擎"和"五拍蓝图"必须是同一次计算的产物**，否则模型能满足一个、忽略另一个。这与我方"同一个 prompt 里绝不能有两套结构并存"是同一条教训的另一种表述。

另有章纲显式指定通道：正则从章纲节点里解析 `章末钩子（xxx）`，作者可覆盖自动选择（`:240-246`）。

### 7.4 两个 base skill

| id | version | 内容要点 |
|---|---|---|
| `base.novel.zh` | 1.1.0 | 中文商业小说协作作者；服从已确认设定与章纲；**回忆前事用故事内锚点，不得说"第四章里"/"上一章中"** |
| `craft.dramatic-motion` | 1.1.0 | 「小说首先写人，不写办事报告」；场景七环核对（入场状态→目标→阻力→策略→转折→选择/代价→离场状态）；**禁止连续多段只做登记/核验/复称/解释权限/罗列数字** |

`craft.dramatic-motion` 里那张"办事报告"禁用清单（登记、核验、复称、保管、交接、凭据、责任、封存、时辰、费用、文书、袋号、阅卷、副本、条款、编号、写入、复核、见证）**与 `generation_coverage.py:26-44` 的 `_PROCEDURAL_TERMS` 逐词对应** —— 条款和检测器共用一份词表，说明这条病是它实测撞出来的，不是想象的。

---

## 8. 覆盖报告：两层，都不下语义结论 ✅

`services/generation_coverage.py`（889 行）。文件头原话：

> The checks intentionally avoid claiming semantic certainty. **Prompt checks prove that author-authored requirements reached the model package; draft checks only surface lexical evidence and leave the final judgement to the author.**

| 层 | 入口 | 证明什么 | 不证明什么 |
|---|---|---|---|
| `stage="prompt"` | `build_prompt_coverage`（`:143`） | 作者写的要求**确实进了 prompt 包** | 模型有没有照做 |
| `stage="draft"` | `assess_draft_coverage`（`:824`） | 草稿里**找得到**对应的字面证据 | 语义是否兑现 |

具体检查器（抽样）：

- `_outline_dramatic_requirements`（`:196`）：从章纲抽戏剧要求
- `_scene_contract_specificity_checks`（`:266`）：场景卡是否够具体
- `_narrative_vitality_checks`（`:319`）：叙事活力
- `_ending_hook_evidence`（`:388`）：章尾钩子的字面证据
- `extract_dramatic_fingerprint`（`:475`）：戏剧指纹（用于跨章相似度）
- `_recent_chapter_similarity_checks`（`:521`）：**与近期章节相似度** → 防套路循环
- `_structural_quality_checks`（`:610`）：结构质量
- `_dramatic_contract_checks`（`:693`）：戏剧契约兑现

标记词表（`_TURN_MARKERS` / `_HOOK_MARKERS`）是中文实词枚举，如转折侧 `却/但/没想到/突然/直到/原本/改口/拒绝/答应/发现/暴露/扣住/拦住/失去/转身/反悔/被截/落空`。

**这套东西与我方 `generation_coverage` 同名同构**（我方文档里的"规划覆盖报告"，区分「规划已进入提示词」与「候选中找到字面证据」）。两边独立得出同一结论，说明这不是谁抄谁，而是**从同一个观察必然导出**：prompt 里写了 ≠ 模型照做了。

---

## 9. 仲裁 fail-open ✅

`services/arbitration.py`：

- 只在 RuleScanner **已持久化确定性告警之后**异步跑，不阻塞规则告警生效。
- 只从 claim 绑定的**不可变 `ChapterVersion`** 与 `P<n>` 锚点取证，单条原文最多 **600 字**。
- 每批 **20 个 case**。
- 输出严格三值：`supported` / `unsupported` / `uncertain`。
- **fail-open**：「任何模型结论都不自动关闭规则告警，`unsupported` 只向作者提示'可能误报'」。
- 模型建议**不参与** issue fingerprint、`issue_rev`、自动处置。
- 调用模型前**释放数据库事务**；网关失败/畸形/漏项显式记 `failed`，规则告警仍 open。

---

## 10. 写边界契约（可靠性工程，不是我方稀缺项）

| 机制 | 实现要点 |
|---|---|
| 乐观锁 | 正文 `base_rev` 严格相等，**小于或大于都 409**；冲突响应含服务端最新版本 |
| API 幂等 | `user_id + route + Idempotency-Key`，存请求 hash + 响应，保留 24h；key 相同 hash 不同 ⇒ 409 |
| Transactional outbox | 唯一键 `topic + aggregate_id + aggregate_rev`；**不 commit 前投递，也不只在 commit 后直投**（前者 worker 读不到新正文，后者崩溃漏任务） |
| Dispatcher | `FOR UPDATE SKIP LOCKED` 批量领取 + `lease_owner/lease_until`；**投递时不持锁**；明确承认"sent 未落库之间崩溃仍会重复投递，**消费者幂等键才是最终保障**" |
| 任务键 | `extract:{chapter_id}:{body_rev}:{pipeline_version}` 等四类版本化键 |
| 错误码 | `OUTLINE_REVISION_CONFLICT` / `BODY_REVISION_CONFLICT` / `BODY_POLICY_REQUIRED` / `STALE_SOURCE_REVISION` / `ISSUE_REVISION_CONFLICT` |
| 稳定段落 id | TipTap 节点持久化 `data-paragraph-id`，重复/缺失锚点在保存前自动修复 |

这七条都是**为多实例服务端付的税**。单进程桌面应用里，`outbox`/`dispatcher`/`lease` 三项的复杂度换不到对应的收益——但「乐观锁 + 幂等键 + 版本三件套」这三条与形态无关，桌面同样需要。

---

## 11. 它自己的评测门槛（值得记的诚实数字）

| 项 | 数字 | 自我限定 |
|---|---|---|
| 结构化评测集 | 280 正例（七类各 40）+ 140 hard negative（每类 20）+ 20 easy negative = **440** | 「输入仍是人工构造的结构化 claim」 |
| 结果 | recall 100%、macro recall 100%、证据定位 100%、hard-neg precision 100%、额外告警 0 | **「不能据此宣称生产就绪」** |
| 目标门槛 | recall ≥70%、误报 ≤20%、证据定位 ≥90% | 达标的却是 100%，因为夹具是合成的 |
| 真实正文盲评 | **未完成** | 「夹具不是正文，无法衡量 LLM 能否从隐含、否定、转述和长距离上下文中正确抽取 claim」 |

Hard negative 的定义值得抄（文档 §11）：

> 「**共享实体和相似表述，但因条件、时间、视角或状态演变而不冲突**的配对」。例：「不擅长用剑」vs「危急时勉强拔剑」、「四月开始融雪」vs「四月底山阴仍有残雪」、「左肩旧伤遇寒痛」vs「服药后症状减轻」。
> 「它们必须和正例**走同一候选召回路径**，才能真实衡量误报；明显无关文本只能作为 easy negative，单独报告，不能稀释误报率。」

这段是整份材料里方法论最硬的一处：**误报率的分母怎么取，决定了这个数字有没有意义**。
