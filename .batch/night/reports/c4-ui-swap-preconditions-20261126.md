# C4 视觉层一次性换壳 · 前置条件与回滚基线（2026-11-26 23:4x）

主人裁定：**C4 一次性更换**；更换之前，**工作区清理干净、做好基线回滚准备**。

## 一、回滚基线（已建）

| 项 | 值 |
|---|---|
| 基线 tag | `pre-ui-rd-swap-20261126`（annotated） |
| 基线提交 | `2880a05bebe151526f2d9df3b688374a8b3b00ae`（`2880a05be`） |
| 我方分支 | `exp/resource-ledger`（领先 `origin` 17 笔，未推） |
| 上游被吸收方 | `upstream/master` = `f1d7f1d9`，分叉点 `549522d4` |
| 换壳范围实测 | `git diff --stat HEAD upstream/master -- src/components` → **553 files changed, +62,337 / −59,129**（口径＝我方当前树 → 上游当前；派工与排期按此数） |
| 三个数不是矛盾、是三个基准（11-26 已实测） | 553＝`HEAD..upstream/master`（待改量，含我方分叉后自己改过的文件）；473＝`549522d4..upstream/master`（上游自分叉点起的改动量）；161＝上游改写/删除的路径转述数。起算点不同，报告里引用须带命令 |
| 目录规模 | 我方 `src/components` 322 文件；分叉点 320；上游现在 413 |

回滚命令（换壳出问题时任一步都可退）：

```bash
cd /c/develop/workspace/AI-writer/develop
git reset --hard pre-ui-rd-swap-20261126     # 回到基线（会丢弃未提交改动，先确认 porcelain 0）
git clean -fd src/components                 # 清掉换壳引入的未跟踪文件
```

tag 目前**只在本地**。仓库一旦损坏 tag 随之丢失，故建议在换壳前把基线 tag 与 17 笔提交一并推到 `origin/exp/resource-ledger`（需主人点头）。

## 二、开工前必须清理干净（现状）

主工作区 porcelain **5 行**，全是文档、无 `src/`：

- `M .batch/night/reports/upstream-not-absorbed-20261126.md`
- `?? .batch/night/reports/upstream-absorb-candidates-20261126.md`
- `?? .batch/night/review-requests/reabsorb-20261126.md`
- `?? .batch/night/staging/upstream-reabsorb-20261126.md`
- `?? .batch/night/staging/upstream-reabsorb-addendum-20261126.md`

→ 由项目组各自提交入库，换壳前 porcelain 必须为 0。

worktree 槽位 7 个，其中 3 个脏，换壳前必须由各自 owner 清零或移除：

| 槽位 | HEAD | 脏文件数 | 处置 |
|---|---|---|---|
| `wt-1` | `89ec70147` | 0 | 冻结或移除 |
| `wt-2` | `6c32f78a5` | **2** | owner 清零后冻结 |
| `wt-c4` | `3e3651ee3` | **2** | C4 已交件，可移除 |
| `wt-c5` | `ce6776a3f` | 0 | C5 已收口，可移除 |
| `wt-d15` | `f95ed1da8` | 0 | 可移除 |
| `wt-d18` | `7b48f0747` | 0 | 可移除 |
| `wt-d18-apply` | `17794aa9c`（detached） | **2** | 先确认无用再移除 |

移除 worktree 属**破坏性动作**，须主人点头后逐个 `git worktree remove`，并先做 blob 比对（沿用 S5 收口的做法）。

## 三、执行顺序（换壳那一次串行做，不许并行）

1. **冻结**：所有 worktree 槽位停止建新分支、停止跑测试（553 文件级替换，任何并行槽位都会被搅乱）。
2. **清场**：主工作区 porcelain 0；worktree 该移除的移除。
3. **备份**：基线 tag 已建；另存 `git bundle create /c/tmp/aiwriter-pre-ui-swap-20261126.bundle --all`（可选，防 `.git` 损坏）。
4. **替换**：按上游 `src/components` 整体替换，逐簇对齐我方 IPC 类型与皮肤变量；**不引入上游依赖**（依赖另按 C5 逐包跟）。
5. **验证**：`pnpm check:fast` → `node scripts/run-tests-electron.mjs` 相关用例 → 起一次 `pnpm dev` 肉眼验主界面 → `electron.exe` 残留 0。
6. **放回**：验证绿后解冻槽位；worktree 从新 HEAD 重建。

## 四、风险（写在前面，别到出事才发现）

- **面太大**：553 文件／+62k 行，一次做完中间态必然不可用，所以必须在一个专用分支上做、不直接在 `exp/resource-ledger` 上改。
- **IPC 边界**：换壳牵 UI 与主进程的接口形状，`src/shared/**` 与 `electron/controllers/**` 可能连带改动，超出"只换组件"的范围要先报。
- **皮肤体系**：我方自有皮肤变量与上游 RD 外壳不同名，替换后会出现样式全丢的中间态，属预期。
- **ABI**：换壳本身不动依赖；若连带加包，按 C5「允许动 ABI」但串行执行。
