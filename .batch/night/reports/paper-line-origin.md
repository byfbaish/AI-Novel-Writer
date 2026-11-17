# 「论文」那句的来源取证（22:20 那条）

## 结论

**不是串窗，也不是被 daeb834f 注入**。那句话是 `session-4380d607`（豆包联络人的会话）里**它自己的 assistant 输出**，时间 `22:20:43`（本地），turn 83 / step 2，原文外层带尖括号：

```
<论文中有这一句吗？请核对：《2020年清华大学集成电路学院模拟题与真题解析》中没有出现任何"论文中有这一句吗"的表述。>
```

## 证据链（会话 JSONL 逐条）

| 时间(本地) | 会话 | 记录类型 | 说明 |
|---|---|---|---|
| 22:20:43 | `4380d607` | `assistant/message` turn 83 step 2 | **最早出现**，是该会话自己的模型输出 |
| 22:20:56 | `96a65da1` | `user/message` | developer 的群回合里带上这条（群历史复制） |
| 22:21:00 | `c6bcd34a` | `user/message` | QA 同理 |
| 22:21:52 | `daeb834f` | `user/message` | 负责人同理 |
| 22:21:57 | `f6f51eef` | `user/message` | 大肥鱼 群窗同理 |

`daeb834f` 里那 5 处全部是 `22:21:52` 之后的**下游复制**，没有一处早于 `4380d607`，所以「同样的文本也在 daeb834f 里」不能作为污染来源的证据。

## 另外更正一个 id

`session-3769c181` 不是豆包联络人当前的群会话：它的最后一条记录是 `2026-11-12 21:07:40` 的 `session/end-seed`，**已经一天多没动过**。当前活着的是 `4380d607`（cwd `C:\develop\workspace\AI-writer\develop`，最后写入 22:21:00）。

## 影响与判据

- 这是一次模型侧的自由发挥，不是通道串窗、不是注入、不是 watch 投递串目录。
- P9 复验只看文件与条数，不受影响；重启前基线未变（`signals\doubao` 仍只有 `.gitkeep` + `wake-later.done` 176B）。
- 若要把这类输出按住，属于 豆包联络人 的提示词/会话卫生问题，不在插件侧。

## 取证工具（新写，可复用）

`.batch\night\tools\session-read.cjs`：DSH 的 `session.v4.jsonl.zstd` 是**多帧 zstd 追加写**（首帧 header + 每轮追加一帧），`zstdDecompressSync` 与流式解压都只解第一帧（只得到 222 字节 header）。该工具按 zstd 帧格式逐帧切分再逐帧解压，leader 会话 1510 帧 → 8,783,445 字符，可用。
配套：`grep-sessions.cjs`（跨会话搜文本）、`grep-sessions-lines.cjs`（带时间与记录类型）、`session-info.cjs`（会话头与活性）。
