# P28b 首验（QA）· 会话选择器默认 10 条 + 查看更多 + 限高滚动

- 判定对象：`6f655500c88bb5dc359fea435c0501bc3b613a7a`（父 `beb0af2`）
- 判据来源：卡 `.batch/night/cards/p28-picker-limit.md` §五 C1–C4（未登记独立派验单，按卡面判并已在群内说明）
- 判定时刻：2026-11-14 09:0x
- **结论：PASS 4/4**

## C1 只动两个文件、`index.js` 未动 —— PASS

```
$ git diff --numstat beb0af2 6f65550
25      12      client.js
50      0       index.test.mjs

$ git rev-parse beb0af2:index.js      6f65550:index.js
04a44b8d89077e9739f57bcde4a931810fdc7ed5  04a44b8d89077e9739f57bcde4a931810fdc7ed5
$ git rev-parse beb0af2:package.json  6f65550:package.json
1b04240d94d3b8fe97094cb06224d1717a2eb20b  1b04240d94d3b8fe97094cb06224d1717a2eb20b
$ git status --porcelain
(空)
$ git tag --points-at HEAD ; git tag | Measure-Object → 0 / 4（无新 tag）
```

## C2 默认 10 条 + 查看更多 + 限高，且展开/收起真跑 —— PASS

实现（`client.js`，提交树内）：

- `const PICKER_LIMIT = 10;`
- `const pickerList = pickerItems(props && props.ctx, query);`
- `const pickerShown = pickerExpanded ? pickerList : pickerList.slice(0, PICKER_LIMIT);`
- 容器：`h("div", { style: { maxHeight: "320px", overflowY: "auto" } }, …)`
- 底部按钮仅在 `pickerList.length > PICKER_LIMIT` 时渲染，文案 `查看更多（共 ${pickerList.length} 条）`，展开后为 `收起`，`onClick: () => setPickerExpanded((v) => !v)`
- 搜索 `onChange` 内 `setPickerExpanded(false)`；`chooseSession`/`reset`/`openPicker` 亦复位

「真渲染跑出来」的独立验证（不是读断言文案）：把 `const pickerShown = pickerExpanded ? pickerList : pickerList.slice(0, PICKER_LIMIT);` 改成恒 `pickerList.slice(0, PICKER_LIMIT)`（即展开按钮点了也不生效），提交树其余不动：

```
FAIL  P28 点「查看更多」后渲染全部 12 条，按钮变「收起」 :: 展开后应渲染全部 12 条
TOTAL: 137/138 PASS
RESULT: FAIL   (exit 1)
```

⇒ 用例 b 的「点开后 12 条」确由状态化重渲染产生，不是恒真断言。

计数来源核对：`查看更多（共 N 条）` 的 N 取 `pickerList.length`（= `pickerItems(ctx, query)` 过滤后的真实总数），不是 `pickerShown.length`，也不是切片后长度 —— 正确。

限高与搜索框：搜索 `input` 是限高 `div` 的**兄弟节点**（`pickerNode` 内顺序：`input` → 限高 `div` → 查看更多/取消），滚动只发生在列表容器内，**搜索框不会被顶出视口**；查看更多/取消按钮同样在容器外，始终可见。

## C3 反证真红 —— PASS（与执行方报告逐字一致）

```
$ 只把 PICKER_LIMIT 10 改成 999
FAIL  P28 默认只渲染 10 条，且底部出现「查看更多（共 12 条）」 :: 默认应只渲染 10 条
FAIL  P28 点「查看更多」后渲染全部 12 条，按钮变「收起」 :: 应有查看更多按钮
TOTAL: 136/138 PASS
RESULT: FAIL   (exit 1)
```

用例 a 先红（12 ≠ 10），b 因总数 12 不大于 999、按钮不渲染而红；c 只查样式仍绿。执行方报告 §3 的读数与我的复跑完全一致。

## C4 全绿且总数 > 135 —— PASS

提交树 `git archive 6f65550 | tar -x` → 临时目录跑：

```
TOTAL: 138/138 PASS
RESULT: PASS
exit=0
```

基线 135 → 138，增量 3 条全是 P28 新用例（`index.test.mjs:2900` 起 `p28Ctx`/`p28OpenPicker`/`p28List` 等辅助 + 三条 check）。

## 附注（不拦，记录）

1. **「收起」回点折叠无用例**：用例 b 只验证展开后 12 条与文案「收起」，未点一次「收起」断言回到 10 条。代码是 `setPickerExpanded(v => !v)`，逻辑简单；建议下次动 `client.js` 的卡顺带补（与 P27 C3 同性质记账）。
2. **搜索词变化复位折叠无用例**：卡 §一.4 要求，代码已实现（`onChange` 内复位），但无用例。低风险。
3. 报告 §6 的 `client.js` MD5 `C2F0C0E5…` 是工作区 CRLF 形态；核字节按 blob 口径（本报告 C1），两者不做交叉。
4. 报告 §7 已如实披露「未做真机视觉复验」「搜索框常驻语义按滚动外固定实现」两点，与我的观察一致，无夸大。

## 判后交接

- 首验 PASS，交 AI writer总负责人 终审；P31（去重）按负责人口径「P28b 的 QA 一过就投」可投。
- 真机视觉（主人看「查看更多」与滚动）不在本卡范围，若要做归真机 U 轮。
