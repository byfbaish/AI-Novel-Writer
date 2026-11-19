# 判件指针化方案 v2（developer · 11-16 20:4x）

输入：`org/process-efficiency-1116.md`（3,178B｜`af92a826c446177a536fac0def8275ea`｜43 行）。
v1 存档不动：`staging/pointer-plan.v1.md`｜10,809B｜`76edbd09e289c51704a9e5f4c5f969aa`｜132 行。
本版按 QA 四条必补项重写 §2（现行判定），并按负责人 20:3x 拍板：**状态行列为必做，`WARN no-status` 改为 exit 2**。

## 1. 结论（不变）

- 手写 `CURRENT.md` 不成立（忘改/并行/回退时读到旧版且无机制会响）。
- 采纳 **脚本派生 `CURRENT.md` ＋ 脚本机检**；消息只引 `CURRENT@<generated>`；对外投出件仍带绝对路径＋三元组，一字不减。
- **现行判定只认文件自带状态行**；任何形式的「猜现行」（取最大版本号、旁车声明、mtime 最新）一律删除——猜不到就 `exit 2`。

## 2. 现行判定（v2 核心）

### 2.1 状态行是唯一现行来源（必做）

- 卡面／派验单／核对单／名册／台账，**首行必须是** `状态：现行` 或 `状态：留档` 或 `状态：作废`（三者之一，正则 `^状态：(现行|留档|作废)$`）。
- 脚本判定：同键同任务中取唯一 `状态：现行` 的一份为现行。
- 硬失败分支（全部 `exit 2`，不阻断即视为漏洞）：
  - `NO_STATUS`：键内存在候选件但没有任何文件带状态行（含首行不是该正则、带 BOM、前置空行）。
  - `AMBIGUOUS`：同键出现两个及以上 `状态：现行`（**禁取最大版本号消歧**）。
  - `STATUS_MALFORMED`：状态行存在但不在首行／取值不在三值内／一行多值。
  - `DUPLICATE`：同键同版本多文件。
  - `REGRESS`：新 `generated` 早于盘上 `CURRENT.md` 的 `generated`（禁回落旧快照）。
- `留档`/`作废` 的件只被列出、不进现行；`作废` 额外在指针里留一行 `void=<version>`，供判件人识别「这版是被否掉的」。

### 2.2 迁移成本（如实写，不藏）

今天实测 `^状态：` 计数：卡面 v5＝1，台账 v67＝0，名册 v3.19＝0，派验单 v3＝0，核对单 v4＝0。

→ **启用即需各出一版带状态行的新件**：台账 `v68`、名册 `v3.20`、派验单 `v4`、核对单 `v5`（旧版不动、标留档，作为交付物原样保留）。
→ 补版前，脚本对这些键如实 `exit 2 NO_STATUS`（表示「该键尚无可信现行声明」），**不回落旧快照、不按文件名猜**。补版顺序建议：名册 → 台账（判件最常用）→ 派验单/核对单（下次出件时顺带带上，避免为加一行而单独出一版）。

## 3. 对 QA 四条与负责人拍板的逐条落实

### ① 状态行不是可选项 → 已改必做（§2.1）
- `WARN no-status` 分支删除；`exit 2 NO_STATUS`／`AMBIGUOUS`／`STATUS_MALFORMED` 三条新判据写入脚本。
- 不再有「取最大版本号」：删掉了，连降级分支都没有。

### ② 熔断路径（写死）

| 退出码 | 含义 | 可熔断 |
|---|---|---|
| 0 | 指针与盘一致 | — |
| 1 | 文件缺失/读失败 | **可** |
| 2 | 一致性失败（NO_STATUS/AMBIGUOUS/STATUS_MALFORMED/MISMATCH/SELF_MISMATCH/REGRESS/DUPLICATE/CONCURRENT_CONFLICT） | **不可** |
| 3 | 环境/参数（无 node、路径不可达、参数错、持锁超时） | **可** |

- 合法熔断＝**直读盘上原件**：`md5sum`＋`wc -c -l`＋`grep -c ''`＋`tail -c1|od`，逐件报原文值。
- **不得**回读任何历史 `CURRENT.md`（含上一版）。
- 熔断必须显式标注并计数：消息首行 `熔断:direct(exit=<n>) 原因=<一行>`；进指标 4。
- `exit 2` 不适用熔断：指针与盘矛盾时先修，选边等于把「读到旧版」制度化。

### ③ 计数口径钉进脚本（三列并存，禁人算）

- `lines`＝文件内 `\n` 个数（等价 `wc -l`）
- `lines_rec`＝`\n` 个数 + (末字节≠`0a` ? 1 : 0)（等价 `grep -c ''`）
- `tail`＝末字节十六进制；`bytes`＝`wc -c`；`md5`＝raw 字节 md5

今日实测锚（我 20:29 复算）：

| 文件 | `^状态：` | `lines` | `lines_rec` | `tail` |
|---|---:|---:|---:|---|
| `reports/task-ledger.v67.md` | 0 | 790 | 791 | `82` |
| `roster/identity-roster.v3.19.md` | 0 | 363 | 363 | `0a` |
| `cards/d1-delivered-path.v5.md` | 1 | 117 | 117 | `0a` |
| `review-requests/d1-delivered-path.v3.md` | 0 | 63 | 63 | `0a` |
| `staging/d1-precheck-1117.v4.md` | 0 | 117 | 117 | `0a` |

→ 台账 790/791 差＝末字节 `0x82`（UTF-8 续字节，非换行）；「335/337 行」式争议同源。指针两列都给，引用单列即错。

### ④ 同秒并发 `--write`
- 锁：`.batch/night/org/.current.lock`，`open(...,'wx')` 独占；持锁超 `--lock-timeout=5000ms` ⇒ `exit 3`。
- 写前重读盘（防读半写文件）；目标比对：
  - 不存在 ⇒ 临时文件＋`rename` 原子写。
  - `generated` 相同且 body 相同 ⇒ 幂等 `exit 0`。
  - `generated` 相同但 body 不同 ⇒ `exit 2 CONCURRENT_CONFLICT`，提示重跑（以盘为准重算，不合并、不覆盖）。
  - 目标为旧 `generated` ⇒ 覆盖，受 `REGRESS` 约束。

## 4. 指针形态与命令

```
# CURRENT（脚本生成，禁手改；--check 不一致即非零退出）
generated=2026-11-16T21:05:00+08:00
ledger   version=v68   path=reports/task-ledger.v68.md   status=现行 bytes=… lines=… lines_rec=… tail=0a md5=…
roster   version=v3.20 path=roster/identity-roster.v3.20.md status=现行 bytes=… lines=… lines_rec=… tail=0a md5=…
card     key=d1-delivered-path version=v6 path=cards/d1-delivered-path.v6.md status=现行 …
void     key=<task> version=v5 path=…   # 仅列作废件，不参与现行
self_md5=<body 除 self 行外>
```

```bash
node .batch/night/scripts/current.mjs --write      # 生成
node .batch/night/scripts/current.mjs --check      # 0/1/2/3 见 §3②
node .batch/night/scripts/current.mjs --json       # 供复算/CI
```

消息引用：`判件基准：CURRENT@2026-11-16T21:05:00+08:00`（只写时间戳）。

## 5. 谁写、谁回读 / 失效可见性

| 动作 | 执行者 | 机检 | 证据 |
|---|---|---|---|
| 产出新版本（带状态行） | 该件写手 | `--write && --check` exit 0 | 否则不得投出 |
| 改状态（现行↔留档/作废） | 该件写手＋负责人一句话（换基准时） | `--check` | 输出原文 |
| 组内引用 | 任一成员 | 只写 `CURRENT@<generated>` | 与指针第 2 行可对 |
| 开判/收口 | QA | 开判前 `--check`；非 0 拒判（1/3 走熔断并标注） | 原文入判词 |

失效可见性：缺状态行/两版都写现行/状态行位置错/失配/回退/重复/并发冲突 ⇒ **读不到一致态**，不回落旧指针；唯一例外＝exit 1/3 熔断（直读原件、显式标注、计入指标）。

## 6. 度量（三项目标＋熔断计数）

| 指标 | 基线 | 目标 | 复算 |
|---|---:|---:|---|
| 含 32 位哈希消息占比 | 19%(338/1754，该分母已被负责人作废，改用同源 ledger 窗口口径) | <5% | 同源 `who+text`、排除 notice、按窗口过滤 |
| 含字节/行数消息占比 | 29% | <8% | 同上 |
| 含「旧回合/过期/作废」占比 | 12% | <4% | 同上 |
| 熔断发生次数 | 0（未启用） | ≤2/周且每条有 `exit` 码与原因 | `grep -c '^熔断:direct'` |
| 指针一致性 | — | `--check` exit 0 | 投前/开判前/每 2h |

## 7. 成本

- 开判前：`--check` 1 条，替代手跑 `md5sum`＋`stat`＋`wc`＋`grep -c ''` 3~4 条 ⇒ 净降。
- 投出方：+1 条（`--write && --check`）；因状态行必做，出件时多写 1 行，属一次性模板改动。
- 一次性：脚本（约 1 小时）＋ 台账 v68／名册 v3.20 两版迁移。

## 8. 待拍板（不代定）

1. 迁移顺序确认：名册 v3.20 → 台账 v68 先做，派验单/核对单随下次出件带状态行（避免为一行单独出件）。
2. 状态行放首行还是第 3 行（首行最容易被判件人看到，但会影响现有「头两行 From/To」的判件习惯；建议：**首行状态行，第 2–3 行 From/To**，脚本只认首行）。
