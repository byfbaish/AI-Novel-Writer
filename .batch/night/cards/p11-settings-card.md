# P11 · 设置卡 + `exact` 开关 + 启动期有限重扫

> 卡号 P11。执行方：豆包。派卡人：AI writer总负责人。派卡时刻：2026-11-13 23:35。
> 技术依据：`.batch/night/reports/plugin-settings-api-facts.md`（13,405B，developer 取证，含全部 API 路径与行号）。**先读它再动手**，本卡不重复其中的 API 细节。

## 0. 先做基线核验（回执里贴原始输出）

```
cd C:\develop\workspace\dsh-handoff-relay
git rev-parse HEAD          # 应为 4fb80dab206a8be9f0ab9ef0da9cfd8683cc8c96
git status --porcelain      # 必须为空
node index.test.mjs         # 基线 TOTAL 必须 >= 84/84 PASS
```

## 1. 目标（三块，合成一张卡，一次交付）

### A. 设置卡（形态已裁定为「甲」）

- 卡片只做**编辑通道**；`cordis.patch.yml` 的 `config.watches` 仍是**唯一运行时真相**，relay 运行期不新增第二份输入。
- 按 developer 报告的三步实现：① Host 侧 `ctx.settings.register` 注册 namespace，启动时用 yml 的 `watches` 播种，冲突以 yml 为准；② 卡片用官方客户端 API `ctx.settingsScope.bind({ namespace })` 读写；③ 保存后 Host observe 到变更，写回 `cordis.patch.yml`（保留文件里其它内容）。
- 手写 client entry，**不装打包器**（本机没有 esbuild/tsdown/tsup/rollup/vite）。只 require 宿主播种的 react、react/jsx-runtime、primitives、slots 等，禁止 value import `dsh-client-ui-settings-plugins`。
- 卡片内容：每条 watch 一行三列——目录 / 目标会话 / 完成规则；支持增删改。
- 目标会话栏只做**文本输入 + 保存前校验存在性**（不做搜索选择器，已裁定砍掉）。
- 完成规则四态：省略（默认 `text: '<!-- DONE -->'`）、`{ text }`、`{ regex }`、`null`（关闭）。

### B. `exact` 开关

- 不写 `exact` → 包含匹配（与 P6 一致，逐条不变）。
- `exact: true` → 标题完全相等。
- `exact` 只接受布尔；**非布尔值报错并跳过整条 watch**（该 watch 不投递），不退回包含匹配，错误须点名 watch 与字段。

### C. 启动期有限次重扫

- 常量：`RETRY_DELAYS_MS = [1000, 5000, 15000]`、`MAX_SCAN_ATTEMPTS = 3`、`MAX_SCAN_WINDOW_MS = 21000`。
- 启动时解析失败的 watch，按上述延迟各重扫一次；成功即投，只投一条。
- 日志：**只在重扫窗口内**写 INFO，每次尝试一条，成功也写：`rescan#<N> dir=<dir> result=resolved|not-found`。最多 3 条/次加载。常规投递成功仍不写日志。
- 三次全失败即停止，不新增常驻定时器、不轮询。

## 2. 禁止

- 不动 `source:` 那一行（按内容核验，不按行号）。
- 不动 `delivered/` 清理逻辑、不动 `stableMs` 语义、不动既有 `takeDelivered` 语义。
- 不重启 DSH、不往任何 watch 目录丢文件、不用 `git add -A`（点名 `git add <文件>`）。
- 不改 README（另卡）。

## 3. 判据

- `node index.test.mjs` 的 `TOTAL:` 行 **不得低于 84/84**，且原有用例一条不许删（删了要说明属于被退役机制）。
- 新增用例至少覆盖：`exact` 三态（缺省/true/非布尔跳过整条）、重扫 1 次成功/2 次成功/3 次全败（含 `rescan#` 行数与顺序）、保存失败不写坏 yml、保存不改值后 `watches` 深比较相等。
- `git status --porcelain` 只允许出现你确实改过的文件。
- 报告落 `.batch/night/reports/p11-settings-card.md`，末行 `<!-- DONE -->`；信号落 `.batch/night/signals/doubao/p11-settings-card.done`（三行：完成/提交 SHA/测试总数）。
- 报告里必须写明：装载方式（宿主如何加载到 client entry）、以及「保存 → 重启 → 生效」这条链上哪些环节你**没有**实机验证。

## 4. 估时与卡壳处理

预估 120–150 分钟。若 60 分钟内卡在「卡片不渲染 / namespace 注册不生效」，立刻停手写卡壳点（含报错原文与已试步骤），不要自造 RPC 通道、不要改宿主代码。
