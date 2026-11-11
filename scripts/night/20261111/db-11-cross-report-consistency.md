# 夜跑 11-11 · DB-11 本夜 25 份产物的交叉一致性核对（只读 + 只写报告）

你是豆包。本卡由 Lead 直接释放为 external，可以立刻认领。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\fff9668f-30df-4c1a-9d73-971e674fd383.md`
- 时间盒：40 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读 + 只写报告；零代码/文档改动。
2. 不跑测试/构建/dev。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 背景
今晚两个 agent 一共交了二十多份报告，横跨两个工作区。这些报告之间**必然存在互相矛盾的数字与结论**（例如「30 条存量红怎么分」「D17 到底结没结项」「B11 是真泄漏还是测试问题」「DB-1 能不能合」），而晨间 digest 会拿它们当唯一事实源。**矛盾不摊平，digest 就会把错的写成结论。**

## 任务（T1）：交叉一致性核对
1. 清点两个工作区的夜跑报告（**只读**）：
   - `C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\*.md`（今晚 11-11 的，按 mtime 筛 1:30 以后）
   - `C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\*.md`（同上）
   - 以及 `wt-2\.batch\night\M1-M2-runbook.md` 等 `.batch\night` 下的产物
2. 就以下**六个主题**，把各报告的说法并排列出，判「一致 / 不一致 / 无法判定」：
   - T1 存量 browser 红的分类与条数（30 条怎么拆）
   - T2 D17 的状态（结项 / 未结项 / 快照 vs 现值）
   - T3 B11（RendererStartup 监听器 1 vs 2）的定性与修法
   - T4 B16（CodeMirror 文案）的定性与修法
   - T5 DB-1 纯函数「能不能合入」的结论与保留条件
   - T6 D9 挂点（单次调用超时）的现状描述
3. 每处不一致给：`报告A:行号 → 原文` / `报告B:行号 → 原文` / `哪个更可信（依据）` / `建议晨间 digest 采用哪一版`。
4. **不许**自己跑测试或读源码来裁决；只用报告正文做交叉核对。若必须读源码才能判，写「需源码裁决，本卡不判」。

## 验收
- 六个主题每个都要有结论行（即使「全部一致」也要明写）。
- 不一致清单每条都要双原文 + 行号。
- 末尾给「晨间 digest 必须采用的结论」一页（六行）。

## 交付
四段报告（改动清单写「无」）+ 六主题结论表 + `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag fff9668f-30df-4c1a-9d73-971e674fd383 --add review --remove external --release --agent doubao
```


