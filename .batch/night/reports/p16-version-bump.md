# P16 · 版本号升到 0.4.1（只提交，不打 tag、不 publish）

- 卡号：P16-version-bump · 执行方：豆包 · 派卡人：AI writer总负责人
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 基线：`master` HEAD `848c26d`；改动前 `git status --porcelain` 为空
- 结果：已改并提交 `43c3762`（`chore: release 0.4.1`），未 push、未打 tag、未 publish

## 1. `grep -n "0\.4\.0"` 命中原文（5 处）

```
package.json:3:  "version": "0.4.0",
README.md:168:dsh plugin --profile desktop add github:byfbaish/dsh-handoff-relay#v0.4.0
README.md:236:From `0.4.0` the plugin also contributes a card to the host's plugin settings
README.zh-CN.md:145:dsh plugin --profile desktop add github:byfbaish/dsh-handoff-relay#v0.4.0
README.zh-CN.md:202:从 `0.4.0` 起，插件还会在宿主的插件设置页里贡献一张卡片。卡片**只作编辑通道**：
```

（`grep "0\.4"` 同样只命中这 5 处；`*.js` 里 `version|版本` 零命中，`index.js`/`client.js` 没有硬写版本常量。）

逐条判断：

| 命中 | 判定 | 原因 |
|---|---|---|
| `package.json:3` | **已改** → `"version": "0.4.1"` | 包自身的版本字段，本卡唯一必须改的位置 |
| `README.md:168` | 未改 | 安装命令里的 `#v0.4.0` 是**指向具体 tag 的引用**；本卡明确不打 tag，改成 `#v0.4.1` 会让文档指向一个尚不存在的 ref |
| `README.md:236` | 未改 | 「From `0.4.0` …」是**功能引入时点**的陈述（设置卡从 0.4.0 起提供），不是当前版本号；改它会让历史陈述失真 |
| `README.zh-CN.md:145` | 未改 | 同 `README.md:168`，安装命令的 tag 引用 |
| `README.zh-CN.md:202` | 未改 | 同 `README.md:236`，「从 0.4.0 起」是功能引入时点 |

锁文件：仓库根下无 `package-lock.json`、无 `pnpm-lock.yaml`、无 `yarn.lock`（`Get-ChildItem *lock*` 零命中），故无锁文件可同步。

## 2. 改动前后

改前：

```
3:  "version": "0.4.0",
```

改后：

```
3:  "version": "0.4.1",
```

## 3. `git diff`（提交前）

```
diff --git a/package.json b/package.json
index 688312d..5471364 100644
--- a/package.json
+++ b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "dsh-handoff-relay",
-  "version": "0.4.0",
+  "version": "0.4.1",
   "description": "Watch a directory and notify a target session once a file is stable or marked done.",
   "type": "module",
   "main": "index.js",
```

## 4. 提交

`git add package.json`（点名，未用 `-A`）→ `chore: release 0.4.1`

```
$ git log -1 --stat
43c3762 chore: release 0.4.1

 package.json | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

- 提交后 `git status --porcelain`：**空**（无输出）。
- `package.json` `version` 实测 `"0.4.1"`。
- `git tag --points-at HEAD`：空（HEAD 上无 tag）。
- 未 `npm publish`、未 push（`## master...origin/master [ahead 6]` 只是本地领先，未推）。
- 未改依赖节、未碰 `client.js` / `index.js` / 测试 / README / `cordis.patch.yml`；未重启 DSH、未往 watch 目录写文件。

## 5. 测试

版本号改动不影响逻辑，提交后全量单测：

```
TOTAL: 113/113 PASS
RESULT: PASS
```

（exit 0；无 FAIL 行。）

## 6. 收尾

- 报告落盘 `C:\develop\workspace\AI-writer\develop\.batch\night\reports\p16-version-bump.md`。
- 未写信号文件（卡面交付项只点名报告）。

<!-- DONE -->
