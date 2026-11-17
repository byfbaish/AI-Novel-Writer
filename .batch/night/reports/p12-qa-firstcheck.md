# P12 首验（QA）· README 0.4.0

> 状态：已实施（2026-11-14 00:02 · P12 首验；结论 **PASS · 5/5**）
> 派验单：`.batch/night/review-requests/workbuddy-night-1113.md`（P12 段）· 交付：提交 `8c5c073d090154094c479650e7355958cedc7c6e` + 报告 `.batch/night/reports/p12-readme-040.md` · 首验人：QA

## 结论

**PASS · 5/5**。提交面干净、双语对应、三块新内容齐全、`#v` 硬编码只剩同一示例的两语言版本、脱敏 0 命中、自测 95/95。

## 判据逐条

1. **diff 只有三个文件**：`git show --numstat` = `50 4 README.md`、`40 3 README.zh-CN.md`、`1 1 package.json`；`git status --porcelain` 空。`package.json` 的 diff 只有 `"version": "0.3.2"` → `"0.4.0"` 一行，`files` / `exports` / `dsh.client` **未被本次提交改动**（它们属于 P11 工作区，已随提交 `27c40bb` 落库）。
2. **三块内容都在**（双语各一）：`## Settings page` / `## 设置页`（保存只写 yml、重启后生效、重启前需确认）、`exact` 三态（`watches[].exact` 布尔、省略/`false` 包含匹配、`true` 全等、非布尔报错**跳过整条 watch**）、`## Startup rescan`（`RETRY_DELAYS_MS = [1000, 5000, 15000]`、`MAX_SCAN_ATTEMPTS = 3`、`MAX_SCAN_WINDOW_MS = 21000`、`rescan#1 … not-found` / `rescan#2 … resolved` 示例、普通投递仍不写 `relay.log`）。
3. **安装示例**：主推写法不带版本号；全仓 `#v\d` 只剩两行——`README.md:168`、`README.zh-CN.md:145`，同一句示例的中英两版，属允许的「一处」。
4. **脱敏**：两份 README 搜 `C:\` / `session-` / `.batch` / `.dsh\` **0 命中**。
5. **自测**：`node index.test.mjs` → `TOTAL: 95/95 PASS` / `RESULT: PASS` / exit 0。

## 记两条（不拦）

1. 报告末「建议提交信息（英文）」两行写的是旧建议 `docs: document settings card, exact matching and startup rescan for 0.4.0`，与实际提交信息 `docs: bump to 0.4.0 and update the install guide` 不一致；负责人已在报告末尾加更正行说明以实际提交为准，**不按建议行核**。
2. 版本号在正文里另有 `README.md:236`、`README.zh-CN.md:202` 两处「从 0.4.0 起有设置卡」的说明，属版本说明不是安装示例，不计入「硬编码 ref」处数。
