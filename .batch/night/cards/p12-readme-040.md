# 卡 P12 · README 更新到 0.4.0（只改两份 README + package.json 版本号）

> 卡号：P12-readme-040。执行方：豆包。派卡人：AI writer总负责人。
> 基线：仓库 `C:\develop\workspace\dsh-handoff-relay`，HEAD `27c40bb`，porcelain 空，`node index.test.mjs` = `TOTAL: 95/95 PASS`。

## 1. 要改什么（三件，别扩面）

1. `package.json` 的 `version`：`0.3.2` → `0.4.0`（只这一行）。
2. 两份 README（`README.md` 英文、`README.zh-CN.md` 中文）逐节对应地补三块内容：
   - **设置卡**：在 DSH 插件设置页可编辑每条 watch（目录 / 目标会话 / 完成规则 / exact）。写明「保存只写 `cordis.patch.yml`，**重启 DSH 后生效**，一期不做热更新」。
   - **`exact` 字段**：字段表里加一行——不写 → 标题包含匹配（与旧行为一致）；`exact: true` → 标题完全相等；写成非布尔（如字符串 `"true"`）→ **报错并跳过整条 watch**，不退回包含匹配。
   - **启动期有限重扫**：启动时解析不到目标的 watch 会再试 3 次（约 1s / 5s / 15s，最多 21 秒），期间日志写 `rescan#N dir=… result=resolved|not-found`；三次全失败就停，不会常驻轮询。
3. 安装段里凡出现 `#v0.3.2` 的示例版本号，改成 `#v0.4.0`（若发版后再改会过期，先按 0.4.0 写）。

## 2. 硬约束

- 只改 `package.json`、`README.md`、`README.zh-CN.md` 三个文件；`git add` **点名**这三个，不许 `-A`。
- 不许 `git push`、不许 `npm publish`、不许重启 DSH、不许动 `index.js` / `client.js` / `index.test.mjs`。
- 双语必须逐节对应，不许只改一种语言。
- 脱敏：不得出现本机路径（`C:\`）、项目名、Bot 名、群名、`session-` 开头的 id、`.batch`、`.dsh`。
- 自检并写进报告：`node index.test.mjs` 仍 `TOTAL: 95/95 PASS`；`git status --porcelain` 只三个文件。

## 3. 产物

- 报告：`.batch\night\reports\p12-readme-040.md`，末行 `<!-- DONE -->`（追加内容要加在 DONE 之前）。
- 信号：`.batch\night\signals\doubao\p12-readme-040.done`，三行：完成 / 改了哪几节 / 提交 SHA。

## 4. 估时

25–35 分钟。做完提交（改名不改仓库），提交信息用英文。
