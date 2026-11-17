起点 HEAD：8df4e764fd60861dbcbf48e1a7846821bc68aa47
提交 SHA：87782339a5cb8d3c6786548f93d355b14a2dea35
提交信息：`docs: align README with 0.5.0 and settings card entry`

# P45 · README 对齐 0.5.0

## 1. 提交

`git show --numstat HEAD` 原文：

```text
commit 87782339a5cb8d3c6786548f93d355b14a2dea35
Author: dsh-plugin <dsh-plugin@example.com>
Date:   Sat Nov 14 21:39:40 2026 +0800

    docs: align README with 0.5.0 and settings card entry

16	4	README.md
12	2	README.zh-CN.md
```

`git show --stat HEAD`：两份 README，`28 insertions(+), 6 deletions(-)`；未改 `index.js`、`client.js`、`index.test.mjs`、`package.json`、`cordis.patch.yml`。

## 2. 逐处改动

### `README.md`

- `README.md:168`（安装 tag）
  `dsh plugin --profile desktop add github:byfbaish/dsh-handoff-relay#v0.5.0`
- `README.md:171`（版本警告）
  `0.4.0 is not usable (its settings card never appears). Install 0.5.0 or later.`
- `README.md:238`（设置卡改为 0.5.0 可用）
  `From `0.5.0` the plugin contributes a usable card to the host's plugin settings page;`
- `README.md:242`（设置卡入口）
  `The entry is buried: **Plugins → Installed → dsh-handoff-relay → open its`
- `README.md:253`（新增英文节标题）
  `## Directory field border colors`
- `README.md:255`（三态说明）
  `Green = the directory exists and is readable; red = the directory does not exist, is unreadable, or the path points to a file; gray = the host does not provide directory verification (this state does not block saving).`
- `README.md:257`（保存提示与主进程探测）
  `When saving, an unreadable directory shows the inline red hint “Directory is currently unreadable; confirm after saving”, **but saving is not blocked**. Path existence is checked in the main process by `GET /handoff-relay/probe`, which only calls `stat`/`access` and never lists directory contents.`

### `README.zh-CN.md`

- `README.zh-CN.md:145`（安装 tag）
  `dsh plugin --profile desktop add github:byfbaish/dsh-handoff-relay#v0.5.0`
- `README.zh-CN.md:148`（版本警告）
  `0.4.0 不可用（设置卡缺入口），请安装 0.5.0 或更高版本。`
- `README.zh-CN.md:204`（设置卡改为 0.5.0 可用）
  `从 `0.5.0` 起可用：插件会在宿主的插件设置页里贡献一张卡片，可直接增删行、绑定目录与会话。`
- `README.zh-CN.md:207`（设置卡入口）
  `卡片入口较深：**插件 → 已安装 → dsh-handoff-relay → 打开其 README 页 → 页面最下方「包含的组件」→ 点击 `Handoff Relay`** 即进入设置页。`
- `README.zh-CN.md:215`（新增中文节标题）
  `## 目录框沿颜色`
- `README.zh-CN.md:217`（三态说明）
  `绿 = 目录存在且可读；红 = 目录不存在 / 不可读 / 指到了文件；灰 = 宿主未提供目录核验（此态不阻止保存）。`
- `README.zh-CN.md:219`（保存提示与主进程探测）
  `保存时若目录不可读，行内会出现红字提示「目录当前不可读，保存后需确认」，**但不阻止保存**。路径存在性由 `GET /handoff-relay/probe` 在主进程判定，仅读 `stat`/`access`，不列举目录内容。`

## 3. 状态

提交前 `git status --porcelain`：

```text
 M .gitignore
 M README.md
 M README.zh-CN.md
```

提交后 `git status --porcelain`：

```text
 M .gitignore
```

`.gitignore` 是开工前已有的 CRLF 行尾差异，不在本卡允许改动范围内，未清理；两份 README 已提交，内容改动为 `16/4` 与 `12/2`，`git diff --ignore-cr-at-eol` 与内容 diff 一致。提交时把两份 README 从工作区 CRLF 归一为仓库 HEAD 的 LF，避免 289/251 行的纯行尾噪声进入提交；文件仍为 UTF-8 无 BOM。

## 4. 检查

- 两份 README 均含 `0.5.0` tag 与完整警告原文。
- 中文/英文设置卡入口均已写入，原「只作编辑通道」已删除，改为可直接增删行、绑定目录与会话。
- 中文/英文均新增「目录框沿颜色」节，三态、保存红字不阻断、主进程 `GET /handoff-relay/probe` 只 `stat`/`access` 不列举目录内容均已写明。
- 未 push、未打 tag、未 publish、未 reset/checkout/stash。

<!-- DONE -->
