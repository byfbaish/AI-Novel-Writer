---
## 投递指令（投方补充，与正文同等效力，冲突以本节为准）

**落点与自证**：落点是 `C:\develop\workspace\dsh-handoff-relay`（master），不是线程 chip 显示的 `AI-writer-wt-1`。开工第一步只自证一次：`git -C C:\develop\workspace\dsh-handoff-relay rev-parse --show-toplevel` 应为 `C:/develop/workspace/dsh-handoff-relay`，`HEAD` 应为 `8e4ad642095e9f239038e86468d9dced459361fa`，`git status --porcelain` 应为空。三项全部符合就**立刻开始写代码**，不要重述计划、不要反复复核工作区、不要再问确认。任一项不符就停下报告实况，禁止自己 reset/checkout/stash。

**测试命令**：`node index.test.mjs`（本项目 test 脚本是自跑式断言），**不是** `node --test`，也不是 `pnpm test`。

**提交**：完成后一次点名提交，例如 `git add index.js client.js index.test.mjs`；**禁 `-A`**、禁 push、禁打 tag、禁 publish。禁改 `package.json`、两份 README、`cordis.patch.yml`。

**报告**：落 `C:\develop\workspace\AI-writer\develop\.batch\night\staging\p44-dir-probe-report.md`（注意根目录是 develop，写绝对路径），末行 `<!-- DONE -->`，必须含：提交 SHA、`git show --numstat` 原文、`git status --porcelain` 结果、测试输出末 10 行。

**信号**：报告落盘后立刻写 `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p44-dir-probe.done`，三行：`p44-dir-probe` / 提交 SHA / porcelain 结果。

**回执**：最后在对话里贴这三样原文——提交 SHA、`git show --numstat` 原文、测试输出末 10 行。写完即停，不要继续做本卡以外的事。


投出时刻：2026-11-14 20:55:35（正文原卡 4,810B / MD5 D74A6852E2B55F61FBBCA3337A39AAFE，未改动一个字节）
