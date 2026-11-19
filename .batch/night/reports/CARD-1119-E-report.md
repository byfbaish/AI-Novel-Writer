执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# CARD-1119-E 交付报告 · 尾行检查对 `.batch/night/archive/` 豁免

- 卡面：`.batch/night/cards/CARD-1119-E-hygiene-archive-exempt.md`（61 行 / 5,526B / `8b352ef57d3048be538bbadc61d994e3`）
- 派验单：`.batch/night/review-requests/CARD-1119-E-hygiene-archive-exempt.md`（47 行 / 2,636B / `7af3bef7866938ca7d6e979b3441d3d2`）
- 工作区：`C:/develop/workspace/AI-writer/wt-1119e`｜分支 `card/1119-E`｜起点 `f8728c8d`（`work/pii-1119`）
- 提交：**`44ff679f1aa714c7d099e336ee3fa548942fa970`**（父 `f8728c8def62c6bdf20a77d8e3ab0070bc579867`，1 提交，2 files changed +64/−1）
- 一句话：给机检尾行规则加了**只含 `archive/`** 的目录豁免面，单测补两向反证；判据 4 正反两向都实测过（正向 0 项、常量置空后仍报 8 项）。**未改 archive 内任何文件字节。**

## 一、开工与改动面

开工四项校验：`git worktree add -b card/1119-E ../wt-1119e f8728c8d`（3205 文件、status 0）；junction 共享 `develop/node_modules` 成功（`fs.symlinkSync(...,'junction')`，与 A/D 卡同法），未 `pnpm install`、未 rebuild。

改动三处，全在 `scripts/ops/check-batch-hygiene.mjs`：

1. `:39-44` 新增常量（紧跟 `EXEMPT_VERSIONED_DIRS`，不改它）：
   ```js
   /**
    * 尾行检查的目录豁免面（与版本文件名豁免面分开维护）：
    * archive/ 是「原样留档、事后哈希对账」的冻结区，补末行换行会改归档件字节，
    * 故只对尾行规则放行 archive/；staging/、cards/、reports/ 仍照常检查。
    */
   export const EXEMPT_TRAILING_DIRS = [`${WATCH_ROOT}/archive/`]
   ```
2. `:72-78` 新增判定函数：
   ```js
   export function isTrailingExempt(repoRelPath) {
     return EXEMPT_TRAILING_DIRS.some((dir) => repoRelPath.startsWith(dir))
   }
   ```
3. `:101-104` 尾行检查入口加豁免（版本文件名规则一字未动）：
   ```js
   if (file.path.endsWith('.md') && !isTrailingExempt(file.path)) {
   ```

单测（`scripts/ops/__tests__/check-batch-hygiene.test.mjs`）新增 `describe('尾行豁免面：archive 不报、其它照报（CARD-1119-E）')` 六例：豁免面只含 archive／archive 缺尾行不报／archive 连续空行也不报／staging 照报／cards 与 reports 照报／archive 版本文件名仍由 `EXEMPT_VERSIONED_DIRS` 豁免。

两个文件的最终尺寸：`scripts/ops/check-batch-hygiene.mjs` 16,431B、`scripts/ops/__tests__/check-batch-hygiene.test.mjs` 12,999B。

## 二、判据 1–8 取证

**判据 1（常量运行时解析值＝`.batch/night/archive/`）** —— 两行取证：

- 源码行：`export const EXEMPT_TRAILING_DIRS = [`${WATCH_ROOT}/archive/`]`
- 解析值：`node -e "import('./scripts/ops/check-batch-hygiene.mjs').then(m=>console.log(JSON.stringify(m.EXEMPT_TRAILING_DIRS)))"` → `[".batch/night/archive/"]`

**判据 2（`EXEMPT_VERSIONED_DIRS` 仍含 staging）**：

```
$ git show HEAD:scripts/ops/check-batch-hygiene.mjs | sed -n '36,45p'
export const EXEMPT_VERSIONED_DIRS = [`${WATCH_ROOT}/archive/`, `${WATCH_ROOT}/staging/`]
...
export const EXEMPT_TRAILING_DIRS = [`${WATCH_ROOT}/archive/`]
```

运行时：`JSON.stringify(EXEMPT_VERSIONED_DIRS)` → `[".batch/night/archive/",".batch/night/staging/"]`；`isTrailingExempt('.batch/night/archive/roster/x.md')`＝`true`、`isTrailingExempt('.batch/night/staging/x.md')`＝`false`。

**判据 3（单测两向反证）**：

```
$ node scripts/run-tests-electron.mjs scripts/ops/__tests__/check-batch-hygiene.test.mjs
 ✓ scripts/ops/__tests__/check-batch-hygiene.test.mjs (33 tests) 2823ms
 Test Files  1 passed (1)
      Tests  33 passed (33)
EXIT=0
```

33 例＝原 27 例 ＋ 新增 6 例（全部通过，无跳过）。

**判据 4（`78d56ea0` 临时树正反两向）** —— 详见 §三。

**判据 5（本线 `--all` ＝ 0 项）**：

```
$ node scripts/ops/check-batch-hygiene.mjs --all   # 在 wt-1119e
0 项不合规
EXIT=0
```

**判据 6（`check-fast` 全部通过）** —— 由 pre-commit 钩子实名跑（junction 已在，未用 `--no-verify`）：

```
[check:fast] typecheck ✓ 26.8s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 2.3s
doc placement: 扫描 437 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。
隐私机检（暂存新增行）：通过，0 处命中
```

**判据 7（提交面）**：

```
$ git show --name-only --pretty=format: HEAD | grep -c '^\.batch/'
0
$ git rev-list --count f8728c8d..HEAD
1
$ git status --porcelain | wc -l
0
```

**判据 8（报告格式）**：首行 `执行方：developer`、次行 model 行、末行 `<!-- DONE -->`；全文不含真名（用户目录写作 `<用户名>`）。

## 三、判据 4 正反两向（8 项≠7 项，两种子形态都覆盖）

临时树：`git worktree add --detach ../tmp-dev/e-78d56ea0 78d56ea0`，把本卡改后的 `check-batch-hygiene.mjs` 覆盖进去（其余文件原样）。

正向（豁免生效）：

```
$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规
EXIT=0
```

反向（把 `EXEMPT_TRAILING_DIRS` 临时改成 `[]`）：

```
$ node scripts/ops/check-batch-hygiene.mjs --all
.batch/night/archive/roster/identity-roster.v2.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.1.md · trailing-newline · 以连续空行结尾（末行是空行）
.batch/night/archive/roster/identity-roster.v3.10.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.11.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.12.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.13.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.8.md · trailing-newline · 末字节不是换行（末行缺换行）
.batch/night/archive/roster/identity-roster.v3.9.md · trailing-newline · 末字节不是换行（末行缺换行）
8 项不合规
EXIT=1
```

与 QA 实测的构成一致：**7 件缺末行**（`v2`／`v3.8`／`v3.9`／`v3.10`／`v3.11`／`v3.12`／`v3.13`）＋**1 件连续空行**（`v3.1`），两种子形态同由 `checkTrailingNewline` 产出，豁免一次覆盖两者。`hygiene-baseline.txt` 未动，只冻结旧路径 `.batch/night/roster/…`。

取证后临时树已删除：`git worktree remove --force ../tmp-dev/e-78d56ea0`，`ls ../tmp-dev | grep -c 78d56ea0` → `0`。

## 四、红线自检

| 红线 | 结果 |
|---|---|
| 不改 archive 内任何文件字节 | 未动（`git status` 0 行；archive 内件不在提交面） |
| 不把尾行豁免扩到 archive 以外 | 常量只含 `archive/`，单测反向四例覆盖 staging/cards/reports |
| 不动 `EXEMPT_VERSIONED_DIRS`／`--disk`／退出码／修法行文案 | 均未动（diff 只 +64/−1，三段） |
| 不 `git add -A`／`.`／`-f`、不 push/rebase/merge | 逐文件点名 add 两件；未 push |
| 不留临时产物 | 临时树已删；无新增 tmp 脚本 |
| 未跑判据 4 反证不报完成 | 已跑，见 §三 |

## 五、备注

1. **F 卡判据 8 曾是「空集上通过」这条背景，本卡已把它补成真的。** 依据是负责人 19:5x 的实测：改动前 `scripts/ops/check-batch-hygiene.mjs` 对所有 `.md` 一律查尾行、**从来没有目录豁免**（只有版本文件名有 `EXEMPT_VERSIONED_DIRS`），而当时树里 `archive/` 未入库、97 件被 ignore，`--all` 只扫已跟踪面 → F 卡那条「archive 尾行 0 项」实际是在空集上成立的。本卡的判据 4 反向取证（`78d56ea0` 上常量置空仍报 8 项）正是把这条从「空集通过」变成「有实测红项、豁免后才转绿」的证明。

2. 本卡只做**尾行规则**的 archive 豁免；`archive/` 的**版本文件名**仍由 `EXEMPT_VERSIONED_DIRS` 豁免（两条规则分开维护，互不替代）。`--disk` 在带 archive 入库的树上仍会因 `versioned-filename` 计数上升——那是 B-16 的范围，本卡不碰。

3. 合并 `work/archive-in-git-1119`（`78d56ea0`）后，这笔改动可让 `--all` 从红 8 项转为 0 项；合并与推送仍由项目总负责人裁，我不动。

4. 本卡未改 `.gitignore`：本线（`work/pii-1119`）上 `archive/` 仍是 ignore 区，`--all` 只扫已跟踪面，故判据 5 在本线为 0 项属预期。

<!-- DONE -->
