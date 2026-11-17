# 真机验收 · 0.5.0（P17 修完）

> 前提：代码已在仓库（`74f4cc1`，version 0.5.0），profile 的 `node_modules\dsh-handoff-relay` 是指向仓库的 Junction，**不需要**再 install。
> 需要主人做的只有四步，每步回一句，我据此往下走。

## ① 开开关（DSH 开着，热重载）——**这一步本身就是一次实跑，必须单独记结果**
QA 提的取证口径：热重载路径与重启路径是两个不同的加载路径，崩因不能混记。

1. **先存好手上的活**（热重载会当场加载插件）。
2. 文件：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`
   第 295 行 `disabled: true` → `disabled: false`（第 293-294 行的 `- id:` / `name:` 不动）。
3. 存盘后**看这一下会不会崩/白屏**，回一句：
   - **「①后还在」** → 热重载路径正常，`relay.log` 应多一行 `启动 7/7 个 watch`，继续 ②
   - **「①已崩」** → 热重载路径崩（与重启路径分开记账），先按 §回滚 处理，本轮不继续，崩因另查

## 1. 退出 DSH（完整退出，不是最小化）→ 回一句「关了」

## 2. 重新启动 DSH
- **正常起来** → 回「起来了」
- **崩/白屏** → 先把 `C:\Users\<用户名>\AppData\Roaming\@deepseek-ai\dsh-desktop\logs\` 下最新一个 `crash-*-web-boot.log` 的**文件名**发我（不用发全文），再走 §回滚。

## 3. 起来后看卡
`设置 → 插件 → 插件配置`：第一块应是 **Handoff Relay**，目录 / 目标会话 / 完成规则 / exact 的界面在。
- 有卡 → 回「有卡」（最好截一张，参照 `.batch\night\evidence\p15-card-visible\settings-plugin-card-0158.png`）
- 没卡 → 回「无卡」，我让 developer 走三步取证（`settings.describe` → 控制台有无 `slot entry crashed` → 才查时序）

## 回滚（只在崩溃时，DSH 必须处于关闭状态）
1. `cordis.patch.yml:295` 改回 `disabled: true`
2. 存盘，再启动 DSH
3. 回一句「已回滚」，本轮真机判定记 FAIL，不再重试

## 判据（我终审用）
| 项 | 通过条件 |
|---|---|
| 热重载路径（①） | 改开关存盘后不崩、`relay.log` 多一行 `启动 7/7 个 watch` |
| 重启路径（②③） | 进程起来、无新 `crash-*-web-boot.log` |
| 不 pending | 日志里不出现 `pending (waiting for service: …)` |
| 卡片可见 | 插件配置页第一块是 Handoff Relay |
| 宿主侧照常 | `relay.log` 有 `启动 7/7 个 watch`，7 条目录各一条 watch |
| 无新增 WARN | 除了已知的 target 失效 warn，不出现其它 ERROR |
