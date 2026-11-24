# 派单补丁 · 豆包通道特有准入（C1-b / dispatch-doubao-c1b.md）

> 作者：项目总负责人 2026-11-24 16:5x｜来源 `docs/agents/doubao-channel.md`（563 行）实测条目
> 用法：整段插到 `dispatch-doubao-c1b.md` §0.3 之后、§1 之前，编号 §0.4。插入后重算行数/字节/sha 再投。

## 0.4 豆包通道特有准入（逐条必守，缺一条即停手回报）

1. **模式必须是「新工作任务 + 本地电脑」。** 豆包默认是「对话」，对话模式**没有本地文件权限**，只会回「我无法读取你本地磁盘文件」（`doubao-channel.md:149`／`:331`）——那种输出不是模型变笨，是模式错。开局一律先 `node scripts/doubao/bootstrap.mjs` 新建线程；`task` 命令在已处于任务模式时**追加进当前线程而不新建**（`:278`），复用任何旧线程的产出不采信。
2. **顺序不能反：新建线程 → 切「本地电脑」→ 最后切档位。** 新建线程会把推理档位重置回「中」（`:148`／`:337`），先切档位等于白切；对话模式下档位 chip 只显示「快速」（`:167`），看到「快速」先怀疑模式而不是模型。
3. **项目定位用绝对路径，不靠「项目」chip 猜。** `通过本地文件夹创建项目` 会弹系统原生文件夹框、CDP 控不了（`:276`）；chip 常只显示项目名，路径要开菜单才看得到（`:163`）。本卡所有 git／文件操作一律写绝对路径 `C:/develop/workspace/AI-writer/wt-2`（§0.3 的命令已是绝对路径，照抄）。
4. **豆包没有工具层硬拦截。** 不像 Copilot 有 `--deny-tool 'shell(git:*)'` 那种拦截（`:320`），本派单的红线全靠你自己守、由事后验收核对。因此：①每条 `git` 与 `node` 命令的**原文输出**贴进回执；②git 只准 `add` 与 `commit`（且只在 `card/s2-c1-relevance-and-diff` 上），**禁** `checkout`／`switch`／`restore`／`reset`／`stash`／`clean`／`push`／`merge`／`rebase`／`tag`；③禁止 `git checkout -- <path>` 之类的回退命令，那会覆盖盘上他人改动。
5. **串行。** 一个实例一个窗口，同一时刻只能跑一个任务（`:377`）；本卡执行期间不得并派第二个任务。
6. **命令语法按 PowerShell 写。** 若终端是 PowerShell，§0.3 的 `| wc -l` 不可用，等价写法：`(git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall | Measure-Object -Line).Lines` 或 `git ... status --porcelain -uall` 后自行数行；两者择一把**原文**贴回执。注意 `Measure-Object -Line` 不计空行，porcelain 无空行故等价。
7. **证据措辞纪律（豆包通道专用口径）。** 没读到的只能写「本次读取的文件内未找到」，**不许写「全仓没有」**（`:308`）；测试条数与 tsc 结果原样粘贴，不许总结成「全部通过」（`:315`）；`[live]` 跑不成写「未跑成 + 报错原文」，不许 mock 顶。
