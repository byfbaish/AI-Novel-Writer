# P29 终审 · dir 校验提示 +「选择目录…」

- 终审人：AI writer总负责人
- 时刻：2026-11-14 10:02
- 判定：**PASS**（认 QA 5/5）
- 交付：`d535dc148c761b0cc8518ee3d84061b96bdfaefe`「feat: add directory picker and readable dir hints」（父 `801dc38`），numstat `client.js +121/−5`、`index.test.mjs +217/−0`，porcelain 空，150/150
- 报告：`.batch/night/reports/p29-dir-check.md`（6,705B / MD5 `EAD812E0A12C8E0C76E447822913CA04`）
- 首验：`.batch/night/reports/p29-qa-firstcheck.md`（5,146B）
- 派验单：`.batch/night/review-requests/P29.md`

## 采纳

- C1 `index.js` blob `8293cc14…`、`package.json` blob `1b04240d…` 与 `801dc38` 逐字相同；tag 仍 4 个。
- C2 `client.js:21` 仍是 `["slots","sessions"]`；`probeDirectory`（`:207`）整段 try 内 `ctx.get("remoteAccess")`，`workspaceFilesOf`（`:185`）四路候选，全文无 `ctx.remoteAccess` 直接属性读。
- C3 反证把 inject 改成三项并直读 `ctx.remoteAccess` → 147/150 FAIL、exit 1，d 的红因是 `mod.inject` 断言。**边界**：单测桩非 cordis 严格代理，「硬 inject → pending → 整页不 boot」的机制复现不了，只能靠代码形态 + 真机。不把 d 当「已证真机安全」。
- C4 `client.js:519` 保存按钮 `disabled: !writable || !dirty`，探测结果不参与；`save()` 函数体 0 处引用探测缓存。
- C5 150/150，含 a–f 六条新增。

## QA 附注的处理

1. **卡面矛盾我认**：§一.3（探测失败不画红点）与 §二.2（`ok!==true 或抛错 ⇒ 红点`）冲突，实现按更安全的一支（抛错/超时 → `none`）。以 §一.3 为准；以后派码卡前我自己先查一遍同类矛盾再发。**不返工**。
2. `sessionId` 取 `sessionMap` 第一个 key（`client.js:202 firstSessionId`）⇒ 多会话下可能用 A 会话权限判 B 的目录。**列入真机轮必验项**，不现在改。
3. `workspaceFiles` 形状靠四路候选猜，真实宿主走哪路未验 ⇒ 真机若一个点都不出现，先查这条，别判「目录不可读」。
4. 3 秒超时无用例；探测缓存按 `(ctx,sessionId,dir)` 永久保留、不自动重探——符合卡面「只探一次」，记录备查。

## 后续

真机轮合并三项一起验：P29 的点/选择器、P31 的去重、7 条 watch 的 id→标题迁移；一次重启尽量全做完，不制造第二次问询。
