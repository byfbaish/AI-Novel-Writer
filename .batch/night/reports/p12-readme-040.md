# P12 · README 更新到 0.4.0

- 卡号：P12-readme-040（执行方：豆包；派卡人：AI writer 总负责人）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 基线：HEAD `27c40bb`，`git status --porcelain` 为空（已实测）；`node index.test.mjs` 基线 95/95
- 结果：三件全部改完，`TOTAL: 95/95 PASS`；按点名三文件提交，提交后 porcelain 为空
- 提交：`8c5c073d090154094c479650e7355958cedc7c6e`（`docs: bump to 0.4.0 and update the install guide`，3 files changed, 91 insertions(+), 8 deletions(-)）；未 push、未 publish、未重启

---

## 1. 改了什么

### 1.1 `package.json`

`version`: `0.3.2` → `0.4.0`（只改这一行）。

```
$ git diff --numstat -- README.md README.zh-CN.md package.json
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'README.zh-CN.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
46	2	README.md
39	2	README.zh-CN.md
1	1	package.json
```

（追加轮后的最终值：`50	4	README.md`、`40	3	README.zh-CN.md`、`1	1	package.json`）

### 1.2 两份 README 逐节对应补的三块

| 内容 | 英文（`README.md`） | 中文（`README.zh-CN.md`） |
|---|---|---|
| 设置卡 | 新增 `## Settings page` 一节（在 `## Config` 之前） | 新增 `## 设置页` 一节（在 `## 配置` 之前） |
| `exact` 字段 | 「Who gets notified」节补一段 + `### Config fields` 加 `watches[].exact` 条目 + `## Config` 字段表加一行 | 「通知发给谁」节补一段 + `### 配置字段` 加 `watches[].exact` 条目 + `## 配置` 字段表加一行 |
| 启动期有限重扫 | 新增 `## Startup rescan` 一节（紧跟 Settings page） | 新增 `## 启动期有限重扫` 一节（紧跟 设置页） |

标题结构实测一一对应（各 9 个二级标题）：

```
英文：What "finished" means / Who gets notified / Why "relay" / Install / Settings page / Startup rescan / Config / Test / License
中文：「已完成」如何判定 / 通知发给谁 / 为什么叫 relay / 安装 / 设置页 / 启动期有限重扫 / 配置 / 测试 / 许可证
```

三块正文要点（两份语义一致，非直译）：

- **设置卡**：卡片只作编辑通道；`cordis.patch.yml` 的 `watches` 仍是运行时唯一真相；逐条可编辑目录 / 目标会话 / 完成规则 / `exact`；保存只写 `cordis.patch.yml`；**重启 DSH 后生效**，本版本不做热更新。
- **`exact`**：不写 → 包含匹配（旧行为不变）；`exact: true` → 标题完全相等；非布尔（如字符串 `"true"`）→ 报错并跳过整条 watch，不退回包含匹配。
- **启动期有限重扫**：3 次、约 1s/5s/15s、21 秒窗口内；日志 `rescan#N dir=… result=resolved|not-found`；首次成功即补投并取消剩余；三次全败即停，无常驻轮询；加载时解析得到的 watch 不重扫；常规投递成功不写 `relay.log`。

### 1.3 安装段版本号

`0.3.2` → `0.4.0` 共 4 处（两份 README 各 2 处：npm 当前版本说明、`#v0.4.0` 固定版本示例）。

```
$ Select-String README.md,README.zh-CN.md -Pattern '0\.3\.2'
（无输出：0 处残留）
```

## 2. 硬约束自检

```
$ git status --porcelain
 M README.md
 M README.zh-CN.md
 M package.json
```

- 只改了这三个文件；`index.js` / `client.js` / `index.test.mjs` 未动。
- 未 `git add`、未 commit、未 push、未 `npm publish`、未重启 DSH。
- 未改任何 `cordis.patch.yml`、未往 watch 目录丢文件。

脱敏扫描：

```
$ Select-String README.md,README.zh-CN.md -Pattern 'C:\\|\.batch|\.dsh|session-[0-9a-f]|AI-writer|workbuddy|doubao'
（无输出：0 命中）
```

说明：README 原有的目录示例是 `D:\path\to\inbox`（通用占位，非本机路径），未新增任何 `C:\`、项目名/Bot 名/群名、真实 `session-` id、`.batch`、`.dsh`。新增小节里只出现 `<dir>`、`<session id>` 这类占位。

## 3. 测试

```
$ node index.test.mjs
…
TOTAL: 95/95 PASS
RESULT: PASS
```

## 4. 追加轮（示例不写死版本号）

按追加卡改造安装段示例：

1. 主推写法不带版本：`dsh plugin --profile desktop add github:byfbaish/dsh-handoff-relay`（两份 README 的「更新」节均如此，未出现 ref）。
2. 固定版本只在「锁定版本」那一句给一个示例，并在同句补「以仓库 Releases 最新 tag 为准」：
   - 英文：`To pin a specific release, append the tag shown below — the repository's Releases page stays authoritative: after a new release, use the latest tag listed there.`
   - 中文：`要固定某个版本就带下面的 tag，但以仓库 Releases 页为准：发版后取那里当前最新的 tag。`
3. 「当前版本」不再写死：英文改为 `(the Releases page lists the current version)`，中文改为 `（当前版本见仓库 Releases 页）`，避免发版后过期。

### 版本号出现位置（文件 + 行号，实测）

```
$ Select-String README.md,README.zh-CN.md -Pattern '0\.4\.0'
README.md:168: dsh plugin --profile desktop add github:byfbaish/dsh-handoff-relay#v0.4.0
README.md:236: From `0.4.0` the plugin also contributes a card to the host's plugin settings
README.zh-CN.md:145: dsh plugin --profile desktop add github:byfbaish/dsh-handoff-relay#v0.4.0
README.zh-CN.md:202: 从 `0.4.0` 起，插件还会在宿主的插件设置页里贡献一张卡片。卡片**只作编辑通道**：
```

- `#v0.4.0` 硬编码 ref 只剩**一处/每种语言**，且都在「锁定版本」示例里（行号 168 / 145）。
- 另两处（行号 236 / 202）是功能版本说明（「从 0.4.0 起有设置卡」），不是安装示例，未写成 `#v…` 形式；若发版版本号变化，这两句随之更新。
- 其它示例（市场安装、本地路径安装、直接 GitHub 安装、更新、卸载）均无版本号。

### 追加轮自检

```
$ node index.test.mjs
TOTAL: 95/95 PASS
RESULT: PASS

$ git status --porcelain
 M README.md
 M README.zh-CN.md
 M package.json

$ git diff --numstat
50	4	README.md
40	3	README.zh-CN.md
1	1	package.json
```

脱敏扫描仍 0 命中（`C:\`、`.batch`、`.dsh`、真实 `session-` id、项目/Bot/群名）。

## 5. 收尾

- 提交已由本轮派卡人交回执行方完成：点名 `git add README.md README.zh-CN.md package.json`（未用 `-A`）→
  `git commit -m "docs: bump to 0.4.0 and update the install guide"`。
- 提交 sha：`8c5c073d090154094c479650e7355958cedc7c6e`（短 sha `8c5c073`）。
- `git show --numstat`（三行）：

```
50	4	README.md
40	3	README.zh-CN.md
1	1	package.json
```

- 提交后 `git status --porcelain` 为空。
- 提交后测试：

```
$ node index.test.mjs
TOTAL: 95/95 PASS
RESULT: PASS
```

- 未 push、未 publish、未重启 DSH。
- 发版后的核对：`#v0.4.0` 只出现在「锁定版本」示例（`README.md:168`、`README.zh-CN.md:145`），
  另两处 `0.4.0` 是功能版本说明（`README.md:236`、`README.zh-CN.md:202`）；若实际发布版本不同，
  改这三处语义对应的位置即可。

> 更正（负责人，2026-11-14 00:00）：本报告末尾「建议提交信息」那两行已过期，**以实际提交 8c5c073d090154094c479650e7355958cedc7c6e docs: bump to 0.4.0 and update the install guide 为准**，不要按建议行去核。
<!-- DONE -->
