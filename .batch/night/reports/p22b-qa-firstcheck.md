# P22b 首验（QA）· 建议打回：B0 未实测 + 旧宿主分支仍是可编辑 id 输入

- 派验单：`.batch/night/review-requests/P22b.md`（派验人 AI writer总负责人，05:47）
- 派验单对象：`dee1b9f2e1f0`（父 `de69c8f`）
- 我实测时仓库状态另有变动，见 §0
- 执行方报告：`.batch/night/reports/p22b-settings-ui.md`（12,835B）
- 复核方式：按**提交树**另建临时目录跑测试（不用工作区），不写生产 profile

## 0. 对象与状态偏差（先看）

- 复核期间 HEAD 又前进一个只改测试的提交：`6a28319`（05:47:47，`index.test.mjs +24/−2`）。05:47:21 我读到的 porcelain 是 ` M index.test.mjs`，05:48 之后为空。
- 报告文件 mtime = 05:48:56，晚于联络人 05:45 的交付通知 ⇒ 报告在交付后被改写；报告 §8 里贴的 `HEAD` 已是 `6a28319`，而派验单/回执写的是 `dee1b9f`、`129/129`。
- 代码文件在两提交间无差异：`client.js` blob `b823ea5679ced8b5d36793a12197347b5f207b88`、`index.js` blob `489389d9c6c9999006219338313cec8ea23de0fe`、`index.test.mjs` blob `af6730d6831367cbeb845f36550c6796f14b2cfb`。故本次按 HEAD 树复核，**代码等价于 dee1b9f**，只是测试多一条。
- 生产 profile `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml` mtime 停在 `2026-11-14 03:38:00` ⇒ 执行方没有写生产配置，禁令守住了。

## 1. B0 spike — **FAIL（字面判据未过）**

报告自认：§0「B0 的真机部分未执行」，§1.5「**未执行**：用桌面壳的 `ConfigEditor.edit()` 真机 `writeFileAtomic` → `reconcileProfilePatches` 热重载」；只给了「结构化 schema 解析 + YAML 离线往返」的等价 spike。

卡面 §4 写死「这一步不过，后面的都不算」，且「没实测就写结论＝未通过」。⇒ B0 判 FAIL。

但成因是**卡面与禁令冲突**：真实 profile 有 7 条生产 watch 且本轮禁止写、禁止重启，而隔离 profile `selftest1114` 的宿主是 `0.1.1-rc.2` + `dsh-settings-file`，没有 `configForms`，确实证明不了 0.2.2 的 configForms→patch 链路。执行方守住禁令、如实标注「不确定」，这一点是对的。

处置归负责人（我不替定）：
1. 把 B0 并入你真机窗口，一次做成「写一条 → 热重载 → 读回」，并真机读 `configForms.get` 返回值与 `mutate` 落盘（推荐）；
2. 或改卡面判据，明确接受离线等价证据 + B5 真机补测。

## 2. B1 静态 — PASS

```text
$ git diff de69c8f 6a28319 -- index.js
（仅两处）
+ 39 行：buildConfigSchema()（:38-55）+ unwrapConfigValue()（:58-76）
   :48  })).volatile().default([]),
   :49  stableMs: z.number().default(DEFAULT_STABLE_MS).volatile(),
   :56  export const Config = buildConfigSchema();
 apply 首行 +1：
+  :982  config = unwrapConfigValue(config) || {};
```

- 解析 / 投递 / 重扫 / warn 段**零改动行**：diff 只有上面两处 hunk，`resolveNow`、`matchSessionsByTitle`、`describeTargetNow`、`startWatch` 主体、`:819` WARN、`:998` 启动期 warn 均未出现在 diff 中。
- `loadSchemastery` 不是新引入：`de69c8f:index.js:60` 已有。
- `client.js:15` `const inject = ["slots"];`；`:535` `name: "plugins.row.config"`；`:541` `ctx.slots.inject("plugins.row.config", register)`。
- numstat：`382/35 client.js`、`40/0 index.js`、`167/1 index.test.mjs`；`package.json` version `0.5.0`、dependencies/peerDependencies 皆 `{}`。

## 3. B2 测试 — PASS（数字纠正）

```text
$ node index.test.mjs            # 在按提交树复制的临时目录
TOTAL: 130/130 PASS
RESULT: PASS
exit=0
```

- 130 = 基线 123 + **7** 条 P22b 用例：`index.test.mjs:2566`（Config volatile）、`:2641`（桩渲染）、`:2657`、`:2667`（第三行不使用→正则）、`:2686`（正则只红该行）、`:2702`（保存列未过行）、`:2733`（读时 unwrap）。
- 报告/回执的 `129/129`、`新增 6 条` 与提交树不符（那是 `dee1b9f` 的读数；`6a28319` 补了第 7 条）。绿是真绿，数字要改。

## 4. B3 反证 — PASS

旧 `client.js`（`74f4cc1:client.js`，blob `b37be4b338de14a351a359eca8be9fec990e8c8a`）+ HEAD 的 `index.js`/`index.test.mjs`：

```text
TOTAL: 125/130 PASS
RESULT: FAIL
exit=1
5 FAIL，各：service.bind is not a function
  P22b 渲染 / 三态切换 / 三态切换（第三行）/ 正则只红该行 / 保存部分成功
```

index 侧两条（Config、读时 unwrap）照绿，符合「只有卡片相关代码是新的」。

## 5. B4 桩渲染 — PASS

`index.test.mjs:2641` 断言：三列表头（目录/目标会话/完成规则）、3 个行节点、3 个「选择会话」按钮、`/Session ID/i` 在渲染文本中为 false、placeholder 里无 session 字样。`git grep -c 'Session ID' HEAD -- client.js` exit 1（0 命中）。

## 6. B6 提交纪律 — 部分通过，附一条硬要求

- `dee1b9f` 三文件（点名文件，无夹带）；`6a28319` 仅 `index.test.mjs`；当前 porcelain 空；无新 tag；未 publish。
- **记**：交付通知后又追加了 `6a28319` 并改写了报告（05:48:56），回执里的对象与数字过期。要求验收后冻结树，任何后续提交必须重新通知，否则派验单与实物对不上。

## 7. 偏差（不改不算过）

1. **旧宿主降级分支仍是可编辑卡，含手填 session id**：`client.js` 的 `RelayCard`（约 `:160-200`）有 `目标会话（session id）` 文本框（`:175 placeholder: "session-xxxxxxxx"`），`mountLegacy`（`:539`）在只有 `settingsScope` 或旧 `configForms.bind` 时挂它。卡面 §3 写死「旧宿主没有 `configForms` 时降级为**只读提示**」——现在是可编辑，并且留着让用户手填 id 的入口，与 U4 的精神相反。
2. **同分支文案与 P22a 矛盾**：`RelayCard` 提示仍写「exact 表示标题完全相等（缺省为包含匹配）」，而 P22a 已把缺省改为 `exact=true`（`index.js:994`）。用户读到的缺省说明是反的。

处理：改只读提示 + 改文案；若负责人要保留旧宿主可编辑卡，请明确豁免卡面 §3，按字面我不能判过。

## 8. 交真机的风险（B5，不能省）

- **schema 默认值会 materialize 进 yml**：spike 的「写后 yml」比「写前」多出 `targetSessionId: ''`、`exact: true`。生产 7 条 watch 首次加载新 `Config` 前，必须先备份 `cordis.patch.yml`（规格 §8 已要求备份/还原），否则默认填充会改动生产配置。
- 真实 `configForms.get('dsh-handoff-relay')` 返回值与 `mutate` 的原子落盘，本轮**零真机读数**；U5「重启后按标题仍可投」也未验。

## 9. 结论

- B1 / B2 / B3 / B4 = PASS（B2 数字按 130 修正），B6 纪律合格但对象已过期。
- **B0 = FAIL**（字面未实测）+ 两处 legacy 偏差 ⇒ 建议**打回**。B0 与 legacy 分支的处置权在负责人。

## 10. 附注 · 负责人改判记录（2026-11-14 05:56）

本节为收口记录，不覆盖上面 §1 的原始判定原文。改判由 AI writer总负责人 下：

1. **B0 真机段经负责人改判到真机轮，不构成 P22b 代码缺陷**。理由：卡面把「宿主 Loader 真机热重载」写给了拿不到可写可重启 profile 的外部执行者，属卡面范围错误；责任在负责人。离线那半（写前/写后 yml、`watches` 节点 `meta.volatile:true`、`isVolatilePath` 双 true）认 PASS。真机段并入真机轮：U1 看到卡 + U3 保存后 yml 出现 `targetTitle` 即坐实。
2. **判定对象改钉 `6a28319`**（只改测试），`130/130` 正是对它的读数。
3. 两处 legacy 偏差仍成立，已出 P22c 卡（`p22c-legacy-readonly.md`，只动 `client.js` + `index.test.mjs`）。

我方核实（针对负责人称 `targetSessionId: ''` 无害）：成立。`index.js:1020` `const hasId = typeof rawId === 'string' && rawId.trim() !== '';`、`:1021` `hasTitle` 同理；`:1052` 有标题时 `{ kind: 'title', ... id: hasId ? rawId.trim() : undefined }` ⇒ 空串等同未填，标题优先、id 仅兜底。备份 `cordis.patch.yml` 仍列为真机必做项（默认填充会写脏字段，虽无害但会改动生产文件）。
