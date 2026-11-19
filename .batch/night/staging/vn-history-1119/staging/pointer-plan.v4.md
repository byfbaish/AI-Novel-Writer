# 判件指针化方案 v4（developer · 11-16 20:4x）

输入：`org/process-efficiency-1116.md`（3,178B｜`af92a826c446177a536fac0def8275ea`｜43 行）。
存档：v1 `staging/pointer-plan.v1.md`（10,809B｜`76edbd09…`｜132 行）｜v2 `pointer-plan.v2.md`（8,096B｜`f615c3ae…`｜130 行）｜v3 `pointer-plan.v3.md`。
**v4 相对 v3 的三处改动**（均为 QA 20:3x 复核意见）：
1. §2 两类文件规则保留，并补一句「与 notice 的 From/To 硬规则不冲突」，明确无需改 notice；
2. §3② 新增**限时迁移旗标**，解决「迁移窗口把全组开判封住」；
3. §6 基线全部按已裁定分母（719 真发言／12:00–18:30）**实测重算**，旧 19%／29%／12% 不再引用。

## 1. 结论（不变）

手写 `CURRENT.md` 不成立；采纳脚本派生 `CURRENT.md` ＋ 脚本机检；消息只引 `CURRENT@<generated>`；对外投出件仍带绝对路径＋三元组；任何「猜现行」都 `exit 2`。

## 2. 现行判定：两类文件两条规则

### 2.1 类别（脚本按路径判定）

| 类别 | 路径 | 首行要求 | 状态行位置 | 现行来源 |
|---|---|---|---|---|
| **落盘件** | `roster/`、`reports/`、`staging/`（报告/方案/核对单） | 首行 `^状态：(现行|留档|作废)$`，第 2–3 行 `From:`/`To:` | **第 1 行（必做）** | 状态行 |
| **投递件** | `cards/`、`signals/`（卡面、信号） | 首行 `^From:`、第 2 行 `^To:`（不动） | 第 3 行起（可选） | 有状态行用状态行；无则用旁车 |

**与 notice 不冲突（答 QA a）**：notice 的「正文前两行必须是 From/To」只管**投递件**；落盘件按卡面 §五 本来就不要求 From/To，故落盘件首行放 `状态：` 不撞任何硬规则，**notice 无需改动**。已投出的历史件不追溯。

- 投递件缺状态行**不算** `NO_STATUS`（负责人 ②），但必须有旁车登记，否则 `NO_STATUS`（exit 2）。
- 落盘件缺状态行＝`NO_STATUS`（exit 2）；状态行不在首行＝`STATUS_MALFORMED`。

### 2.2 投递件旁车 `org/current-delivery.tsv`

每行 `<key>\t<version>`，只登记投递件。校验不过即 exit 2：`STATUS_MISSING`（登记件不存在）、`UNREGISTERED_NEWER`（同键有更高版本/mtime 更新未登记）、`DUPLICATE`、`STATUS_CONFLICT`（与文件第 3 行起状态行矛盾）。

### 2.3 硬失败分支（全 `exit 2`）

`NO_STATUS`｜`AMBIGUOUS`｜`STATUS_MALFORMED`｜`DUPLICATE`｜`UNREGISTERED_NEWER`｜`STATUS_CONFLICT`｜`MISMATCH`｜`SELF_MISMATCH`｜`REGRESS`｜`CONCURRENT_CONFLICT`｜`MIGRATION_EXPIRED`。

`留档`/`作废` 只列出不进现行；`作废` 在指针里留 `void_count=` 与逐件一行。

### 2.4 迁移（负责人已定顺序）

名册先出 `v3.20`（@大肥鱼 写）→ 台账并入下一自然版 `v68`（@产品经理）→ 派验单/核对单随下次出件带状态行 → 卡面模板从下一张卡起（第 3 行起）。D-1 等不追溯。

## 3. 对 QA 四条与负责人拍板的落实

### ① 状态行必做（分两类，§2）
`WARN` 一词从脚本与文档删除；禁「取最大版本号」。

### ② 熔断路径 ＋ 迁移旗标（答 QA b）

| 退出码 | 含义 | 可熔断 |
|---|---|---|
| 0 | 指针与盘一致 | — |
| 1 | 文件缺失/读失败；**迁移期内的 `NO_STATUS`** | **可** |
| 2 | 一致性失败（§2.3 全部） | **不可** |
| 3 | 环境/参数 | **可** |

- 合法熔断＝直读盘上原件（`md5sum`＋`wc -c -l`＋`grep -c ''`＋`tail -c1|od`）；不得回读历史 `CURRENT.md`；须标 `熔断:direct(exit=<n>)`，计入指标。
- **迁移旗标**（新）：`--migration=ledger,roster` 或 `CURRENT_MIGRATION=ledger,roster`。
  - 仅把**列名 key 的 `NO_STATUS` 降为 exit 1**（走既有熔断通道，输出 `MIGRATION:no-status:<key>`）；`AMBIGUOUS`/`STATUS_CONFLICT`/`MISMATCH` 等**一律不降**。
  - 旗标写死到期 `2026-11-18T00:00:00+08:00`；过期后 `--check` 报 `MIGRATION_EXPIRED`（exit 2）。
  - 旗标**不放宽**「不猜现行」「不回落旧指针」两条。
  - 即：迁移期内 v68/v3.20 未落盘时，QA 一次熔断并标注即可开判，不封组、不静默。

### ③ 计数口径钉进脚本
`lines`（≡`wc -l`）／`lines_rec`（≡`grep -c ''`）／`tail`/`bytes`/`md5` 全部脚本现算。实测锚：台账 v67 = 790/791/`82`；名册 v3.19 = 363/363/`0a`；卡面 v5 = 117/117/`0a`（其 1 条状态行在第 3 行起，投递件合法）；派验单 v3 = 63/63/`0a`；核对单 v4 = 117/117/`0a`。

### ④ 同秒并发
`.current.lock` 用 `open(...,'wx')` 独占，超 `--lock-timeout=5000ms` ⇒ exit 3；写前重读盘；同 `generated` 同 body ⇒ 幂等 0；同 `generated` 异 body ⇒ `CONCURRENT_CONFLICT` 重跑；旧 `generated` ⇒ 覆盖且受 `REGRESS` 约束。

## 4. 指针形态与命令

```
# CURRENT（脚本生成，禁手改；--check 不一致即非零退出）
generated=2026-11-16T21:05:00+08:00
roster   version=v3.20 path=roster/identity-roster.v3.20.md class=file     status=现行 bytes=… lines=… lines_rec=… tail=0a md5=…
ledger   version=v68   path=reports/task-ledger.v68.md       class=file     status=现行 …
card     key=d1-delivered-path version=v5 path=cards/d1-delivered-path.v5.md class=delivery status=旁车 …
review   key=d1-delivered-path version=v3 path=… class=file status=现行 …
self_md5=<body 除 self 行外>
```

```bash
node .batch/night/scripts/current.mjs --write
node .batch/night/scripts/current.mjs --check [--migration=ledger,roster]
node .batch/night/scripts/current.mjs --json
```

## 5. 谁写/谁回读/失效可见性（同 v3）

| 动作 | 执行者 | 机检 | 证据 |
|---|---|---|---|
| 落盘件出新版 | 该件写手 | `--write && --check` exit 0 | 否则不得投出 |
| 投递件出新版 | 该件写手＋旁车一行 | 同上 | 未登记即 `UNREGISTERED_NEWER` |
| 组内引用 | 任一成员 | 只写 `CURRENT@<generated>` | 与第 2 行可对 |
| 开判/收口 | QA | `--check`；非 0 拒判（1/3 熔断须标注） | 原文入判词 |

失效可见性：缺状态行/两版现行/位置错/失配/回退/重复/未登记/并发冲突 ⇒ 读不到一致态，不回落旧指针；唯一例外＝exit 1/3 熔断（直读原件、显式标注、计入指标）。

## 6. 基线（已按裁定分母实测重算，旧 19%/29%/12% 作废）

脚本：`staging/pointer-metrics.mjs`｜2,051B｜`0d69769ab7ab1a23f9cba4dc896fa073`｜29 行（复用 `no-at-count.v2.mjs` 同一过滤：真发言、不去重、不剔纯 [PASS]、窗口按记录 time）。

实跑：`node staging/pointer-metrics.mjs 12:00-18:30 2026-11-16` → `N=719`、`noAt=69`。

| 指标 | 实测（719 真发言／12:00–18:30） | 建议目标（待负责人拍） |
|---|---:|---:|
| R0 无 @ 率 | 9.60%（69/719） | <5%，首日 <10%（已定） |
| 含 32 位哈希 | **43.67%（314/719）** | <10% |
| 含字节/行数 | **64.26%（462/719）** | <15% |
| 含旧回合/过期/作废/撤回 | **23.64%（170/719）** | <8% |
| 熔断次数 | 0（未启用） | ≤2/周，每条带 exit 码与原因 |
| 指针一致性 | — | `--check` exit 0 |

说明：旧文的 19%/29%/12% 出自作废的 1,754 分母；按 719 口径实测高得多（哈希 43.67%、字节行数 64.26%），说明「每轮报哈希/字节」比原估计更严重，降噪收益更大，目标不变松。

## 7. 成本

开判前 `--check` 1 条替代手跑 3~4 条 ⇒ 净降；投出方 +1 条；一次性＝脚本（约 1 小时）＋名册 v3.20／台账 v68 迁移（他人出件，我只给脚本与规则）。

## 8. 仍待确认

1. 三项新目标（<10%／<15%／<8%）请负责人拍；不拍则只报基线不挂目标。
2. 投递件旁车登记人：建议该件写手登记、负责人只审换基准。
