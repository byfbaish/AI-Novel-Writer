# B-23 证据文件：`archive/` 已豁免 `versioned-filename`——B-23「不成立」

- 记录人：developer · AI writer项目组（群分身）
- 记录时刻：2026-11-21 00:35（Asia/Shanghai）
- 取数基线：分支 `exp/mainline-1119`，HEAD `0d2671db`（含 `376ce148`），工作区 `C:/develop/workspace/AI-writer/develop`
- 结论：**不成立**。`archive/` 自 `d1a6e75c`（2026-11-17）起就在 `EXEMPT_VERSIONED_DIRS` 里；代码中不存在「同目录须有主件」这条规则。本件不是「本 Goal 修好的」，是「从来就是豁免的」。

## 证据一：豁免名单自 `d1a6e75c` 起含 `archive/`

```
$ sed -n '36,39p' scripts/ops/check-batch-hygiene.mjs
export const RULE_VERSIONED = 'versioned-filename'
export const WATCH_ROOT = '.batch/night'
export const EXEMPT_VERSIONED_DIRS = [`${WATCH_ROOT}/archive/`, `${WATCH_ROOT}/staging/`]

$ git log -1 --format='%h %ad %s' --date=short -S"EXEMPT_VERSIONED_DIRS" -- scripts/ops/check-batch-hygiene.mjs
d1a6e75c 2026-11-17 CARD-1117-D pre-commit 机检：尾行换行/禁 vN 文件名/缺卡号提醒
```

即：`archive/` 的豁免与 `versioned-filename` 规则**同一次提交落地**，从未缺失。

## 证据二：`checkVersionedName` 对豁免目录直接 `return null`

```
$ sed -n '84,86p' scripts/ops/check-batch-hygiene.mjs
export function checkVersionedName(repoRelPath) {
  if (EXEMPT_VERSIONED_DIRS.some((dir) => repoRelPath.startsWith(dir))) return null
  const base = repoRelPath.split('/').pop() ?? ''
```

「同目录须有主件」这条规则在全仓代码中不存在：

```
$ grep -rn "主件" --include=*.mjs --include=*.ts --include=*.ps1 scripts/
（无输出，exit 1）

$ grep -rln "同目录须有主件" --include=*.mjs --include=*.ts --include=*.ps1 --include=*.md . | grep -v node_modules
./.batch/night/org/BACKLOG.md
```
BACKLOG 里那一句就是 B-23 自己的叙述，不是代码。

## 证据三：实测 archive 内 71 件 `.vN`，`--disk` 命中 0 行

```
$ find .batch/night/archive -type f -name "*.v[0-9]*" | wc -l
71

$ node scripts/ops/check-batch-hygiene.mjs --disk | grep -E "^\.batch/night/archive/" | wc -l
0

$ node scripts/ops/check-batch-hygiene.mjs --disk | tail -3
.batch/night/tools/_mk-notice-readback-v2.cjs · versioned-filename · 文件名带版本号（版本由 git 承担，请去掉 .vN/-vN）
14 项不合规
修法：给缺换行的文件末尾补一个换行；带版本号的文件用 `git mv` 改名（archive/ 与 staging/ 下豁免）；历史件本身不动则进 baseline 冻结清单。
```

- 71 件构成：69 个 `.md` + 2 个 `.mjs`
- `--disk` 全量 14 项分布：`signals/lead` 4、`tmp/` 7、`tools/` 5——**无一在 `archive/`**
- `--disk` 输出里唯一含 `archive/` 的一行是「修法」提示文案，不是违规行（`grep '^\.batch/night/archive/'` 为 0 已经排除）

## 附：B-23 这条叙事的来源（供后人核对，不作结论）
CARD-1118-D 把 82 件工作件移入 `archive/` 后，`--disk` 计数确实上升过；但上升的项来自 `signals/lead`、`tmp/`、`tools/` 这些非豁免目录。BACKLOG B-23 记于 2026-11-20 05:45，应是把「D 卡 --disk 上升」与修法文案里「archive/ 与 staging/ 下豁免」两句合并误读所致。

<!-- DONE -->
