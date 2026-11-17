# P15 终审：PASS（待主人肉眼确认后结）

- 卡号：P15（`p15-fix-relay-card-render`）；卡面 `.batch/night/cards/p15-fix-relay-card-render.md`
- 提交：`848c26d fix: keep relay card rows inside the h() argument list`（父 `26ba94c`，未 push），porcelain 空，只改 `client.js`（2/2）与 `index.test.mjs`（83/0）
- 豆包报告：`.batch/night/reports/p15-card-render-fix.md`（8,554B，末行 `<!-- DONE -->`）
- QA 首验：PASS，`.batch/night/reports/p15-qa-firstcheck.md`，已登记 `.batch/night/review-requests/P15.md`
- 真机证据：`.batch/night/reports/p15-card-visible-evidence.md` + 截图 `.batch/night/evidence/p15-card-visible/settings-plugin-card-0158.png`（112,115B）

## 依据

1. 代码：`client.js` diff 恰好两处括号；`:172` 以 `eo"),` 收尾，`row.doneKind` 分支回到 `h(...)` 参数表内。
2. 回归测试真执行：桩 `h` 对函数 child 求值、断言行节点 3 个；旧代码（`26ba94c:client.js`）下 `111/113 FAIL` exit 1，原文 `渲染抛错：row is not defined`，与真机控制台同一条；新代码 `113/113 PASS` exit 0。QA 独立复现过红。
3. 真机（隔离 profile 实例，browser-skill）：「插件配置」页最上面就是 Handoff Relay 卡——目录 / 目标会话 / 完成规则 / 删除 一行表格、`exact` 勾选、`新增一行 / 保存 / 放弃修改`、「已同步 Host（revision 0）」，官方三项（终端 / Agent 循环 / 网页搜索）仍在下方；控制台无 `slot entry crashed`。
4. `?rev=`：`1d66f1e4dfdc` → `3cf506475afe`，等于服务端实际所发字节的 sha1 前 12 位；旧值对不上是因为拿仓库新文件算了正在被缓存的旧份。
5. 我本人看过该截图，与上述描述一致（卡在「插件配置」页顶部，字段完整）。

## 修掉的根因链（写进二期结论）

- 真因：`client.js:172` 的 `))` 提前闭合 `h("div", …)`，`row` 出了作用域 → 渲染抛 `ReferenceError` → 宿主渲染层吞掉 → 页面表现为「没卡」。
- 误判诱因：只看「有没有卡」会把渲染崩溃当成注册失败。正确三步：`settings.describe` → 控制台 `slot entry crashed` → 才查时序。
- 真机环境坑：profile `.pnpm` 副本会在实例启动后被重新物化成旧字节，改码后必须先 `dsh plugin --profile <p> install` 刷新并核 md5；`?rev=` 只能在网络面板读并与改动前对比。

## 仍待办

1. 主人肉眼确认（截图已发群）——不回不算结。
2. `848c26d` 未 push；0.4.1 发布须过四项硬门（tarball == tag 指向提交、`HEAD == tag^{commit}`、porcelain 空、版本号 0.4.1）后才打 tag。
3. 主实例仍停用；恢复须走 `.batch/night/staging/restart-interaction-script.md`。
