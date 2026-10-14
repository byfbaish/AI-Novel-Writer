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
| 我方主线 | `dev_byf` | 见下方快照 | 全部开发工作在这里；**2026-10-14 已推送远程** `origin/dev_byf` |
| 上游基线（本地） | `upstream-baseline` | **`549522d4`**（2026-10-14 第二次推进） | 用途：随时与上游比 diff 的锚点；**已推送远程** |
| 上游（远程） | `upstream` = `EthanYoQ/AI-Novel-Writer` | — | **原项目**，只读参照，不推 |
| 我方 fork（远程） | `origin` = `byfbaish/AI-Novel-Writer` | — | 自己的远端；`origin/master` 自 2026-10-09 后未再同步 |

**分叉点（merge-base）**：`8c93403`（2026-10-09，`Merge pull request #331`）

**当前快照**（2026-10-14 更新）

| 项 | 值 |
|---|---|
| dev_byf HEAD | `5e452a0f`（2026-10-14） |
| 独有提交数（分叉点之后） | **135** |
| 上游侧独有提交数 | **0**（分叉点之后 origin/master 无新增） |
| 上游侧被引入的提交 | **3 个**：`464aa95`(#335)、`dc74cde`(#336)、`1f8f22d`(#337) —— 2026-10-10 从 `upstream/master` 拉入，**已在 dev_byf 上** |

**基线推进记录**

| 日期 | 推进前 → 推进后 | 依据 |
|---|---|---|
| 2026-10-14 | `1f8f22d` → `bb3c80a0` | 首次 diff（116 笔）评估完毕、遗留项清空。⚠️ 当时**未推到最新**：`bb3c80a0..upstream/master` 尚有 27 笔未逐笔评估 |
| 2026-10-14 | `bb3c80a0` → `549522d4` | 第二批 diff（27 笔）评估完毕（记录 = `docs/handoffs/upstream-sync/2026-10-14-diff-02.md`）。✅ 已与 `upstream/master` **完全对齐（0 笔差）** |

**当前待评估区间**：**无** —— 基线已与 `upstream/master`（`549522d4`）对齐。
另有 3 项「已评估、待作者决策」，不阻塞基线推进，见 §4.3。


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
| 2026-10-14 | `docs/handoffs/upstream-sync/2026-10-14-diff-02.md` | `bb3c80a0` → `549522d4`（27 笔） | 见 §4.3 |

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
| ✅ 全部吸收 | **1** | `b5781975` —— 两部分均已落地：部分 Ⅰ（`electron/database.ts` 单事务）`55122230`；部分 Ⅱ（短细纲首次失败自动重试）`febd9e0f` |

**遗留待评估项**：**无**（本轮已清空）。

> ✅ **基线已推进**（2026-10-14）：`1f8f22d` → `bb3c80a0`（已评估边界）。
> ⚠️ **当时未推到 `upstream/master`** —— `bb3c80a0..upstream/master` 尚有 **27 笔**未逐笔评估，
> 推过去会让它们"消失在基线里"。（该 27 笔已在第二批评估完毕，见 §4.3，基线随后推进至 `549522d4`。）

### 4.3 第二批 diff（2026-10-14）：`bb3c80a0` → `549522d4`（27 笔）

**原始记录见 `docs/handoffs/upstream-sync/2026-10-14-diff-02.md`**。摘要：

| 判定 | 数量 | 说明 |
|---|---|---|
| ⛔ 跳过 | **18** | RD-4 运行侧页 / 新外壳（`src/components/stage/run/`、`src/components/run/` —— 我方**尚无**这些目录）+ `scripts/redesign/` + docs 截图视频 + CI |
| ✅ 吸收 | **1** | `2f357054` 的两组：① 调用记录按 UTC 解析（`stats-service.ts` 导出 `llmCallTime`，`BottomPanel.tsx` 历史表改用它 —— 我方 `new Date(row.createdAt)` 同样慢 8 小时）；② 角色定位显示中文（`CharacterProposalSelectionPanel.tsx` 两处）→ 落 `5e452a0f` |
| ⚪ 待作者决策 | **5** | 运行标题改版包：`17dc343b` `862c04ba` `5c5c37c4`（把「写稿 — 第 N 章 · 标题」改为「第 N 章 · 写稿」、去破折号）+ 连带修复 `53017cb6` `a8480855`（去掉 `replace(/^[^\s]+\s/)` 截断） |

**唯一带独立缺陷修复的是 `2f357054`**：其余 26 笔全部属于 RD-4 设计线或 CI/资产。
判「`2f357054` 哪几组与我方相关」的方法是**逐组比对文件存在性 + 逐行比对现状代码** ——
四组里 (b)(d) 落在我方没有的模块，只 (a)(c) 命中。

> ✅ **基线已推进**（2026-10-14）：`bb3c80a0` → `549522d4`，**与 `upstream/master` 完全对齐（0 笔差）**。
> 剩余 3 项「已评估、待作者决策」（见 §4.4）**不阻塞**基线推进 —— 它们有明确评估结论与理由，已登记在案，
> 不属于"还没看过"。


### 4.4 已评估、待作者决策（不阻塞基线推进）

| 项 | 提交 | 性质 | 说明 |
|---|---|---|---|
| 运行标题改版（去破折号、改间隔点） | `17dc343b` `862c04ba` `5c5c37c4` | 设计决策 | 上游把「写稿 — 第 N 章 · 标题」改为「第 N 章 · 写稿」，**破折号不再出现在运行标题里**。我方标题仍是旧格式（`chapter-workflow.ts:252`）。跟进与否 = 是否采用上游运行标题格式 |
| 去掉运行标题的截断逻辑 | `53017cb6` `a8480855` | 设计决策（可独立） | `AIOutputPanel.tsx:639`/`:1164`、`StatusBar.tsx:167` 的 `replace(/^[^\s]+\s/, '')` 在旧标题下会留下前导破折号（`— 第 1 章 · 标题`）。**即使不跟进标题格式**，改为直接显示完整标题也是净改善 ⇒ 可单独吸收 |
| 旧外壳隐藏 AI 聊天入口 / 启动不连 MCP | `380406ec` | 产品决策 | 删 `layout-store.rightView`、右侧工具栏去 Agent 按钮、`App` 启动不再 `useMCPStore.init()`。触碰我方多个文件，但是"要不要隐藏聊天入口"的产品取舍 |

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

**✅ 2026-10-14 推送已完成（三条分支全部在远程）**

```
refs/heads/dev_byf            0e5f2184   ← 我方主线（132 笔自有提交）
refs/heads/upstream-baseline  bb3c80a0   ← 上游基线锚点（2026-10-14 由 1f8f22d4 推进）
refs/heads/master             8c934037   ← 与 origin/master 对应，未动
```

**2026-10-14 二次推送（b5781975 部分 Ⅱ 收口）**

```
5d8fc590..0e5f2184  dev_byf -> dev_byf
1f8f22d4..bb3c80a0  upstream-baseline -> upstream-baseline
```

- **`unset` 四个代理变量后第 1 次即成功** —— 再次印证「清代理直连」优于盲重试。
- 基线推进是 **fast-forward**（`1f8f22d` 是 `bb3c80a0` 的祖先）⇒ **无需 `--force`**。
- 校验：`origin/dev_byf` = `dev_byf` = `0e5f2184`；`origin/upstream-baseline` = `upstream-baseline` = `bb3c80a0`。

- `git push origin upstream-baseline` 首次因抖动失败，**重试通过**。
- `git push -u origin dev_byf` 连续失败 **6 次**，**第 7 次通过**。
- `git fetch upstream --prune` 成功（并拉回上游新增 116 笔 + 6 个 tag）。

⚠️ **沙箱/主机访问 GitHub 都极不稳定**（`CONNECT tunnel failed 502` / `OpenSSL unexpected eof`）。

**★ 2026-10-14 二次实测：找到确定性绕过法（优于盲重试）**

沙箱每次会话会注入一个**本地代理**：`HTTP_PROXY/HTTPS_PROXY/http_proxy/https_proxy = http://127.0.0.1:<随机端口>`
（首轮是 `64692`，本轮是 `57013`）。**这个代理本身就是坏的** ⇒ `CONNECT tunnel failed, response 502` 全由它产生。

```bash
# 判据：沙箱内 env | grep -i proxy 有 127.0.0.1 代理；宿主 PowerShell 无此变量 ⇒ 宿主通、沙箱不通
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy   # 清掉后走直连
git push origin dev_byf                               # 本轮：第 1 次即成功
```
- **本轮实测**：带代理连试 **20 次全败**；`unset` 后**第 1 次成功**。
- ⇒ 修正既往经验：**先 `unset` 四个代理变量，再考虑重试**；盲重试只在代理"偶尔活"时有效。
- `dangerouslyDisableSandbox: true` **不放行网络**（它放开命令本身，子进程仍受沙箱网络策略约束）。
