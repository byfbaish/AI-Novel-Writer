# README 安装段改写 · 交付报告

仓库 `dsh-handoff-relay`（HEAD `0db38cb`，tag `v0.3.0`）。只改了两份 README 的安装段，其余章节未动（diff 只有两个 hunk，见下）。

## 1. 改了哪几个小节（标题 + 行号范围，行号为改后）

### README.md

| 行号 | 内容 |
|---|---|
| 59 | `## Install`（标题行保留，正文整段重写） |
| 61-63 | 新开篇：一条命令装完，不用手改 profile 的 `package.json` / bundle 列表 |
| 65-70 | `### Install from the marketplace`：暂不可用（未发布到 npm），发布后按名搜索 |
| 72-112 | `### Install with the CLI`：本地检出 / GitHub 两种装法 + 配置放哪里 + 重启 |
| 114-128 | `### Update`：重跑安装命令、本地 `git pull`、带 ref 固定版本 |
| 130-148 | `### Uninstall and check status`：`remove` + `list --depth 0` + `--dump-config` |
| 150 起 | `### Config fields` 及其后所有章节 —— **未动** |

diff hunk：`@@ -61,55 +61,88 @@`（唯一一处）。

### README.zh-CN.md

| 行号 | 内容 |
|---|---|
| 47 | `## 安装`（标题行保留，正文整段重写） |
| 49-51 | 新开篇 |
| 52-55 | `### 从插件市场安装` |
| 57-95 | `### 用命令行安装` |
| 97-110 | `### 更新` |
| 112-128 | `### 卸载与查看状态` |
| 130 起 | `### 配置字段` 及其后所有章节 —— **未动** |

diff hunk：`@@ -49,49 +49,80 @@`（唯一一处）。

被删掉的旧内容是「改 profile 的 `package.json` 加 `file:` 依赖 + 在 `dsh.profile.bundles` 里加一行 + 手动 `pnpm install` + 手写 patch 行」这五步；新内容把前四步合并成一条 `dsh plugin add`。

## 2. 每条命令的查证依据（原始输出片段）

### 依据 A：`dsh plugin` 必须带 `--profile`，且它的参数是转发给 profile 目录里的 pnpm

命令：`dsh plugin --help`

```
error: required option '--profile <name>' not specified
```

命令：`dsh --help`（节选）

```
Commands:
  web [options] [args...]     boot the web profile (alias of --profile web); the
                              web app's own flags follow
  plugin [options] [args...]  manage a profile's plugins by forwarding the
                              remaining arguments to pnpm in the profile
                              directory
...
  dsh plugin --profile tui add <package>     install a plugin into the tui profile
```

⇒ README 里写 `dsh plugin --profile <name> add …` 有依据；profile 名要显式给（`desktop` / `web` / 你实际启动的那个）。

### 依据 B：`add` / `remove` / `list` / `update` 是 pnpm 的命令面

命令：`dsh plugin --profile desktop --help`

```
Version 11.11.0
Usage: pnpm [command] [flags]
...
      add                  Installs a package and any packages that it depends
                           on. By default, any new package is installed as a
                           prod dependency
...
      rm, remove           Removes packages from node_modules and from the
                           project's package.json
...
      ls, list             Print all the versions of packages that are
                           installed, as well as their dependencies, in a
                           tree-structure
      up, update           Updates packages to their latest version based on the
                           specified range
```

⇒ `add`（装）、`remove`（卸）、`list`（看）三个子命令的语义直接来自 pnpm，不是杜撰。

### 依据 C：`list --depth 0` 真实可用（本机实测输出）

命令：`dsh plugin --profile desktop list --depth 0`

```
Legend: production dependency, optional only, dev only

dsh-profile-desktop …(PRIVATE)
│
│   dependencies:
├── @deepseek-ai/dsh-computer-use@0.2.2-rc.1
├── @goodandready/dsh-agent-loop-guard@0.2.26
├── dsh-ops@0.5.2
...
```

⇒ 「查看状态」那条命令是跑过的，输出形态与 README 描述一致（列依赖树）。

### 依据 D：`github:` 形式的安装在同 profile 里已有先例

profile 的 `package.json` 里已存在这样一条依赖（原文节选，第三方仓库 ref）：

```
"github: owner/repo#<commit-sha>" 形式的依赖已存在（本报告不复述具体仓库名）
```

⇒ `dsh plugin … add github:<owner>/<repo>` 与 `#<ref>` 固定版本这两条写法，是这套环境里已经在用的形式。

### 依据 E：本地绝对路径依赖同 profile 里已有先例

同一 profile 的依赖里存在 `file:<绝对路径>` 形式（本报告不引原文，因为该路径属内部目录）。⇒ `add <绝对路径>` 这条写法与既有事实一致；README 里因此强调「路径给绝对路径，因为命令实际在 profile 目录里执行」。

### 依据 F：包未发布到 npm（所以市场按名安装暂不可用）

命令：`npm view dsh-handoff-relay version`

```
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/dsh-handoff-relay - Not found
npm error 404  'dsh-handoff-relay@*' is not in this registry.
```

⇒ README 的市场小节写「暂不可用 + 发布后可搜索」，不是把不可用的路写成可用。

### 依据 G：`--dump-config` 的语义

命令：`dsh --help`（节选）

```
  --dump-config               print the composed profile tree and exit
  --dump-default-config       print the profile tree without its user layer or
                              --patch overlays and exit
```

⇒ README 里「打印合成后的 profile 树并直接退出，不会启动应用」有依据。

### 未实测的部分（边界，明写）

- **没有真的执行 `add`**：执行会改本机 profile 的依赖与 patch 状态，属对用户环境的写入，本轮不做。`add` 的可用性由依据 A/B/D/E 合成（命令面 + 同环境既有的两种依赖形式），不是「跑过一次」的证据。
- **没有真的执行 `remove` / `update`**：同上，且 `remove` 会动既有安装。
- **没有执行 `dsh --dump-config`**：只引了 `--help` 的选项说明，未实跑（它会合成整个 profile 树，代价高）。
- `update` 一节里「`git pull` 后重启；若没生效再执行一次 `add`」是保守写法，未区分 pnpm 对 `file:` 依赖是软链还是拷贝 —— 标**不确定**，因此给了「没生效就再 add」的退路。

## 3. 双语一致性核对（逐节对应）

| README.md | README.zh-CN.md | 对应关系 |
|---|---|---|
| `## Install`（59） | `## 安装`（47） | ✔ |
| `### Install from the marketplace`（65） | `### 从插件市场安装`（52） | ✔ |
| `### Install with the CLI`（72） | `### 用命令行安装`（57） | ✔ |
| `### Update`（114） | `### 更新`（97） | ✔ |
| `### Uninstall and check status`（130） | `### 卸载与查看状态`（112） | ✔ |
| `### Config fields`（150，未改） | `### 配置字段`（130，未改） | ✔ 原有对应保持 |
| `## Config`（179） | `## 配置`（153） | ✔ 未改 |
| `## Test`（190） | `## 测试`（164） | ✔ 未改 |
| `## License`（199） | `## 许可证`（173） | ✔ 未改 |

**代码块逐块比对**：两份文件各有 8 个 fenced block，按出现顺序逐块做**字节级相等**比较 —— 8/8 全部相同（含命令、注释、YAML 两段）。

配置示例按交付要求原样保留（5 行逐字命中：`stableMs: 5000` / `watches:` / `dir` / `targetSessionId` / `done`），并且「`targetSessionId` 必须指向当前存在的会话，宿主重启后会变」这句在两版安装段与原「配置字段」段各保留一份。

## 4. 脱敏自检

- 扫描范围：`git diff -U0 -- README.md README.zh-CN.md` 的全部新增行（168 行插入）。
- 扫描模式：`C:\develop`、`AI-writer`、`.batch`、`workbuddy`、`doubao`、`豆包`、`\bBot\b`、`\bNight\b`、`卡号`、`派卡`、内部编号前缀。
- 结果：**0 真命中**（一次假阳性已排除：英文单词 `Both` 含 `bot` 子串，不构成 Bot 名）。
- 反向检查：新增内容里没有「为多 agent 流程而做」这类背景叙述；没有出现内部任务编号、内部会话名、内部目录名。

## 5. 未覆盖 / 不确定

1. 未执行任何安装/卸载/更新命令（见 §2 边界）。
2. `dsh --dump-config` 未实跑，只据 `--help` 描述。
3. 市场小节的「发布后可搜索安装」按插件市场按包名取 npm 包的常规语义写；本轮没读到市场的具体检索实现（本次读取的宿主包内未找到该实现），标**不确定**。
4. `update` 对 `file:` 依赖是否需要重装，未验证（已给退路写法）。
5. 没有改 `index.js`、`index.test.mjs`、`cordis.patch.yml`、`package.json`（`git status` 仅两份 README）。

## 6. 提交

`git add README.md README.zh-CN.md`（点名添加）→ 本地 commit `7f217e2`，未 push。提交后 `git status --porcelain` 为空，工作区干净；`git log -1 --stat` 记为 `2 files changed, 168 insertions(+), 104 deletions(-)`。

<!-- DONE -->
