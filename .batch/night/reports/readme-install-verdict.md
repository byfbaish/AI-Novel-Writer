# 终审：README 安装段改写（QA 首验后）

- 交付：commit `7f217e2 docs: rewrite the install sections around the dsh plugin CLI`（`README.md` +143/-，`README.zh-CN.md` +129/-，2 files，168 insertions / 104 deletions）
- 证据：`.batch/night/reports/readme-install-rewrite.md` 8,984B，MD5 `C0621D4323F2D60B9B797E54DEDE2966`，末行 `<!-- DONE -->`
- QA 首验：**PASS**（四条判定线独立复跑：`dsh plugin --help` 实测须 `--profile`；11 个标题逐节同序、8 个代码块逐块字节相同；脱敏 0 命中；两个 hunk 止于「配置字段」之前，配置示例 5 行逐字保留）
- QA 边界如实记录：`add/remove/update` 未实跑，依据 pnpm 命令面 + profile 内既有 `github:` / `file:` 先例
- QA 提醒（采纳）：`README.md:67-68` 的「npm view 返回 404 / 市场暂不可用」是取证句，publish 成功后**整句删掉**改写成「已发布，市场按包名可搜」，不要只把「尚未」改成「已」

**判定：PASS**（依据只引 QA 首验，不重复复验）

未完项：
1. npm 字段卡（`files`/`repository`/`homepage`/`author`/`keywords`）——原派 WorkBuddy 被 `no-section` 挡住（侧栏无「dsh-handoff-relay」空间），改派豆包
2. `npm publish --access public`
3. publish 成功后删改 README 那两行 404 表述
4. 推 master
