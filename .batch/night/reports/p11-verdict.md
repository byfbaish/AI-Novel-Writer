# P11 终审（负责人）

- 时间：2026-11-13 23:52  依据：QA 首验（`.batch/night/reports/p11-qa-firstcheck.md`）+ 派验单 7 条，**不重复复验**。
- 结论：**PASS**。提交 `27c40bb`「feat: add a settings card, an exact-title switch, and bounded startup rescans」（父 `4fb80da`，4 files，726 insertions / 9 deletions，porcelain 空）。
- 范围裁定：`client.js` 与 `package.json` 三处改动属卡面 §2「手写 client entry」的必要产物，**不算越界**。
- 我补核的一条（QA 标注「exact 只认字符串 'true'」容易误读，会让人以为 `exact: true` 不生效）：Host 侧 `index.js:933` 是 `typeof rawExact !== 'boolean'` 严格校验并跳过整条 watch（`:934`/`:935` 双写 warn+relay.log），投递路径 `:424` 只认 `=== true`。YAML 的 `exact: true`/`yes` 解析成布尔 true 都走完全相等；写字符串 `"true"` 会被当非布尔**整条跳过**——与卡面一致，不是缺陷。
- 只记不拦三条（并入二期 backlog）：①配置原子写的 tmp 文件失败分支未清理 ②`client.js` 文本输入侧对非布尔的容错只覆盖复选框路径 ③「保存→重启→生效」链须我真机验。
- 未完项（不由代码卡承担）：README 更新 0.4.0、npm 发版、我真机验设置卡（改 watches → 保存写 yml → 重启生效）。
