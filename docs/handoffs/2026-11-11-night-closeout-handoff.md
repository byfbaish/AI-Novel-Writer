# 2026-11-11 夜班收口交接（20:00–21:00 单轮实机）

> 事实与读数全在 [`2026-11-11-night-batch-digest.md`](2026-11-11-night-batch-digest.md) **§9**，
> 逐项证据在 [`2026-11-11-night-evidence/`](2026-11-11-night-evidence/)。
> 本稿只写「下一班该做什么 / 别踩什么 / 哪些话不能说」。

## 0. 授权与边界（沿用）

本班授权：起 dev / 停 dev · 跑单测（全量未启用）· 看板写 · 改文档现值 · 本地提交（不推送）· 派豆包 · 写产物。
**「可改码」未启用 ⇒ 全程零源码改动**，三项待裁都需要作者单独点头后才能动代码。

## 1. 本班净结果（一句话一条）

1. **B11 结案**：三时刻 `window:close-requested` 活跃订阅数稳定 = 1，判 **A（测试夹具缺陷 / 合成 Workspace 多订）**，不是真泄漏。
2. **A2 抓到展示层缺口**：「本次创作模型」确实生效（DB `modelReceipt` = `deepseek-flash`），但状态栏恒显示配置值 A —— 主进程持租约路径上 `recordActualModel` 从不触发。
3. **B16 判「测试写法问题」**：`SourceConflictNotice` 是两条独立 `<p>`，而内联路径把整串塞进一个元素 ⇒ 精确 `getByText` 必然失败。实机另发现作者更常撞的是「正文或原目标已变化」那条。
4. **D9 降静态**：单测 12/12 绿；`resolveCallDeadline` 的 `capMs` **在 `generation-run-service.ts:206` 根本没接线**。
5. **收尾线（豆包）已结项**：卡 `4993ba9c`，报告 12,744 B，三张表齐；Lead 换身份 `pass → Done`。**处置动作一条未执行**（没 move、没 done 别的卡）。

## 2. 下一班优先做什么

| 序 | 事项 | 前置 |
|---|---|---|
| 1 | **裁 D16 投影方案**：把 `modelReceipt` 塞进 `MainGenerationSnapshot` 首帧，或明确「指示器只覆盖渲染层持租约路径」写进设计稿 | 作者点头（改码） |
| 2 | **修 B16 两处断言**：`CodeMirrorEditor-generation.browser.tsx:281 / :335` 改 `getByText(/来源已变化：这一稿不能保存/)` 或 `toHaveTextContent` | 作者点头（改测试） |
| 3 | **D9 `capMs` 接线**：把 `readMainGenerationPolicy` 的 cap 传进 `resolveCallDeadline` | 作者点头（改码） |
| 4 | **处置 14 张未结算卡**：只做豆包表 A 里标「否（无需点头）」的那一条（DB-5 补 `tag --add review`），其余等作者裁 | 作者裁 13 条 |
| 5 | 若作者要做 D9 真验证：需**单独一轮** 10 分钟慢吐，与成功章互斥 | 环境 |

## 3. 别踩的坑（本班新增）

- **`window.aiNovelAPI` 不可包装**：frozen + sealed，`api.on` 与整体都不可写；CDP 各 execution context 也拿不到 `require`/`ipcRenderer`。要计数就包装 Vite 模块 `src/services/ipc-client.ts` 的 `ipc.on`。
- **内联「替换」按钮在生成中是 `disabled`**：等它变可用才算真拿到结果，等出现即点会点空。
- **给 CodeMirror 设选区**：`Control+A` 不触发内联工具条，要 `EditorView.findFromDOM()` 后 `dispatch({ selection })`。
- **PowerShell 解 JSON 会烂中文**：`node ... --json | ConvertFrom-Json` 会因编码把标题打坏导致 `targets=0`，改用 `node -e` 里 `execFileSync` 拿 UTF-8。

## 4. 数据与环境现状

- `project.db`：第 1 章 `finalized` 1741 字**未变**；新增第 2 章 `draft` 2052 字（本轮 A2 生成，B16 造冲突时插入的字符已清）。
- 备份仍在 `develop/.tmp-ui/d8-backup/`（未回滚）。
- dev 已停：5180 / 9222 释放，Electron 进程 0。
- 看板 rev 804。
- 分支 `exp/resource-ledger`，本班提交为本地提交，**未推送**。

## 5. 交接给作者的一句话

三项待裁都是「改一行就能收口」的量级，但没有一条属于可以自行决定的类型 —— 它们分别决定
**可见性承诺（D16）**、**测试与产品哪个是真相源（B16）**、**超时上限是否该可配（D9）**。
