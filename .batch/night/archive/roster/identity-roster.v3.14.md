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
## 十五、未结项与处置口径（v3.11，2026-11-16 13:06，大肥鱼 · AI writer项目组，session `03205043`）

本节取代 §12.4 作为现行未结项清单（§12.4 保留为当时记录，不改写）。

### 15.1 豆包侧现行 id 待自证（唯一未结项）

- 现象：`relay.log` `rescan#3 04:34:20` 七条 watch 中六条 `result=resolved`，两条 doubao watch（`:299` / `:309`，现值 `27a1c2ae`）报 `not-found`。
- QA 已核：`wakeup-inbox\doubao` 与 `signals\doubao` 两个目录都存在（DIR-OK），故 `not-found` 指**会话解析失败**，不是目录缺失 ⇒ `27a1c2ae` 很可能已死。
- 影响：豆包交付会静默丢件，直到目标会话 id 被修正。
- 待办：豆包联络人直读 `$DSH_SESSION_ID` 贴出前 8 位自证（按 §十三 只收本人直读）。

### 15.2 处置口径（三条，须照此执行）

1. **改配置归主人动手**，Bot 一行不改、不代改。
2. 改完**必须重启**（relay 只在启动时读配置），并确认 `relay.log` 出现新的「启动 N/N 个 watch」行。
3. 验通只认**一次真投**的 `resolved` + `delivered` 两条留痕；**`rescan` 的 `resolved` 不得当投达凭据**。

### 15.3 第 7 条 watch（`to-plugin-group`→`c9ff5961`）

配置里有、`rescan#3` 报 `resolved`，但**尚无一次真投**；按 15.2 第 3 条，不得写「已实投验证」。
## 十六、第 7 条 watch 真投验证（v3.12，2026-11-16 13:09，大肥鱼 · AI writer项目组，session `03205043`）

项目总负责人 13:06 批准一次自投验证，本节为结果。**只验一次，不追加第二轮，不回滚、不重配。**

### 16.1 做法

- watch：`:323`/`:324`，dir=`C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-plugin-group`，targetSessionId=`session-c9ff5961-2f11-4337-a885-3cf826db31b0`（大肥鱼 · DSH 插件组，群分身）。
- 投件：`selftest-7th-watch-1116.md`｜345B｜MD5 `96dcdba1f0eda694e6825d6eb1146c99`｜13:08:18 写入；正文前两行带 From/To 头，末行 `<!-- DONE -->`，内容为纯测试、无业务指令。

### 16.2 结果：**通**

- `relay.log:841` `2026-11-16T05:08:18.922Z` 去重表无该目录记录，首次运行全部视为新。
- `relay.log:842` `05:08:18.936Z INFO 注入身份 from=大肥鱼 · AI writer项目组 | 03205043 to=c9ff5961|大肥鱼 · DSH 插件组|群分身`。
- 落地：`…\dsh-handoff-relay\delivered\7f7c38b2b656\selftest-7th-watch-1116.md`｜345B｜13:08:18；源目录已被搬空（只剩 `.gitkeep`）＝正常态。
- 结论：第 7 条 `to-plugin-group`→`c9ff5961` **已实投验证通过**，`c9ff5961` 活着、能收件。

### 16.3 口径更正（重要，防误判）

- relay **不**为每次投递单独打一行 `result=resolved`；`result=resolved` 只出现在 `rescan#N`（启动后按目录重扫）里。
- 因此单个件的投达凭据是「`注入身份` 行（带 from/to）＋ `delivered/<target>/<file>` 落地 ＋ 源目录被搬空」这三件；`rescan` 的 resolved 只能证明「目录能解析到会话」，不能证明「某件投达」。
- 本节即按此口径判「通」，未拿 `rescan#3` 当凭据。

### 16.4 仍未结项

仅 §15.1：豆包侧 `27a1c2ae` 待豆包联络人直读 `$DSH_SESSION_ID` 自证；`rescan#3` 两条 doubao watch 报 `not-found` 的状态未变。
## 十七、豆包侧自证结论：§15.1 关闭（v3.13，2026-11-16 13:21，大肥鱼 · AI writer项目组，session `03205043`）

### 17.1 豆包联络人自证（本人直读）

- `echo $DSH_SESSION_ID` → `session-27a1c2ae-35db-4d0f-9974-2e612c0ab554`（13:05:27 取），前 8 位 `27a1c2ae`。
- 会话文件在写：`…\session-27a1c2ae-…\session.v4.jsonl.zstd` 13:05 = 1,647,171B → 13:06 = 1,647,363B。

### 17.2 我的独立复核（13:20–13:21）

- 同一会话目录存在，文件 13:08:01 = 1,658,715B（继续增长），未被换段。
- `cordis.patch.yml` 13,229B｜MD5 `2f4a89b7083bb072a3eefcad737e7c6a`，`:299` 与 `:309` 均为 `session-27a1c2ae-…`，与自证值一致（文件 mtime 13:19:31 又被同内容重写一次，MD5 不变）。
- 七条 `targetSessionId` 现值：`:294`/`:304`=`6acae4d3`、`:299`/`:309`=`27a1c2ae`、`:314`=`3286c9d7`、`:319`=`03205043`、`:324`=`c9ff5961`。

### 17.3 结论

- **§15.1 关闭**：豆包两条 watch 未绑错，`27a1c2ae` 是现行群分身，**无需改配置、无需重启**。
- `rescan#3` 那两条 `not-found` 属**加载时序**，不是绑错：同一份日志里 `04:34:06` rescan#1、`04:34:09` rescan#2 七条**全部** `not-found`，`04:34:20` rescan#3 只有当时在跑的会话转 `resolved`。取数那一刻未注册即报 `not-found`，与 id 对错无关。
- 由此新增一条判据纪律：**`rescan` 的 `not-found` 不能反推「绑错」**，须与「会话文件是否仍在增长＋本人 `$DSH_SESSION_ID` 直读」两条合看。
- 唯一残留（非阻塞）：待一次**真实**投递到 `signals\doubao` 或 `wakeup-inbox\doubao` 的样本，届时看 `relay.log` 的注入行与 `delivered/` 落地即可，**不造探针**。

### 17.4 当前未结项

无阻塞项。第 7 条已实投验证通（§十六）；豆包侧已自证（§十七）。
---

## 十八、v3.14：第 7 条判词入册 ＋ 三处机制措辞修正（2026-11-16 13:37）

### 18.1 第 7 条 `to-plugin-group`→`c9ff5961` 结论
**通（PASS）**。判词：`.batch/night/reports/qa-7th-watch-livecheck-1116.md`｜2,909B｜`0ad88e51affa71e74bf4d40bd1b7ce77`｜13:24:37。developer 13:36 独立复核同样判「验成」。**不回滚、不重配、不追第二轮。**

### 18.2 单件投达的四件凭据（定稿，取代此前一切简写）
1. `relay.log` 的「注入身份」行（如 `05:08:18.936Z from=大肥鱼 · AI writer项目组 | 03205043 to=c9ff5961|大肥鱼 · DSH 插件组|群分身`）；
2. 该件在 `dedupe.json` 的记账项（`at` / `contentHash` / `targetSessionId`，由 `rememberDeliveredSnapshot()` 在注入成功后写，`index.js:1328-1331`）；
3. `delivered\` 下的副本（字节与源件一致）；
4. 源目录被搬空（只剩 `.gitkeep`）。
`rescan#N` 的 `resolved` **不作单件凭据**——那行只在目录级重扫时打。

### 18.3 读日志陷阱（必须记住，否则判反）
注入成功后同毫秒常跟一条 `去重跳过 … 原因=重复(size,mtime 相同)`。它不是「没投」：`deliver()` 先去重（`index.js:1285-1287`）、命中才 skip；这次是注入完成、文件被移入 `delivered\` 后再触发一次 fs 事件，才命中去重表。**判投达看 18.2 四件，不看有没有「去重跳过」。**

### 18.4 两处机制措辞修正（我先前表述不准，以此为准）
- `delivered\` 子目录**不是按目标 session**划分，而是 `dirKeyOf()`（`index.js:281-284`）＝ `sha1(path.resolve(dir).toLowerCase()).slice(0,12)`，按 **watch 目录**取哈希；第 7 条实测目录名 `7f7c38b2b656` 即该 watch 目录的哈希前 12 位（developer 13:36 指出）。
- 去重主判据是**内容哈希**（`index.js:472-491`）：**改名但字节不变照样判重，只有改字节才放行**（QA 13:24 指出）。故「同一路径补件」必须改字节，只改名无效。

### 18.5 现状补记
relay 第 4 次重启 `05:17:17.315Z 启动 7/7`（CST 13:17:17），加载期七条全 `agent-not-found`、`rescan#3 05:17:32` 仅 to-owner/to-group resolved——仍是加载时序，不构成本次验证回退。配置未变：13,229B｜`2f4a89b7083bb072a3eefcad737e7c6a`｜`:324`=`session-c9ff5961-2f11-4337-a885-3cf826db31b0`。
