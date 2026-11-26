# 上游「吸收候选包」（2026-11-26，按主人三条裁定改判）

- 出件：developer（只读分析；不写生产码、不 commit 生产码、不 push）
- 判据：「不吸收」必须建立在我方已做独立取舍之上（`upstream-not-absorbed-20261126.md` §0）；**本件取其反面**——凡拿不出独立取舍凭证、或凭证之外仍缺的能力，全在这张包里
- 口径补件：`.batch/night/staging/upstream-reabsorb-addendum-20261126.md`（人类 11-26 23:28，C2／C3／C5 三条裁定与两栏口径）
- 读数命令：`git rev-list --count 549522d4..HEAD -- <path>`／`git rev-list --count 549522d4..upstream/master -- <path>`；改动量命令 `git diff --stat 549522d4 upstream/master -- <path>`

## 1. 候选包（一簇一行）

| 簇 | 路径 | 我方／上游 | 吸收什么（函数级） | 按我方接口的适配点 | 代价 | 前置 |
|---|---|---|---|---|---|---|
| **C2a** | `src/services/draft-index.ts` | 3／6（上游砍 **171** 行） | 定稿章重开编辑 → 替换后提示「后续内容不会跟着改」；合并视图按修稿自己的循环说复验 | 我方 `chapter-workflow.ts` 状态转换 ＋ `DraftEditor.tsx` 提示位；**不吸「删掉我们仍在用的索引」那一半** | S/M | —（主人已定「需要」） |
| **C3** | `src/services/workflows/commands/legacy-character-roster-repair.command.ts` | 1／12（上游 −288/+26） | 上游那次改用 model-routing／`pinWorkflowModel` 的整体重构，**一次性整体吸收** | 我方无 `pinWorkflowModel`，先在 `electron/llm` 做等价档位解析；`d57b380c8` 的 `legacy-roster-generation*.ts` 四件保留，阶段判定并进来 | M | —（一次收口，不分期） |
| **C5** | `package.json` 依赖 | — | `better-sqlite3 ^13.0.3`、`electron ^44.9.3` 同卡升级 ＋ 全量原生重编 | 五步串行表与回滚路径见不吸收件 §1.12；我方独有 `@electron/rebuild` 是重建必需 | M | worktree 槽位全停 |
| D5a | `.claude/skills/verify/references/issue-scenarios/`（65 条） | 0／0（非代码） | 不搬运行时，只借结构：`issue 号 → 可复现场景 → 判据` 的文件组织与写法 | 落 `.batch/night/` 下验收资产目录，不改 `src/` | S | — |
| B9 | `src/shared/writing-skills.ts` | 1／11 | 引用去重键＝**解析后路径**（非字面量）；install manifest 优先；角括号链接非阻塞 | 我方 `writing-skills.ts` 类型与错误码，重写 3 个纯函数＋单测 | S/M | — |
| B5 | `electron/vector-store.ts` | 15／14 | `fullTextTerms`／`fullTextFilter`／`rankFullText`（中文相邻二元组＋BM25）＋ `openLanceDatabase` 单入口＋表格式钉住＋生成入口去重 | 我方 `vector-store.ts:179` `connectionPool`、`:202` lancedb 目录 | M | — |
| B6＋B7 | `electron/knowledge-base.ts`／`electron/controllers/kb-controller.ts` | 13／13 · 10／26 | `rankPassages` 重排＋`RerankConfig`（含 `kind:'none'` 降级）＋候选池常量＋KB 配置 IPC 形状 | 我方 KB 服务接口＋`src/shared/ipc-channels.ts` 通道表 | M | **B5** ＋ rerank 端点 |
| B1＋B2 | `electron/services/model-discovery-service.ts`／`electron/llm` | 4／9 · 19／45 | ①超长报错→真实上下文窗口 ②显式选档才发推理参数、自动档映射 off ③Anthropic cache 用量归集 | 我方 `prompt-budget-failure.ts` 的 `provider-context` 分类；各 provider reasoning 映射；usage 记账 | M | — |
| B3a | `electron/repositories/import-run-repository.ts`（阶段计划半） | 25／11 | **第三份计划表** `authorWithInference`（`global→style→blueprints` 插在 `author-postprocess` 后）＋`authorInference` 冻结 flag 落库读回＋运行索引候选查找＋删中间章后全书可写 | 我方已有阶段机（`import-run-orchestrator.ts:135 stagesFor` 两份静态表、`src/shared/import-run.ts:22-32` 11 值枚举），接入点＝换成共享 `importStagesFor`＋加一列 run flag；**不新造阶段机** | **M**（原 L 作废） | 一页 flag 落库方案（含迁移列） |
| B4 | `src/services/workflows/import-run-orchestrator.ts` | 10／21 | 阶段推进前先判取消的顺序、`stopIfCancelled` 守卫位置 | 挂我方阶段推进点，不搬其阶段枚举 | S/M | **B3a** ＋ 取消卡 `1630c44b` |
| B8 | `electron/services/editor-inline-generation.ts` | 1／18 | **不进本包**：多批注内联生成走新功能立项（批注锚点 UI 契约、请求 IPC、单次成本、与现有生成链关系） | — | L | 产品立项 |
| D2 | `docs/assets/`（44 条） | 1／0（非代码） | 只取换壳后需要的界面素材 | — | S | **C4 已裁更换，随期 1 取图** |

**C1 不进本包**（也不在任何排期里）：主人 11-26 原话「不要、不排期」，admin 23:37 订正——补件 §3 曾把 C1 排进线序是负责人沿旧排期的笔误、已作废。既有取消卡 `1630c44b` 是我方自己的取消与失败分离工作（19 处抛点），与吸收上游 `llm-store` 改动不是一件事。

## 2. 排序（我方改动量从小到大，再叠依赖）

簇改动量取该簇主路径区间笔数（多路径取最大）：**D5a 0、B9 1、C2a 3、B4 10、B6＋B7 13、B5 15、B1＋B2 19、B3a 25**；C3／C5 不是「我方改动量」意义上的簇（C3 我方 1 笔但吸收的是上游 288 行重构；C5 是依赖面），按主人裁定的线序排在后面。

| 序 | 簇 | 代价 | 前置 | 备注 |
|---|---|---|---|---|
| 1 | D5a | S | — | 纯文档资产，不动代码 |
| 2 | B9 | S/M | — | 我方该文件只 1 笔 |
| 3 | C2a | S/M | — | 主人定死「需要」，收益最直接 |
| 4 | B5 | M | — | 必须在 B6＋B7 之前 |
| 5 | B6＋B7 | M | **B5** | 数字比 B5 小，被依赖压到其后 |
| 6 | B1＋B2 | M | — | 与 B5 无交集，可并行 |
| 7 | B3a | **M** | —（先出一页方案） | 原估 L 作废：不新造阶段机 |
| 8 | B4 | S/M | **B3a**＋取消卡 | 数字小，被前置压到最后 |
| — | D2 | S | **C4（已裁）期 1** | 换壳启动后随期 1 取图 |
| — | B8 | L | 产品立项 | 独立轨，不排进吸收序列 |

## 3. C2／C3／C5 落地顺序与 owner（负责人 23:28 定，照抄）

| 序 | 卡 | owner | 依据 |
|---|---|---|---|
| 1 | **C2** 吸收上游砍掉的 171 行草稿索引能力（按我方接口） | workbuddy 线 | 独立于豆包线，可先起；判据已由主人定死「需要」 |
| 2 | **C3** 一次性吸收 −288 行 model-routing 重构 | 豆包线 | 一次收口，单卡单会话，不拆期 |
| 3 | **C5-pre** 服务层错误码化 → **C5** 依赖跟随（含 ABI 串行窗口） | 豆包线 | 先铺 pre 才有可见收益；动 ABI 一步全仓串行 |
| 已裁 | **C4** 视觉层换壳（473 相对分叉点／**553 HEAD 对上游，排工按 553**） | — | **已裁：一次性更换**（负责人 11-26 23:45 转述主人 23:37）；porcelain 0 起卡 ＋ 回滚 tag `pre-ui-rd-swap-20261126` → `2880a05be` |

**C1 不在此表**：主人「不要、不排期」；补件 §3 的 C1 行是负责人沿旧排期的笔误，已订正作废（admin 11-26 23:37）。

排 C2 在 C3 前：C2 不碰 ABI、不碰 workflow 抛出链，与 C3／C5 无前置；C3 与 C5-pre 同线，必须一前一后（同线不并开两张卡）。

## 4. 建议起卡顺序（B／D 簇，可与 §3 的两条线并行）

1. **卡 1 · D5a 场景资产骨架（S）**——只建目录与两篇样板场景，验证写法是否适配我方验收流程；不改代码。
2. **卡 2 · B9 Skill 引用解析（S/M）**——3 个纯函数＋单测，改动面最小。
3. **卡 3 · B5 全文检索（M）**——新增 `full-text-search` 纯模块＋连接单入口，B6／B7 的地基。
4. **卡 4 · B6＋B7 rerank 与 KB 配置（M）**——前置卡 3；另需产品确认「要不要 rerank」（我方当前无 rerank 端点）。
5. **卡 5 · B1＋B2 provider 适配（M）**——与卡 3 并行，三处改动各自带单测，不引入 stage 路由。
6. **卡 6 · B3a 阶段计划并入（M）**——**先出一页方案**（flag 落库形态＋迁移列＋`author-manuscript` 下两表选择时机），过审再实装；两份现有计划表逐字不动。
7. **卡 7 · B4 取消守卫（S/M）**——前置卡 6 与取消卡 `1630c44b`。

并行关系：卡 1／2／3 互相独立；卡 5 与卡 3 可并行；卡 4 必须等卡 3；卡 6 单独一线（先方案）；卡 7 最后。

## 5. 不进本包的（留「不吸收」栏，凭证见另件）

B3b（可恢复导入／效应围栏，我方 25 笔）· **C1（主人裁「不要、不排期」）** · C2b（删无人调用函数那半，我方在三处 import）· 非代码 D1／D3／D4／D6／D7／D8／D9／D10（各带我方 sha）。C4 已裁一次性更换（负责人转述主人 11-26 23:37），排工按 553；其素材 D2 随换壳期 1 取，仍不进本包。
