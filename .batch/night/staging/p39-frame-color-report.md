起点 HEAD：d535dc148c761b0cc8518ee3d84061b96bdfaefe · 提交 SHA：8e4ad642095e9f239038e86468d9dced459361fa

# P39 · 路径框沿标色报告

## 1. 改动面

- 只改 `client.js`。
- 原 `DirStatusDot` 改为 `DirPathField`：探测状态留在组件内，输入框与「选择目录…」按钮同一行，状态文案落在输入框下方。
- 原 `if (kind === "none") return null;` 已删除；`none` 现在显式中性灰沿 + 文案，不再静默。
- `none` 未渲染成绿沿；`ok` 才是 `#2e7d32`。

## 2. 四个 `kind` 分支

| kind | 输入框渲染 | 行内文案 / title | 行号 |
|---|---|---|---|
| `ok` | 绿沿 `#2e7d32` | title「目录可读」 | 沿：`client.js:244`；title：`client.js:251`；样式挂载：`client.js:278` |
| `bad` | 红沿 `#d33` | title「目录不可读或不存在」；行内「目录不可读或不存在」 | 沿：`client.js:245`；title：`client.js:252`；行内：`client.js:290` |
| `checking` | 中性灰沿 `#9e9e9e` | title「检查中…」 | 沿：`client.js:246`；title：`client.js:254`；样式挂载：`client.js:278` |
| `none` | 中性灰沿 `#9e9e9e` | title「宿主未提供目录核验」；行内「宿主未提供目录核验」 | 沿：`client.js:246`；title：`client.js:253`；行内：`client.js:291` |

空 `dir`：`hasDir` 为假时 `kind` 直接为 `idle`，不探测、不显示灰沿或文案（`client.js:259-260`、`client.js:273`）。

`title` 通过 `client.js:281` 挂到路径 `<input>`，原有两档 title 未丢失。

## 3. `none` 成因判定

`probeDirectory` 的 `none` 返回点：

- `client.js:208`：`dir` 为空或 `sessionId` 为空（空 `dir` 在 `DirPathField` 层已不触发探测）。
- `client.js:213`：`ctx.get("remoteAccess")` 抛错。
- `client.js:215`：取不到 `remoteAccess`。
- `client.js:217`：拿不到可用的 `workspaceFiles`。
- `client.js:230`：3 秒超时。
- `client.js:234`：`list(sessionId, dir)` 抛错。

真实宿主是否提供 `remoteAccess`：**本次读取的文件内未找到宿主侧运行态证据，取不到，不猜**。插件侧只把上述六种“取不到/不可用/超时/抛错”统一降级为 `none`，并在框沿与文案上显式标出，不当作通过。

## 4. 测试

实际运行命令（按 P39 补正，不用 `node --test`）：

```text
node --check client.js
node index.test.mjs
```

结果：

```text
CHECK_EXIT=0
TOTAL: 150/150 PASS
RESULT: PASS
TEST_EXIT=0
```

未删既有用例；P29 d（`remoteAccess` 抛错不崩、不显示点）仍 PASS，P29 e（`ok` / `bad` 状态与红文案）仍 PASS。

## 5. 提交

提交信息：`feat: color directory input border by probe state`

`git show --numstat HEAD` 原文中的文件行：

```text
54	25	client.js
```

只点名 `git add client.js`，未使用 `-A`；未 push、未打 tag、未 publish。

## 6. 提交后 porcelain 与异常说明

提交后 `git status --porcelain` 实际输出：

```text
 M .gitignore
 M README.md
 M README.zh-CN.md
```

这三个文件在开工前已存在且本卡未改动；`git diff --ignore-space-at-eol --stat` 为空，`git diff --numstat` 为 `1/1`、`289/289`、`251/251`，属 CRLF 行尾差异。按卡面禁改 README / `.gitignore`，未执行 `reset` / `checkout` / `stash` / `--force` 清理，因此提交后 porcelain 不是空。该异常需投方处理；本卡没有第二个提交。

## 7. 交付

- 代码：`client.js`
- 本报告：`.batch/night/staging/p39-frame-color-report.md`

<!-- DONE -->
