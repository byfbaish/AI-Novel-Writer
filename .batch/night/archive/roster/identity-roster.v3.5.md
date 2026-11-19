# Bot 身份名册（v3）

- 用途：handoff-usage-criteria v7 §3.1 / H7-A1 的判定输入。名册不是权限表，只作「From 里的角色名与 8 位 id 是否对得上」的核对依据。
- 生成人：大肥鱼（项目管家）｜生成时刻：2026-11-16T10:58+08:00（v3.5 刷新时刻；首版 06:39）
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
| 大肥鱼（项目管家） | 大肥鱼 · AI writer项目组 | 0103a0ac | **c64bc312** | 已确证（`state.json` rooms 现值＋`session-c64bc312-…/session.v4.jsonl.zstd` 10:58:26 仍在写入；旧值 `66023777` 于 10:42 重启后轮换·非现行，更早 `6441a6cb` 亦作废） |
| 项目总负责人 | 项目总负责人 · AI writer项目组 | 5b5bc124 | **51aa9018** | 已确证（本人 10:34 用本会话 `DSH_SESSION_ID` 直读自证 `session-51aa9018-7b91-44ea-8f8a-996ab38e7b69`，与 rooms 现值同值；`session-51aa9018-…` 10:58:22 仍在写入。旧值 `64419d69` 已轮换·非现行） |
| workbuddy联络人 | workbuddy联络人 · AI writer项目组 | 7c3feeab | **4f18b03f** | 已确证（本人 10:21 实名自查：本进程 `DSH_SESSION_ID` 直读＋`state.json` 的 `rooms` 同值，mtime 10:13:56；QA 与 developer 独立复核一致。旧值 `d17681e6` 已轮换·非现行，会话文件最后写 06:57:21） |
| 豆包联络人 | 豆包联络人 · AI writer项目组 | 27a1c2ae（已确证） | **27a1c2ae**（rooms 映射） | 11-16 07:42 该 Bot 自报三条证据：cordis.patch.yml:301/:307 两条 doubao watch 同值、rooms 映射同值、其 session 目录 07:42:25 仍在增长；已确证 |
| QA | QA · AI writer项目组 | 1586edd1 待复核 | **2ae0758e** | rooms 现值＋`session-2ae0758e-…/session.v4.jsonl.zstd` 10:57:45 仍在写入；**本人 `DSH_SESSION_ID` 自证未到，未自证前只作「room 现值」、不作判定依据**（旧值 `57c8bd18` 已轮换·非现行） |
| 产品经理 | 产品经理 · AI writer项目组 | 090e6e7d 待复核 | **4e6e07bd** | 已确证（06:37 写入） |
| developer | developer · AI writer项目组 | 585a879b 待复核 | **332cfc5a** | 已确证（本人 10:48 双源自证：本会话 `DSH_SESSION_ID` 直读 `session-332cfc5a-b91a-4b98-ba14-8382c914f5bf` ＋ rooms 同值；`session-332cfc5a-…` 10:58:22 仍在写入。旧值 `906d802a` 已轮换，`4d758355` 系他人推测值、作废） |
| 金牌编辑 | 金牌编辑 · AI writer项目组 | 3460ca40 待复核 | **55617061** | 已确证（06:37 写入） |

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

| # | 目录 | 绑定 session | 应对身份 | 结论 |
|---|---|---|---|---|
| 1 | `scripts\dsh\wakeup-inbox\workbuddy` | `d17681e6` | workbuddy联络人 · 群分身 | 对 |
| 2 | `scripts\dsh\wakeup-inbox\doubao` | `27a1c2ae` | 豆包联络人 · 群分身 | 对（rooms 映射同值） |
| 3 | `.batch\night\signals\workbuddy` | `d17681e6` | workbuddy联络人 · 群分身 | 对 |
| 4 | `.batch\night\signals\doubao` | `27a1c2ae` | 豆包联络人 · 群分身 | 对 |
| 5 | `.batch\night\bridge\to-owner` | `0103a0ac` | 大肥鱼 · 主身 | 对（06:48 实投已验证） |
| 6 | `.batch\night\bridge\to-group` | `aa5256c5` | **无对应现行群分身**（大肥鱼在本群是 `6441a6cb`，在「DSH 插件组」是 `c9ff5961`；`aa5256c5` 最后写 06:06） | **指空，须重绑** |

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
