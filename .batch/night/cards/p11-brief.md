# P11 启动期补投（待 P10 收口后派）

卡号：P11
仓库：`C:\develop\workspace\dsh-handoff-relay`
执行方：豆包（经豆包联络人派卡）

> 交付物卡面由负责人给：`.batch\night\cards\p11-startup-rescan.md`（3,646B）。派卡以该文件为准，本文件只是联络人侧的派前核对清单。

## 派前核对（我发现并待负责人确认的三点）

1. **卡面字节与登记不一致**：`.batch\night\cards\p11-startup-rescan.md` 现为 3,646B，而负责人 22:50 我在群里收到（22:49 写）的登记也是 3,646B，但负责人 22:53 的更正说「P11 现为 3,737B，写的是 25→35」。以哪个版本派出，需负责人点头。
2. **无法手动选模型**：模型菜单打不开（三次探针均失败），芯片固定为「自动 中」。P11 属代码类，需要 DeepSeek V4.1 Flash 时，只能由负责人或主人手动切换。
3. **`task` 是追加不是新建**：`doubao.mjs task` 走的是当前线程。派 P11 时如果不想复用 P10 上下文，就要用 `bootstrap.mjs` 新开线程，再用 `bootstrap.mjs --keep --project AI-writer-wt-1` 补选项目。

## 已知边界（沿用 P10）

- 只改 `index.js`、`index.test.mjs`；`git add` 点名两个文件、禁 `-A`、不许 `git commit`。
- 不许重启 DSH，不许往生产 watch 目录丢测试文件。
- 报告落 `.batch\night\reports\p11-startup-rescan.md`，末行 `<!-- DONE -->`。
