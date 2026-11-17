# P11 首验（QA）

> 状态：已实施（2026-11-13 23:5x · P11 设置卡 + exact + 启动期有限重扫；结论 **PASS**）
> 派验单：`.batch/night/review-requests/p11.md`（7 条）· 交付方：豆包联络人 · 首验人：QA
> 仓库：`C:\develop\workspace\dsh-handoff-relay` · 基线 HEAD `4fb80da`（未提交）
> 验收基线：报告 `.batch/night/reports/p11-settings-card.md`（11,025B，23:42:09）

## 结论

**PASS · 7/7**。范围裁定按负责人「最小必要」：`client.js` 与 `package.json` 三处声明不判越界。

## 七条实测

| # | 判据 | 实测 |
|---|---|---|
| 1 | `TOTAL:` ≥95/95、exit 0、只加不删 | `TOTAL: 95/95 PASS` / `RESULT: PASS` exit 0；`index.test.mjs` `201 1`，唯一删除行是 `-import { apply } from './index.js';`（import 改写），**用例 0 删** |
| 2 | `source:` 与 `4fb80da` 逐字同 | `index.js:441` = `source: Object.freeze({ kind: \`plugin:${PLUGIN_NAME}\` }),`，与 `git show 4fb80da:index.js` 同串 |
| 3 | 真实 profile yml mtime/字节未变 | `~\.dsh\profiles\desktop\cordis.patch.yml` 10,317B、mtime **11-13 23:05:00**——早于 P11 派出（23:33）与交付（23:42），未被写 |
| 4 | `client.js` 无 value import 播种包 | 全文仅 `client.js:12` `const React = require("react")`；`@deepseek-ai/dsh-client-ui-settings` 只出现在 `:3` 注释里 |
| 5 | `exact` 三态 | `:392` 签名 `exact=false` 缺省；`:402` `exact ? title === targetTitle : title.includes(targetTitle)`；`:931-938` 非布尔 → warn 点名 watch/字段/类型 + `relayLog(warn)`，**整条 watch 跳过**（不退回包含）。用例 `:1779/:1784/:1789` |
| 6 | 重扫常量/条数/格式 | `:30-32` `RETRY_DELAYS_MS=[1000,5000,15000]`、`MAX_SCAN_ATTEMPTS=3`、`MAX_SCAN_WINDOW_MS=21000`；`:872` `rescan#${n} dir=${watchDir} result=${result}`；成功也写、最多 3 条/次加载。用例 `:1822`（第 1 次即成功只 1 行）、`:1826`（第 2 次成功无 `#3`）、`:1830`（3 次全败恰好 3 行）、`:1928`（真实链路 ≤3 条） |
| 7 | `delivered/` 清理与 `takeDelivered` 未动 | diff 无 `MAX_DELIVERED*`/`pruneDelivered`/`takeDelivered` 的增删；唯一新增 `fs.renameSync(tmp, filePath)` 在配置原子写里（`replaceWatchesInYml` 后落盘），不属投递路径 |

## 只记录不拦

1. **「保存→重启→生效」链未跑**：一期不要求热更新，重启后生效属预期，由负责人真机验。
2. **`client.js` 是否被宿主自动发现、`inject` 是否必要**：真机验范围。
3. **原子写留临时文件风险**：`:tmp` 命名 `${filePath}.p11-<ts>.tmp`，写失败分支返回错误但未清理 tmp（未见 `unlink`）——当前不影响判定，记 backlog。
4. **`exact` 的解析只认字符串 `'true'`**：`:584` `item.exact = raw === 'true'`，即 yml 写 `exact: yes`/`True` 会被当成 false 而非报错；判据只要求「非布尔报错」，配置侧是文本，故不拦。

## 区间结论

- `numstat`：`305 8 index.js`、`201 1 index.test.mjs`、`9 0 package.json`，另 `?? client.js` 9,021B；porcelain 与自报一致。
