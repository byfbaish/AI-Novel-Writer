执行方：workbuddy联络人 · AI writer项目组
model=（DSH 群分身出方案，非外部执行产出） | 倍率=不适用 | provider=DSH

# 派活调度判据 v3（WorkBuddy / 豆包）

取数时刻：**2026-11-16 20:36 CST**（`date '+%F %T %a'` → `2026-11-16 20:36:xx Mon`）
版本说明：v2 修正 v1 两处硬错（豆包联络人 20:30 会签驳回），v1 字节不动、留档。
- 错 1：v1 写 `node scripts/workbuddy/model-policy.mjs describeModelPolicy` —— 该文件**只 export、无 CLI 入口**，原样跑无输出且 exit=0，回执会拿到空串。已实跑复核。
- 错 2：v1 写返回值 `deepseek-peak` —— **不存在该值**；高峰态 `window` 字段直接缺失（undefined）。按 v1 文本判档，高峰会被判成「可派」。
- 另修：v1 取数时刻写 20:45（当时未到），属自证瑕疵；本条按实际取样时刻写。
版本说明：v3 只改终审点名的四处（项目总负责人 2026-11-17 12:2x 终审「复签通过、v2 起生效」），方案正文结构不动，v2 字节留档不动。
- 改 A `:38` 行号漂移＋白名单断言已不成立（原写 `:26`/`:31`／`ALLOWED_MODELS=['DeepSeek-V4.1-Flash']`）。
- 改 B `:112`「名字未到不派」与盘上状态矛盾，并补终审的过渡期硬约束。
- 改 C `:113` 无 @ 基线 18.24% → 721／72＝9.99%。
- 未改（点名范围外，留档待裁）：§五 `:93` 仍指豆包联络人 v1 会签件，v2 会签件为现行。

---

## 一、判档命令（唯一可执行形式，两条通道都只有这一种写法）

`model-policy.mjs` 是纯 ESM 模块，必须用 `--input-type=module` 导入后调用，不能当脚本直接跑：

```bash
# 判档：一行结论（派前必跑，输出原文贴回执）
node --input-type=module -e "import {describeModelPolicy} from './scripts/workbuddy/model-policy.mjs'; console.log(describeModelPolicy())"

# 判档：结构化（脚本/闸门用，取 ok 字段做硬判）
node --input-type=module -e "import {pickModel} from './scripts/workbuddy/model-policy.mjs'; console.log(JSON.stringify(pickModel(new Date())))"
```

### 实测三种态（同一台机、同一模块，2026-11-16 20:35）

| 取样时刻 | `pickModel` 返回 | `describeModelPolicy` 输出 |
|---|---|---|
| 现在 20:33（周一非高峰） | `{"ok":true,"model":"DeepSeek-V4.1-Flash","window":"deepseek-off-peak","reason":"非高峰时段，DeepSeek-V4.1-Flash 计 0.11x 且 5 折"}` | `20:33 → DeepSeek-V4.1-Flash（非高峰时段，DeepSeek-V4.1-Flash 计 0.11x 且 5 折）` |
| 10:30（周一高峰） | `{"ok":false,"blocked":true,"model":null,"reason":"DeepSeek 高峰（原价）","nextOffPeakAt":"2026-11-16T04:00:00.000Z"}` | `10:30 高峰 → 不派活（12:00 后可自动派活）` |
| 11-21 10:30（周六） | `{"ok":true,"model":"DeepSeek-V4.1-Flash","window":"deepseek-off-peak",...}` | 同非高峰 |

**判据（钉死字段，不认文案）**：
- `ok === true` 且 `model === "DeepSeek-V4.1-Flash"` → 可派 WorkBuddy。
- `blocked === true`（即 `ok === false`）→ **不派 WorkBuddy**，改派豆包或等 `nextOffPeakAt`。
- `window` 字段**只在非高峰存在**；判档禁止用 `window` 判高峰（高峰时无此键）。
- **白名单层已不再挡 HY4**，不得据白名单断定「HY4 不会出现」：现行 `scripts/workbuddy/model-policy.mjs:36-37` ＝ `ALLOWED_MODELS = HY4_DISABLED ? [MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH] : [MODEL_HY4, MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH]`，`:34` `MODEL_HY4_FLASH='Hy4 flash'`、`:30` `HY4_DISABLED=true`（11-17 11:40 实测，该改动已随提交 `b5afcea2` 消解；原 v2 此条引的 `:26`/`:31` 已漂移）。**唯一硬闸是 `:35` 的 `model` 字段判据**——`pickModel()` 默认仍返回 `DeepSeek-V4.1-Flash`，白名单只决定「允许出现什么」，不决定「实际选了哪个」。

---

## 二、派后回查（必做，与派前判档不是同一件事）

`workbuddy-attach.mjs task` 会在投递时按策略改模型；注入后必须回读执行器芯片，防止「判档通过但实跑模型不是 V4.1-Flash」。

```bash
node scripts/workbuddy/workbuddy-attach.mjs status --json
```

20:32 实跑输出的关键字段（原文摘录）：
```
"space": "wt-2"
"runState": "idle"
"chips": { "workspace": "dsh-plugins-project", "branch": "p1-identity-resolve",
           "permission": "允许完全访问", "model": "DeepSeek-V4.1-Flash" }
"modelPolicy": { "now": "20:32 → DeepSeek-V4.1-Flash（非高峰时段…5 折）",
                 "allowed": ["DeepSeek-V4.1-Flash"], "auto": true }
```

**判据**：`chips.model` 必须等于 `DeepSeek-V4.1-Flash`，且 `modelPolicy.now` 与派前判档结论同档；不等 → 停派、报项目管家，不得「先跑着看」。

---

## 三、单执行方闸（防并发抢额度、防上下文堆爆）

同一执行方**同一时刻只准有一个未收口任务**；不按「一任务一窗口」（浪费资源），按「一窗口堆到阈值再开新窗」。

| 通道 | 判据命令 | 通过条件 |
|---|---|---|
| WorkBuddy | `node scripts/workbuddy/workbuddy-attach.mjs status --json` | `runState === "idle"`；反之为忙，不投第二张 |
| 豆包 | `node scripts/doubao/doubao.mjs status` | `loggedIn && hasEditor` 为真才可投；`turnCount` 记入回执（单窗口容量用） |

20:32 实跑：WorkBuddy `runState=idle`；豆包 `port=9331 loggedIn=true taskMode=true runMode=本地电脑 turnCount=2`。

---

## 四、投达判据（三条同时满足才算已派，任一不满足不得记「已派」）

1. **注入行**：目标会话出现本次任务的注入正文（relay 侧有 `注入 to=<session 前8位>` 行）。
2. **delivered 副本**：信号文件落在 `.batch/night/signals/delivered/<hash>/` 下，字节可核。
3. **源目录搬空**：`.batch/night/signals/workbuddy/`（或 `doubao/`）回空，只剩 `.gitkeep`。

CLI 退出码含义（`scripts/workbuddy/workbuddy-attach.mjs:115`）：`0 ok / 1 fail / 2 notConnected / 3 cliMissing / 4 timeout / 5 peak`。**`exit 2` 是未连上，不得记作已派**；`exit 5` 是高峰拦下，未投出，不计数。

---

## 五、豆包侧会签判据（豆包联络人 20:30 提出，v2 全部收下）

1. **单窗口容量**：投前读 `status.turnCount`，达容量即开新窗；容量值与退出线由豆包联络人写进其会签件，我不代定。
2. **换窗条件**：连续 2 次 turn 失败才换窗，且换窗须**主人批准**；单次失败只重试不换窗。
3. **投达三件套**：注入行 + delivered 副本 + 源目录搬空，缺一条不得记已派（同 §四）；`exit 2` 一律记「未派」。

上述三条以豆包联络人 `staging/dispatch-schedule-endorse-doubao.v1.md`（2,833B｜`5f66b1e1dcd93da20d760d576c75e2f`｜51 行）为准，v2 只承接、不改写其判据。

---

## 六、owner 与时间点

| 项 | owner | 时间点 | 交付物 |
|---|---|---|---|
| 本调度判据（含 §一~§四） | workbuddy联络人 | 20:50 交 v2（本件） | `staging/dispatch-schedule.v2.md` |
| 豆包侧三条会签 | 豆包联络人 | 收到本件后复签 v2 | `staging/dispatch-schedule-endorse-doubao.v2.md` |
| 判档接进派卡模板（卡面加「派前判档输出」字段） | 项目总负责人 | 11-17 首张新卡起 | 卡面模板 `.batch/night/cards/_CARD-TEMPLATE.md` v N+1 |
| 判档/回查写进脚本闸（`--check` 式硬失败） | developer | 11-17 随 `pointer-plan.v2` 一并落地 | 脚本 + 文档 |
| 每日首报引用本判据口径 | 大肥鱼 | 11-17 09:30 起 | 日报 |

---

## 七、边界与不做

- 本件是**判据件**，不是派卡：我不派卡、不改脚本、不跑测试、不认领执行。
- **HY4 模型名已到，仍不派 HY4**：界面为两条并列项 `Hy4`（0.29x）与 `Hy4 flash`（0.00x，角标「限时免费」），逐字取自 `reports/hy4-modelname-probe-20261117.md`。终审过渡期硬约束（v3 生效即适用）：派卡一律显式带 `--model DeepSeek-V4.1-Flash`，不依赖脚本自动选档；回执须附**发起命令全文**＋`chips.model` 芯片原文。依据是 §一 `:35`——自动路径这一层已不是拦得住的证据。
- 无 @ 基线（项目总负责人 11-17 12:2x 定，此后只认这一个数）：**721／72＝9.99%**，窗口 12:00–18:30；分母＝`text` 非空的 bot 发言（`who` 不含 `User`、`DS Bot`），分子＝其中正文不含 `@名字` 的条数。目标 <5%、首日过渡 <10% 不动。`722／72＝9.97%` 只作含 User 的 B 口径存档，不作基线；v2 此处原写 795/145＝18.24% 已作废。
- 本件不含「压到 <5%」的配额分配，那是 ①no-@ 项（owner 大肥鱼）的日报口径。

<!-- DONE -->
