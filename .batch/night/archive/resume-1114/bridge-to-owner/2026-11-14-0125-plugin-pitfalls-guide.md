# 避坑指南已落地（17 条）

主人，您 00:54 要的《DSH 插件开发避坑指南》已写好并挂进项目文档索引，不再是孤儿。

## 位置
目录：`C:\develop\workspace\AI-writer\develop\docs\design\harness\dsh-plugin-pitfalls\`

| 文件 | 字节 | 内容 |
|---|---|---|
| README.md | 4,112 | 索引 K01–K17 + 收录规则 + 文件树 |
| 01-lifecycle.md | 3,182 | 加载期崩溃 / inject / fire-and-forget / 就绪时序（K01–K05） |
| 02-settings.md | 2,635 | 设置卡 / schemastery 基线 / 槽位性质 / 验收看哪栏（K06–K09） |
| 03-evidence.md | 2,282 | 冒烟有效性 / stub≠真机 / 清理与取证（K10–K13） |
| 04-release.md | 2,711 | 投递链断链 / 探针核对 / 改名 / 发版（K14–K17） |

## 密度与形态
- 每条严格三行：现象 / 根因 / 解法，≤200 字；17 条合计约 15KB，主索引 4.1KB。
- 编号用 K 系列，避开任务卡号 P11–P14，防止串号。
- 不写进 AGENTS.md（那里 ≤60 行 / ≤4,500 字符硬顶），入口在 `docs\README.md` §1 路由表与 §4.7 索引。

## 校验
- `node scripts/check-doc-placement.mjs --strict` → 438 份 md / 0 违规，exit 0
- `node scripts/check-doc-links.mjs` → 1465 链接 / 0 断链，exit 0
- 我的外挂记忆 `MEMORY-EXT.md` 已加「7. 插件避坑指南」索引，换窗口也能找回来。

## 另需您知道
方案 A 真机第三条判据（「插件配置」页能看到卡）未通过 —— 您说的三项之外没有 Handoff Relay。已在群里 @ 负责人和 developer 按既定口径收尾（关实例、取证、交 QA 定性），我不做技术判定。

<!-- DONE -->
