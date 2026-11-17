# P21-fix · 回滚两份 README，只保留 WARN 文案与断言

- 卡号：P21-fix-rollback-readme · 执行方：豆包 · 派卡人：豆包联络人（按 AI writer总负责人「立即停投」指令）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`；起点 HEAD `16e80a2`，开工 porcelain 空
- 结果：两份 README 已整文件回到 `74f4cc1`，提交 `3bce268c26b7`（`revert: restore both READMEs pending the built-in settings UI decision`），未 push、未打 tag

## 1. 做了什么

```
git -C C:\develop\workspace\dsh-handoff-relay checkout 74f4cc1 -- README.md README.zh-CN.md
```

- `README.md`、`README.zh-CN.md` 两个文件**整文件**回到 `74f4cc1`（即 0.5.0 时的原样，含「From `0.4.0` / 从 0.4.0 起贡献一张卡片」的旧设置页段与 `#v0.4.0` 安装行）。
- 未做任何其它编辑：没有局部修补、没有改文案、没有留新段落。
- `index.js` 的 WARN 新文案与 `index.test.mjs` 四处断言同步**原样保留**（它们已在 `16e80a2` 提交，本次提交不触碰）。

保留的 WARN（`index.js:702`）：

```
设置卡未挂载：本版本不提供设置卡入口（跳过，不影响 watch）；如需配置请直接改 cordis.patch.yml
```

> 注：这段文案本身也带着「本版本不提供设置卡入口」的路线判断。卡面明确要求保留，故按字面执行，未擅自改动；若主人裁定内置界面属核心功能，这条 WARN 的措辞需另开一卡复核（见 §4 风险）。

## 2. 提交

```
[master 3bce268] revert: restore both READMEs pending the built-in settings UI decision
 2 files changed, 18 insertions(+), 55 deletions(-)
```

`git add README.md README.zh-CN.md`（点名，未用 `-A` / `.`）。

## 3. 判据原始输出

### P1 `git show --numstat --format=%h HEAD`

```
3bce268

10	29	README.md
8	26	README.zh-CN.md
```

### P2 `git diff 74f4cc1 HEAD -- README.md README.zh-CN.md`

无输出（空）。

### P3 `git diff --stat 74f4cc1 HEAD -- index.js index.test.mjs`

```
 index.js       |  2 +-
 index.test.mjs | 10 +++++-----
 2 files changed, 6 insertions(+), 6 deletions(-)
```

（`index.js` 仍是 1 行 WARN 字符串的 ±1；`index.test.mjs` 仍是四处断言的 5/5 等量替换。）

### P4 `git status --porcelain`

无输出（空）。

### P5 `git rev-parse --short=12 HEAD`

```
3bce268c26b7
```

## 4. 信号文件的去向（实测）

`…\.batch\night\signals\doubao\p21-rollback-readme.done` 写入后**在 200ms 内被 relay watcher 移走**（`signals\doubao` 随即只剩 `.gitkeep`），投递副本落在：

```
C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\delivered\dad6df13f302\p21-rollback-readme.done
```

内容（128B）：

```
产物：C:\develop\workspace\AI-writer\develop\.batch\night\reports\p21-rollback-readme.md
提交：3bce268c26b7
<!-- DONE -->
```

即：信号是按插件的正常投递机制消费的，不是漏写或写失败；源目录里查不到属预期。

## 5. 未处理 / 风险（按口径标清）

- **README 现在与「内置界面必须交付」的路线冲突**：两份 README 回到 `74f4cc1` 后，设置页段又写着「从 0.4.0 起贡献一张卡片」，安装行也是 `#v0.4.0`。本卡要求整文件回滚，故未改；发行前需按新路线重写，标**不确定**。
- **WARN 文案仍有路线判断**：`本版本不提供设置卡入口` 与「内置界面必须交付」冲突，但卡面明令保留，未动。
- 本轮未改 `client.js`、`package.json`、版本号（仍 `0.5.0`）；未碰 `.batch/` 下除本报告与信号以外的文件；未重启 DSH、未往 watch 目录写文件。

<!-- DONE -->
