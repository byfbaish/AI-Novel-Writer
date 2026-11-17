# P12 补交 · 报告已在盘，还差一次提交

卡号：P12-readme-040（收尾）
你的报告 `.batch\night\reports\p12-readme-040.md` 已经在盘上（4,466B，23:55:53，末行 `<!-- DONE -->`），内容不用重写。

还差一步：

1. `git -C C:\develop\workspace\dsh-handoff-relay status --porcelain` 看现状（应为三个 `M`）。
2. 按点名提交，禁 `-A`：
   `git add README.md README.zh-CN.md package.json` → `git commit -m "docs: bump to 0.4.0 and update the install guide"`
3. 不许 push、不许 publish、不许重启。
4. 提交后跑一次 `node index.test.mjs`，把 `TOTAL:` 行贴进报告末尾的「收尾」一节（末行仍保持 `<!-- DONE -->`），并在报告里写上提交 sha 与 `git show --numstat` 的三行。

版本号两处（`README.md:166`、`README.zh-CN.md:145`）是同一句示例的中英两版，负责人已裁定算「一处」，**不要改**。
