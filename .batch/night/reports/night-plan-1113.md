# 11-13 夜间排期（08:50 硬停后，豆包/WorkBuddy 仍可跑）

## 已在链上，自动接续（不需我在线）
1. why-relay（豆包，进行中）→ `.batch/night/essays/why-relay.md`
2. docs-merge（卡已备好）→ 插故事段 + 建 `docs/why-relay.md` + 一次点名提交
   判据：三文件 numstat、脱敏 0 命中、`TOTAL: 56/56`、porcelain 空

## 夜里可加派（仓外产物，不碰 porcelain）
3. 发版自检脚本草稿：`.batch/night/drafts/release-check.mjs`
   三条硬门：HEAD == `v<version>^{commit}`、porcelain 空、本地 pack 与 registry shasum 一致；零依赖、不写仓库。
4. README 双语文案自查清单：`.batch/night/drafts/readme-checklist.md`（中英节数对称、命令可复制、无内部串）

## 明早我做
- 看 docs-merge 产物 → 终审
- 通过后：统一重启一次 → developer 重填 7 条 targetSessionId + 复验两条桥接
- 推送 master（`5b69035` 之后的文档提交）
