# P17 首验报告（QA）· 结论 PASS

- 卡号：P17-client-inject-configforms
- 派验单：`.batch/night/review-requests/P17.md`（派验人 AI writer总负责人，03:01 登记，五字段齐）
- 交付物：`C:\develop\workspace\dsh-handoff-relay`，HEAD `74f4cc1`（父 `43c3762`），version 0.5.0
- 判定时刻：2026-11-14 03:05 前后
- 结论：**PASS（7/7 判据全过）**；两条「记」级提醒、四条留真机项，均不阻塞。

## 判据逐条

### 1. `inject` 只含 `["slots"]`，`settingsScope` 仅剩兜底读取与注释 ✅
`client.js:17` `const inject = ["slots"];`。`grep settingsScope client.js` 四行全为注释（`:4`、`:197`）、`??` 兜底（`:216`）、warn 文案（`:223`），无硬引用。

### 2. 三档服务组合用例真跑 ✅
`index.test.mjs:2376-2432` 四条用例：① `assert.deepEqual(Array.from(mod.inject), ['slots'])` 且不含两服务名；② 只有 `configForms` → `registered === 1`、`mountedScope.kind === 'configForms'`；③ 只有旧 `settingsScope` → `registered === 1`、kind 对；④ 两者都无 → `doesNotThrow`、`registered === 0`、`injected` 为 `['configForms']`、回调里仍无只 warn。桩是真调 `mod.apply`，不是导出 smoke。

### 3. 延后分支只在两个服务都取不到时才走 ✅
`client.js:216-226`：先 `readService(ctx,"configForms") ?? readService(ctx,"settingsScope")`；`if (forms) { mountWith(forms); return; }` 之后才 `ctx.inject`。正常路径不会进延后分支。`readService` 带 try/catch，未声明服务在严格代理下抛错也只返回 `undefined`。

### 4. `package.json` ✅
version `0.5.0`；`dsh.client.immediately: true` 已删（diff `-      "platform": "web", -      "immediately": true` / `+      "platform": "web"`）；`dependencies` 未动。

### 5. `index.js` 零改动 ✅
`git show --numstat 74f4cc1` 只有 `38/8 client.js`、`76/1 index.test.mjs`、`2/3 package.json`。

### 6. 测试全绿 + porcelain 空 + 无新 tag ✅
```
TOTAL: 117/117 PASS
RESULT: PASS
exit=0
```
porcelain 空；`git tag --points-at HEAD` 空，tag 仍 4 个（`v0.3.0/0.3.1/0.3.2/0.4.0`）；`npm view dsh-handoff-relay version` → `0.3.2`（未 publish）。工作区 blob `b37be4ba…` = `HEAD:client.js` blob，字节口径一致。

### 6b. 旧代码必红（我独立反证）✅
把 `43c3762:client.js`（blob `e76141cf…`，9,021B）放进临时目录、配同一份 HEAD 测试跑：
```
FAIL P17 ① client inject 只含 slots（不含 settingsScope / configForms） :: Expected values to be strictly deep-equal:
FAIL P17 ② 只有 configForms：卡片挂载一次… :: Cannot read properties of undefined (reading 'bind')
FAIL P17 ③ 只有旧 settingsScope：同样挂载一次 :: Cannot read properties of undefined (reading 'bind')
FAIL P17 ④ 两个服务都没有… :: Got unwanted exception.
TOTAL: 111/117 PASS  RESULT: FAIL  exit=1
```
另带 2 条 P15 渲染用例同步变红，说明新测试真执行到 `apply`/渲染路径。临时目录 `C:\develop\workspace\tmp\p17-oldcode`，未污染仓库（复查 porcelain 仍空）。

### 7. README 未改的理由 ✅（成立），但留一条绑定
`grep settingsScope|configForms` 在两份 README 零命中，服务名确无常量可同步；`0.4.0` 命中仅安装 tag 引用（`README.md:168`、`README.zh-CN.md:145`）与「从 `0.4.0` 起…」功能陈述（`README.md:236`、`README.zh-CN.md:202`），按 P16 同一口径不动 = 站得住。

**绑定（打 tag 那次同一提交必须做，P16 记的 `#v0.4.1` 已过期）**：
- 安装行 `#v0.4.0` → `#v0.5.0`（版本已升 0.5.0；`v0.4.0` 本身是标注不可用的坏版，README 现指向它）。
- 「From `0.4.0` / 从 `0.4.0` 起…贡献一张卡片」这句在 0.4.x 事实上不成立（0.4.0 卡渲染崩、0.4.1 未发），建议随 tag 改为 `0.5.0`，否则文档与已发布事实冲突。

## 记账级提醒（不阻塞）
- **R1 · 延后分支只回读 `configForms`**：`client.js:226-233` 回调里只 `readService(c,"configForms")`，不再回读 `settingsScope`。「老宿主 + settingsScope 晚到」会漏挂卡。现实概率低（旧宿主 apply 时服务已就绪），记为已知边界即可，不建议现在加分支。
- **R2 · 远端不可达**：`git ls-remote origin` 报 `Recv failure: Connection was reset`，「未 push」无法独立核实，只能采信交接人声明 + `tag --points-at HEAD` 为空。

## 留真机（单元层无法证，不代下结论）
1. `ctx.get(name)` 对未声明服务是否安全（社区 issue #29 只证了 `ctx.X` 属性访问被严格代理拦，`ctx.get()` 是另一条路径）。
2. 桌面端 0.2.2-rc.1 实际出卡：`configForms` 是否真被宿主暴露、卡是否出现在「插件配置」页。
3. 删掉 `immediately: true` 后条目是否仍能首次加载即挂上（不 pending）。
4. 宿主版本差异：旧宿主只有 `settingsScope` 时，卡是否照常出。

## 证据
- 仓库：`C:\develop\workspace\dsh-handoff-relay`，HEAD `74f4cc1`，porcelain 空
- 报告：`.batch/night/reports/p17-client-inject-configforms.md` 8,437B，MD5 `A301558A855CC44CA839204F71DE2182`，末行 `<!-- DONE -->`（我复算一致）
- 信号：`.batch/night/signals/doubao/p17-client-inject-configforms.done` 133B，内含报告路径 + `74f4cc1` + `<!-- DONE -->`
