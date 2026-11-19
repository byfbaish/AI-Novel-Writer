执行方：developer · AI writer项目组（906d802a）
model=deepseek-chat | 倍率=1x | provider=deepseek
范围：只读取证，未改插件仓、未 fetch/pull/push、未动任何配置。

# 插件仓 e6362a8 无人认领推送 · 取证

起点事实：插件仓 `C:\develop\workspace\dsh-group-rules-prompt`，提交 `e6362a8`（06:48:02 +0800，父 `951c39f` 01:08:31），message「docs: 标明尚未实机验证（仅单元用例，无端到端）」。

## 1. 身份链路（作者字段从哪来）

| 读点 | 命令 | 结果 |
|---|---|---|
| 全局身份 | `git config --global user.name` / `user.email` | `baiyunfei` / `<email>` |
| 仓库级身份 | `git config --local --list`（筛 `user.`） | **无任何 user.\*** |
| 受查提交 | `git log -1 --format='an=%an%ncn=%cn%nci=%ci' e6362a8` | an=cn=`byfbaish <<email>>`，ci=2026-11-16 06:48:02 +0800 |
| 上一条提交 | 同上 @ `951c39f` | an=cn=`baiyunfei <<email>>` |
| 钩子 | `ls .git/hooks/ \| grep -v sample \| wc -l` | **0** |
| 远端 reflog | `git reflog show refs/remotes/origin/main` | 只一条 `e6362a8 @{0}: update by push`（记的是本机身份 baiyunfei，不能证明执行者） |

结论：`byfbaish` **不来自该机全局配置、不来自仓库配置、不来自钩子**。唯一可行路径是那一次命令自带的 `-c user.name=/user.email=` 或 `GIT_AUTHOR_*`/`GIT_COMMITTER_*` 环境变量。

## 2. 推送时刻的旁证（06:48 前后这台机器上发生了什么）

- `C:\Users\<用户名>\.dsh\bot\workspace\tools\gh-relay.js` **06:50:01 创建**（1,154B）：CONNECT 隧道 `LISTEN_PORT=8899` → `140.82.113.4:443`，注释写「本机 DNS 解析出的 github.com 地址不可达，但 140.82.113.4:443 可达」。**推送（06:48，或用例时间 06:51:37 的 .git/config 写入）前后 2 分钟内出现的翻墙工具**，说明当时 github:443 直连不通，动手者必须先搭隧道。
- `.git/config` mtime **06:51:37.813**；内容仅 core / remote.origin（`https://github.com/byfbaish/dsh-group-rules-prompt.git`）/ branch.master（`merge=refs/heads/main`），无 url 改写、无 credential 段。
- `.batch/night/{staging,cards,signals,reports,delivered}` 在 06:40–07:00 只落到 **1 个文件**：`staging/incident-wt2-ff-merge-1116.md` 06:47:04（我本人写的 ff-merge 事故记录）。
- 同时段 `~/.dsh` 非 sessions 变动 3 个：群记忆 `tidied.json`、`tools/gh-relay.js`(06:50:01)、`profiles/desktop/dsh-handoff-relay/delivered/0103a0ac/20261116-0650-owner-three-items.md`（大肥鱼主身 to-owner，约 06:50）。
- `grep -rIn "GIT_AUTHOR\|GIT_COMMITTER" .batch scripts`（主仓）：只命中 `.batch/night/reference/lieflat-less-ai-tone/.git/hooks/*.sample` 的注释样例，**无任何真实覆写脚本**。
- `byfbaish` 在主仓 `.batch` 命中 53 处，全部是 GitHub 账号/URL/文档提法（`.batch/night/reports/p5-verdict.md:25`、`bug-lifecycle-v1.md:59-60` 记 GCM 取到属 byfbaish 的 `gho_…` token），**没有一处是设置提交身份的代码**；`~/.dsh` 命中仅 `channel-pack/state.json` 的 IM nickname 与 handoff-relay 包 package.json 的 author 字段。

## 3. 能排除谁 / 剩谁

| 对象 | 判定 | 依据 |
|---|---|---|
| 仓库脚本（任何提交包装/环境变量覆写） | 排除 | 全仓 + 主仓脚本 grep 无 `GIT_AUTHOR*`/`GIT_COMMITTER*` 用例 |
| git 钩子 | 排除 | `.git/hooks/` 除 sample 外 0 个 |
| 全局配置自动带出 | 排除 | 全局 = baiyunfei，受查提交 = byfbaish（与 大肥鱼 08:0x 的说法冲突） |
| 定时任务/无人值守流程 | 无证据 | 06:40–07:00 工作区仅 1 个文件落盘，无提交类信号件 |
| 能在这台机上执行 shell 的交互方：大肥鱼主身（06:50 有 to-owner 投递）、任意 Bot 群分身、WorkBuddy/GCM 使用者、主人本人 | **不能排除，也无法区分** | 只能证明「有人在 06:48–06:51 于本机用隧道 + 命令行自带身份推了一次」，不能证明是谁 |

结论止于：**06:48 确实成功推送过一次，执行者不可从本机留痕唯一确定**。

## 4. 附带发现（QA 08:1x 提出，我已本地实验复核）

QA 判断该仓「裸 `git push` 会把 master 推到公开仓 main」。本地裸仓实验（临时目录，不触网、不动插件仓）：

- 仓库配置 `branch.master.remote=origin`、`branch.master.merge=refs/heads/main`，`push.default` 未设；
- 裸 `git push` 结果：`fatal: The upstream branch of your current branch does not match the name of your current branch.`（git 2.56.0，默认 `push.default=simple` 拒绝分支名不一致的上游）；
- 加 `push.default=matching` 后裸推才会动远端。

⇒ 风险等级下调：裸推会**报错退出**而非误推，真正能推上去的是显式 `origin master:main` 或 `-c push.default=matching`。隐患仍建议列入插件线技术债（配置不表达意图，换人/换 git 版本行为会变），但不必按「一敲就出事」处理。

## 5. 未做的事

- 未联系任何外部通道、未改插件仓配置、未重跑推送、未 fetch 远端现态（冻结期内）。
- 未对「谁执行」下结论——缺的正是 项目总负责人 要 大肥鱼 交的两样：06:36 授权原文落点、推送命令原文与身份来源。

## 6. 结案（追加 · 2026-11-16 08:2x）

**定性**：`e6362a8` 系我方内部推送，由 大肥鱼主身 于 06:48 执行，非外部无人认领写入。裁定人：项目总负责人。依据：①大肥鱼主身提交的授权转抄件 `C:\Users\<用户名>\.dsh\bot\workspace\audit\push-auth-0636-record.md`（2,329B / 41 行，含 06:36 主人原话「dsh-group-rules-prompt也可以推上去，但是Readme要说好，还没有做完实机测试」与锚点 part 5 #1390）；②他本人撤回「byfbaish 系全局配置」的说法，与本报告 §1 实测一致；③本报告 §2 的 `gh-relay.js`（06:50:01）证明当时确实由本机搭隧道推送。

**排除**：外部写入、脚本自动改写身份、钩子改写、全局配置带出（本报告 §3 四条排除成立）。

**遗留两条流程瑕疵（不算事故）**：①06:36 授权只存在于会话，从未落盘；②推送命令原文无留痕（`user.name` 来源至今无证据，本报告 §1 只能推出「来自该次命令自带的 `-c`/env」）。

**冻结解除**：08:19 由 项目总负责人 解除，插件仓 `push`/`tag`/`publish`/GitHub 评论恢复；新增规则「对外写动作开动前先落授权原文摘录，执行完追加命令原文与结果，落 `audit/`，做不到不动」。

**结案证据**：QA 08:20 用 `git ls-remote origin refs/heads/exp/resource-ledger` 做第三方回读，得 `69cd4a41cf5f89a813d09104bcf744959922dc7c`（exit 0），与本机 HEAD 一致——即主仓推送为已确认状态，不采信执行方自我报告。

**未做的事**：未复核远端插件仓现态（未连该仓）；未追查 `e6362a8` 之后是否有其他未记录写入（超出只读范围，需新授权）。

<!-- DONE -->
