P44 收口，直接照做，不要重述计划、不要复核工作区（落点/HEAD/porcelain 投方已核过：C:\develop\workspace\dsh-handoff-relay，HEAD 8e4ad64，porcelain 0）：
1. 自证一遍够了，直接写代码。
2. 先改 index.js 注册路由，再改 client.js 接 fetch，最后跑 node index.test.mjs。
3. 完成后一次点名 git add index.js client.js index.test.mjs 提交，然后把报告写到 C:\develop\workspace\AI-writer\develop\.batch\night\staging\p44-dir-probe-report.md（末行 <!-- DONE -->），并写信号 C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p44-dir-probe.done（三行：p44-dir-probe / 提交 SHA / porcelain）。
4. 最后在对话里只贴：提交 SHA、git show --numstat 原文、测试输出末 10 行。写完即停。
