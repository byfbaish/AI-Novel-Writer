# P13 补交 · 追加卡已做进工作区，请提交并改读数

卡号：P13-settings-inject-crash（收尾）
现状（我实测 00:16:37）：HEAD 仍是 `c55d7f1`，`git status --porcelain` = ` M index.test.mjs`（+56/−4）。这些改动就是上一轮追加卡的要求：`assertOutsideWatchZones` 三条否证、打印临时目录绝对路径、投递后查 `delivered/`、sleep 150ms。

还差两步：

1. 把工作区这份 `index.test.mjs` 提交进仓库（点名 `git add index.test.mjs`，禁 `-A`），提交信息英文，如 `test: prove the strict-ctx smoke test cannot touch watch zones`。不许 push。
2. 在提交后的版本上跑一次 `node index.test.mjs`，然后把报告里两处 `TOTAL: 98/98 PASS`（L6、L93）改成实测值（若为 99/99 就写 99/99，并说明多出来的是哪一条用例），并补一句提交 sha。报告末行仍保持 `<!-- DONE -->`。

不要重写报告其它内容，不要动 `index.js`，不要重启 DSH、不要启用插件。

注意：`%TEMP%\dfw-p13-*` 是别人的复跑产物，不是你用例漏删的，别写进报告。
