# CARD-1118-D §2.2 开工前的两处判据问题 · 请裁定

- 执行方：developer · AI writer项目组
- 时间：2026-11-19 12:2x
- 状态：**尚未移动任何文件**（只做了只读探测与一次 3 秒探针，已删）
- 工作区：`C:/develop/workspace/AI-writer/develop`（分支 `work/pii-1119`，HEAD `f8728c8d`）

## 一、丙类处置规则与判据 5 互斥

卡面 §2.2 丙类：「无主件 → **不删、不改名**，只入 archive 并 README 写『唯一现存副本』」。
卡面判据 5：「**丙类原路径全部仍在**」。

「移入 archive」与「原路径仍在」不可能同时成立——除非对丙类做的是**复制**（那样原处与 archive 各一份，正好又是你否掉的「两套副本」）。

实测丙类影响面：丙类 **34 件**（含 `staging/identity-copies/` 3 件），其中 **26 件被在盘件按原路径引用**（取数：`git grep -l -F <文件名> f8728c8d -- .` 条数 >0）。移走后这些引用指向空路径，而 archive 被 git 忽略（见第二节），断链在 git 侧也查不出来。示例：`cards/d1-delivered-path.v3.md` 被 5 件引用（`.batch/night/reports/ledger-pending-entries-1116.md`、`.batch/night/reports/task-ledger.md`、`.batch/night/review-requests/d1-delivered-path.md`、`.batch/night/staging/d1-precheck-1117.md`、`scripts/ops/hygiene-baseline.txt`）。

**请裁（二选一）**

- **A1 丙类原地保留**：只在 `archive/README.md` 登记「原路径 · 丙类 · 唯一现存副本 · 未移动」，判据 5 天然满足；本卡实际移入数＝乙类 **48**；README 清单 82 条（48 移入＋34 未移，逐条标状态）。
- **A2 丙类移入 archive**：判据 5 改读「archive 内 34 件实存且 md5 与清单一致」，同时接受 26 处原路径引用失效（README 记新旧映射供日后追）。

我的建议：**A1**。丙类是没有主件的孤本，移动的唯一收益是目录整齐，代价是 26 处引用断＋git 侧零留痕；留原处不改名也守住了「唯一现存副本」。

## 二、判据 4 后半句在 archive 上恒为假

判据 4：「`git status --porcelain -- .batch/night` 无 ` D`、移入件在 `git ls-files --others` 可见」。

`.gitignore` 只放行 6 个目录，**`archive/` 不在其中**：

```
91:/.batch/*
92:!/.batch/night/
93:/.batch/night/*
94:!/.batch/night/cards/
95:!/.batch/night/org/
96:!/.batch/night/reports/
97:!/.batch/night/review-requests/
98:!/.batch/night/roster/
99:!/.batch/night/staging/
```

探针实证（12:2x，放 `.batch/night/archive/__probe-1118d.md` 后立即删除）：

```
$ git ls-files --others --exclude-standard .batch/night/archive
（空）
$ git status --porcelain -- .batch/night/archive
（空）
$ git status --porcelain --ignored=matching -- .batch/night/archive
!! .batch/night/archive/
```

即：**任何进入 archive 的件，git 都看不见**，与是否移入无关。所以「移入件在 `git ls-files --others` 可见」对 archive 目标不可满足；而原 78 件本就未跟踪，移动也不会产生 ` D`（判据 4 前半句天然满足）。

**请裁：判据 4 后半句改读**——移入件以**文件系统实存**为准（`test -f` 可读、`wc -c` 与清单字节一致、`md5sum` 与清单一致），git 侧只保留「`status -- .batch/night` 无 ` D`」。

附带的盘面变化先说清，免得被当成丢件：乙类 48 件移走后，`git status --porcelain` 的 `??` 会从 98 降到 50 —— 它们是进了 ignore 区，不是消失（`ls` 可查）。

## 三、你已定的两条，我不再问

- 按 **82** 收：79 顶层 ＋ `staging/identity-copies/bot-session-identity.v2/v3/v4.md`。
- 在 **develop 原地移**；`wt-1118d` 只跑机检。
- 本卡只要求 `--all` exit 0 且 0 项，`--disk` 上升不算不通过（`versioned-filename` 对 archive 仍生效）。

## 四、等你一句话就开工

A 段（丙类 34 件）与 B 段（判据 4 改读）定下来，我按选定口径一次做完：移 48 或 82、写 82 条 README、跑判据 1–8、出 `.batch/night/reports/CARD-1118-D-report.md` 交件。
