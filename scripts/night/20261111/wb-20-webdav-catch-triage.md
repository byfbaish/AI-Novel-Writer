# 夜跑 11-11 · WB-20 WebDAV 备份服务空 catch 成因取证（只读 + 只写报告）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`。
- 卡 ID：`ff1da4c0-2567-4a37-8d39-f2b8f6be6b20`，报告写到 `wt-2\.dsh-task-board\reports\ff1da4c0-2567-4a37-8d39-f2b8f6be6b20.md`。
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`

## 红线（先回一行「已确认红线 1-4」）
1. **纯只读 + 只写报告**：不改任何代码。
2. 不跑测试/构建/dev。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件。

## 背景
今晚豆包交了 DB-12「静默失败普查」：生产代码里 S1（空 catch / 只有注释的 catch）命中 **124 处**，其中它点名 `electron/services/webdav-backup-service.ts` 有 **9 处** `catch {}`，判为「备份/清理路径失败静默」的高价值候选。但豆包自己注明：**没有逐处读上下文，结论是基于位置与注释的判断**。

本卡就是补这一步：把这 9 处逐个读上下文，判清楚「刻意忽略（可接受）」还是「吞错（该修）」。

## 任务（T1）
对 DB-12 报告 §S1 表里 `webdav-backup-service.ts` 的**每一处**（报告给了行号，至少 9 处）：
1. 读该 catch 前后各 ~15 行，写清：
   - 被 try 包住的是什么操作（读文件？删文件？发请求？写 DB？）
   - catch 体是否为空 / 只有注释 / 只有 log
   - 忽略失败后**调用方会看到什么**（成功？静默成功？状态不一致？）
2. 判档：
   - **A 刻意忽略**（例：清理临时文件失败无所谓）—— 写理由
   - **B 该修**（失败会导致数据/状态不一致且无人知道）—— 写修法方向（最少一行：加日志 / 返回错误 / 上报事件）
   - **C 无法判定**（需要实机或外部上下文）
3. 汇总：A n 处 / B n 处 / C n 处。
4. 给「如果只修 3 处，修哪 3 处」（凭 B 档里的严重度排序，说明排序依据）。

## 验收
- 每个 catch 都要有 `文件:行号` + 前后文摘录（≤5 行）。
- A/B/C 三档每处都要给理由，不许只给档位。
- 「只修 3 处」必须给理由，不许拍脑袋。
- 末尾明确写：本卡**未读**哪些相邻文件（若判 B 需要看调用方但没看，如实写）。

## 交付
四段报告：结论（B 档几处、最该修哪 3 处）/ 改动清单（写「无」）/ 原始输出 / 未做项。
末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
`node …\dsh-task-board.mjs tag `ff1da4c0-2567-4a37-8d39-f2b8f6be6b20` --add review --remove external --release --agent workbuddy:worker`
