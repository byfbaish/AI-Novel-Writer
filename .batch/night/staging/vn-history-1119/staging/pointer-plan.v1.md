# 判件指针化方案 v1（developer · 11-16）

输入：`org/process-efficiency-1116.md`（3,178B｜`af92a826c446177a536fac0def8275ea`｜43 行，主人 18:5x 最高优先级②）。
目标：消除「每轮重新自证现行版本」导致的发言膨胀（版本号 31% / 哈希 19% / 字节行数 29% / 过时作废纠错 12%）。
本件只做技术方案与可执行落法，不代定业务拍板项；实现不早于负责人 21:00 定案。

## 1. 结论（先给结果）

- **手写 `CURRENT.md` 不成立**：等于把「每轮自证」换成「记得改指针」；忘改/并行写/回退时读者读到旧版且无机制会响，失效面大于现状。
- **采用：脚本派生 + 脚本机检的 `CURRENT.md`**（全名 `org/CURRENT.md`，见 §5.3）。指针只由脚本写；读不到或与盘不一致即 `exit≠0` 硬失败；**禁回落旧快照**（`generated` 回退 → `REGRESS` 非零退出）。消息里只引 `CURRENT@<generated>`（快照时间戳），不再逐条报哈希/字节/行数。
- 组内消息降噪；**对外投出件（卡面/派验单/信号）仍带绝对路径与哈希，一字不减**——外部执行方读不到组内脚本，指针不改流转件证据链。

## 2. 候选评估与剔除（答不出 QA a/b/c 的直接删）

| 候选 | 机制 | a) 谁写/谁回读 | b) 失效时读者读到旧版还是读不到 | c) 用后是否还得再报哈希 | 结论 |
|---|---|---|---|---|---|
| A 手写 `CURRENT.md` | 人工维护五行现行值 | 人写、人自证，无第二人/机检 | **读到旧版**（忘改/并行覆盖/回退均无声） | 读者仍须自查哈希才敢信 | **删**（a/b/c 均不满足） |
| B 台账内「现行区」 | 挂在 `task-ledger.vN` 段落 | 台账写手写，无机检 | **读到旧版**且自指+滞后（台账并入晚于盘） | 仍须报台账版本与哈希 | **删** |
| C 消息只写版本名不写哈希 | `名册 v3.19 / 台账 v67…` | 无新增写入，靠对方纠 | **读到旧版**（新旧同形，回放无法区分，正是 12% 纠错源） | 不再报，但 b 失败 | **删（不单独用）**；其「不写哈希」并入 D 的消息格式 |
| **D 脚本派生 `CURRENT.md`**（推荐） | 脚本扫盘现算并写；`--check` 现算再比对 | **脚本写；机检回读**（任何人可跑 `--check`，QA 开判前跑、投出方投前跑；非零退出＝不一致） | **读不到**：文件缺失/`self` 不匹配/与派生结果不符 ⇒ `exit≠0` 硬失败；回退 ⇒ `REGRESS` 非零退出；绝不回落旧快照 | **不需要**。消息只写 `CURRENT@<generated>`；哈希/字节/行数只在 `CURRENT.md` 内，由一次 `--check` 覆盖 | **采纳**（与 C 消息格式组合） |

判决原则：要的是「现况的可复算快照」，不是「某个人说现况是什么」。A/B 把自证搬到一个文件但错了不响；D 搬到命令上，错了会响。

## 3. 机制设计（D）

### 3.1 扫描键与现行判定
- 扫描根：`.batch/night/`（脚本按自身位置推导绝对根，指针内只写相对该根的路径）。
- 键与模式：
  - `ledger`   ← `reports/task-ledger.v*.md`
  - `roster`   ← `roster/identity-roster.v*.md`
  - `card`     ← `cards/<task>.v*.md`（按 `<task>` 分组）
  - `review`   ← `review-requests/<task>.v*.md`（按 `<task>` 分组；兼容无 `.vN` 的历史件，视为 `v1` 并 `WARN`）
  - `precheck` ← `staging/<task>-precheck-*.v*.md`（按 `<task>` 分组）
- 现行判定（防「读到旧版」）：
  1. 读各文件首行状态：`状态：现行|留档|作废`（见 §5.1）。同键同 `<task>` 中取 **最新且状态=现行** 的一份。
  2. 无状态行时退化为「版本号最大者」并输出 `WARN no-status:<path>`（不阻断，但写入指针供复核看到）。
  3. 同键同版本多文件 ⇒ `DUPLICATE`，`exit 2`；不得静默择一。
  4. `generated` 早于盘上已有 `CURRENT.md` 的 `generated` ⇒ `REGRESS`，`exit 2`（**禁回落旧快照**）；需强制回退时必须先删旧指针并由负责人显式授权，不纳入脚本自动路径。

### 3.2 指针文件形态（脚本生成，禁手改）
路径：`.batch/night/org/CURRENT.md`（建议，待定案；脚本以 `--out` 可配，默认此路径）。

```
# CURRENT（脚本生成，禁手改；--check 不一致即非零退出）
generated=2026-11-16T20:50:00+08:00
ledger   version=v67   path=reports/task-ledger.v67.md           bytes=195126 lines=790 md5=96a0dfe37976f0db19c85bf251a76834
roster   version=v3.19 path=roster/identity-roster.v3.19.md      bytes=36680  lines=363 md5=f3276aec4a663ea21de5ab29cffa85ad
card     key=d1-delivered-path version=v5 path=cards/d1-delivered-path.v5.md       bytes=14183 lines=117 md5=e8a797f435f659873fe97bb5d305aba6
review   key=d1-delivered-path version=v3 path=review-requests/d1-delivered-path.v3.md bytes=8288  lines=63  md5=a064f4c327ab244782c2cbdd5dabce56
precheck key=d1-precheck-1117  version=v4 path=staging/d1-precheck-1117.v4.md          bytes=8305  lines=117 md5=7f4348e70c13a85f50b1347cec3afb5c
self=<sha256 或 md5: body(除 self 行外) 的摘要>
```
- `self` 对 body（不含 `self=` 行）现算；手改任一字段不改 `self` ⇒ `--check` 报 `SELF_MISMATCH`；伪造 `self` 仍被派生对比挡住（派生值≠盘上值 ⇒ `MISMATCH:<key>`）。两层都要过才算一致。
- 消息引用格式（组内）：`判件基准：CURRENT@2026-11-16T20:50:00+08:00`。只写时间戳；需要细节时才展开到具体 key。

### 3.3 脚本与命令（可复算、QA 复跑同值）

脚本：`.batch/night/scripts/current.mjs`（node，零依赖，读文本按 UTF-8，行数按 `\n` 计；CRLF 统一归一后计哈希与字节以避免平台差，输出 `bytes_raw`/`bytes_norm` 两列可选——v1 先用 `bytes_raw` 与 `md5(raw)` 与现行口径一致）。

```bash
# 生成/刷新（任何人可跑；无唯一写手）
node .batch/night/scripts/current.mjs --write

# 机检：与盘现况逐键比对，且校验 self 与 generated 不回退
node .batch/night/scripts/current.mjs --check
# 退出码：0=一致；1=文件缺失/读失败；2=MISMATCH|SELF_MISMATCH|REGRESS|DUPLICATE；3=参数错误
# stdout：每个 key 一行 OK/MISMATCH/WARN；stderr：失败原因；末行 summary

# 机器可读（供复算/CI）
node .batch/night/scripts/current.mjs --json

# 指定输出路径（默认 org/CURRENT.md）
node .batch/night/scripts/current.mjs --write --out .batch/night/org/CURRENT.md
```

复算判据（写死）：
- 分母/样本：`CURRENT.md` 中列出的 key 集合（即当次派生选中的现行件）；不含 `WARN` 以外的隐含件。
- 一致：`--check` 退出码 0，且 stdout 无 `MISMATCH/REGRESS/DUPLICATE/SELF_MISMATCH`。
- QA 复跑：在同一工作树、同一 commit 快照下运行 `node .batch/night/scripts/current.mjs --check`，退出码与 stdout key 集逐字同值（因派生自盘，盘不变则结果不变）。

### 3.4 谁写、谁回读（a）

| 动作 | 执行者 | 回读/机检 | 证据 |
|---|---|---|---|
| 产出新版本流转件 | 该件写手（照旧） | 写手投前跑 `--write && --check` | `--check` exit 0 |
| 组内引用现况 | 任一成员 | 消息只写 `CURRENT@<generated>`；不再自报哈希 | 时间戳可与 `CURRENT.md` 第2行比对 |
| 开判/收口 | QA | 开判前跑 `--check`；若非 0 则**拒绝开判**并报失败 key | `--check` 原文（stdout/stderr+exit）入判词 |
| 定案/换基准 | 负责人 | 定案前跑 `--check` | 同上 |

不存在唯一写手；**机检是第二只眼**，满足 a)。

### 3.5 失效时的可见性（b）——读不到，不读旧

| 失效 | 表现 | 读者结果 |
|---|---|---|
| `CURRENT.md` 不存在/不可读 | `--check` exit 1 | **读不到**，不得凭记忆判件 |
| 任一 key 的 md5/字节/行数与盘不符 | `MISMATCH:<key>` exit 2 | **读不到一致态**，必须先 `--write` 刷新或修盘 |
| 手改指针 | `SELF_MISMATCH` 或 `MISMATCH` exit 2 | 同上 |
| 盘上回退/旧件冒充现行 | `REGRESS` exit 2；状态行可挡「留档误升现行」 | **禁止回落旧快照** |
| 并行产出同版 | `DUPLICATE` exit 2 | 需先消歧（另存 `.v(N+1)`） |

任何非 0 退出 = “当前没有可信指针”，流程上等价于读不到；不允许回退去读上一份 `CURRENT.md` 或凭群消息哈希补救。

## 4. 与派验流程的关系（冲突与不冲突）

- **不变**：投出件（卡面/派验单/信号）继续写绝对路径＋哈希＋字节＋行数；派验单「报告贴三元组原文」仍是交付物证据；D-1 这类已定稿件一个字节不回溯。
- **变化**：组内讨论/判件引用只写 `CURRENT@<generated>`；QA 由“逐条复核消息里抄的哈希”改为“开判前跑一次 `--check`”。复核从 N 人×N 轮降为 投出方 1 次 + QA 1 次（必要时负责人 1 次）。
- **c) 结论**：组内不再重报哈希；交付物证据内的哈希保留。两者分属不同对象，不冲突、也不翻倍。

## 5. 落地清单（定案后执行，约 1 小时）

1. 新增 `.batch/night/scripts/current.mjs`（`--write/--check/--json/--out`，node 零依赖）。
2. **状态行**（改模板，需负责人点头）：卡面/派验单/核对单/名册/台账首行加 `状态：现行|留档|作废`。不改也能跑（退化为取最大+`WARN`），改了才能机械化表达回退/留档。
3. 首次生成：`node .batch/night/scripts/current.mjs --write && node .batch/night/scripts/current.mjs --check`，将 `org/CURRENT.md` 作为组内现行快照。
4. 消息规则补一句（进 `GROUP-RULES.md` 由 developer 起草时纳入）：组内引用现况写 `CURRENT@<generated>`；对外投出件维持原三元组。

## 6. 待拍板（不代定）

1. 状态行是否纳入模板（影响回退场景是否可机械判定）。
2. `CURRENT.md` 落点确认：建议 `.batch/night/org/CURRENT.md`（与本方案/主人文件同目录，易定位）。
3. `self` 摘要算法：`md5`（与现行口径一致）或 `sha256`（更抗碰撞）；v1 建议 `md5` 以复用现有心智，字段名写 `self_md5=`。

## 7. 度量（对齐主人基线，写死口径）

| 指标 | 基线（12:00–18:30, 1754 条） | 目标 | 复算命令/时点 |
|---|---:|---:|---|
| 含 32 位哈希的消息占比 | 19% (338/1754) | <5% | 同主人台账脚本、同窗口；每 2h 随无@基线复算 |
| 含字节/行数的消息占比 | 29% (506/1754) | <8% | 同上 |
| 含「旧回合/过期/作废」的消息占比 | 12% (215/1754) | <4% | 同上 |
| 指针一致性 | — | `--check` exit 0 | `node .batch/night/scripts/current.mjs --check`（投前/开判前/每 2h） |

判据用词仅「占比 ≤ x%」「退出码 0/非 0」；不出现「合理/尽量/视情况」。
