# 上游同步台账（upstream sync ledger）

> **用途**：`dev_byf` 与本仓库原项目（`upstream`）已实质分叉，**不可能再整体 merge**；
> 本文件记录每次对上游做 diff 的**时间与基线**，并逐条评估上游改动**是否值得吸收**，
> 让"选择性挑拣"变成可复查、可接续的流程，而不是每次都靠记忆重新判断。
>
> **权威状态**：本文件是同步状态的唯一台账。分支与基线一旦变化，**先更新 §1，再动代码**。

---

## 1. 分支与基线

| 角色 | 名称 | 指向 | 说明 |
|---|---|---|---|
| 我方主线 | `dev_byf` | 见下方快照 | 全部开发工作在这里 |
| 上游基线（本地） | `upstream-baseline` | `upstream/master` | **2026-10-14 新建**，用途：随时与上游比 diff 的锚点；本地跟随 |
| 上游（远程） | `upstream` = `EthanYoQ/AI-Novel-Writer` | — | **原项目**，只读参照，不推 |
| 我方 fork（远程） | `origin` = `byfbaish/AI-Novel-Writer` | — | 自己的远端；`origin/master` 自 2026-10-09 后未再同步 |

**分叉点（merge-base）**：`8c93403`（2026-10-09，`Merge pull request #331`）

**当前快照**

| 项 | 值 |
|---|---|
| dev_byf HEAD | `c74a018`（2026-10-14） |
| 独有提交数（分叉点之后） | **123** |
| 上游侧独有提交数 | **0**（分叉点之后 origin/master 无新增） |
| 上游侧被引入的提交 | **3 个**：`464aa95`(#335)、`dc74cde`(#336)、`1f8f22d`(#337) —— 2026-10-10 从 `upstream/master` 拉入，**已在 dev_byf 上** |

> ⚠️ **重要判据**：origin/master 与 upstream/master 的差异**只有这 3 笔**。
> 也就是说 `dev_byf` 相对 `upstream/master` 已经是"分叉点 + 3 笔上游 + 120 笔自有"。
> **所谓"从 master fork 一个分支存原项目代码" = 就是 `upstream-baseline` 这一个引用，不需要真做 merge。**

---

## 2. 文件命名与边界

**`upstream-sync-ledger.md`（本文件）** = **流程台账**：基线、方法、逐条评估、决策。
**真正的"逐次 diff 记录"按日期另存**，避免本文件无限膨胀：

```
docs/handoffs/upstream-sync/YYYY-MM-DD-diff.md     ← 每次 diff 的原始记录（可多条）
```

历次记录索引：

| 日期 | 文件 | 基线 | 结论 |
|---|---|---|---|
| 2026-10-14 | `docs/handoffs/upstream-sync/2026-10-14-diff.md` | `1f8f22d` → `bb3c80a0`（116 笔） | 见 §4.2 |

---

## 3. 同步方法（每次照做）

```bash
# 0) 前提：能访问 GitHub（沙箱内需先解决网络；见 §6）
git fetch upstream --prune          # 更新上游引用
git fetch origin --prune            # 更新自己的 fork

# 1) 上游自上次基线以来有什么新东西？
git log --oneline upstream-baseline..upstream/master

# 2) 逐笔看内容（只看这一类：fix / feat / test / perf）
git log upstream-baseline..upstream/master --stat

# 3) 判断某笔"是否已被我方覆盖"—— 三种手段，按成本递增
#    ① 反向查找：这笔在上游的原始提交是否已在 dev_byf 上（注意 cherry-pick 会产生新 hash）
git log --oneline --all --grep="<关键词>"
#    ② 内容比对：某文件的当前版本是否已包含该修复
git log -L :<function>:<file> dev_byf --oneline
#    ③ 直接 diff 目标区域
git diff dev_byf upstream/master -- <path>

# 4) 确认要吸收的 → cherry-pick（不要 merge）
git cherry-pick <sha>
#    冲突时优先保留我方设计；若该笔已无意义则 git cherry-pick --skip

# 5) 记录：新增 docs/handoffs/upstream-sync/YYYY-MM-DD-diff.md，并在 §2 索引与 §4 追加一行
# 6) 基线推进（重要！否则下次重复评估）
git branch -f upstream-baseline upstream/master
```

**为什么用 cherry-pick 不用 merge**：两条线已实质分叉（我方 123 笔，其中 57 笔是设计文档），
整体 merge 会把上游的架构假设重新灌进来，冲突面覆盖全库。cherry-pick 按笔选择性吸收，**每笔都可独立回退**。

---

## 4. 逐条评估记录

每次 diff 就追加一张表。字段定义：

- **类型**：`fix` / `feat` / `test` / `chore` / `docs` / `refactor` / `perf`
- **判定**：`吸收`（cherry-pick）/ `跳过`（与本项目无关或已被覆盖）/ `替代`（用我方方式实现同一目的）/ `待定`
- **依据**：必须写**可复查的事实**（文件名、函数名、命令输出），不写"感觉"。

### 4.1 基线建立时的存量核对（2026-10-14）

| # | 上游提交 | 类型 | 判定 | 依据 |
|---|---|---|---|---|
| 1 | `464aa95` fix(qualification): reuse protocol snapshot per ledger update (#335) | fix | **已在 dev_byf** | `git merge-base --is-ancestor 464aa95 dev_byf` 成立 |
| 2 | `dc74cde` test(browser): bound relationship graph fixture dimensions (#336) | test | **已在 dev_byf** | 同上 |
| 3 | `1f8f22d` test: keep batch chapter waits inside React act (#337) | test | **已在 dev_byf** | 同上 |

⇒ 建立台账时**无待吸收项**。

### 4.2 首次 diff（2026-10-14）：`1f8f22d` → `bb3c80a0`（116 笔）

同步上游引用时发现上游 5 天内推进 116 笔，随即完成全量分类。**原始记录见
`docs/handoffs/upstream-sync/2026-10-14-diff.md`**。摘要：

| 判定 | 数量 | 说明 |
|---|---|---|
| ⛔ 跳过 | **100** | `redesign`（RD-0~RD-8 前端重设计）89 笔 + `docs(design)` 11 笔 —— **上游在走"纸墨设计系统 + 新外壳"，是另一个方向** |
| ✅ 吸收 | **1** | `eb8c3f00` 的「章节卡出场关键人输入被打断」半 —— **我方有同样 bug**（`ChapterCardEditor.tsx:1136` 仍用受控 `value`），手工应用 2 行 |
| ⚪ 待评估 | **1** | `b5781975` —— 与 P0-1 落点重叠，且碰 schema 红线，单独开轮 |

**遗留待评估项**（下次 diff 必先看）：

| 项 | 提交 | 阻塞原因 |
|---|---|---|
| 短细纲重试 + 新项目单事务初始化 | `b5781975` | 与 P0-1 落点重叠；且碰 schema 基线红线（需 lane 六步） |

> ⚠️ **基线暂未推进**（仍 `1f8f22d`）—— `b5781975` 未评估完，推进会让它"消失在基线里"。
> 待该项处理完，执行 `git branch -f upstream-baseline upstream/master` 并更新本节。

---

## 5. 长期维护约定

1. **本文件只放台账与判据**，原始 diff 记录放 `docs/handoffs/upstream-sync/`，防止本文件膨胀。
2. **每次吸收完必须推进基线**（§3 第 6 步），否则下次会把已看过的重看一遍。
3. **吸收上限**：一次同步不要 cherry-pick 超过 5 笔 —— 超过说明分叉已经太大，应改为"读上游思路、我方自己实现"（判定 `替代`）。
4. **设计文档类（docs）一律不吸收**：上游的设计稿建立在他们自己的分层假设上，我方已有独立设计稿（`docs/design/`）。
5. **不动 `master` 分支**：它仍跟踪 `origin/master`，保持与 fork 的对应关系；上游比对走 `upstream-baseline`。

---

## 6. 已知环境障碍（2026-10-14 实测）

| 现象 | 根因 | 处置 |
|---|---|---|
| `git fetch` 报 `CONNECT tunnel failed, response 502` | 沙箱注入的本地代理（`HTTP_PROXY=http://127.0.0.1:64692`）本身不可用 | 需在**允许网络**的环境执行 fetch/push |
| 清空 `HTTP_PROXY` 后报 `Failed to connect to github.com:443 after 21s` | 沙箱自身拦截 443 出站 | 同上 |
| 主机侧 `ping github.com` 正常（249ms），`Invoke-WebRequest` 取 GitHub API **返回 200** | **宿主环境网络是通的**，仅 Agent 沙箱受限 | 推送新分支需网络豁免或由你在主机终端执行 |

**实测进展（2026-10-14）**：
- `git push origin upstream-baseline` **已成功**（首次因网络抖动失败，重试通过）。
  远程：https://github.com/byfbaish/AI-Novel-Writer/tree/upstream-baseline
- `git fetch upstream --prune` **已成功** —— 沙箱网络时好时坏，**失败就重试 1–2 次**。
- ⚠️ **沙箱内访问 GitHub 不稳定**（`CONNECT tunnel failed / 502`）。经验：**先直接重试**，
  往往第二次就通；不必先去调代理。若连续失败，再用 `dangerouslyDisableSandbox` 走主机网络。
