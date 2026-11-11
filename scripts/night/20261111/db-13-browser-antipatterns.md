# 夜跑 11-11 · DB-13 browser 套件「测试写法反模式」普查（只读 + 只写报告）

你是豆包。本卡由 Lead 直接释放为 external，可以立刻认领。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\9d73e91a-7b70-4526-b740-915894f67429.md`
- 时间盒：45 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读 + 只写报告；零代码/文档改动。
2. 不跑测试/构建/dev。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 为什么做这个
今天 30 条存量 browser 红修完之后，**判定线是「2 failed / 835 passed / 837」**——留下的 2 条大概率还是测试写法问题。若不先把「写法反模式」系统性列出来，下一轮又会用同样的反模式写出新的假红/假绿。

## 任务（T1）：普查四类反模式
扫描范围（只读）：`src/**/__tests__/*.browser.tsx`（全部 `*.browser.tsx`）。

- **P1 IPC mock 缺分支导致夹具违约**：夹具里 `installIpc` / `mockIPC` 一类兜底 `throw` 或返回统一哑值，而发生组件**要求某 channel 必须有特定形状**。判据：该 channel 名在整个测试文件里**没有被 mock 返回过**，但组件源码里读它。给「测试文件:夹具行号 / 缺失 channel 名 / 读它的产品文件:行号」。
- **P2 依赖帧时序的裸断言**：`expect(...)` 直接跟在 `act(...)`/点击之后，中间**没有** `await vi.waitFor(...)` / `await act(async () => {})`。这是今日 B11 的形态（监听器 1 vs 2）。
- **P3 依赖「默认折叠/默认展开」的裸查询**：`getByText/getByRole` 直接查一个**产品默认折叠**区域里的内容（今日 B9/B10 形态）。
- **P4 用占位组件冒充真实组件**：夹具传 `xxx={<p>占位</p>}` 之类，导致被测组件里的某条路径**永远不会被真实执行**（今日 B15 形态：绝不挂载真实 `StatusBar`）。

## 验收（硬要求）
- 四类各一张表，每行给真实 `文件:行号`（来自 `Select-String`，不许凭印象）。
- P1 必须给「缺失 channel 全名单」，并标注每个 channel 在产品代码里的读取位置。
- P2 / P3 / P4 每类至少给出 **3 个具体样本**；不足 3 个要明写「全树仅 n 处」。
- 每类末尾一句话：**这一类是本轮新引入的风险，还是历史写法**（依据 mtime 或 `git log -1 --format=%ad -- <file>` 时，**只读**）。
- 报告末尾贴至少 3 条 `Select-String` 原样输出。

## 硬约束
- 只读 `wt-1` 工作区；不跑任何测试。
- **不要**把「测试红」当结论——本卡只列写法，不判对错。

## 交付
四段报告（改动清单写「无」）+ 四张表 + 汇总（P1 n1 / P2 n2 / P3 n3 / P4 n4）+ `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag 9d73e91a-7b70-4526-b740-915894f67429 --add review --remove external --release --agent doubao
```

