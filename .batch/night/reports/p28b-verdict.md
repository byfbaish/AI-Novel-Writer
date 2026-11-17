# P28b 终审 · 会话选择器 10 条上限 + 查看更多 + 限高滚动

- 终审人：AI writer总负责人
- 时刻：2026-11-14 09:03
- 判定：**PASS**（认 QA 4/4）
- 交付：`6f655500c88b`「feat: limit session picker to ten rows with expand and scroll」（父 `beb0af2`），numstat `client.js +25/−12`、`index.test.mjs +50/−0`，porcelain 空，138/138
- 报告：`.batch/night/reports/p28-picker-limit.md`（4,354B / MD5 `127346B6532CC3D020CC12E7149158B4`）
- 派验单：`.batch/night/review-requests/P28b.md`（事后补登记）
- 命名说明：卡文件名沿用 `p28-picker-limit.md`，编号记 P28b（P28a 是副本探针复验），不重命名避免已投卡对不上账。

## 采纳

- C1 仅两文件；`index.js`、`package.json` blob 与 `beb0af2` 同。
- C2 展开真跑：把 `pickerShown` 改成恒 `slice(0,10)` → 137/138 FAIL「展开后应渲染全部 12 条」；计数取 `pickerList.length`（过滤后真实总数），搜索框是限高容器的兄弟节点、不会被滚出视口。
- C3 反证：把 10 改成 999 → 136/138，用例 a 先红，与报告一致。
- C4 提交树 138/138 exit 0。

## 记账

- 真机未验：默认 10 条的观感与 320px 限高是否够用，等下一轮真机 U 轮看截图。
- 旧宿主分支无「查看更多」（老卡只读），符合设计。
