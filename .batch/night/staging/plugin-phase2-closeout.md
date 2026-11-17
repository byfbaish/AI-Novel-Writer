# dsh-handoff-relay 二期结项单（骨架）

> 状态：骨架待填（2026-11-14）。**结论一栏留空，由负责人写判定。**
> class: B（仓外文档，不产生仓库提交）。数值与证据由负责人补，本稿只定结构与小节标题。

---

## 1. 范围（本期做了什么）

| # | 交付项 | 一句话说明 |
|---|---|---|
| 1 | 设置卡三列 | 目录 / 目标会话 / 完成规则，一条 watch 一行 |
| 2 | 会话选择器 | 默认 10 条、「查看更多」展开、带搜索；不提供手填 id |
| 3 | `exact` 开关 | 关 = 包含匹配，开 = 标题完全相等；界面写回一律 `true` |
| 4 | 标题优先 / id 兜底 | 标题解析不到或命中多条时才用 `targetSessionId`，仍不唯一则跳过告警、不猜 |
| 5 | 目录选择器与可读性提示 | 可读/不可读/未探测三态提示；只提示不阻断保存 |
| 6 | 投递层物理去重 | 指纹 = 路径 + 字节数 + `mtimeMs`，跨重载与重启不重复唤醒 |

## 2. 技术结论（三条，照原文填）

1. `settings.plugin.item` 在 0.2.2-rc.1 已不存在；真实槽位是 `plugins.row.config` + `plugins.item`。
2. `Config` 必须 `await import()` 取：模块求值期同步 `require` 会撞 `ERR_REQUIRE_ESM_RACE_CONDITION`，异常被 catch 吞成 `undefined`，宿主 `describe()` 静默跳过该条目。
3. client 硬 inject 运行时可能不存在的服务 ⇒ 条目 pending ⇒ 整页 `web boot: 1 entry did not activate`（真机两次）。可选服务一律 `ctx.get` 惰性取。

## 3. 验证边界

- 机制级证据只有真机：两次崩溃日志 + U0/U2 PASS。
- 单测桩不是 cordis 严格代理，复现不了 pending —— 单测全绿**不等于**条目会激活。
- 真机范围以 `staging\real-machine-050-scope-v3.md` 为准。

## 4. 迁移

本轮按 `staging\real-machine-050-scope-v3.md` **跳过**（P33 已证：标题解析同样只遍历存活的会话，迁移解决不了「目标不在线」；同一轮不换两个变量）。迁移段保留在真机脚本里，下一轮再取回。

## 5. 遗留（0.6）

| # | 项 | 说明 |
|---|---|---|
| 1 | `undelivered.json` | not-found 时记账 + 留原地 + 一条 warn；不静默丢、不改投常驻通道 |
| 2 | `dedupe.json` 剪枝 | 按 7 天清理 |
| 3 | `relay.log` 无投递成功行 | 判通道死活只能看 `delivered\` |
| 4 | 选择器显示会话在线状态 | `running`/`blank`；保存后提示「目标当前未打开，投递会在它打开后生效」 |
| 5 | `.batch` 4 个仍被跟踪的文件 | `CLAIM-WB-E1.md`、`S0.txt`、`S1.txt`、`fix-enotempty.md`；`.gitignore` 挡不住已入库文件，按本轮口径「不折腾」，需要时单独一次清理提交 |

## 6. 结论

**判定：PASS（带条件）。** 2026-11-14 收口，负责人（AI writer总负责人）下判。

成立依据（逐项已走「联络人给证据 → QA 首验 → 负责人终审」）：

- 代码与单测：P21 WARN 文案/README 回滚、P22a 标题优先、P22b 三列卡、P22c 旧宿主只读、P26 `await import()`、P27 `sessions` inject、P29 目录选择器与可读性提示、P31 落盘去重 —— 全部终审 PASS，末次全量 `150/150 PASS`（P29 交付时）。
- 真机：两次启动崩溃已定性并修复（`web boot: 1 entry did not activate`）；重启后 **U0 PASS**（行底由「Host 未提供该条目」变「已同步 Host」）、**U2 PASS**（搜索可用、会话标题可枚举）。
- 副本探针：P28a 正反证（`inList`/`configUndefined` 两档读数）证 P26 修复链闭合。

条件（未完成，不计入本期通过）：

1. P29 的目录红绿点与 `firstSessionId` 多会话取值、P31 的去重行为、U3/U7/U8 —— **真机未验**，宿主跑的是旧代码，等主人有空重启后按 `real-machine-050-script.md`（v2，`1D1416A1…`）补验。
2. 0.5.0 **不发版、不打 tag**：npm 保持 0.3.2；README 落地（`staging\readme-050-landing.md`）与发布说明等真机补齐后，在打 tag 那一次一并做并转 A 类。
3. 会话寻址迁移本轮跳过（见 §4），P33 已证其不解决在线问题。

证据位置：`reports\p*-verdict.md`（各卡终审）、`reports\p28a-verdict.md`、`reports\p33-verdict.md`、`reports\real-machine-050-script.md`、`staging\real-machine-050-scope-v3.md`。

<!-- DONE -->
