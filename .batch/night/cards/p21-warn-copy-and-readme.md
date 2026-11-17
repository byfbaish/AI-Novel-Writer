# P21 · WARN 文案改准 + README 口径 + 安装行（0.5.0 收口）

- 派卡：AI writer总负责人（2026-11-15）
- 执行：豆包（经豆包联络人）
- 估时：30 分钟
- 仓库：`C:\develop\workspace\dsh-handoff-relay`，起点 HEAD `74f4cc1`（version 0.5.0）

## 背景（一句话）

0.2.2-rc.1 里没有 `settings.plugin.item` 槽位，`settings.register()` 也不存在，所以设置卡在本宿主上不显示。现有 WARN 文案把它误写成「宿主无 settings 服务」，会把排查方向带偏。本期不交付界面，只把文案与文档改准，代码与扩展点一律保留。

## 必做改动（三处，别扩散）

1. **`index.js:702`** 那条 WARN 只改字符串：

   改前：
   ```
   `[${PLUGIN_NAME}] 设置卡未挂载：宿主无 settings 服务（跳过，不影响 watch）`
   ```
   改后：
   ```
   `[${PLUGIN_NAME}] 设置卡未挂载：本版本不提供设置卡入口（跳过，不影响 watch）；如需配置请直接改 cordis.patch.yml`
   ```

   只改这一行字符串。判定逻辑、跳过语义、watch 启动流程一律不动。

2. **测试断言同步**：`index.test.mjs:2018/2020`、`:2123`、`:2216/2220` 断言的是子串 `无 settings 服务`。改文案后这些断言会红。处理方式二选一，**不许删断言、不许改成永远为真**：
   - 把断言的子串改成新文案里稳定的一段（例如 `不提供设置卡入口`），保持「有 warn / 无 warn」的正反两向断言不变；或
   - 若新文案里保留一个稳定标记词，则统一用它。

   改完在报告里逐行贴出这四处的改后原文。

3. **两份 README**：
   - 「设置页 / 配置」相关整节按 `.batch/night/staging/readme-settings-section.md` 替换（中英口径一致，允许按实际排版微调，不得改变结论）。
   - 通读功能列表与安装说明，凡仍在描述「设置卡 / 在插件配置页里改」的句子，一并改成「配置见 `config.watches`」。
   - 安装行 `#v0.4.0` 改 `#v0.5.0`（README.md、README.zh-CN.md 各一处，若还有其它 `v0.4.0` 引用一并核）。

## 明令不动

- `client.js` 一行不动（含 `inject`、槽位注册、渲染函数）。
- `index.js` 除 `:702` 那一个字符串外零改动；`inject` 仍 `['agents']`；watch 判定与投递逻辑不动。
- `package.json` 版本保持 `0.5.0`，不新增依赖。
- 不删任何注释、不删任何测试用例。

## 验收判据（逐条可核）

- P1 `node index.test.mjs` 全绿，末行贴原文读数。
- P2 `git diff --stat` 只含 `index.js`、`index.test.mjs`、`README.md`、`README.zh-CN.md`。
- P3 `grep -n "不提供设置卡入口" index.js` 命中 1 处；`grep -n "宿主无 settings 服务" index.js` 命中 0 处。
- P4 两份 README 里 `grep -n "v0.5.0"` 各 ≥1 处，`grep -n "v0.4.0"` 命中 0 处。
- P5 `git status --porcelain` 只显示上述四个文件。

## 交付

- 报告 `.batch\night\reports\p21-warn-copy-and-readme.md`，含：改动前/后 WARN 原文、四处测试断言改后原文、P1–P5 命令与原始输出、提交 SHA（不自行补全，写 `git rev-parse --short=12 HEAD` 原文）。
- 末行 `<!-- DONE -->`。

<!-- DONE -->
