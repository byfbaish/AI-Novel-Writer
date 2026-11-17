# P17 · 客户端条目不得硬 inject 旧服务名（0.5.0）

- 卡号：P17-client-inject-configforms · 执行方：豆包 · 派卡人：AI writer总负责人
- 仓库：`C:\develop\workspace\dsh-handoff-relay`；基线 HEAD `43c3762`，开工 porcelain 空
- 结果：已改并提交 `74f4cc1`（`fix: bind the settings card through configForms instead of hard-injecting settingsScope`），未 push、未打 tag、未 publish；`TOTAL: 117/117 PASS`

## 0. 一句话

`client.js` 的条目级 `inject` 不再硬绑 `settingsScope`，只留 `["slots"]`；运行时用 `ctx.get("configForms") ?? ctx.get("settingsScope")` 二选一取服务，并去掉 `package.json` 的 `dsh.client.immediately`，版本升 `0.5.0`。条目不再因服务改名而 pending。

## 1. 改动明细

### A · `client.js`

改前（`:17`、`:197-204`）：

```
17:		const inject = ["slots", "settingsScope"];
...
198:			const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NS });
199:			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
200:				name: "settings.plugin.item",
201:				key: SETTINGS_NS,
202:				inject: () => ({ scope }),
203:			}, RelayCard));
```

改后：

```
17:		const inject = ["slots"];

197:		// 0.2.2-rc.1 起宿主把设置服务改名为 configForms；旧宿主只有 settingsScope。
198:		// 不把任一名字写进 inject：硬注入不存在的服务会让条目永远 pending。
199:		function readService(ctx, name) {
200:			try {
201:				return typeof ctx.get === "function" ? ctx.get(name) : undefined;
202:			} catch {
203:				return undefined;
204:			}
205:		}
206:
207:		function apply(ctx) {
208:			const mountWith = (service) => {
209:				const scope = service.bind({ namespace: SETTINGS_NS });
210:				ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
211:					name: "settings.plugin.item",
212:					key: SETTINGS_NS,
213:					inject: () => ({ scope }),
214:				}, RelayCard));
215:			};
216:			const forms = readService(ctx, "configForms") ?? readService(ctx, "settingsScope");
217:			if (forms) {
218:				mountWith(forms);
219:				return;
220:			}
221:			// 两个都没有：等服务就绪再挂；apply 本身立即返回，绝不 await。
222:			if (typeof ctx.inject !== "function") {
223:				console.warn("宿主无 configForms/settingsScope 服务（跳过设置卡，不影响 watch）");
224:				return;
225:			}
226:			ctx.inject(["configForms"], (c) => {
227:				const late = readService(c, "configForms");
228:				if (!late) {
229:					console.warn("宿主无 configForms 服务（跳过设置卡，不影响 watch）");
230:					return;
231:				}
232:				mountWith(late);
233:			});
234:		}
```

要点：

- `inject` 只剩 `["slots"]`——条目不再等待 `settingsScope`，也不会等待 `configForms`。
- 两个服务名都不进 `inject`：谁到就用谁；顺序是 `configForms` 优先，旧宿主 `settingsScope` 兜底。
- `apply` 不 await、不返回 Promise；服务都没到、且没有 `ctx.inject` 时只 `warn` 后返回；有 `ctx.inject` 时登记一个就绪回调，回调里仍取不到只 `warn`，不抛错。
- `readService` 对 `ctx.get` 包了 try/catch（严格 ctx 下调 `get` 也可能抛，取不到按 undefined 处理）。

### C · `package.json`

```
-      "platform": "web",
-      "immediately": true
+      "platform": "web"
```

`dsh.client.inject`（`["@deepseek-ai/dsh-client-ui-settings"]`，模块依赖语义）**未动**，按卡面不属于本次修复对象。

### 版本

```
-  "version": "0.4.1",
+  "version": "0.5.0",
```

### README 判断（最终判断，已确认）

`grep -n "settingsScope|configForms"` 在 `README.md`、`README.zh-CN.md` 内**零命中**，本轮读取的 README 内未找到需要同步的服务名或版本号事实（`0.4.0` 的命中是安装 tag 引用与「从 0.4.0 起」的功能引入陈述，按 P16 的同一口径不动）。故本轮未改 README。**已确认：这不是漏做，是最终判断。**

## 2. `grep` 复核

`grep -n "settingsScope" client.js`（4 处，全部是兜底读取与注释，符合判据）：

```
4: // ctx.configForms（旧宿主为 ctx.settingsScope）.bind({ namespace }).set('watches', ...)，Host observe 后回写
197: // 0.2.2-rc.1 起宿主把设置服务改名为 configForms；旧宿主只有 settingsScope。
216: const forms = readService(ctx, "configForms") ?? readService(ctx, "settingsScope");
223: console.warn("宿主无 configForms/settingsScope 服务（跳过设置卡，不影响 watch）");
```

`grep -n "immediately" package.json`：无命中。`grep "export const inject" index.js`：`export const inject = ['agents'];`（未动）。

## 3. 测试

新增 4 条（`P17 ①`–`④`），原有 113 条一条未删：

```
PASS  P17 ① client inject 只含 slots（不含 settingsScope / configForms）
PASS  P17 ② 只有 configForms：卡片挂载一次，服务对象非 undefined
PASS  P17 ③ 只有旧 settingsScope：同样挂载一次
PASS  P17 ④ 两个服务都没有：不抛、不挂卡、不 pending，回调里仍没有则只 warn
TOTAL: 117/117 PASS
RESULT: PASS
```

- ①②③ 都用 `slots.register` 的 spy 断言**恰好 1 次**，并从 `def.inject().scope` 取挂载时用的服务对象，断言非 `undefined` 且 `kind` 正确——只断言「回调触发」不够，这里断言到了真注册。
- ④ 的「不 pending」判定方式：`ctx.inject` 桩**只登记回调、不调用**，`apply` 必须同步返回（`assert.doesNotThrow` 即返回），此时 `register` 计数为 0；再手动用「取不到 configForms 的 ctx」调回调，断言不抛、不挂卡、出现 `无 configForms` 的 warn。这样既不靠固定 sleep，也证明 `apply` 本身不会挂住客户端条目激活。
- 既有 P15 用例的夹具只做了一处适配：假 ctx 从「直接属性 `settingsScope`」改成「`get('settingsScope')` 返回同一服务」，两条 P15 断言与 watches 数据一字未改（因为 `apply` 现在走 `ctx.get`）。
- 测试临时目录全部来自 `os.tmpdir()`，清理在 `finally`，本轮未新增临时目录逻辑。

## 4. 判据自查

- `node index.test.mjs` → `TOTAL: 117/117 PASS`，exit 0。
- `node --check client.js` → exit 0；`package.json` JSON 解析通过（`node -e JSON.parse`），`dsh.client` 实测为 `{"inject":["@deepseek-ai/dsh-client-ui-settings"],"platform":"web"}`（无 `immediately`）。
- `index.js` 未改：`export const inject = ['agents'];` 原样，watch 判定逻辑零改动。
- `git status --porcelain` 提交后为空；提交前恰为 `M client.js`、`M index.test.mjs`、`M package.json` 三行。
- `git add client.js package.json index.test.mjs`（点名，未用 `-A`）。
- `git show --numstat --format= HEAD` 的原文（制表符分隔，共三行）：

```
38	8	client.js
76	1	index.test.mjs
2	3	package.json
```

- `git log -1 --stat`：`3 files changed, 116 insertions(+), 12 deletions(-)`。
- `git tag --points-at HEAD`：空；未 push（本地 `master` 领先 origin）；未 `npm publish`。
- 未重启 DSH、未往任何 watch 目录写文件。

## 5. 未验证 / 风险

- **真机 `web boot` 是否恢复本条目不激活的报错，本轮未验证**（卡面禁重启 DSH、禁启用插件）。单测只能证明：导出 `inject` 不含旧服务名、两种服务名各自能挂一次、都没有时不抛不挂卡。客户端 cordis 的 pending 语义是否真的消失，要在隔离 profile 起壳时看 `web boot: ... did not activate` 是否再现——标**不确定**，等 developer 真机复验。
- `ctx.inject(["configForms"], cb)` 的「服务永远不来」情形：本轮按卡面 A 保留该兜底，`apply` 不 await（不会挂住条目激活），但该子注入 fiber 自身会一直等待。这是否在渲染层 `assertEntriesActive` 口径内产生新的 pending，本轮无真机证据——标**不确定**；若真机仍报 pending，优先删掉这段兜底改为纯 warn。
- `package.json` 去掉 `immediately` 后，客户端条目的加载时机由宿主默认策略接管；默认是否仍能在设置页出现卡片，本轮无法验证（同一真机缺口）。

## 6. 收尾

- 提交 `74f4cc1`，未 push；提交后 porcelain 空。
- 报告落盘 `C:\develop\workspace\AI-writer\develop\.batch\night\reports\p17-client-inject-configforms.md`。
- 未写信号文件（卡面交付项只点名报告）。

<!-- DONE -->
