From: up-c3 · developer
To: 大肥鱼@主身
# C3 网络失败三因细分 · 设计案（卡 f5671e1e）

只读设计。基线 HEAD `1b5a4eff0`。全部行号为本轮 `sed -n`／`grep -n` 实测。

## §0 结论（先行）

1. 「新建诊断载体」不成立；「只扩 `transportDiagnosticReason` 也够」同样不成立——它在 `src/components/panels/ai-output-failure-presentation.ts:110`，是组件私有函数，只被本文件 `:166`、`:198` 两处调用；短细纲与编辑器扩写的失败文案根本不经它。要一份共用文案，落点只能是 `src/shared/`。
2. 未连上／中途断**不必新增字段**：`phase` 四态在主进程是真维护的（`electron/llm/openai-provider.ts:223`、`:251`、`:473`），失败快照在 `electron/services/generation-run-service.ts:333-336` 成型并到达渲染层（`src/services/workflows/workflow-main-generation.ts:57`、`:203`、`:207`）。缺的只是把 phase 读成第三桶的判定与文案。
3. 代理不可达**在本卡不可做**：代理配置只写成 `process.env.HTTP_PROXY`（`electron/controllers/llm-controller.ts:63-79`，派发前由 `electron/controllers/generation-controller.ts:130` 触发），而生成请求是裸 `fetch`（`openai-provider.ts:123`、`:217`）；全仓 `NODE_USE_ENV_PROXY`／`EnvHttpProxyAgent`／`setGlobalDispatcher` 命中 0。即代理开关今天对生成请求不生效，此时把 `ECONNREFUSED` 标成「代理不可达」＝把直连拒绝误报成代理故障。
4. 三处今天有三个文案所有者：正文/续写/大纲/审稿 → `transportDiagnosticReason`；短细纲 → `src/shared/chapter-failure.ts:129-135` 受控码 `DRAFT_SHORT_OUTLINE_FAILED` 的 `detail`；编辑器扩写 → `src/components/editor/CodeMirrorEditor.tsx:682` 固定句。

## §1 事实核（每条可复算）

| # | 断言 | 证据 | 用途 |
|---|---|---|---|
| 1 | phase 真四态 | `openai-provider.ts:182` 初值 `'request'`；`:223` 响应头到 → `'response'`；`:251` 拿到 reader → `'stream'`；`:473` → `'complete'` | 主判据 |
| 2 | 未连上时 `firstResponseMs` 必为 null | 首块字节才赋值 `:435-436`，`:223` 之前无赋值 | 双证据 |
| 3 | HTTP 失败另成一档 | `:230-231` `errorCode='HTTP_ERROR'`；状态码 `:224` | 优先级最高 |
| 4 | 三个超时码今天合并成一句 | `ai-output-failure-presentation.ts:126-128` | 细分收益点 |
| 5 | 失败诊断能到渲染层，无需新 IPC | `run-service.ts:333-336`；`workflow-main-generation.ts:57`／`:203`／`:207` | 不用改传输 |
| 6 | 短细纲诊断已进 activity，未进文案 | `generate-draft.command.ts:1439`（`draftingSession.complete` 返回 `outcome.receipt.diagnostics`）经 `workflow-main-generation.ts:203`／`:207` 落 `generationActivity`；抛点 `:1478-1481` 只带受控码 | 落点在呈现层 |
| 7 | 编辑器扩写诊断入库未上屏 | `main-generation-owner.ts:1262` 返回 `execute(...)` 的 outcome（`generation-harness.ts:168` 带 `diagnostics`）；`CodeMirrorEditor.tsx:680-682` 只给固定句 | 需适配器透传 |
| 8 | 代理未接入 fetch | §0.3 三处证据 | 代理档不可做 |

## §2 落点表（函数级）

**L1 新文件 `src/shared/transport-failure-copy.ts`**
`describeTransportFailure(diagnostic, locale): { bucket: 'http' | 'not-connected' | 'interrupted'; text: string } | undefined`。
判定顺序：`endReason !== 'failed'` → `undefined`；`errorCode === 'HTTP_ERROR' || httpStatus >= 400` → `http`；`phase === 'request'` → `not-connected`；`phase === 'response' | 'stream'` → `interrupted`；其余 → `undefined`（交调用方兜底）。
码级文案逐字沿用 `ai-output-failure-presentation.ts:115-133` 现六句（`UND_ERR_BODY_TIMEOUT`／`UND_ERR_HEADERS_TIMEOUT|UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT`／`STREAM_INCOMPLETE`／`STREAM_INVALID|RESPONSE_BODY_MISSING`／`UND_ERR_SOCKET|ECONNRESET|ERR_STREAM_PREMATURE_CLOSE`），码未命中时用 bucket 级引导句：`not-connected`＝「连接未建立，请求未到达模型服务。」`interrupted`＝「已连上服务，响应中途中断。」；`http` 保留 `:130-131` 原句。
文案沿用既有 inline 双写（`locale === 'zh-CN' ? … : …`），不引 i18n 资源。

**L2 `ai-output-failure-presentation.ts:110-134`** → 换成 `return describeTransportFailure(diagnostic, locale)?.text`。`:166`、`:198` 两处调用与 `??` 兜底**一字不改**。

**L3 同文件新增短细纲分支**（位置：`:182` 超时分支之后、`:198` 传输分支之前）
`failureCode === CHAPTER_FAILURE_CODES.DRAFT_SHORT_OUTLINE_FAILED` 且 `activityDiagnostics` 有桶时，`reason = chapterFailureMeta(code).detail + ' ' + bucket.text`；词表 `detail` 字段不动——符合 `chapter-failure.ts:12-16` 规则 2「detail 只写现象，不写归因」，归因句只进呈现层。

**L4 `CodeMirrorEditor.tsx:680-682`**：失败分支先取 `receipt.outcome.receipt.diagnostics`，有桶则显示 `describeTransportFailure(...)?.text`，取不到保持今日固定句（现状不变）。

**L5（同一卡内，+3 行）`src/services/editor-inline-generation.ts` `execute()`**：返回值显式带 `diagnostics`，不让下游去摸 `outcome.receipt` 的形状；只是类型与一处赋值。

**为什么不选「只在 components 里扩」**：短细纲文案源在 `src/shared/chapter-failure.ts`，编辑器在另一棵组件树；留在组件里必然第三次复制，与「文案只许一份」直接冲突。

## §3 代理不可达：不可做，理由与替代物

- **判法 A（请求侧打标）**：给 diagnostics 加 `proxyEnabled`，`phase==='request'` 且 `ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT` 时标 `PROXY_UNREACHABLE`。硬前提是代理真的生效；今天不生效（§0.3），该标记要么永假，要么必误报。**不可做。**
- **判法 B（呈现层读 `proxy.enabled`）**：呈现是同步纯函数，读配置要 IPC 异步；配置还可能在该请求之后被改过，形成竞态误判。要动 `ai-output-failure-presentation.ts`、`CodeMirrorEditor.tsx`、`ipc-channels` 类型三处，误判面反而更大。**不可做。**
- 根因不在呈现层，不能靠文案补。**替代物**：文案只写事实句——「连接被拒绝」「无法解析主机」「连接超时」，不夹代理归因；把 `proxyEnabled` 记入件内作为追因线索。
- **前置独立卡**：让代理真正接入生成请求（正规 dispatcher 或 `net.fetch`，`llm-controller.ts:63-79` 不再只写环境变量）。该卡落地并实测到达代理后，本方案再加第四桶 `proxy` 与 `proxyEnabled` 字段——那时判据才有构造基础。

## §4 判据修正版

| 编号 | 标签 | 判据 | 命令／断言 |
|---|---|---|---|
| 1 | [static] | 四桶表驱动：每桶两个代表码 × 两 locale，返回 bucket 与文案 | `pnpm test src/shared/__tests__/transport-failure-copy.test.ts`，贴整文件汇总行 |
| 2 | [static] | 既有六句逐字不回归（L2 变形不动文案） | `pnpm test src/components/panels/__tests__/ai-output-failure-presentation.test.ts`，贴 `Tests N passed (N)` |
| 3 | [mock] | 三处共用同一份：短细纲与编辑器扩写各一例，构造 diagnostics 注入，断言输出句与 L2 完全一致 | `pnpm test` 三文件；行为断言为主，`grep -c '读取响应流超时'` 只剩一处作旁证 |
| 4 | [mock] | 优先级：`failureCode=GENERATION_CALL_TIMEOUT` 时不出网络桶句；`HTTP_ERROR` 时不出连接句 | 同判据 3 文件内的定向断言 |
| 5 | [static] | 不新增依赖、不牵 i18n | `git diff --stat` 无 `package.json`、无 locale 资源 |

**不可靠构造，明说**：「真·未连上」与「真·中途断」不靠真实网络构造——用 diagnostics 直接构造即可覆盖全部判定分支，真实网络只留一条 [live] 冒烟（可执行，不作判据）。代理档不可构造，理由见 §3；替代判据是前置卡的开工核验：[live] 把代理指向 `127.0.0.1:1` 后生成仍成功 ⇒ 证现代理未接入。

## §5 改动面与量级

- 新增：`src/shared/transport-failure-copy.ts` ≈70 行；`src/shared/__tests__/transport-failure-copy.test.ts` ≈90 行。
- 修改：`ai-output-failure-presentation.ts` −25／+14（含 L3 分支）；`CodeMirrorEditor.tsx` +6；`editor-inline-generation.ts` +3。
- `src/components` 命中 **2 个文件**，不是 1 个：与 C4「`src/components` 一次性更换」直接冲突。C4 未落地前动这两处会被换壳覆盖；顺序由 admin 裁定，本卡不自认。
- 不碰 i18n 资源；不新增依赖；不改 `generation-contract.ts`（字段够用）。

## §6 风险

- R1 文案回归：`:166`（审稿）与 `:198`（正文/大纲）共用同一函数，改壳须保序保字，判据 2 钉住。
- R2 超时抢档：`GENERATION_CALL_TIMEOUT` 判定必须在网络桶之前（`:182-192`），新函数不得插到 `:182` 前。
- R3 abort 改写：`run-service.ts:333-336` 会把 `endReason` 改写为 `failed` 并叠 `failureCode`；桶判定只读 phase＋码，超时不会被读成中断。
- R4 口径重叠：`prompt-budget-failure.ts:116` 的 `NETWORK_FAILURES` 按 failureCode 分类、不产文案，本卡不动；两处并轨属另一卡。
- R5 既有红：`legacy-project-copy-import.test.ts` 7 例在 `1b5a4eff0` 上本就红（既有红单列，不计入判据）。

## §7 自查

- `grep -rn 'NODE_USE_ENV_PROXY\|EnvHttpProxyAgent\|setGlobalDispatcher' --include=*.ts --include=*.mjs src electron scripts` → 无命中（exit 1）。
- `grep -rn 'ProxyAgent\|dispatcher\|http-proxy-agent' --include=*.ts electron/llm electron/utils` → 无命中（exit 1）。
- `grep -n 'diagnostics.phase = ' electron/llm/openai-provider.ts` → `223`／`251`／`473` 三行，与 §1.1 一致。
- `grep -n 'transportDiagnosticReason' src/components/panels/ai-output-failure-presentation.ts` → `110`／`166`／`198`，与 §0.1 一致。
- 派单 §2 四个禁语词的 grep 计数为 0（本行不重述原词，免得自指命中）；语料原文、密钥、PII 未写入。
