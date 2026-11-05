# 交接：D 系列缺陷晚间班 —— D20 已落地、D20b 在跑、D13 待裁

> 交接基准：2026-11-05 22:10（Asia/Shanghai）· 分支 `exp/resource-ledger` · 主线 HEAD `9f53509c` · 工作区干净
> 最后一班：20:00–22:10（作者裁定 → 落地 → 派活 → 复核）
> 三条主线：**D20（模板指纹误报）已实施并合并** · **D20b（模板段收窄）豆包在 wt-1 做，未回** · **D13（失败契约）方案稿已出，三条裁定待答**
> 相关稿：[`d20-checkpoint-template-fingerprint-design.md`](../design/architecture/d20-checkpoint-template-fingerprint-design.md) · [`d13-chapter-failure-contract-design.md`](../design/architecture/d13-chapter-failure-contract-design.md) · [`d8-checkpoint-degradation-design.md`](../design/architecture/d8-checkpoint-degradation-design.md) · [`d6-volume-count-source-design.md`](../design/architecture/d6-volume-count-source-design.md) · 缺陷总表 [`live-pipeline-acceptance-defects-assessment.md`](../design/product/live-pipeline-acceptance-defects-assessment.md)

---

## 〇、三十秒版本

**D20 收口了。** 作者裁定「模板变化不该被报成源事实变化，优先做」，豆包在 wt-1 实施（`7f18caa2`），我独立复核通过后合并（`eef01325`）。做法：检查点指纹拆成「源事实 / 模板」两段，`combined` 仍按原来四段拼（逐字不变 ⇒ 存量检查点不失效），两处判定点改逐项比较，报文六支。

**D20b（模板段从整对象收窄到影响渲染的 4 段）正在 wt-1 跑**，卡 `45ef0936`，豆包已认领（`running`，22:05 起）。它改的是「什么算模板变了」这条判据；D20 本体只做到「报错说真话」。

**D13 方案稿已出但未开工**。核心发现是三条旧「建议方向」全不成立，其中第 2 条把 D8 裁定 2 的问法整个改了：不是「`mainOwned` 下要不要留恢复候选」，而是「唯一留候选的那条分支，生产里根本走不到」。

---

## 一、这一班落了什么（按提交）

| 提交 | 内容 |
|---|---|
| `1a30005d` | 裁定 3 = 世界观链**不改**；裁定 4 = §4.6 收窄**做**，作 D20b 单开一张卡 |
| `20caeab3` | `doubao-channel.md` §10 边界改写：认领 / 写报告 / 交 `review` / `release` 它可自做，`done` 与 `review --pass\|--rework` 仍归 Lead |
| `17d082b0` | **D13 方案稿**（经独立复核打回五处后修订） |
| `43330fa4` | 豆包手册补「该复用还是该新开」判据 + `--help` 会把整套 bootstrap 跑一遍 |
| `c5352381` | 豆包档位改回默认「中」，长任务用 nudge 而不是升「高」 |
| `7f18caa2` | **D20 本体实施**（在 wt-1，豆包做） |
| `eef01325` | `--no-ff` 合并 wt-1 到主线 |
| `9f53509c` | D20 稿状态行与缺陷总表同步（已实施 / 待实机复验） |

更早的同日晚间：`2cc5542b`（三条裁定落地）· `0bae5981`（D8 §10 + D20 裁定 A）· `dfefea0b`（D20 稿复核修订）· `1d8cd114`（逐章路径保留 + 旧检查点放行）· `81964be3` + `83b00e2a`（§4.6 提案及精度修正）。

---

## 二、六条裁定（原话口径，后续不许改写）

| # | 问题 | 裁定 | 作者理由（要点） |
|---|---|---|---|
| D8 语义 | 模板/检查点降级后怎么办 | **A：整批重来** | 「以前整批重来代价非常高，但现在我们是按单元的，代价可接受」 |
| D6 卷数来源 | 沿用旧裁定还是以本稿为准 | **以本稿为准**，取代 2026-10-19 的旧裁定（旧裁定原文保留在 `arc-budget-engine-design.md:4`，已加取代标注） | 「原先那个做法有一点公式主义，为了不一样而不一样」 |
| D20-1 | 只有模板变化时怎么办 | **A：允许续写** | — |
| D20-2 | 旧检查点怎么办 | **放行，不逼全书重来** | 「开新小说项目走的全是新检查点，旧的仅用来做实机验证，全书重来没有意义」 |
| D20-3 | 世界观链要不要一起改 | **不改** | 后果轻一个量级（一次调用 vs 全书重写）。稿子 §8.2 写死「将来要改另开缺陷条目，不要并进 D20 任何一张卡」 |
| D20-4 | §4.6 模板段收窄做不做 | **做，作 D20b，排本体之后** | 前置是 D20-2（否则存量检查点会一次性全失效） |

D17 已结项（`a698d60d` 走 `review --pass` 落 Done，判词注明是作者裁定非自判，因「`review` 拒同身份自审」）。
D8 §10.5 另记一条：**逐章路径保留**——小说配置若没选卷单元模式，压根不会出现「按单元」选项，只能按章节 From/To 写。

---

## 三、D20 本体：做了什么、怎么验的

### 3.1 代码落点

- `src/services/workflows/commands/architecture.command.ts`
  - `synopsisInputFingerprintParts(...)` 返回 `{ source, template, combined }`；**`combined` 仍按原四段拼**（`sourceInputs` / `stepGuidance` / `from:to` / `template`），这是存量检查点不失效的唯一原因，有单测钉死。
  - `PartialArchData` 新增两个可选字段（源事实 / 模板各一），**同时进了 `SYNOPSIS_CHECKPOINT_FIELDS` 与 `SYNOPSIS_CHECKPOINT_KEYS`**——漏一个会在 commit 失败回滚时新旧不一致。
  - 三处写入点一起落三份；`:3750` 用的是 `completedFingerprint` 那份**实际范围**，不是请求期 `:3273` 的。
  - 两处判定点改逐项比较 + `synopsisFingerprintDrift` / `synopsisFingerprintVerdict`，报文六支：`source` 拦 / `template` 放行+提示 / `both` 逐项说明 / `unknown` 拦 / `legacy`（旧检查点）放行且**不提**「源事实已变化」 / `none` 静默。
  - 4 处复述旧结论的文案与注释，唯一用户可见的是 `ArchitectureConfirmDialog:792`。
- 测试：新增 3 + 5 个用例，改写 2 个断言旧文案的用例，**未删任何断言**。

### 3.2 复核是怎么做的（不要看报告，看证据）

1. 在 wt-1 自己跑 4 个测试文件：**145 tests 全绿**（architecture.command 62 / plot-outline-batch 47 / synopsis-unit-launch 26 / synopsis-unit-batch 10）。
2. wt-1 里 `node scripts/check-fast.mjs` 全绿（tsc + doc-links 1143 + doc-placement 382）。
3. 硬约束逐条查：`promptRenderSignature` **全库无出现**（没顺手实现 §4.6）；`world_building_result` 只出现在新增回滚测试里当守卫（没碰世界观链）；`combined` 仍是四段拼。
4. `git diff` 里被删掉的 `expect(` **为 0 条**——只增测试，没放宽断言。
5. 两个看着越界的文件（`ProjectTree.tsx` / `project-clear-service.ts`）实为注释改写，正是方案稿 §4.5 那 4 处。

`review --pass --agent workbuddy:reviewer`，`handedBy=doubao`，两个身份天然不同，没撞「拒同身份自审 exit 3」。

### 3.3 遗留观察（非阻断）

`unknown` 分支（指纹不等但两个分项都没变）会**拦**，文案说检查点可能被外部改过。这与原方案稿口径一致，但属于「不知道该信谁就拦」的保守选择；若实机遇到，先怀疑是不是又出现了第五种漂移源，别急着放宽。

---

## 四、D20b 进行中（下次接着看）

- 卡 `45ef0936-beb4-4ab4-b149-207aea59e113`，标签 `external` + `I2`，状态 `running`（22:05 认领）。
- 工作目录 `C:\develop\workspace\AI-writer\wt-1`，分支 `agent/wt-1`，**基线 `7f18caa2`**（wt-1 当前 HEAD 就是它，尚未快进主线的 `eef01325` 等文档提交——不影响，全是 docs）。
- 交付物：`promptRenderSignature(template, language)` 只哈希 `content` / `taskGuidance` / `systemRole` / 内置 `systemSuffix`；`combined` 算法**不许动**，只改 `template` 分项的值。
- 报告落点：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\45ef0936-*.md`。
- **接法**：卡上出现 `review` 标签 ⇒ 以 `workbuddy:reviewer` 跑 `review --pass|--rework --kind --note`，判词只对卡上那几条验收标准；通过后合并 wt-1，并把 `d20` 稿状态与缺陷总表同步。
- **前置已完成**，不要再等本体。

---

## 五、D13：三条裁定待答（本班只出稿，没开工）

稿子：`docs/design/architecture/d13-chapter-failure-contract-design.md`，状态 `待裁定`。

### 5.1 一句话结论

不是三个 bug，是**一条链上没有失败契约**：正文层 10 处抛点 + 主进程 4 处 + 组装层 4 处，约 8 个码，**但码全在 `message` 里、不带 `code` 字段**（`fail()` 就是 `throw new Error(code)`），于是 `recoveryFailureCode` 一律兜底成 `GENERATION_FAILED`；跨 IPC 还会再丢一次。

### 5.2 三条被推翻的旧结论（缺陷稿原文已就地标注失效并保留）

1. **「续写结果没参与 compose 判定」—— 错。** 它逐字参与（`:2034` 的 `mergedDelta`）。第 3 次失败的真实路径是「accepted → acknowledge → compose `:531` 才判没变长」，不是「没被消费」。另注意 `noProgress` 还要求 `finishReason=length`，退化要 `REPEAT_MIN_COUNT=3`。
2. **「丢弃前留草稿」代码在但生产走不到。** 条件是 `!mainOwned`，而 `mainOwned` 在生产恒真（三个调用点都不注入 `dependencies`）。
3. **范围写小了**：3 处 → 18 处。

另修一处读反：组装层 `:526` 的 `text` 到 `:533` 才更新，它判的是**压缩前**正文，语义是「这次压缩请求本来就不该发生」，不是「压缩后仍超上限」。

### 5.3 三条裁定（建议值已写在稿子 §7）

| # | 问题 | 建议 |
|---|---|---|
| 1 | 失败契约做不做 | **B**（发码 + 保码 + 汇聚出口）；但 **§5.4 跨 IPC 取码必须先验通**，没验通 A 和 B 都是空的 |
| 2 | 恢复候选那条死分支 | **A**（让生产也留候选），但**必须与 D8 裁定 2 合并答**——两处问的是同一件事，分两次答会给出互相矛盾的结论 |
| 3 | 组装层 4 个码拆不拆 | **A**（拆 4 个），`:526` 必须按 §5.3 改名 |

### 5.4 划界（写实施卡时必须原样带上）

D13 只承诺「**一旦有人判它失败，失败得有身份**」。**不许**顺手加超时 / 心跳 / run 终态兜底——那是 D9 与 D2 甲的地盘。

---

## 六、还欠着的裁定（都不阻塞 D20b）

| 出处 | 待答 |
|---|---|
| D8 裁定 2 | `mainOwned` 下要不要留恢复候选 —— **与 D13 裁定 2 是同一件事，要一起答** |
| D8 裁定 3 | 同屏章数取 5 还是 10 |
| D8 裁定 4 | 决策点做不做 |
| D6 裁定 2 | 每卷章数区间取多少 |
| D6 裁定 3 | 存量库怎么办（是 D6 方向 A 开工的前置） |

---

## 七、环境与陷阱（本班真踩到的，下次别再踩）

1. **`bootstrap.mjs` 没有 `--help` 分支**（`:63-67` 只用 `argv.includes`），未知参数被静默忽略 ⇒ 拿 `--help` 当「看用法」会真建线程、真切模式档位。**查状态一律 `--check`。**
2. **豆包任务该复用窗口**：`--keep` 复用当前线程、不重读章程。判据：同一张卡 / 后续追问 / 只补切项目档位 ⇒ `--keep`；换不相干的新任务才新开。
3. **档位默认「中」**。手册 §10 原话就是「`--effort 中` 足够，只有审核发现幻觉严重才升「高」」。中档做一件就收工时用 `say "继续执行 Tn…"` nudge，**不是加档**。
4. **`get <taskId> --json` 顶层是 `{ task: {...} }`**（`list` 才是 `{ ledgerId, revision, tasks }`）。直接取 `.title` 会 `undefined`。
5. **卡面描述里有反引号必须用文件传参**（`--prompt-file` / `--description "$(cat file)"`），直接拼进 bash 会被当命令替换吃掉内容。
6. **多行 `git commit` 一律 `-F -` + heredoc**。PowerShell here-string（`@'...'@`）在 bash 下会变成字面量 `@` + 空行。
7. **wt-1 里禁 `pnpm test:node`**（`prepare:native-node` 会把 `better-sqlite3` 切回 Node ABI，打断所有槽位的 dev）。只准 `node node_modules/vitest/vitest.mjs run <file>`。
8. **派活前先看 wt-1 的 HEAD**：卡面写的行号只在快进之后才对得上。

---

## 八、下次开工先读什么

1. 本文 §四（D20b 是否已回、怎么复核合并）。
2. 要动 D13：先读稿子 §5.4（跨 IPC 取码先例在 `src/services/workflows/structured-batch-executor.ts:172` 的 `PROTOCOL_CODE_MESSAGE`），并且**先验通再往下做**。
3. 要动检查点指纹：`d20` 稿 §4.1（两个名单）、§3.1（三处写入点）、§4.3；红线一句——**加检查点字段必须同时改 `SYNOPSIS_CHECKPOINT_FIELDS` 与 `SYNOPSIS_CHECKPOINT_KEYS`**。
4. 世界状态 / 失效线 / 资源账本等外围：见 `.workbuddy/memory/MEMORY.md` 的主题索引表。
