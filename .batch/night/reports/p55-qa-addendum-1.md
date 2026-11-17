执行方：QA · AI writer项目组 | 57c8bd18
model=DeepSeek · 倍率=本会话未暴露计费读数（不猜） | provider=本会话模型标识为 DeepSeek

# p55 归属白名单 · 首验判词 补记 1（不改原判）

- 原判词：`p55-pinned-cwd-allowlist-qa.md`｜5,824B｜67 行｜MD5 `5498905b2a1996351b8065a8f29590a0`｜crlf 0
- 受判提交：`51e95bf8e3a3f903e2ffc217f338332e00c7d0ec`（父 `26627655`，`agent/wt-2`）
- 本补记性质：**只补证据，不改 PASS 结论**；不动原报告一个字节（流转件不原地覆盖）。

## 一、补记①：执行方归因（原 §三 观察②、原判词「不能凭 author/committer 断定谁执行」）

我已独立复核，不再依赖联络人自述：

1. `C:\Users\<用户名>\.workbuddy\sessions\26828.json`（536B，mtime 11-16 06:59）实读：
   `pid=26828`、`sessionId=241cbeac-db4f-4451-a2d3-a5d096e60fc9`、
   `cwd=C:\develop\workspace\AI-writer\wt-2`、`startedAt`→`2026-11-16 06:54:06 CST`、
   `updatedAt`→`2026-11-16 06:59:06 CST`、`version=2.176.0`、`kind=interactive`。
2. 时间闭合：会话窗 06:54:06–06:59:06 完整覆盖提交时刻 `06:58:13`；同期 `rev-list --count 26627655..HEAD = 1`，
   即窗内只产生这一个提交，无第二个执行方痕迹。
3. 我亲自跑 `node scripts/workbuddy/workbuddy-attach.mjs read --session 241cbeac… --json`：
   返回 `chips.model="DeepSeek-V4.1-Flash"`、`chips.permission="允许完全访问"`、`messageCount=2`、`agentCount=1`，
   回复正文是 p55 回执全文（含 06:58:13 提交说明与 G1–G8 表）。**model 读数由我取到，非转述。**
4. 局限（如实记）：同一命令返回的 `chips.workspace/branch` 为 `null`，故会话库行不能独立证明 cwd 分支，
   分支结论仍以 `wt-2` 仓库侧 `git` 实读为准（`agent/wt-2`）。`status=completed` 我未在会话库中读到独立字段，
   以会话 `updatedAt` 与提交时刻的闭合为准，不采信单方自述。

## 二、补记②：G2 成功路径已由我端到端跑到判据层（原 §三 观察① 的一半）

命令（只读 `status`，不发任务、不占执行方）：

```
WORKBUDDY_ALLOWED_CWDS='C:\develop\workspace\dsh-group-rules-prompt' \
  node scripts/workbuddy/workbuddy-attach.mjs status --cwd 'C:\develop\workspace\dsh-group-rules-prompt'
```

实测 `exit=0`，返回会话列表 `id=8ac906da…`、`cwd=C:/develop/workspace/dsh-group-rules-prompt`，
无 `[refuse]`。对照原 G1：不设 env 同命令 `exit=1` + `[refuse]` + `允许=` 只列 wt-2。
⇒ 「注册后放行 / 未注册拒绝」两条路径均已由我本人跑通；**仍未做的是真投任务（task）**，
该项按负责人裁定不补投，保持非阻断。

## 三、新增非阻断（交负责人，不改结论）

1. 文档滞后：`docs/agents/workbuddy-channel.md:130` 仍写「归属固定…只有 --force 能越过」，
   `workbuddy-attach.mjs:807` usage 仍写「只允许 wt-2」。卡面禁改 docs/，故留作合回 develop 时的文档债。
2. 回执自述两条判断点（注册项相对路径一律拒、不拿 process.cwd() 猜基准）我认可为合理保守，
   但卡面未就此立规，建议在合回卡里补一句口径，避免下次各判各的。

<!-- DONE -->
