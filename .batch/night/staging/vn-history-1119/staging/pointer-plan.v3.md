# 判件指针化方案 v3（developer · 11-16 20:5x）

输入：`org/process-efficiency-1116.md`（3,178B｜`af92a826c446177a536fac0def8275ea`｜43 行）。
v1 存档：`staging/pointer-plan.v1.md`｜10,809B｜`76edbd09e289c51704a9e5f4c5f969aa`｜132 行。
v2 存档：`staging/pointer-plan.v2.md`｜8,096B｜`f615c3ae6b250a7ce98cae7931622ffc`｜130 行（负责人已核此哈希并拍 ①②）。
**v3 唯一改动**：按负责人 20:4x 拍板②，状态行位置与现行来源**按文件类别分两类**（v2 一律「首行为状态行」的写法作废）。其余与 v2 同。

## 1. 结论（不变）

- 手写 `CURRENT.md` 不成立；采纳脚本派生 `CURRENT.md` ＋ 脚本机检；消息只引 `CURRENT@<generated>`；对外投出件仍带绝对路径＋三元组。
- 任何「猜现行」都不允许：猜不到就 `exit 2`。

## 2. 现行判定（v3 核心：两类文件两条规则）

### 2.1 文件类别（脚本按路径判定，不靠人声明）

| 类别 | 路径 | 首行要求 | 状态行位置 | 现行来源 |
|---|---|---|---|---|
| **落盘件** | `roster/`、`reports/`、`staging/`（报告/方案/核对单） | 首行 `^状态：(现行|留档|作废)$`；第 2–3 行 `From:`/`To:` | **第 1 行（必做）** | 状态行（唯一） |
| **投递件** | `cards/`、`signals/`（卡面、信号） | 首行 `^From:`、第 2 行 `^To:`（硬规则与机检卡这两行，不动） | 第 3 行起（可选） | 有状态行则用状态行；无则取旁车登记 |

- 投递件**缺状态行不算 `NO_STATUS`**（符合负责人 ②）；但必须有旁车登记，否则 `exit 2 NO_STATUS`——不允许按文件名/版本号猜。
- 落盘件**缺状态行即 `NO_STATUS`（exit 2）**；状态行不在首行即 `STATUS_MALFORMED`。

### 2.2 投递件的旁车（只登记投递件，最小面）

`org/current-delivery.tsv`：
```
# <key>\t<version>；仅供投递件（cards/signals）无状态行时使用
card	d1-delivered-path	v5
```
校验（任一不过 `exit 2`）：
- `STATUS_MISSING`：登记版本的文件不存在。
- `UNREGISTERED_NEWER`：同键存在版本更高或 mtime 晚于旁车的件而旁车未登记（防忘更新后静默取旧）。
- `DUPLICATE`：同键同版本多文件。
- `STATUS_CONFLICT`：旁车与文件第 3 行起的状态行矛盾。

### 2.3 硬失败分支（全 `exit 2`）

`NO_STATUS`｜`AMBIGUOUS`（同键两个「现行」）｜`STATUS_MALFORMED`｜`DUPLICATE`｜`UNREGISTERED_NEWER`｜`STATUS_CONFLICT`｜`MISMATCH`｜`SELF_MISMATCH`｜`REGRESS`（新 `generated` 早于盘上指针）｜`CONCURRENT_CONFLICT`。

`留档`/`作废` 只列出不进现行；`作废` 在指针里留 `void=<version>` 一行。

### 2.4 迁移（负责人已定顺序，照办）

- 名册先出 `v3.20`（@大肥鱼 写，首行加状态行）；台账并入下一自然版 `v68`（@产品经理 唯一写手，不为一行单独出件）。
- 派验单／核对单随下次出件带状态行；卡面模板从**下一张卡**起加（第 3 行起）。
- D-1 等已定稿件不追溯、不返工；补版前对应键如实 `exit 2 NO_STATUS`。

## 3. 对 QA 四条与负责人拍板的逐条落实

### ① 状态行必做 → 分两类落实（§2.1）
- `WARN no-status` 分支删除；`WARN` 一词在本文与脚本里不再出现。
- 禁「取最大版本号」：投递件无状态行时改由旁车登记，未登记即红。

### ② 熔断路径（写死）

| 退出码 | 含义 | 可熔断 |
|---|---|---|
| 0 | 指针与盘一致 | — |
| 1 | 文件缺失/读失败 | **可** |
| 2 | 一致性失败（§2.3 全部） | **不可** |
| 3 | 环境/参数（无 node、路径不可达、参数错、持锁超时） | **可** |

- 合法熔断＝直读盘上原件：`md5sum`＋`wc -c -l`＋`grep -c ''`＋`tail -c1|od`，逐件报原文值；**不得**回读历史 `CURRENT.md`。
- 熔断须显式标注 `熔断:direct(exit=<n>) 原因=<一行>`，并计入指标 4。
- `exit 2` 不熔断：指针与盘矛盾时先修，选边等于把「读到旧版」制度化。

### ③ 计数口径钉进脚本（三列并存，禁人算）

`lines`＝`\n` 个数（≡`wc -l`）；`lines_rec`＝`\n` 个数 +(末字节≠`0a`?1:0)（≡`grep -c ''`）；`tail`＝末字节 hex；`bytes`＝`wc -c`；`md5`＝raw。

今日实测锚（我 20:29 复算）：

| 文件 | `^状态：` | `lines` | `lines_rec` | `tail` |
|---|---:|---:|---:|---|
| `reports/task-ledger.v67.md` | 0（首行为标题） | 790 | 791 | `82` |
| `roster/identity-roster.v3.19.md` | 0 | 363 | 363 | `0a` |
| `cards/d1-delivered-path.v5.md` | 1（首行 From） | 117 | 117 | `0a` |
| `review-requests/d1-delivered-path.v3.md` | 0 | 63 | 63 | `0a` |
| `staging/d1-precheck-1117.v4.md` | 0 | 117 | 117 | `0a` |

→ 台账 790/791 差＝末字节 `0x82`；卡面 v5 的 1 条状态行在第 3 行起（投递件，合法）。

### ④ 同秒并发 `--write`
- 锁 `.batch/night/org/.current.lock`，`open(...,'wx')` 独占，超 `--lock-timeout=5000ms` ⇒ `exit 3`。
- 写前重读盘；目标不存在⇒临时文件+`rename`；`generated` 与 body 全同⇒幂等 `exit 0`；`generated` 同而 body 异⇒`exit 2 CONCURRENT_CONFLICT` 提示重跑；旧 `generated`⇒覆盖并受 `REGRESS` 约束。

## 4. 指针形态与命令

```
# CURRENT（脚本生成，禁手改；--check 不一致即非零退出）
generated=2026-11-16T21:05:00+08:00
roster   version=v3.20 path=roster/identity-roster.v3.20.md class=file status=现行 bytes=… lines=… lines_rec=… tail=0a md5=…
ledger   version=v68   path=reports/task-ledger.v68.md       class=file status=现行 …
card     key=d1-delivered-path version=v5 path=cards/d1-delivered-path.v5.md class=delivery status=旁车 …
review   key=d1-delivered-path version=v3 path=… class=file status=现行 …
void     key=<task> version=v4 path=…      # 仅作废件
self_md5=<body 除 self 行外>
```

```bash
node .batch/night/scripts/current.mjs --write
node .batch/night/scripts/current.mjs --check      # 0/1/2/3 见 §3②
node .batch/night/scripts/current.mjs --json
```

消息引用：`判件基准：CURRENT@2026-11-16T21:05:00+08:00`。

## 5. 谁写、谁回读 / 失效可见性

| 动作 | 执行者 | 机检 | 证据 |
|---|---|---|---|
| 落盘件出新版（带首行状态行） | 该件写手 | `--write && --check` exit 0 | 否则不得投出 |
| 投递件出新版（首行 From 不动） | 该件写手＋旁车登记一行 | 同上 | 旁车未登记即 `UNREGISTERED_NEWER` |
| 组内引用 | 任一成员 | 只写 `CURRENT@<generated>` | 与指针第 2 行可对 |
| 开判/收口 | QA | 开判前 `--check`；非 0 拒判（1/3 熔断须标注） | 原文入判词 |

失效可见性：缺状态行/两版都现行/状态行位置错/失配/回退/重复/未登记/并发冲突 ⇒ **读不到一致态**，不回落旧指针；唯一例外＝exit 1/3 熔断（直读原件、显式标注、计入指标）。

## 6. 度量

| 指标 | 基线（负责人 20:4x 定口径：真发言、窗口 12:00–18:30、不去重、不剔纯 [PASS]） | 目标 | 复算 |
|---|---:|---:|---|
| 无 @ 率 R0 | 9.60%（719 发言／69 无 @） | <5%，首日 <10% | `staging/no-at-count.v2.mjs`（`fd145ba9…`） |
| 含 32 位哈希占比 | 19%（旧分母已作废，按同源 ledger 重算后取数） | <5% | 同源脚本同窗口 |
| 含字节/行数占比 | 29% | <8% | 同上 |
| 熔断次数 | 0（未启用） | ≤2/周，每条带 `exit` 码与原因 | `grep -c '^熔断:direct'` |
| 指针一致性 | — | `--check` exit 0 | 投前/开判前/每 2h |

## 7. 成本

- 开判前 `--check` 1 条替代手跑 3~4 条 ⇒ 净降；投出方 +1 条。
- 一次性：脚本（约 1 小时）＋名册 v3.20／台账 v68 两版迁移（他人出件，我只给脚本与规则）。

## 8. 仍待确认

1. 投递件旁车 `org/current-delivery.tsv` 的登记人：建议＝该件写手登记、负责人只审换基准（日常不阻塞）。
2. `void=` 行是否需要在指针里展开（当前只列 1 行/件；件多时可能过长，可改 `void_count=`）。
