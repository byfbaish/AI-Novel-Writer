# 上游评估基线（2026-11-26 钉定）

> 用途：下次只做差量。任何"重新评估全量"的提案先拿本文件对一次，能算差量就不重跑全量。
> 本文件由项目总负责人维护；读数一律带命令，别只写结论。

## 一、节点

| 项 | 值 | 取证命令 |
|---|---|---|
| 上游仓库 | `EthanYoQ/AI-Novel-Writer` → 已改名 **`EthanYoQ/Pagekin`**（API repo id 1275436512） | — |
| 上游 remote | `https://github.com/EthanYoQ/AI-Novel-Writer.git` | `git remote -v` |
| **上游 HEAD（本次基线）** | **`f1d7f1d91bd5bb8e2e2523fda5edaea53a8dc079`** | `git rev-parse upstream/master` |
| 上游全历史笔数 | 5,482 | `git rev-list --count upstream/master` |
| 本地 `.git` 体积 | 241M（拉全量后） | `du -sh .git` |
| **分叉点（真实共同祖先）** | **`fc576e089939789c18261560ea5838b4487e7440`**（`fc576e08`，2026-08-16 `chore(release): prepare v0.8.4 reliability release`） | `git merge-base HEAD upstream/master` |
| **上游发布点（非我方祖先）** | `549522d4`（#381 rd-4-run-sheet，2026-10-14 03:43 +0800）——**不是我方祖先**，只是上游某次发布点，评估时曾被误当分叉点 | `git merge-base --is-ancestor 549522d4 HEAD` → exit 1（NO） |
| 真实缺口 | **5,248** 笔（`fc576e08..upstream/master`） | `git rev-list --count fc576e08..upstream/master` |
| 未评估区段 | **893** 笔（`fc576e08..549522d4`，2026-08-16→10-14）——**从未被任何一件评估覆盖**，是否扩面待主人裁 | `git rev-list --count fc576e08..549522d4` |
| 分叉点树（旧评估起点 `549522d4` 的树） | `ecca898653fcd98b69c9870ec6ecf4063be26a4d` | `git rev-parse upstream-baseline^{tree}` |
| 分叉点本地副本 | `upstream-baseline`=`8afec2a1`、`relive-src/upstream-baseline`=`5ee50c2a`（重写副本，树同值） | `git rev-parse <ref>^{tree}` |
| 禁用祖先 | `dd04d3e9`（10-10 #337）是重写史**假祖先**，`merge-base` 不可用 | — |
| 我方 HEAD（基线时点） | `41664021e8737d5aa3af75e930e1b89b6bd3a573` | `git rev-parse HEAD` |
| 评估件 | `.batch/night/reports/upstream-diff-eval-20261126.md`，140 行／`326e3104…921758` | `sha256sum` |
| 机器清单 | `.batch/night/reports/upstream-diff-inventory.tsv`，4,320 行／667,855 B／`44a33a3b…e275aa1e` | `sha256sum` |
| 评估时增量（相对上游发布点 `549522d4`） | API `compare/549522d4...master` → `ahead_by 4348` | `GET /repos/EthanYoQ/Pagekin/compare/549522d4...master` |
| 本地复算增量（相对 `549522d4`） | `4355`（`549522d4..upstream/master`）；与 4348 差 7＝上游在取数后又进 7 笔。**这是真实缺口的子集**，不是总缺口 | `git rev-list --count 549522d4..upstream/master` |

## 二、通道（实测，含生效用法）

**可用（当前唯一可靠方式）**：git 不认 Windows 系统代理，必须显式给环境变量：

```bash
HTTPS_PROXY=http://127.0.0.1:3067 git fetch upstream
```

- 该命令实测通过：一次拉全 `upstream/master`（5,482 笔），`.git` 191M → 241M。
- 副作用警告：`warning: Ignoring unavailable SSL backend 'openssl'; using 'schannel' instead` 属正常，不影响。
- 备用通道（不走代理时可用）：`codeload.github.com` 取 master tarball（114,852,871 B／9.49s）；`api.github.com` 未认证 60/h（用尽后走认证 MCP `list_commits(path=…)`）。

**不可用（别再试）**：不设代理时 `github.com:443` 的 git 协议直接超时（`Failed to connect to github.com:443 after 21073 ms`）；`ssh git@github.com` 小查询通，但大流量 `git fetch` 下到 ~4MB 静默失败（`FETCH_HEAD` 0 字节、ref 不更新）。

## 三、对象级 cherry-pick 结论：不做（已实测，别复验）

临时 worktree 摘两条代表提交：

| 上游提交 | 内容 | 冲突 |
|---|---|---|
| `589d20b4` | 导入失败文案分项（C4 来源） | 3 处 |
| `ee7b305b` | 取消/失败分离（C1 来源） | 6 处 |

冲突不只在正文，还有一批 **modify/delete**（我方已删、上游仍改）：`issue-scenarios.md`、`transport-diagnostics.ts` 等。
**结论**：摘取省不掉改写，只是把改写换成解冲突。五张吸收卡一律**按我方接口重写**，卡面「非 cherry-pick」的依据就是这两组冲突数。A1 不再复验。

## 四、下次评估的起算命令（原文，直接复制）

```bash
cd /c/develop/workspace/AI-writer/develop

# 1) 取最新上游（必须带代理变量）
HTTPS_PROXY=http://127.0.0.1:3067 git fetch upstream

# 2) 总增量笔数（自真实共同祖先）
git rev-list --count fc576e08..upstream/master

# 2b) 其中从未被评估覆盖的区段（08-16→10-14；扩面与否待主人裁）
git rev-list --count fc576e08..549522d4

# 3) 差量：自上条基线以来新增的提交（起点 = 本文件 §一 的上游 HEAD）
git log --oneline f1d7f1d91..upstream/master

# 4) 差量：文件级变化（只要触及我方已有文件的）
git diff --name-status f1d7f1d91..upstream/master | awk '$2 ~ /^(electron|src|scripts)\//'

# 5) 取某文件上游原文对（评估某簇时唯一合法依据）
git diff f1d7f1d91..upstream/master -- <路径>
```

**差量评估口径**（沿用上一轮，勿另立）：P0 去 merge → P1 路径映射（上游路径 ∩ 我方 HEAD 树为空 ⇒ 整簇 B/C）→ P2 只评"触碰我方已有文件"的提交，逐条落 A1/A2/B/C。禁凭标题定性、禁按上游行号定位（我方已脱敏重写）。

## 五、已定的不吸收面

见 `.batch/night/reports/upstream-not-absorbed-20261126.md`（B 九簇／C 五簇／324 条非代码路径，逐条理由与重估触发条件）。**该清单只覆盖 `549522d4..upstream/master`，不含 `fc576e08..549522d4` 的约 893 笔**；该区段是否扩面待主人裁。
