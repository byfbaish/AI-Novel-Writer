# P45-fix 派验单

- 卡号：P45-fix
- 依据首验：`.batch/night/reports/p45-qa-firstcheck.md`（5,067B / `70E9F4C0E34D35A4EA1542F48E75DA3A`）第 ④ 条不通过
- 验收口径：**只重验第 ④ 条**——中文 `README.zh-CN.md` 入口句不得再出现「最下方」，英文 `README.md` 必须写 `Components`（不得是 `Included components`）与 `in the "Components" section`（不得是 `at the bottom`）；其余七条不重验，但仓内出现第三处改动即判不通过
- 交付物：提交 SHA + 两行 diff + `staging\p45-fix-report.md`
- 派验人：大肥鱼
- 时刻：2026-11-16 22:37（Asia/Shanghai）
- 兜底验收点：22:50
## QA 首验结论（2026-11-14 22:43）

- 判定：**通过**（只重验第 ④ 条）
- 对象：`15e9d835a6c1816f42cb6eb2d16693790bacdfa5`，父 `8778233`；numstat `1 1 README.md` / `1 1 README.zh-CN.md`；porcelain 空；diff 恰两处增删
- 第 ④ 条五项全过：中文无「最下方」、英文无 `Included components` / `at the bottom`，`README.md:243` = `in the "Components" section`（宿主 `pm-client.js:467`），`README.zh-CN.md:207` = 「页面里「包含的组件」一节」（宿主 `:173`）
- B9 两行未被碰；报告 `staging/p45-fix-report.md` 2,554B / `A7C1B8F920721BCBBA4128D61EF11E15` / 末行 DONE
- 报告：`.batch/night/reports/p45-fix-qa-firstcheck.md`
- 备注（不拦）：联络人把报告名写成 `p45-readme-fix-report.md`，实际为 `p45-fix-report.md`
