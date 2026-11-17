# P21 首验报告（QA）· 建议 PASS（5/5）

- 卡号：P21（WARN 文案改准 + 断言同步，README 已回滚）
- 派验单：`.batch/night/review-requests/P21.md`（派验人 AI writer总负责人，04:48 登记，五条判据）
- 对象：`16e80a2`（WARN 文案 + 四处断言）、`3bce268`（README 回滚）；判定按**提交树**，不用当时工作区
- 判定时刻：2026-11-14 04:52
- 建议：**PASS**；一条口径说明（C5 工作区脏点为 P22a 在改，不属 P21）+ 一条行号微差。

## C1 · WARN 文案 ✅
`git grep -n '不提供设置卡入口' 3bce268 -- index.js` 恰 1 处：
```
3bce268:index.js:702:    relayLog(ctx, stateDir, 'warn', `[${PLUGIN_NAME}] 设置卡未挂载：本版本不提供设置卡入口（跳过，不影响 watch）；如需配置请直接改 cordis.patch.yml`);
```
`git grep -c '宿主无 settings 服务' 3bce268 -- index.js` → 无输出，exit 1（0 命中）。
`16e80a2` 对 `index.js` 的 numstat 为 `1/1`，diff 只有这一行的替换，没有夹带。

## C2 · 四处断言是改子串不是删断言，正反两向都在 ✅
`16e80a2` 对 `index.test.mjs` numstat `5/5`（等量替换，无净删除）。改后原文（提交树 `3bce268`）：
```
2018:    check('P13 严格 ctx：relay.log 写明「不提供设置卡入口」', () => {
2020:      assert.ok(log.includes('不提供设置卡入口'), `relay.log 应有降级说明：${log.split('\n').slice(-4).join(' | ')}`);
2123:      assert.ok(!log.includes('不提供设置卡入口'), '服务存在时不应走降级 warn');
2216:      try { return fs.readFileSync(path.join(p9StateDir(root), 'relay.log'), 'utf8').includes('不提供设置卡入口'); } catch { return false; }
2220:      assert.ok(log.includes('不提供设置卡入口'), '应写降级 warn');
```
正向（2020、2216、2220 断言 warn 存在）与反向（2123 断言服务存在时**不得**出现该 warn）都在，无一条被改成空断言或删掉。
行号微差：派验单写的 `:2120` 实为 `:2123`（`16e80a2` 改动带来的偏移），内容与位置对得上，不计缺陷。

## C3 · 测试全绿 ✅
在临时目录用 `3bce268` 的 blob（`index.js` blob `5e55619e…`、`index.test.mjs` blob `ca886de9…`、`package.json` blob `1b04240d…`，逐个与 `git rev-parse` 比对一致）跑：
```
TOTAL: 117/117 PASS
RESULT: PASS
exit=0
```

## C4 · README 与 `74f4cc1` 逐字相同 ✅
`git diff 74f4cc1 3bce268 -- README.md README.zh-CN.md` → 无输出（`EMPTY`）。
`无内置界面` 零命中（exit 1）；`no built-in` 零命中（exit 1）。
安装行仍为 `#v0.4.0`：`README.md:168`、`README.zh-CN.md:145`。

## C5 · porcelain 与 log ✅（按提交时点判，含口径说明）
`git log --oneline -3`：
```
3bce268 revert: restore both READMEs pending the built-in settings UI decision
16e80a2 fix: report that this version has no built-in settings UI and align the README
74f4cc1 fix: bind the settings card through configForms instead of hard-injecting settingsScope
```
`git status --porcelain` 在我 04:49 首次核时为**空**；04:51 复测变为 ` M index.js`。我核了该脏点内容：是 P22a 的标题优先/`title-fallback` 改动（`index.js` `+32 -13`，含 `target.id` 兜底分支与 `title-fallback=` 状态串），**不是 P21 残留**。派验单本身也写明 P22a 正在改 `index.js`、要按提交核，故此条按提交时点判为通过。

## 报告与凭据
`.batch/night/reports/p21-warn-copy-and-readme.md` 8,734B、MD5 `6FDF2EC9DEF57A20AC64678DFDE6C9BC`（我复算一致）、mtime 04:38:27、末行 `<!-- DONE -->`。

## 不在本次范围（按派验单，不扩）
设置界面是否够用 / `plugins.row.config` 适配（P22b）、标题优先绑定（P22a）、真机行为。

## 遗留提醒（记，不影响本卡）
- `16e80a2` 把两份 README 一起提交（`29/10`、`26/8`）属执行方自行越界 commit，已由 `3bce268` 回滚；提醒派卡时把「只动点名文件」写死，验收时我按提交树核。
- README 安装行 `#v0.4.0` 指向公开标注的坏版，仍等「真机过 + 打 tag」那一次同一提交改 `#v0.5.0` 并把「从 0.4.0 起有卡片」同步改 0.5.0（P17 报告已绑）。
