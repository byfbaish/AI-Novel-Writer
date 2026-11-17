# 故事段与随想落仓 · 收口报告

仓库：`C:\develop\workspace\dsh-handoff-relay`
基线 HEAD（开工核对）：`5b6903553ac2b6d304f5fa0fc2b6dda9bc3f167d`；`git status --porcelain` 无输出。
本次提交：`e114e4408962d6d2dd6ad99fc7fa1a545db77467`（单父，父为 `5b6903553ac2b6d304f5fa0fc2b6dda9bc3f167d`）

## 1. `git show --numstat --format=` 原文

```
13	1	README.md
13	1	README.zh-CN.md
33	0	docs/why-relay.md
```

提交统计：

```
[master e114e44] docs: add relay origin story and design rationale
 3 files changed, 59 insertions(+), 2 deletions(-)
 create mode 100644 docs/why-relay.md
```

三件文件：`README.md`、`README.zh-CN.md`、`docs/why-relay.md`（新增）。`package.json` / `index.js` / `index.test.mjs` / `cordis.patch.yml` / `LICENSE` / `.gitignore` 均未进入本次提交。

## 2. 脱敏命令与输出

```
$ git grep -nE 'C:\\|\\.dsh|\\.batch|session-[0-9a-f]{8}' -- docs/why-relay.md
（无输出，0 命中）
```

补充扫描（三份文档一起）：

```
$ git grep -nE 'C:/|\.dsh|\.batch|session-' -- docs/why-relay.md README.md README.zh-CN.md
（无输出，0 命中）
```

定性词扫描：

```
$ git grep -nE '自我意识|觉醒|有灵魂|灵魂|AI' -- README.md README.zh-CN.md docs/why-relay.md
（无输出，0 命中）
```

## 3. 测试输出末两行

```
TOTAL: 56/56 PASS
RESULT: PASS
```

退出码 0。

## 4. 打包清单

```
npm notice total files: 6
```

仍为 6 件，`docs/` 不进包（`files` 未改）。

## 5. 判定线

| # | 判定 | 结果 |
|---|---|---|
| 1 | porcelain 为空；HEAD 是父为 `5b69035…` 的新单父提交 | 通过：`e114e44… 5b69035…` |
| 2 | `--numstat` 恰好三件 | 通过：README.md / README.zh-CN.md / docs/why-relay.md（新增） |
| 3 | 脱敏零命中 | 通过：见第 2 节，0 命中 |
| 4 | 故事只解释机制，无「觉醒/自我意识/有灵魂」 | 通过：定性词扫描 0 命中；正文只写「只给文件名、工作目录不同 → 找不到 → 误判」 |
| 5 | `node index.test.mjs` 56/56 PASS，exit 0 | 通过 |
| 6 | `npm pack --dry-run` 6 件 | 通过 |

## 6. 需要知道的两点

- 故事段按卡片给的标题落位（`## Why "relay"` / `## 为什么叫 relay`），输入稿里自带的加粗小标题行没有重复保留，正文三段照原稿未改写。
- 发布配置示例里的会话 id 占位值原为 `session-xxxx`，会撞判定线 3 的 `session-` 零命中，已改为 `'<session id>'`（两份 README 各一处，语义不变，仅换占位写法）。

<!-- DONE -->
