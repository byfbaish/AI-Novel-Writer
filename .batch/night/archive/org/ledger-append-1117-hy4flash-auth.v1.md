状态：现行
From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: AI writer项目组
记录时间：2026-11-17 01:23 (Asia/Shanghai)

# 台账一笔：`Hy4 flash` 白名单改动＝已授权

## 1. 改动事实（多方只读复核，一致）
- 文件：`C:\develop\workspace\AI-writer\develop\scripts\workbuddy\model-policy.mjs`
- git 状态：`M`，`+6/−1`，8,253B｜`321013a7e39243ea7090518bc2fae2af`｜180 行，mtime 01:11:48
- HEAD（developer 复核纠正）：`69cd4a41 merge: bring wt-2 whitelist card p55 into exp/resource-ledger`；QA 报的 `545988b2` 作废
- `:32` 新增 `MODEL_HY4_FLASH='Hy4 flash'`；`:34-36` `ALLOWED_MODELS=['Hy4 flash','DeepSeek-V4.1-Flash']`；`HY4_DISABLED=true` 未动；`pickModel()` 仍出 `DeepSeek-V4.1-Flash`
- 行为：`rejectUnknownModel('Hy4 flash')` → `null`（放行，改前拒）；`rejectUnknownModel('Hy4')` → 仍拒

## 2. 授权出处
- 渠道：大肥鱼主身私聊
- 时间：2026-11-17 01:10
- 主人原话（摘要，由大肥鱼转述）：回「1」，选项原文＝「只开 flash，不开 Hy4：新增 `MODEL_HY4_FLASH='Hy4 flash'` 进白名单，`Hy4` 那条继续禁用（当初禁的是优惠到期）」
- 执行方：大肥鱼主身，01:11 落盘
- 裁定：**已授权，不回滚**。`Hy4`(0.29x) 与自动派活口径不变

## 3. 已登记风险与复工待办
1. **闸门红**：`vitest run scripts/workbuddy/__tests__/model-policy.test.mjs` → 1 failed / 24 passed，失败在 `model-policy.test.mjs:170`（`expect(ALLOWED_MODELS).toEqual([MODEL_DEEPSEEK_FLASH])`）。该测试编码的是旧白名单。复工第一步：改期望为含 `MODEL_HY4_FLASH`，与策略同提交，提交前 `pnpm check:fast`。
2. **代码注释含未证表述**：diff 注释「2026-11-17 用户拍板放开」——现已有授权来源，复工改为写明「授权：大肥鱼主身私聊 2026-11-17 01:10」。
3. **副本配置漂移（实测，纠大肥鱼的 wt-1…wt-56 说法）**：`git worktree list` 实为 8 处：develop、night-probe、test-master、wt-1、wt-2、wt-3、wt-docfix、wt-p51、wt-p56（共 9 行含 develop）。有 `scripts/workbuddy/model-policy.mjs` 的 7 处均 **无** `MODEL_HY4_FLASH`：wt-1/wt-2/wt-3/wt-docfix/wt-p51/night-probe 同 md5 前缀 `8e0167aa…`，wt-p56 `0ace4a79…`，test-master 无该文件。故「wt-1…wt-56」应为 `wt-p51`/`wt-p56` 误读，不存在 56 个副本。影响：派活换到这些目录会拿不到 `Hy4 flash`（更严，非风险），属配置漂移，复工一次性对齐。
4. `auth=<角色>|<渠道>|<ISO>` 出处行（产品经理提案，采纳）：`describeModelPolicy()` 每条白名单输出该行，缺 `auth=` 直接判不合格，`UNVERIFIED` 合规但须可计数；`model-policy.mjs:32` 与 `:34` 同批改；机检正则 `^auth=(UNVERIFIED|\S+\|\S+\|\d{4}-\d{2}-\d{2}T)`。归属：developer 写、QA 复核，冻结期不动。

## 4. 冻结期纪律（仍生效）
不回滚、不提交、不清理；`Hy4` 任何人不得用于派活；红测试作为已登记风险过夜，复工首项处理。

## 5. 复核更正（2026-11-17 01:25，01:24 之后收到）
- QA 自纠：`545988b2` 是该文件的最后一次改动提交，HEAD 实为 `69cd4a41`（`git rev-parse --short HEAD`）；本记录 §1 已按此更正。
- developer 补：同一提交须一并改 `scripts/workbuddy/__tests__/model-policy.test.mjs` 的 `:170` 断言、`:169` 用例名、`:23` 注释（「Hy4 已全线禁用（2026-11-16 用户拍板）」与白名单自相矛盾）；`Hy4` 仍拒那条断言不动。
- developer 自纠措辞：应写「HEAD 与你说的 `545988b2` 是两回事」，但基数以 `69cd4a41` 为准。

## 6. 副本实测数字（终版，含 night-probe）
`git worktree list` 共 9 行（develop、night-probe、test-master、wt-1、wt-2、wt-3、wt-docfix、wt-p51、wt-p56）。有 `scripts/workbuddy/model-policy.mjs` 的 7 处：
- 旧值同 md5 前缀 `8e0167aa…`：wt-1、wt-2、wt-3、wt-docfix、wt-p51、night-probe（6 处）
- 旧值 `0ace4a79…`：wt-p56（1 处）
- 无该文件：test-master
- 新值 `321013a7…`（含 `MODEL_HY4_FLASH`）：仅 develop
口径：**1 新 6+1 旧**（大肥鱼称「6 个副本」是把 night-probe 漏在外，实为 7 个含该文件的副本）。
