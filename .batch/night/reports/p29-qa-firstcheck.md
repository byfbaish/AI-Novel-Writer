# P29 首验（QA）· dir 校验提示 +「选择目录…」

- 判定对象：`d535dc148c761b0cc8518ee3d84061b96bdfaefe`（父 `801dc38`）
- 派验单：`.batch/night/review-requests/P29.md`（1,017B，09:40，已登记）；判据卡面 §六 C1–C5
- **结论：PASS 5/5**
- 判定时刻：2026-11-14 09:5x

## C1 改动面只含两个文件 —— PASS

```
$ git diff --numstat 801dc38 d535dc1
121     5       client.js
217     0       index.test.mjs
$ git rev-parse 801dc38:index.js       d535dc1:index.js
8293cc1461341e2d8142b25d932b2b37acbb02a5  8293cc1461341e2d8142b25d932b2b37acbb02a5
$ git rev-parse 801dc38:package.json   d535dc1:package.json
1b04240d94d3b8fe97094cb06224d1717a2eb20b  1b04240d94d3b8fe97094cb06224d1717a2eb20b
$ git status --porcelain → 空；git tag --points-at HEAD → 空（tag 仍 4 个）
```

## C2 导出数组未变，`remoteAccess` 全走惰性取 —— PASS

- `client.js:21 const inject = ["slots", "sessions"];`（我一个人读原文，不靠联络人转述）。
- 探测入口 `client.js:207 probeDirectory`：`ctx && typeof ctx.get === "function" ? ctx.get("remoteAccess") : undefined`，整段在 `try` 内，抛错即 `{ kind: "none" }`。
- `workspaceFilesOf`（`:185`）的候选依次来自 `access.workspaceFiles`、`access.remote.workspaceFiles`、`readService(ctx,"remote").workspaceFiles`、`readService(ctx,"remote.workspaceFiles")`；`readService`（`:140`）本身就是 `try { ctx.get(name) } catch { undefined }`。
- 全文没有对 `ctx.remoteAccess` / `ctx.remote` 的直接属性读（反证时我加的 `ctx.remoteAccess` 在正式版里 0 处）。

## C3 用例 d 真跑，反证真红 —— PASS

用例 d 在提交树上通过：`ctx.get('remoteAccess')` 抛错 ⇒ `mod.inject` 仍为 `["slots","sessions"]`、点数 0、无「目录不可读或不存在」文案。

反证（临时副本）：`inject` 改成 `["slots","sessions","remoteAccess"]` 且探测改成直接读 `ctx.remoteAccess`：

```
FAIL  P17 ① client inject 只含 slots + sessions（不含 settingsScope / configForms）
FAIL  P27 client inject 恰为 ["slots", "sessions"]
FAIL  P29 d … :: 不得硬 inject remoteAccess
TOTAL: 147/150 PASS / RESULT: FAIL / exit 1
```

d 的红因是 `mod.inject` 断言——这正是卡面要的保险丝。**边界说明**：测试桩的 ctx 是普通对象（不是 cordis 严格代理），所以反证红在「数组断言」这一层，「硬 inject → 条目 pending → 整页 `web boot: 1 entry did not activate`」的机制本身在单测里复现不了，只能靠代码形态 + 真机；这条别当成真机已证。

## C4 保存未被校验阻断 —— PASS

- `client.js:519 h("button", { onClick: save, disabled: !writable || !dirty }, "保存")` —— 无探测结果参与 disable。
- 用例 f：先造红点（`list` 恒 `ok:false`），改 dir 后断言 `save.props.disabled === false`，点保存后文案出现「已保存」；我在提交树上复跑通过。
- `save()` 函数体未引用 `probeDirectory`/`dirProbeCache`（`git grep` 该函数体内 0 命中）。

## C5 全绿且总数 > 144 —— PASS

提交树（`git archive d535dc1 | tar -x`）跑：

```
PASS  P29 a 无 __DSH_DIRECTORY_PICKER__ ⇒ 不渲染「选择目录…」
PASS  P29 b pick 返回 C:\x ⇒ 该行 dir 写成 C:\x
PASS  P29 c pick 返回 null ⇒  dir 保持原值、不报错
PASS  P29 d ctx.get(remoteAccess) 抛错 ⇒ 不崩、不显示任何点
PASS  P29 e list ok:true ⇒ 绿点；ok:false ⇒ 红点 + 行内文案
PASS  P29 f 红点出现后保存仍可用
TOTAL: 150/150 PASS / RESULT: PASS / exit 0
```

基线 144 → 150，增量 6 条。

## 附注（不拦，交负责人）

1. **卡面自身矛盾，实现按更安全的一支走**：§一.3 说「探测失败（服务不可用、IPC 抛错、超时）不得画红点、降级为无徽标」，§二.2 又说「`ok!==true` **或抛错** ⇒ 红点」。实现取前者（抛错/超时 → `none`），与用例 d 的期望一致。建议下次改卡面时把 §二.2 的「或抛错」删掉，避免执行方照后句做反而骗过 d。
2. **`sessionId` 取 `sessionMap` 第一个 key**（`client.js:202 firstSessionId`）：若宿主 `workspaceFiles.list` 的可见性按 session 区分，多会话下可能拿 A 会话权限判 B 会话的目录，出现假红/假绿。报告 §6 已自认不确定；真机轮请顺带验一条「多个会话、目录只对其中之一可读」的场景。
3. **`workspaceFiles` 形状靠四种候选猜**：真实宿主到底走哪一路，本机未验；真机若一个点都不出现，先查这条（而不是先判「目录不可读」）。
4. **3 秒超时实现有、无用例**（用例会真等 3 秒）；**缓存按 `(ctx, sessionId, dir)` 永久保留**，同一路径从不可读变可读不会自动重探——都符合卡面「只探一次」，记录备查。

## 判后交接

- PASS 5/5，交 AI writer总负责人 终审。
- 真机项：点「选择目录…」拿真实路径、红/绿/灰三态在真宿主可见、多会话下的 sessionId 语义 —— 按派验单属「不在范围」，归下一轮真机。
