# 熔断核对（11-13 19:58）

## 结论
熔断已完成且无损：两个 watch 目录现在只剩 `.gitkeep`。

## 存量文件去向（15 个，一个没丢）
`.batch/night/archive/1107/`：
- `bridge-to-owner/` 5 个：ask-npm-token、ask-p6-addressing、bridge-handoff-reverse-test、how-to-deliver-npm-token、where-the-files-are
- `bridge-to-group/` 3 个：bug-duplicate-delivery-0654、decision-p6-0612、reverse-test-0558
- `signals-doubao/` 6 个 + `signals-workbuddy/` 1 个

我 19:44 也发起过一次「移入 archive-20261113-1950」，两边动作撞车：我的命令执行时文件已被归档，只留下两个空目录（已删除），所以没有双份、也没有丢失。

## 关键事实：当前跑的还是旧代码
- DSH 宿主进程 PID 40728，启动时间 06:20:35
- 去重表落盘提交 `8514269` 时间 07:09 ⇒ **进程比它早 48 分钟**，旧代码仍在内存里
- `~/.dsh/dsh-handoff-relay-state.json` 不存在 ⇒ 新逻辑从未运行过

## 因此
熔断是当前唯一防线。重启前不要往 `to-owner` / `to-group` 放文件：旧代码会投一次，再遇任何载入（改配置热重载）就把存量重扫再投一遍。

建议今晚重启一次，重启后放**一个**探针验收：应恰好收到 1 条、文案带绝对路径。
