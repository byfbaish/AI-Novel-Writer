# Bot 身份名册（v3）

- 用途：handoff-usage-criteria v7 §3.1 / H7-A1 的判定输入。名册不是权限表，只作「From 里的角色名与 8 位 id 是否对得上」的核对依据。
- 生成人：大肥鱼（项目管家）｜生成时刻：2026-11-16T11:06+08:00（v3.6 刷新时刻；首版 06:39）
- 生成依据：`C:\Users\<用户名>\.dsh\bot\state.json` 的 `rooms[<AI writer项目组 roomId>].sessions`（主身→群分身映射）＋ `bots[*].sessionId`（主身）；再以 `C:\Users\<用户名>\.dsh\sessions\` 下各 `session.v4.jsonl.zstd` 的写入时间交叉验证（全部在 06:35–06:38 有写入＝现行在跑）。
- 取代：`identity-roster.v2.md`（2026-11-15 16:15，全部 id 已轮换为旧值）自本版生效起转历史件，不再作判定输入；v1、v2 原样保留不改写。

## 〇、别名映射（改名，11-16 06:29 主人定）

| 旧名 | 新名 | session 是否变 |
|---|---|---|
| AI writer总负责人 | 项目总负责人 | 否（改名不改 session；下表的 id 才是主键） |

判定规则：`From: AI writer总负责人 …` 与 `From: 项目总负责人 …` **视为同一身份**；但 id 不符仍按 H7 判可疑，不因名字相符放过。

## 一、在群（8）——群分身 id 已全部刷新（v2 那批作废）

| 角色（新名） | 群内称谓 | 主身 session | 群分身 session（前 8 位） | 状态 |
|---|---|---|---|---|
| 大肥鱼（项目管家） | 大肥鱼 · AI writer项目组 | 0103a0ac | **03205043** | as of 12:09:20｜来源＝本人 `DSH_SESSION_ID` 直读＝`session-03205043-4e5b-498e-97e8-1e1d6d69d566`＋`state.json` rooms 同值；旧值 `c64bc312` 11:49:54 停写＝已轮换·非现行 |
| 项目总负责人 | 项目总负责人 · AI writer项目组 | 5b5bc124 | **5b1e2d16** | as of 12:05:51｜来源＝本人 `DSH_SESSION_ID` 直读 `session-5b1e2d16-57e9-4d93-80b6-cee9ac51aed6`＋rooms 12:09 同值；旧值 `51aa9018`、`64419d69` 已轮换·非现行 |
| workbuddy联络人 | workbuddy联络人 · AI writer项目组 | 7c3feeab | **6acae4d3** | as of 11:40｜来源＝本人 11:52 实名自查＋QA、developer 各自会话文件独立复读（`session-4f18b03f-…` 最后写 11:40:32.589 停写；`session-6acae4d3-…` 11:51:11 仍在写）＋12:14:11 relay 真投验过；旧值 `4f18b03f`、`d17681e6` 已轮换·非现行 |
| 豆包联络人 | 豆包联络人 · AI writer项目组 | 27a1c2ae（已确证） | **27a1c2ae**（rooms 映射） | as of 12:09:20｜来源＝`state.json` rooms 现值；该 Bot 07:42 自报三条证据（两条 doubao watch 同值、rooms 同值、session 目录 07:42:25 仍在增长），本轮未被轮换 |
| QA | QA · AI writer项目组 | 1586edd1 待复核 | **b2001584** | as of 12:09:20｜来源＝`state.json` rooms 现值 `session-b2001584-83f6-474e-ac90-010b1082583a`；旧值 `2ae0758e`（v3.6 记「已确证」）与 `57c8bd18` 均已轮换·非现行；本人本轮自证未到 |
| 产品经理 | 产品经理 · AI writer项目组 | 090e6e7d 待复核 | **4e6e07bd** | as of 12:09:20｜来源＝`state.json` rooms 现值；本轮未被轮换，沿用 06:37 写入验证 |
| developer | developer · AI writer项目组 | 585a879b 待复核 | **332cfc5a** | as of 12:09:20｜来源＝`state.json` rooms 现值 `session-332cfc5a-b91a-4b98-ba14-8382c914f5bf`＋该 Bot 10:48 `DSH_SESSION_ID` 直读自证；旧值 `906d802a` 已轮换·非现行，`4d758355` 系他人推测＝未自证·不作判据 |
| 金牌编辑 | 金牌编辑 · AI writer项目组 | 3460ca40 待复核 | **55617061** | as of 12:09:20｜来源＝`state.json` rooms 现值；本轮未被轮换，沿用 06:37 写入验证 |

说明：`bots[*].sessionId` 只有大肥鱼、项目总负责人、workbuddy联络人三条有值（其余为 None，主身 id 只能沿用 v2 旧值、未复核，故标「待复核」）。群分身一列全部来自 rooms 映射并已按写入时间验证。

## 二、已移出群（0）

无。

## 三、非现行 id（不作判定依据，仅防误用）

| id | 归属 | 状态 |
|---|---|---|
| 74a01c9a | 大肥鱼 · 群分身 | 上一 part，最后写 11-15 16:55，已非现行 |
| a1d48adb | 大肥鱼 · 主身 | 上一 part，最后写 11-15 20:03；**to-owner relay 仍指向它＝疑失效，须报主人裁决重绑** |
| 9c03a032 | 大肥鱼 · 群分身 | 更早 part，最后写 11-16 03:19 |
| 08b720e9 | 项目总负责人 · 群分身 | 旧 part，最后写 11-15 16:06 |
| 7730f863 | workbuddy联络人 · 群分身 | 旧 part，最后写 11-15 00:58；**v1 卡 From 行即此值＝已过期** |
| c12ee7f6 | 豆包联络人 · 群分身 | 旧 part，11-14 21:25 |
| 5d4057a5 | QA · 群分身 | 旧 part，11-15 14:20 |
| 54f674e2 | 产品经理 · 群分身 | 旧 part，11-15 10:13 |
| ba2b3946 | developer · 群分身 | 旧 part，11-15 02:00 |
| c883ffa3 | 金牌编辑 · 群分身 | 旧 part，11-14 23:29 |
| 33494f59 | workbuddy联络人 | 更早群分身，11-15 00:57 停写 |
| daeb834f | wakeup-inbox watch 孤儿目标 | 无对应在群分身 |
| 6dc4ab20 | 项目总负责人（旧名 AI writer总负责人） | 更早 part 群分身 |
| 6441a6cb | 大肥鱼 · 群分身 | v3.3 值，11-16 10:42 重启后轮换，非现行 |
| 66023777 | 大肥鱼 · 群分身 | v3.4/台账 `:319` 值，10:42 重启后轮换，非现行；`cordis.patch.yml` 的 to-group 仍绑它＝指空 |
| 64419d69 | 项目总负责人 · 群分身 | v3.3/v3.4 值，已轮换，非现行（本人 10:34 自证为 `51aa9018`） |
| 57c8bd18 | QA · 群分身 | v3.3/v3.4 值，已轮换，非现行 |
| 906d802a | developer · 群分身 | v3.3/v3.4 值，已轮换，非现行（本人 10:48 自证为 `332cfc5a`） |
| 4d758355 | developer · 群分身（**他人推测值**） | **从未实测到，非现行·作废**；重复出现会冒充现行值，禁止引用 |

## 四、连带影响（v3.1 更正）

> v3.1 更正说明（2026-11-16T06:49+08:00，生成人 大肥鱼）：v3 的 §四① 写「to-owner 仍绑 a1d48adb、已过期」**与实测不符，作废**。实测 `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml` 第 313–314 行：`to-owner` 的 `targetSessionId: session-0103a0ac-…`（＝现行主身），并把 06:50 的 to-owner 报件实投验过：relay.log `2026-11-15T22:48:23.397Z … 注入身份 from=大肥鱼 · AI writer项目组 | 6441a6cb to=0103a0ac|大肥鱼|主身`，落 `delivered/session-0103a0ac…/20261116-0650-owner-three-items.md`（1,545B）。v3 原文件字节不动。

1. **to-owner：已绑现行主身 `0103a0ac`，通道正常**（v3 该条作废）。原 `a1d48adb`（最后写 11-15 20:03）只是旧 part，配置已不指向它。
2. **v1 卡 `From: workbuddy联络人 · AI writer项目组 | 7730f863` 已过期**（现行 `d17681e6`）。→ 之前「v2 冻结」的理由是「新群分身未生成」，该理由已被 id 轮换覆盖，v2 现在**必须出**（只换前 8 位）。
3. 其余 relay watch 若绑的是上表旧 id，同样失效，须按现行 id 重绑（改配置与重启仍归主人）。

## 五、六条 relay watch 实测对账（v3.1 新增，2026-11-16T06:49）

配置来源：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`（`dsh-handoff-relay` 段，`disabled: false`，`stableMs: 5000`）。

| # | 目录 | 绑定 session（as of 12:12:13 现读） | 应对身份 | 结论 |
|---|---|---|---|---|
| 1 | `scripts\dsh\wakeup-inbox\workbuddy` | `6acae4d3` | workbuddy联络人 · 群分身 | 对 |
| 2 | `scripts\dsh\wakeup-inbox\doubao` | `27a1c2ae` | 豆包联络人 · 群分身 | 对 |
| 3 | `.batch\night\signals\workbuddy` | `6acae4d3` | workbuddy联络人 · 群分身 | 对（**12:14:11 真投验过**，`p56.signal` 注入成功） |
| 4 | `.batch\night\signals\doubao` | `27a1c2ae` | 豆包联络人 · 群分身 | 对 |
| 5 | `.batch\night\bridge\to-owner` | `3286c9d7` | 大肥鱼 · 主身 | 对（12:04:13 真投验过） |
| 6 | `.batch\night\bridge\to-group` | `03205043` | 大肥鱼 · 本群 admin 群分身 | 对（12:13:06 `rescan ... result=resolved`；真投待做） |

配置现值来源：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`，13,007B／MD5 `01d70792ff1e6178010791bfd7a80bdd`／`:294`、`:299`、`:304`、`:309`、`:314`、`:319` 六行现读。第二次重启已发生：`relay.log` `2026-11-16T04:12:51.919Z 启动 6/6 个 watch`（CST 12:12:51）。

**判据纪律（v3.7 新增）**：重启加载期六条 watch 会**全部**报 `agent-not-found`（含本来有效的 `27a1c2ae`、`3286c9d7`，见 `04:12:51.914–.919` 五行），这是加载时序而非绑错；真假只认随后的 `rescan ... result=resolved` 与 `delivered/` 留痕。以「无 `agent-not-found`」作判据会导致六条永远全不过。

处置：第 6 条改配置＋重启归主人，我不动；已随 06:50 的 to-owner 报件一并报上。

## 六、v3.2 变更记录（2026-11-16 07:58，生成人 大肥鱼）

仅改 §二 豆包联络人行：`27a1c2ae` 由「待复核」改为「已确证」，依据该 Bot 07:42 自报的三条实证。其余各行与 v3.1 逐字相同；v3.1 原样保留。

## 七、v3.3 变更记录（2026-11-16 10:23，生成人 大肥鱼）

仅改 §一 大肥鱼行：群分身 `6441a6cb` → `66023777`（依据 `C:\Users\<用户名>\.dsh\bot\state.json` 的 `rooms["AI writer项目组"].sessions` 现值，并以本人 `session-66023777-…\session.v4.jsonl.zstd` 10:13:56 写入交叉验证），旧值就地标「已轮换·非现行」。其余各行、§三 旧 id 表、§五 watch 对账与 v3.2 逐字相同；v3.2 原样保留不改写。项目总负责人要求「只改自己那一行」，故本次不动他人条目（他人现行 id 若已轮换，由各自自证后另出 v3.4）。

## 八、v3.4 变更记录（2026-11-16 10:28，生成人 大肥鱼）

仅改 §一 workbuddy联络人行：群分身 `d17681e6` → `4f18b03f`。依据＝该 Bot 本人实名自查两条（本进程 `DSH_SESSION_ID` 直读、`state.json` 的 `rooms["AI writer项目组"].sessions` 同值，mtime 10:13:56）＋ QA 与 developer 各自只读核对一致；旧值就地标「已轮换·非现行」。其余各行、§三 旧 id 表、§五 watch 对账、§七 与 v3.3 逐字相同；v3.2、v3.3 原样保留不改写。

### 待各自自证（本版未改表格，只记事实）

以下三行在 `state.json` 的 `rooms["AI writer项目组"].sessions` 现值与 v3.3 表内所记不同，按「一人只自证自己那行」的规则，等本人自证后再出 v3.5，本文不代改：

| 角色 | v3.3 表内值 | `state.json` rooms 现值 |
|---|---|---|
| 项目总负责人 | `64419d69` | `51aa9018` |
| QA | `57c8bd18` | `2ae0758e` |
| developer | `906d802a` | `4d758355` |

（§五 六条 watch 对账表里出现的 id 属当时实测记录，不随本版改动；重绑后按新值另记。）

## 九、v3.5 变更记录（2026-11-16 10:58，生成人 大肥鱼）

依据：`C:\Users\<用户名>\.dsh\bot\state.json`（mtime 10:50:47）的 `rooms["AI writer项目组"].sessions` 现值，逐 id 以 `C:\Users\<用户名>\.dsh\sessions\` 下 `session.v4.jsonl.zstd` 的 mtime 交叉验证（四行均 10:57:45–10:58:26 仍在写）。同批边界已由项目总负责人在同一份 state.json 上 join 出八行，与本文一致。

本版改四行（其余逐字不动）：

| 角色 | v3.4 值 | v3.5 值 | 依据 |
|---|---|---|---|
| 大肥鱼（admin 群分身） | `66023777` | `c64bc312` | rooms 现值＋会话文件写入 |
| 项目总负责人 | `64419d69` | `51aa9018` | 本人 `DSH_SESSION_ID` 自证（10:34）＋rooms 同值 |
| QA | `57c8bd18` | `2ae0758e` | rooms 现值＋会话文件写入；**本人自证未到** |
| developer | `906d802a` | `332cfc5a` | 本人 `DSH_SESSION_ID` 自证（10:48）＋rooms 同值 |

§三 新收 6 个非现行 id（含 `4d758355`「他人推测·作废」）；§五 watch 对账表保持当时实测原样不动。

**连带（只报，不改配置）**：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml` 的 to-group watch（第 6 条）现值 `session-66023777-…`，对当前 admin 群分身 `c64bc312` 已指空，应改为 `c64bc312` 后重启生效；其余五条（`4f18b03f`×2、`27a1c2ae`×2、to-owner `0103a0ac`）本次实测仍正确。改配置与重启归主人。

§八 那张「待各自自证」表随本版结清：三行中两行已由本人自证（总负责人、developer），QA 一行改记为「room 现值、自证待补」。v3.4 及更早各版原样保留，不改写。

## 十、v3.6 变更记录（2026-11-16 11:06，生成人 大肥鱼）

只改一行：§一 QA 群分身 `2ae0758e` 由「rooms 现值、本人自证未到」升级为「已确证」。依据＝本人 11:04 自证两条：本会话 `DSH_SESSION_ID` 直读 `session-2ae0758e-334f-4a84-be71-d7512708837f`，与 `state.json` rooms 同值；会话文件 909,617B、mtime 11:02:14 仍在写。此时八行全部为「已确证」，§八 待自证表全部结清。

其余各行、§三 非现行 id 表、§五 watch 对账、§九 变更记录与 v3.5 逐字相同；v3.5 及更早原样保留不改写。

## 十一、v3.7 变更记录（2026-11-16 12:12–12:30，生成人 大肥鱼 · AI writer项目组，session `03205043`）

改的是 §一 与 §五 两段，其余逐字不动（由 v3.6 12,578B/11:07 复制而来）：

1. **§一 八行全部重采**，as of 12:09:20，来源 `C:\Users\<用户名>\.dsh\bot\state.json` rooms 现值，逐行标注「as of 时刻 + 来源」。只作取样记录，**不作 relay 绑定判据**。同时按 11-16 定下的通用规则加一句：任何人的 id 只收本人直读自证，别人推测的一律标「未自证·不作判据」（`4d758355` 那类坑）。凡每轮都会变的值不为此反复出 vN。
2. **§五 六条 watch 对账表整段替换**为 12:12:13 配置现读：`:294`=`6acae4d3`、`:299`=`27a1c2ae`、`:304`=`6acae4d3`、`:309`=`27a1c2ae`、`:314`=`3286c9d7`、`:319`=`03205043`（文件 13,007B／MD5 `01d70792ff1e6178010791bfd7a80bdd`）。结论：六条全部指向现行身份；其中第 3 条（`p56.signal` → `6acae4d3`）与第 5 条（`owner-three-lines-after-restart-1202.md` → `3286c9d7`）已有真投留痕，第 6 条 `04:13:06` 首次 `rescan ... result=resolved`、真投待做。
3. **新增判据纪律段**：重启加载期六条 watch 会同时报 `agent-not-found`，这是加载时序不是绑错；真假只认随后的 `rescan ... result=resolved` 与 `delivered/` 留痕。拿「无 `agent-not-found`」当判据会导致六条永远全不过。

**原「待主人一行」已结清**：`cordis.patch.yml` 三行已由主人改完（`:294`/`:304`→`6acae4d3`、`:319`→`03205043`），并已于 12:12:51 重启生效（`relay.log` `2026-11-16T04:12:51.919Z 启动 6/6 个 watch`）。v3.5（10:59）与 v3.6（11:07）原样保留不改写。

## 十二、v3.8 变更记录（2026-11-16 12:55，生成人 大肥鱼 · AI writer项目组，session `03205043`）

只追加本节，§一～§十一 逐字不动（由 v3.7 14,923B／MD5 `cc74b3c782ae1ff033852ada91e2e53f`／143 行复制而来）。v3.7 的 §五 写「六条 watch」在当时正确；12:36 配置新增第 7 条，故本版补记，不改写 §五 原文。

### 12.1 配置现值（as of 12:53 现读，非推断）

- 文件 `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`：**13,229B｜MD5 `2f4a89b7083bb072a3eefcad737e7c6a`｜mtime 12:36:00**
- 生效重启：`relay.log` `2026-11-16T04:34:04.174Z 启动 7/7 个 watch；stableMs=5000，delivered=…\dsh-handoff-relay\delivered`（CST 12:34:04，第三次重启）

### 12.2 七条 watch 对账

| # | dir（简） | targetSessionId | 指向身份 | 结论 |
|---|---|---|---|---|
| 1 | `wakeup-inbox\workbuddy` | `6acae4d3` | workbuddy联络人群分身 | 对；已有真投（`p56.signal` 12:14） |
| 2 | `wakeup-inbox\doubao` | `27a1c2ae` | 豆包联络人群分身 | 配置对；但 `rescan#3 04:34:20` 报 `not-found`，**待该 Bot 本人自证现行 id**，未自证前不作判据 |
| 3 | `signals\workbuddy` | `6acae4d3` | workbuddy联络人群分身 | 对；已有真投（`p56.signal.v2` 12:24） |
| 4 | `signals\doubao` | `27a1c2ae` | 豆包联络人群分身 | 同 #2 |
| 5 | `bridge\to-owner` | `3286c9d7` | 大肥鱼主身 | 对（既有例外）；已有真投 |
| 6 | `bridge\to-group` | `03205043` | 大肥鱼群分身（本群 admin） | 对；`04:13:06` 首报 resolved，真投待做 |
| 7 | `bridge\to-plugin-group`（新增 `:322`–`:327`） | `c9ff5961` | 大肥鱼 · DSH 插件组 群分身 | 只算「配置里有」；加载期 agent-not-found，**尚无一次真投的 resolved+delivered**，未实投前不写「已验证」 |

### 12.3 判据纪律（沿用 v3.7；v3.10 补：12:09:20 那轮取样时的配置 MD5 是 `01d70792ff1e6178010791bfd7a80bdd`／13,007B／六条，与 12:36 的七条不是同一份，引用时须连 MD5 一起引）

加载期六/七条同时报 `agent-not-found` 属正常，不作失败判据；只认随后 `rescan ... result=resolved` ＋ `delivered/<目标>/<文件>` 两条留痕。`signals/` 源目录空是投出后被搬走的正常态，不能当未投达判据。

### 12.4 未结项

- #7 `to-plugin-group` 尚无一次真投（项目总负责人判据③未对第 7 条执行）。
- #2/#4 `doubao` 两条在 `rescan#3` 报 `not-found`，需豆包联络人群分身本人 `DSH_SESSION_ID` 直读自证，或主人重启后另取一次 rescan。

（v3.7 及更早各版原样保留不改写。）
## 十三、通用规则：身份 id 的采信（v3.9 新增，2026-11-16 13:00，大肥鱼 · AI writer项目组，session `03205043`）

1. **只收本人直读自证**：某 Bot 的现行 session id，唯一合格来源是该 Bot 本人 `DSH_SESSION_ID` 直读（或本人 `date`＋会话文件写入两点同证）。
2. **第三方推测值一律标「未自证·不作判据」**：`state.json` rooms 现值、relay 配置值、他人转述，都只能当「取样记录」，可作旁证，不得单独作为「这是他的现行 id」的依据，更不得写进 From/To 当凭据。
3. **历史件不回改**：已投出或已定稿的件里的旧 id 保留原文，只在新版本表格里标「已轮换·非现行」。
4. 已按本条处置的样例：`4d758355`（§三，第三方填入、已标「他人推测·作废」）、`4f18b03f`（wakeup-inbox 与 signals 两条 watch 的旧目标，已由 `6acae4d3` 取代）。

v3.8 及更早各版原样保留不改写；本版只追加本节。
## 十四、v3.10 变更记录（2026-11-16 13:02，大肥鱼 · AI writer项目组，session `03205043`）

按项目总负责人 12:59 的两点补入，另修 §12.2 第 7 条措辞：

1. **取样行三件套**（升格为 §十三 的执行细则）：每行除「本人自证」外，必须带 ①as of 时刻 ②当时的配置文件 MD5 与字节数。取样记录与判据要能被分开读——只看 MD5 就能判断这行是在哪一版配置下取的。
2. **§12.2 第 7 条**（`to-plugin-group`→`c9ff5961`）改为「只算配置里有」，措辞见本版表格；一次真投的 `resolved`+`delivered` 出来后才可写「已实投验证」。
3. 同步在 §12.3 记明：12:09:20 那轮八行取样对应的配置是 `01d70792…`／13,007B／六条，与 12:36 的 `2f4a89b7…`／13,229B／七条**不是同一份**，引用必须连 MD5 一起引。

v3.9 及更早原样保留不改写。