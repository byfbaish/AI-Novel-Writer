# P17 终审 · AI writer总负责人

- 卡号：P17（`.batch/night/cards/p17-client-inject-configforms.md`）
- 交付：`C:\develop\workspace\dsh-handoff-relay` @ `74f4cc1`（父 `43c3762`），version 0.5.0
- QA 首验：`.batch/night/reports/p17-qa-firstcheck.md`，PASS（7/7）
- 终审时刻：2026-11-14 03:07
- **结论：PASS（限真机未验的部分，见「未覆盖」）**

## 我据以判定的三条
1. QA 的 7/7 不是对照清单打勾：第 2、3 条都给了 `client.js:216-226` 的行级对应与 spy 断言口径（`registered === 1`、service 对象非 undefined），第 6b 条做了独立反证——旧 blob `e76141cf…` 配 HEAD 测试 `111/117 FAIL exit 1`，四条 P17 全红且带 2 条 P15 渲染红，证明新用例真执行到 `apply` 与渲染路径，不是空壳。
2. 我另要的那条「延后分支不许在正常路径走」被明确核了：`if (forms) { mountWith(forms); return; }` 在 `ctx.inject` 之前，正常路径直接 return。
3. README 未改的理由成立（两份 README 对 `settingsScope|configForms` 零命中，无常量可同步），且 QA 把「不是漏做」写成了可核的行号对应。

## 绑定条件（不满足则本终审作废）
- **打 tag 那次同一提交**必须做两件：① 安装行 `#v0.4.0` → `#v0.5.0`（`README.md:168`、`README.zh-CN.md:145`）；② 「From `0.4.0` / 从 `0.4.0` 起有卡片」改为 `0.5.0`（`README.md:236`、`README.zh-CN.md:202`）。理由：`v0.4.0` 是已公开标注不可用的坏版，README 现在指向它；0.4.x 事实上从来没有能用的卡。
- P16 记的「打 tag 时补 `#v0.4.1`」**作废**，按本条执行。

## 未覆盖（不由本终审背书）
1. `ctx.get(name)` 对未声明服务是否安全——单元层无法证，社区 issue #29 只证了 `ctx.X` 属性访问会被拦。
2. 桌面端 0.2.2-rc.1 实际出卡：`configForms` 是否真被宿主暴露、卡是否出现在「插件配置」页。
3. 去掉 `immediately` 后条目能否首次加载即挂上（不 pending）。
4. 旧宿主只有 `settingsScope` 时卡是否照常出。
→ 以上四项全部押在真机，真机不过则本终审翻为 FAIL。

## 记账（不阻塞）
- R1：延后回调只回读 `configForms`，老宿主 `settingsScope` 晚到会漏挂（概率低）。留作已知边界，不为此加分支。
- R2（已消解，03:25）：远端 master 已推至 `74f4cc17a5f7d47bafa610255eb40e91d7f5ecd1`；push 输出 `8c5c073..74f4cc1  HEAD -> master` exit 0，`ls-remote` 与本地 HEAD 一致，porcelain 推后仍空。

## 下一步
真机：`.batch/night/staging/real-machine-050.md`（开开关 → 退出 DSH → 启动 → 看崩不崩 → 看卡），崩了按该文件的回滚三行处理。
