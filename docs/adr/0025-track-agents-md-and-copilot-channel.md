# 把 AGENTS.md 纳入版本库，并登记 Copilot 协作通道

ADR-0024 决定常驻入口 `AGENTS.md` **保持被 `.gitignore` 忽略**，理由是「仓库不发布内部 agent 指令」，代价是**新克隆的机器上它不存在**，只能按章程 §7.1 重建一份。这个理由本身成立，但它假设"重建成本可以接受"——2026-10-25 的实测推翻了这条假设。

两件事同时发生：其一，作者把「换机后能重建环境」列为明确诉求；其二，当天打通了 GitHub Copilot CLI 的协作通道（可从任意会话无头派活给一个独立进程），而这条通道的知识**没有任何随仓库走的载体**。本机记忆 `MEMORY.md` 也救不了——`.workbuddy/` 同样被 `.gitignore` 忽略，换机即归零。于是"新机器上没人知道有这条通道"成为事实：通道存在，但不可发现。

因此解除 `/AGENTS.md` 的忽略，让它入库；新增的通道手册 `docs/agents/copilot-channel.md` 同时入库，并在 `AGENTS.md` 与 `docs/README.md` 各挂一个指针。**本文取代 ADR-0024 中「保持忽略」这一子条款，其余不变**：常驻入口的定位、≤60 行上限、章程为权威副本、两边 `charter-version` 由脚本 C7 校验，全部继续有效。

发布卫生的边界因此需要重新划清，而不是被放弃：

- **入库**：项目地图、命令集、硬规则、以及"要做什么 → 先读什么"这类**结构性与纪律性**内容。
- **仍不入库**：`/CONTEXT.md`、`/.claude/`、`/.codex/`、`/.superpowers/` 等工具私有状态与本地审查产物。
- **一律不写**：凭据、机器绝对路径、个人信息。

## Consequences

- 新克隆即可用：`AGENTS.md` 直接存在，Copilot / Codex / Cursor 与 WorkBuddy 都能读到；章程 §7.1 从「不存在时重建」降级为「误删时重建」。
- 通道变得可发现：换机后新会话从 `AGENTS.md` 的一行指针就能找到 `docs/agents/copilot-channel.md`，不必再重新调查参数与权限模型。
- 代价是内部 agent 指令进入公开仓库。约束靠三件事顶住：60 行上限、只写地图/命令/硬规则、上述三条「一律不写」。
- `charter-version` 两边同步升到 `2026-10-25`（C7 校验）；`docs/README.md` §6 与章程 §2/§7.1 的口径已同批改齐。
- ADR-0024 内提到的 `.gitignore:58` 自此成为**历史引用**（行号已失效），以本文为准。ADR 只增不改，原文保留。

## 相关

- 取代的子条款：[`0024-document-placement-charter-and-agents-md.md`](./0024-document-placement-charter-and-agents-md.md)
- 通道手册：[`../agents/copilot-channel.md`](../agents/copilot-channel.md)
- 章程：[`../agents/documentation-charter.md`](../agents/documentation-charter.md)
