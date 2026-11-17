# P20 · 设置页改走 `.volatile()` 自动表单（只做 B，0.5.1）

- 卡号：P20
- 状态：待投（负责人核完即投豆包）
- 作者：产品经理（只出规格）
- 定调：主人已定「方向有误就换方向，这插件花太多时间，必须早点结束」⇒ **放弃 A（自定义三列渲染），探针卡 P19-A 作废**；三列 + 正则标红降为后续版本，本期不做。
- 上游事实：`.batch/night/reports/p18-card-missing-1114.md`——`settings.plugin.item` 在 0.2.2-rc.1 里 0 命中，真实槽位 `plugins.row.config`；host 侧 `settings.register()` 本版本不存在，表单由 `describe()` 从 `Config` 的 `.volatile()` 字段自动生成；`Agent Loop Guard` 就是这个形态（host 只声明 `Config`，零 client 代码）。

## 一、背景

设置页「无卡」不是渲染坏了，是我们挂的槽在 0.2.2-rc.1 被删了、调的 API 也不存在。现在要的只是「能装、能投、能在界面里改 watch」这三件事都成立。三列表格属于锦上添花，已决定不做，好让这个插件早点收尾。

## 二、目标

安装者在「设置 → 插件 → 已安装 → 点开 dsh-handoff-relay」里能看到一张**可编辑的通用表单**，改完保存能落盘、重启后仍在；改不了的情况（宿主不支持）只留一行准确日志，watch 扫描与投递照常。

## 三、改动清单（只这四件，多一件都算越界）

1. **给 `config.watches` 加 `.volatile()` 标注**，使宿主 `describe()` 自动为它生成表单。
   - **写法以 0.2.2-rc.1 实际 Config API 为准**（参照同机 `@goodandready/dsh-agent-loop-guard` 的 `lib/index.js:35` 附近写法），不许照抄网上或旧版本的写法。
   - 若本版本没有 `.volatile()`（或语义不同），**立即停手**，在报告里写「本版本无此能力 + 实际可用的等价入口（如有）」，不要自己发明替代方案。
2. **修正误判 WARN 文案**：现在那句「设置卡未挂载：宿主无 settings 服务」是误判（P18 根因链第 3 条：服务在，是读取时机问题）。改成中性且指路的一句，例如：`配置卡未挂载（本版本设置页不支持本插件的自动表单）；如需修改监控目录，请直接编辑 cordis.patch.yml 的 config.watches`。判据是「不误导」：不得出现「宿主无 settings 服务」这种把排查带偏的表述。
3. **两份 README（`README.md` / `README.zh-CN.md`）各加一节**：说明配置页是通用表单、不是三列表格；并给一个直接编辑 `cordis.patch.yml` 的 `config.watches` 例子（脱敏，占位符，不含本机路径）。
4. **版本号改 0.5.1** 一次（只改 `package.json` 的 version 一行）。

## 四、不动（红线）

- 不动 `index.js` 的 watch 判定与投递逻辑（`stableMs`、`done` 四态、正则限制、去重、投递文案）。
- 不动 `client.js`（P17 已验证不崩；删死代码另议，不在本卡）。
- 不动 7 条 watch 的现有数据与 `cordis.patch.yml` 的 `config.watches`。
- 不 push、不打 tag、不 publish、不改 0.4.x / 0.5.0 已发布行为。
- `git add` 点名文件，禁 `-A`。

## 五、验收判据

| # | 项 | 判据 | 形式 |
|---|---|---|---|
| P1 | 测试 | `node index.test.mjs` 全绿，贴 `TOTAL:` 行原文，读数 ≥ 当前基线 | 报告贴原文 |
| P2 | diff 干净 | `git diff --stat` 只含 `index.js`（`Config` 标注 + WARN 文案）、`package.json`（version）、两份 README；无其它文件 | 报告贴 `--stat` 原文 |
| P3 | 表单出现 | 隔离环境重启后，插件详情页出现可编辑配置区（真机） | 真机截图 |
| P4 | 改一项落盘 | 界面改某条 watch 的某个字段并保存 → 配置文件里该值变化（贴保存前后原文） | 真机 + 文件原文 |
| P5 | 重启后仍在 | 再重启一次，该值仍为新值（贴重启后原文） | 真机 |
| P6 | 降级不误导 | 在无该能力的宿主上，日志只有一句中性提示，且 watch 照常启动（`启动 N/N 个 watch` 在） | 日志原文 |

P3–P5 为真机项，由负责人另派真机执行；码侧只交 P1、P2、P6。**三项真机全过才算 PASS**，只过码侧不算。

## 六、明确不做（本期）

- 三列表格布局、正则编译失败按行标红、行内三句限制常驻提示。
- 会话搜索选择器、按标题锁定、会话改名跟随。
- 多播（一条 watch 投多个会话）、订阅者注册表。
- 历史记录、运行日志查看、重试按钮。
- 除 React/打包链之外的任何新依赖（本卡根本不碰 client，零新增依赖）。

## 七、交付

- 报告：`.batch/night/reports/p20-settings-form-volatile.md`，末行 `<!-- DONE -->`，含 P1/P2/P6 读数与 P3–P5 的空位（真机另行回填）。
- 信号：`.batch/night/signals/doubao/p20-settings-form-volatile.done`。
- 估时：40–60 分钟。第 1 条若判「本版本无此能力」则 15 分钟内停下报告，不算失败。

<!-- DONE -->
