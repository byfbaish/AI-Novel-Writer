# 重启现场记录（重启后新会话先读这一份）

## 截至 2026-11-14 02:16（重启前）

- 触发本次重启的决定：主人 11-15 口径——解冻并恢复 watch（只放一个探针）、0.4.1 等 DSH 重启且一切正常后再发、v0.4.0 tag 保留并标注不可用。
- 仓库 `C:\develop\workspace\dsh-handoff-relay`：`HEAD=43c3762 chore: release 0.4.1`（父 `848c26d`），`version=0.4.1`，porcelain 空，`git tag` 仍 4 个且无新 tag，未 publish（`npm view` 仍 0.3.2）。
- 代码状态：P13 `c55d7f1`+`3e9abd6`（不在声明之外碰 `ctx.settings`）、P14 `2ea6b53`+`26ba94c`（`ctx.inject(['settings'], cb)` 挂卡 + `createRequire(<profile>/package.json)` 解析 schemastery）、P15 `848c26d`（`client.js:172` 括号修复，卡片可见）、P16 `43c3762`（版本号）。
- 验收状态：P13/P14/P15/P16 均 QA 首验 PASS；P15 已真机 PASS（截图 `.batch\night\evidence\p15-card-visible\settings-plugin-card-0158.png`；`?rev=` `1d66f1e4dfdc`→`3cf506475afe`）；终审文件 `.batch/night/reports/p13-verdict.md`、`p14-verdict.md`、`p15-verdict.md`。
- 主 profile：Junction 直指仓库，**不需要 `install`**；`cordis.patch.yml:295` 已 `disabled: false`（备份 `.bak-resume-1114`），文件 10,907B、UTF-8 无 BOM。
- 存量清理：6 条移到 `.batch\night\archive\resume-1114\`（`wakeup-inbox` 1、`signals\doubao` 2 个 `.done`、`bridge\to-owner` 3）；7 条 watch 目录清前清后均只剩 `.gitkeep`。
- 热重载已证实：改配置无需重启即生效（02:14:16 `启动 7/7 个 watch`）；探针 `probe-resume-1114.txt`（376B，指向 `daeb834f`）02:14:34 投出并唤醒负责人。热重载路径下仍有 `WARN 设置卡未挂载：宿主无 settings 服务（跳过）`，所以设置卡必须在**正常启动**后才出现。
- 会话 id：`~\.dsh\sessions\--C-develop-workspace-AI-writer-develop--\` 下按目录持久化，11-13 重启后一条未变 ⇒ 重启后无需改 watch 的 `targetSessionId`。
- 重启目的（仅两件）：设置卡在主实例挂上、验正常启动扫描路径。恢复投递能力这件事已经由热重载完成。

## 重启后要做（按 `.batch\night/staging/restart-interaction-script.md` B5–B8）

1. 读本文件恢复现场。
2. 查 `relay.log` 尾部：无 `fatal load failure`；有 `启动 7/7 个 watch`、每条解析行、`设置卡 schema 基线=… resolved=`；**不应**再有 `WARN 设置卡未挂载`。
3. 请主人确认 `设置 → 插件 → 插件配置` 第一块是 Handoff Relay 卡。
4. 放一个探针验投递与唤醒，验完清干净（判据：`delivered\` 只多这 1 条；`to-owner` 那 3 条积压单独记账，不与探针混算）。
5. 全绿后按四项硬门打 tag `v0.4.1`（同一提交补 `README.md:168`、`README.zh-CN.md:145` 的 `#v0.4.1`）、推送、publish，发布说明用 `.batch/night/staging/release-notes-0.4.1.md`。

## 失败处置

B3 主人在主实例答「无卡」→ 不改码、不重试；按脚本「重启后若卡没出现」三步取证（`describe` → 控制台 `slot entry crashed` → 才查时序），并让主人把 `disabled` 改回 `true` 重启。
