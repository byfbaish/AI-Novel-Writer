# 交接：看板复核的质量边界（`--kind` + 次数上限已落地）

> 交接基准：2026-11-03 04:3x · 分支 `exp/resource-ledger` · **提交 `c4802798`**
> 上一班：[`2026-11-02-d14-volume-structure-sync-handoff.md`](2026-11-02-d14-volume-structure-sync-handoff.md)（D14 卷结构同步）
> 通道手册：[`docs/agents/task-board-channel.md`](../agents/task-board-channel.md) §5.1.2 / §5.2 / **§5.4（新）** / §7 / §8

---

## 〇、三十秒版本

作者的原话是「**质量是没有上限的**，按现在这样复核就是内循环卡死」。上一班只把「复核只跑一轮」写成纪律，纪律靠记性；这一班把它变成**工具会拒**的规则：

**打回必须说清是哪种问题，而能说清的只有两种** —— `unmet`（卡自己写明的验收标准没兑现）、`regression`（这次改动打坏了原本能用的）。「更优雅 / 更全面 / 更规范」没有对应的 `--kind`，想打回也表达不出来，只能开新卡。外加每卡最多打回 3 次的兜底。

**为什么这样能收敛**：两个 kind 都只能引用**已有条目**（卡上的验收标准）或**本次改动**，凭空生不出新要求 ⇒ 题集单调递减 ⇒ 收敛是结构性的，不是靠"这次我真的不挑了"。

---

## 一、这轮改了什么（8 个文件，+241 / −24）

| 文件 | 改动 |
|---|---|
| `scripts/task-board/lib/timeline.mjs` | 新增 `REVIEW_KINDS = ['unmet','regression']`、`MAX_REWORKS = 3`、`reviewStats(stamp)`（读 `reviews[]` 数轮次与分类；**无 timeline 的老卡全 0**，不受上限影响） |
| `scripts/task-board/lib/ops.mjs` | `review()` 加 `kind` 参数：缺/非法 **exit 5**（非法值直接提示"开新卡再 pass 本卡"）；读到 timeline 后加累计闸（第 4 次 **exit 3**，报 `limit 3: N unmet, M regression`）；`reviews[]` 条目落 `kind`；`dispatchHints` 改成打印 `round n of 3` |
| `scripts/task-board/dsh-task-board.mjs` | `--kind`（**必须同时加进 `VALUE_FLAGS` 白名单**，否则报 `unknown option`——已踩）、help、输出 `rework (unmet, round 1/3)`、触顶时多打一行"下一次复核只能 pass" |
| `scripts/task-board/mcp.mjs` | `task_board_review` schema 加 `kind`（enum）+ 转发；工具数仍 15 |
| `scripts/task-board/test/ops.test.mjs` | +2 条（缺/非法 kind；连续 4 次的闸与"触顶后仍可 pass"），3 条老用例补 `kind` |
| `scripts/task-board/test/cli.test.mjs` | +1 条（`--kind` 透传 + `round 1/3` 输出） |
| `AGENTS.md` | 第 9 条塞进"打回只认两种"，**仍 60 行** |
| `docs/agents/task-board-channel.md` | **新增 §5.4**（两种 kind 表 / 三类不许打回 / 它们去哪 / 为什么分类优于限轮 / 依据）；§5.1.2 示例与 bullet 同步；§5.2 末条指向 §5.4；§7 加诚实边界；§8 加验证记录 |

**依据（按"先查行业定义"的规矩，不自创）**：验收边界 = **Definition of Done**（Scrum 对质量标准的正式描述）；复核标准 = Google eng-practices *The Standard of Code Review* —— "improves the overall code health → approve even if it isn't perfect"，nit 不阻塞。行业口径一直是「**比之前好**」，不是「足够好」。

---

## 二、当前状态（可直接复现）

```bash
node --test scripts/task-board/test/*.test.mjs   # 113 / 113 通过，3.6s（上一班 110）
node scripts/check-fast.mjs                      # typecheck ✓ · doc links 1088/0 损坏 · 摆放 0 违规
git log --oneline -1                             # c4802798
```

- 单跑**某个**测试文件如果中途 assert 失败，`board.close()` 不执行 ⇒ 进程挂住、时长看起来像 200s+。**这是测试写法的问题，不是代码卡死**：全绿时 3.6s 退出。
- wt-1 / wt-2 已 `git merge --ff-only exp/resource-ledger` 同步到 `c4802798`。

---

## 三、没做完 / 等作者定

1. **`61e4535d`（`I1`，D 系列缺陷容器卡）还没拆子卡** —— 拆几张、每张什么范围要作者定；拆的时候**只有叶子卡打 `external`**，容器卡不进池子（有未完成子卡时 `next`/`claim` 都会拒，硬闸已落）。
2. **`再对应` 是否等于 `rework`** —— 上一班问过、没回音。现在的实现是"打回 = `rework`"；若语义不同，改常量 + 迁历史卡。
3. **真实看板上还没用两个身份实跑过 `review`** —— 离线 fake board 已全覆盖（通过/打回/同名拒绝/次数上限），但真卡没跑，怕动作者的在办卡。
4. **子卡深度的硬上限（3）没去撞** —— 结论是"按现状不改插件"，没做压力验证。

---

## 四、下一班怎么接着干

**派活（写任务书时）**：把验收标准写进卡正文（"做到什么算完"）。**没有验收标准的卡一定会被反复打回，那是建卡的问题，不是复核的问题。**

**复核（用 `review` 时）**：

```bash
# 通过
node scripts/task-board/dsh-task-board.mjs review <id> --pass --note "第 2 节数字与 §4.3 表对得上" --agent workbuddy:reviewer

# 打回：必须 --kind + --note，一次把话说尽（别挤牙膏，挤一次多一轮往返）
node scripts/task-board/dsh-task-board.mjs review <id> --rework --kind unmet \
  --note "AC2 没兑现：报告里没写回滚方案" --agent workbuddy:reviewer
```

**自己给自己划边界的三句话**：
1. 我能不能**指着卡上的某一条**说它没做到？指不出 ⇒ 不是 `unmet`。
2. 我有**"改之前能跑"的证据**吗？没有 ⇒ 不是 `regression`。
3. 都不是 ⇒ 这是新题目，**开新卡**（`I2`/`I3`，`--add external`），本卡按现状 pass。**新开卡不丢东西**，比攒在判词里强——攒在判词里的待办没人回看。

**已知的洞（诚实记账，§7 已写）**：`--kind` 是自报的，把"更优雅"硬写成 `unmet` 工具拦不住，正如它拦不住冒用 `--agent`。能事后查的只有判词本身：`unmet` 若引不出条目、`regression` 若拿不出改前证据，就是伪装成阻塞项的 scope。**3 次上限是止损线，不是质量线。**
