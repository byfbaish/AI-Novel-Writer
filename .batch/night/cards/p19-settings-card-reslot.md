# P19 · 设置卡按 0.2.2-rc.1 的真实槽位重做（规格草案，未投出）

- 卡号：P19
- 状态：草案（待负责人裁定路线 A / B 后改「待投」）
- 作者：产品经理（只出规格，不写码、不跑测试）
- 依据：`.batch/night/reports/p18-card-missing-1114.md`（11,812B，MD5 `E702A77B…`，末行 `<!-- DONE -->`）
- 上游事实：`settings.plugin.item` 在 213MB 前端 bundle 里 **0 命中**；真实槽位 `plugins.row.config`（key=`包名#条目id`）、`plugins.bundle.config`（key=包名）、`plugins.item`（`{id,label}`）；host 侧 `settings.register()` 本版本**不存在**，表单由 `describe()` 从 Config 的 `.volatile()` 字段自动生成；`Agent Loop Guard` 是唯一在册第三方设置卡，它就是「client 注册 slot + host 只声明 Config」这一形态。

## 一、背景

设置页「无卡」不是渲染失败，是**挂错了槽**：我们向一个本版本不存在的槽位注册，host 侧又调用了一个本版本不存在的 API。所以这不是「补一行代码」，而是换通道。

对使用者（本插件的安装者）的后果是：**能装、能投、但没法在界面里改 watch** —— 改一条 watch 要去手工编辑 `cordis.patch.yml`，且改完必须自己重启。这条路径对「开源给别人用」是不可接受的。

## 二、目标

1. 安装者在界面里能看到并编辑 `watches`（增删行、改三列、保存生效），不需要手工编辑 YAML。
2. 保存后配置落到**唯一真相源**，重启前后行为一致；保存失败有可见反馈，不静默吞。
3. 与 0.2.2-rc.1 的既有能力对齐：零新增依赖、不动 host 侧 watch 判定逻辑、不改已发布版本行为。
4. 旧宿主（0.1.1-rc.2，有 `settingsScope` / `settings.register`）**不做第二条实现路径**，只留一行日志说明（见 §4）。

## 三、两条路线（各自代价，任选其一作为本期）

### 路线 B（先做，推荐）：`.volatile()` 自动表单，零 client 代码

- 做法：host 侧 `Config` schema 已经是真相源；给 `watches` 及其字段加 `.volatile()` 标注，宿主 `describe()` 自动生成表单并负责读写。
- 得到：能增删/编辑 watch、能保存、schema 校验（缺 `dir`、非绝对路径、`done` 与 `text`/`regex` 互斥）由宿主按 schema 报错。
- 得不到：三列并排的自定义行布局、正则编译失败「只标红该行」、行内即时提示、跨行联动。**这三条正是路线 A 的全部价值，B 交付时须在 README 明说「界面为通用表单，不是三列表格」。**
- 代价：client 侧 0 行代码、0 依赖；改动面 = host `Config` 标注 + WARN 文案 + 文档。
- 风险：通用表单对 `watches` 这种数组嵌套对象的呈现可能很朴素（每项一块、字段名直出）。**这是可接受的最低可用，不是最终形态。**

### 路线 A（紧随其后）：`plugins.row.config` 自定义行渲染

- 做法：client 注册 `plugins.row.config`，`key = 包名#<cordis.patch.yml 里该 entry 的 id>`；`props.view` 区分 `summary` / `page`；`page` 渲染三列表格。同一份 schema 由 host 侧 `Config` 提供，client 不另立数据结构。
- 得到：三列一行（目录 / 目标会话 / 完成规则）、增删行、保存与放弃修改、正则编译失败只标红该行不影响其他 watch。
- 代价：client 侧要 React + 打包链（这条 P1 时代已核实过，无法规避）；新增构建产物进发布物；渲染层测试（或至少 DOM 快照）要有一份。
- 风险：`plugins.row.config` 的 props 形状（`view`、`form`、`entryKey` 之外还有什么）目前只有 P18 的静态读法，**须在动手前用一次只读取证钉死**（§5 闸门 G0）。

### 我的建议（产品口径，负责人可改）

**先 B 后 A，分两个版本**：B 让「能配置」这件事本期就有出口，A 再把「标红/行操作」补上。理由：A 依赖 client 构建链，一旦卡在打包上会把「能配置」整体拖住；而 B 的改动面小到可以和其它卡同批发。**不并成一张卡**，因为两者的验收判据完全不同（B 判表单能存、A 判三列与标红）。

## 四、数据通道与旧宿主

### 4.1 读写链路

- **真相源**：`cordis.patch.yml` 里该 entry 的 `config.watches`（现有形态不变，不新增字段；`done` 仍是四态：省略 / `{text}` / `{regex}` / `null`）。
- **写**：界面保存 → 宿主 settings 层写入（`update()` / `mutate()` / `replace()` 三选一，由 G0 取证确定用哪个）→ 落到 profile 的配置存储 → 触发插件重载或 live 应用。
- **读**：`describe()` 产出表单初值；插件自身启动时仍从 `config.watches` 读。
- **冲突**：沿用 `revision` / `expectedRevision` / `SETTINGS_CONFLICT` 语义，冲突时界面必须提示「配置已被别处改动」并让用户选择重新加载，不许静默覆盖。
- **待核（G0，不猜）**：① `.volatile()` 表单保存后究竟写回哪一处文件、是否就是 `cordis.patch.yml` 的 `config`；② 「Host observe 后回写」这条链路在 0.2.2-rc.1 是否仍成立（0.1.x 时代存在，新版是否被 `configure()` 取代）；③ `plugins.row.config` 的 props 完整形状。三项任一未定 ⇒ **只做 B，不写 A 的渲染代码**。

### 4.2 旧宿主

- **不保留旧路径**：`settings.register` + `settings.plugin.item` 在 0.1.1-rc.2 之后已被替代，双路径会让「同一 namespace 两套注册」并存，且判据要写两份。**判据打架的根源不是能力探测，而是两条实现**。
- **降级写法**：启动时探测（`plugins.row.config` 槽可注册 / `configForms` 服务可用）——
  - 探测成功 → 走 B（本期）或 A（下期）；
  - 探测失败 → **只 warn 一行**：`本 DSH 版本的设置页不支持本插件的配置卡（缺 plugins.row.config）；请直接编辑 cordis.patch.yml 的 config.watches`，watch 扫描与投递照常；
  - 不写「旧 API 分支」，不做版本号比较（版本号比较在 0.2.x 的 rc 命名下不可靠）。
- **文案纠正**：现有 WARN「宿主无 settings 服务」是误判（P18 根因链第 3 条），必须改成「未取到 settings 服务（可能尚未就绪）」或上面那条槽位文案。**这条单独成立，不依赖路线选择，可以和 B 一起发。**

## 五、验收判据

### 闸门 G0（动手前，只读取证，30 分钟）

| # | 项 | 通过条件 |
|---|---|---|
| G0-1 | 保存落点 | 给出「界面保存后改的是哪个文件的哪个键」的原文证据（file:line 或保存前后文件 diff） |
| G0-2 | 回写链路 | 明确 `update` / `mutate` / `replace` 中哪个是 volitale 表单用的，以及 `revision` 冲突如何返回 |
| G0-3 | 槽位 props | `plugins.row.config` 的 `view`/`form`/`entryKey` 之外的实际字段，附 `client.js` 行号 |
| G0-4 | entryId 一致性 | `cordis.patch.yml` 里该 entry 的 `id` 与 `包名#id` 的拼接结果，真机上等于页面 `entryKey` |

G0 任一项拿不到 ⇒ 本期只发 B + 文案纠正，A 顺延。

### 路线 B 的判据

| # | 场景 | 判据 |
|---|---|---|
| B1 | 出现 | 隔离 profile 重启后，「设置 → 插件 → 已安装 → 点开 dsh-handoff-relay」出现配置区（真机） |
| B2 | 读初值 | 表单初值与 `cordis.patch.yml` 现有 7 条 watch 逐条一致（真机，截图 + 配置原文对照） |
| B3 | 改一条 | 改某条 `dir` 保存 → 文件里该条变化、重启后仍生效（真机） |
| B4 | 校验 | 缺 `dir`、`dir` 非绝对路径、`done` 同时给 `text` 与 `regex` 三种各自被拒且提示可读（真机或单测） |
| B5 | 失败可见 | 保存失败（模拟冲突）时界面有错误提示，配置不被改写（单测 + 真机各一次） |
| B6 | 不回归 | `node index.test.mjs` 全绿，读数 ≥ 当前基线；watch 投递链路行为不变 |

### 路线 A 的追加判据（本期不做，先写清以免将来重定义）

| # | 场景 | 判据 |
|---|---|---|
| A1 | 三列 | 一行三列＝目录 / 目标会话 / 完成规则；一行对应一条 watch，不引入第二套概念 |
| A2 | 完成规则 | 四态可切换：默认（省略）、文本、正则、不使用（`null`）；写入值与界面态一一对应（见 UI 细稿 §2.4 映射表） |
| A3 | 标红 | 正则编译失败只标红该行、给出失败原因，其他行仍可保存（真机） |
| A4 | 保存/放弃 | 放弃修改恢复上次保存值；保存成功后关掉页面再回来仍是新值（真机） |
| A5 | 正则三句常驻 | 正则输入框下常驻三句限制（只扫尾部 4KB、固定 `m`、禁嵌套量词超限即拒） |
| A6 | 空态 | 0 条 watch 时显示「暂无监控目录」和「新增一行」，不显示空表格 |

### 明确不做（本期与下期都不做）

- 会话搜索选择器（`targetTitle` 已能按标题包含匹配；界面只做 id 文本输入 + 保存前存在性校验）。
- 多播（一条 watch 投 N 个会话）——编排责任在 agent 层，不在投递层。
- 订阅者注册表 / 会话改名跟随 / 按标题锁定。
- 历史记录、运行日志查看、重试按钮。
- 为 UI 引入的除 React 与打包工具之外的任何依赖。

## 六、边界

- 零新增依赖（路线 B 完全不碰 client；路线 A 的 React/打包链已在发布物内，不新增第三方包）。
- 不改 host 侧 watch 判定逻辑（`stableMs` / `done` 四态 / 正则限制 / 去重）。
- 不改已发布版本的既有行为（0.4.x / 0.5.0 语义不动）；版本号与 tag 由发版卡负责，本卡不打 tag、不 publish。
- 只改：`index.js` 的 `Config` 标注与 WARN 文案；路线 A 再加 `client.js` 与构建配置；报告与 README 相应段落。
- `git add` 点名文件，禁 `-A`；禁重启 DSH（真机项由负责人另派真机执行）。

## 七、交付

- 报告：`.batch/night/reports/p19-settings-card-reslot.md`，末行 `<!-- DONE -->`，附 G0 四项证据、逐条判据实测读数、命令原文。
- 信号：`.batch/night/signals/doubao/p19-settings-card-reslot.done`。
- 估时：B 路线 60–90 分钟；A 路线另计（须先有 G0 结果）。

## 八、待负责人裁定（两条）

1. 本期发 **B**、A 顺延，还是直接上 A？（我的建议：B 先发，理由见 §3 末。）
2. WARN 文案纠正是否单独走一张小卡立刻发？（它与路线无关，且当前那条文案会把排查方向带偏。）

<!-- DONE -->
