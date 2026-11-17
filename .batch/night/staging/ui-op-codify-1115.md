# 界面操作方法固化（11-15 凌晨实测交接）

来源：用户要求「联络人查明的界面操作方法须固化，不得每次重新调查」（大肥鱼 11-15 入群记忆）。
输入：workbuddy联络人 实测（WorkBuddy 选项卡）、豆包联络人 实测（豆包队列取消）、负责人裁定（只写实测部分，✕ 未验标未验；脚本补丁另开 A 类卡，排 P48 之后）。
本件性质：**B 类草稿，未提交、未改任何脚本**。落仓库要么随 A 类卡（脚本补丁）同一次提交，要么由负责人另开文档卡。

---

## §0 状态一览

| 动作 | 客户端 | 状态 | 判据 |
|---|---|---|---|
| 选项卡挡住输入框 → 点选项提交 | WorkBuddy 5.9.3 | **已验证**（本次 P48 前实测） | 选项组消失 + 输入框回占位符 |
| 点卡片 ✕ 作废 | WorkBuddy | **未验证** | — |
| 排队行悬停 → 点 ✕ 取消排队 | 豆包 桌面版 | **已验证**（本次两条实测） | DOM 行数减一，1.2s 内 |
| `--no-wait` 被吞掉文本 | 两通道共用 `attach.mjs` | **已定位缺陷，未修** | 见 §3 |
| `queueEmpty` 读数 | 豆包 `doubao.mjs` | **已定位缺陷，未修** | 见 §4 |

---

## §1 豆包：取消排队中的消息（已验证）

**现象**：豆包正在跑任务时再投一条，消息进队列（对话里显示为排队行）；要撤回只能在界面上点掉那一行。

**操作**（豆包联络人本次实测，两条全点掉）：

1. 连 CDP **9331**（常驻，不必每次跑 `start-doubao-cdp.cmd`），页面 `chrome://doubao-chat/chat/<会话id>`。
2. 队列行锚点：`[class*="item-tEUI7Y"][role="button"]`。本次两行实测几何：`x=323, w=903, h=32`，`y=805` 与 `y=837`。
3. **必须先悬停**：`Input.dispatchMouseEvent` 先 `mouseMoved` 到行中心，右侧才出现「↑ × ⋯」胶囊，三个按钮 `x≈1131 / 1174 / 1216`、`y` 取行中心。
   **注意**：✕ 本身是悬停后才渲染的元素，**它的选择器/属性没有登记到（未验）**，目前只有坐标，所以这一步只能按坐标点，不能按选择器点。
4. 对 ✕ 位置发 `mousePressed` → `mouseReleased`（真实鼠标事件，不是 `dispatchEvent`、也不是选项卡）。
5. 回读：约 **1.2 秒**后重新求值一次 DOM，该行消失（两行→一行→零行）。不需要重新拉快照。

**判据（重要）**：只看 **DOM 行数 = 0**。**不要用 `queueEmpty`**——它读的是对话正文里的 `QUEUE` 标记，不是队列 DOM，取消后仍返回 `false`（详见 §4）。

**脆弱点**：`item-tEUI7Y` 是哈希类名，跨版本会变。兜底思路（未实做）：改为定位「输入框上方的队列容器」里的行元素——但本次取证时队列已被点空，**取不到该容器路径**，需要再排一次「带队列时取证」才有结论。**这条兜底未验证，不要当成可照做步骤。**

---

## §2 WorkBuddy：选项卡挡住输入框时怎么选（已验证）

**现象**：`say`/`typePrompt` 报「输入框写不进任务文本」（本次实测：选项卡面板覆盖输入框，真实键盘输入落不进去）。

**操作**（workbuddy联络人本次实测）：

1. 前提：WorkBuddy 桌面 **5.9.3** 自带 Chromium，CDP **9333**，页面 `index.html`；连接由 `workbuddy-attach.mjs` 自己建立，不需要另起脚本。没开 debug 时 `exit 2` 并打印 banner。
2. 先照常调 `say`，失败（「写不进任务文本」）才走回退。
3. CDP `Runtime.evaluate`：找 `div[role="button"]` 且 `innerText` 含选项关键字的元素。容器是 `._options_*`，选项是 `._optionItem_*`，**类名带哈希，不要写死**。
4. 对该元素调 `.click()`。**点击本身就是提交**，卡片随后消失、输入框回到占位符 `今天帮你做些什么？`——**不需要再点「发送」**。
5. 回读：约 **600ms** 选项组消失；约 **1.5s** 输入框回占位符。这就是「已提交」的判据。

**不要混淆**：「已提交」看占位符；「已干活/跑完」必须看 `runState` 与产物，两者不是一回事。

**未验**：WorkBuddy 侧点卡片右上角 ✕ 作废——联络人未实测，本件不写成步骤。

---

## §3 缺陷一：`--no-wait` 被当成带值选项，吞掉后面的文本

**现象**：`workbuddy-attach.mjs say "文本" --no-wait` 报「say 需要一段文字」，今天已复现两次。

**定位（已核代码）**：
- `scripts/workbuddy/workbuddy-attach.mjs:97` `const BOOLEAN_FLAGS = ['--new', '--keep', '--json', '--force', '--no-wait', '--help', '--quiet']` —— 存的是**带 `--`** 的名字。
- `scripts/workbuddy/attach.mjs:565` `export function parseArgv(argv = [], booleanFlags = [])`，`:576` `const name = token.slice(2)` 已剥掉 `--`，`:569` `const booleans = new Set(booleanFlags)` 直接用原数组 ⇒ `booleans.has('no-wait')` 恒 false。
- 于是 `:578` 走进 `options.set(name, String(next))`，把紧跟其后的位置参数吃成 `--no-wait` 的值。

**临时绕法（今天在用）**：位置参数放最前、`--no-wait` 放最后。

**建议根治（二选一，倾向 A）**：
- A. `attach.mjs` 侧归一：`const booleans = new Set(booleanFlags.map(f => f.startsWith('--') ? f.slice(2) : f))` —— 兼容两种写法，不影响任何现有调用方（`parseArgv` 全仓只有 `workbuddy-attach.mjs:813` 一个调用点，`scripts/doubao/*.mjs` 无 `BOOLEAN_FLAGS`）。
- B. `workbuddy-attach.mjs:97` 改成裸名数组 —— 更小，但调用方若有人按带 `--` 传就会再踩。
- 需补一条单测：`parseArgv(['say','text','--no-wait'], ['--no-wait'])` 断言 `positionals=['say','text']`、`flags` 含 `no-wait`、`options` 为空。放在 `scripts/workbuddy/__tests__/attach.test.mjs`。

---

## §4 缺陷二：`queueEmpty` 名不副实

`scripts/doubao/doubao.mjs:660`：`queueEmpty: markers.some(item => item.marker === 'QUEUE')` —— 读的是**对话正文里的标记**，不是队列 DOM；而且语义反了（有 QUEUE 标记时才为 true）。取消排队后它仍返回 `false`，**不能当「队列已空」判据**。

建议：要么改名 `hasQueueMarker`，要么另取真正的队列 DOM 行数。属工具链缺陷，与 §3 同一张 A 类卡更省事。

---

## §5 可直接粘贴的文档段落

### 5.1 追加到 `docs/agents/workbuddy-channel.md` 末尾

```md
## 14. 选项卡挡住输入框时怎么选（2026-11-15 实测）

**现象**：`say`/`typePrompt` 报「输入框写不进任务文本」——选项卡面板盖住输入框，真实键盘输入落不进去。

**操作**：① 前提 WorkBuddy 5.9.3 + CDP 9333 + `index.html`（连接由 `workbuddy-attach.mjs` 自建）；② 先照常调 `say`，失败才走回退；③ CDP `Runtime.evaluate` 找 `div[role="button"]` 且 `innerText` 含选项关键字（容器 `._options_*`、选项 `._optionItem_*`，**类名带哈希，不要写死**）；④ 对该元素 `.click()`——**点击即提交**，不必再点「发送」；⑤ 回读：约 600ms 选项组消失、约 1.5s 输入框回占位符 `今天帮你做些什么？`。

**别混淆**：「已提交」看占位符；「已跑完」看 `runState` 与产物。

**未验**：卡片右上角 ✕ 作废（联络人未实测，不要把本节当依据）。
```

### 5.2 追加到 `docs/agents/doubao-channel.md` 末尾

```md
## 15. 取消排队中的消息（2026-11-15 实测）

**现象**：豆包正在跑任务时再投的消息会进队列，撤回只能在界面上点掉那一行。

**操作**：① CDP 9331（常驻，不必每次跑 `start-doubao-cdp.cmd`），页面 `chrome://doubao-chat/chat/<会话id>`；② 队列行锚点 `[class*="item-tEUI7Y"][role="button"]`（本次两行 `x=323,w=903,h=32`，`y=805/837`）；③ **先 `mouseMoved` 悬停**到行中心，右侧出现「↑ × ⋯」胶囊，✕ 约在 `x≈1174`、行中心 `y`；④ 发真实 `mousePressed`/`mouseReleased`（不用 `dispatchEvent`、不用选项卡）；⑤ 回读：约 1.2s 后 DOM 行数减一，不必重拉快照。

**判据**：只看 **DOM 行数 = 0**。**不要用 `queueEmpty`**——它读正文 `QUEUE` 标记、语义也反了（`doubao.mjs:660`），取消后仍返回 `false`。

**脆弱点**：`item-tEUI7Y` 是哈希类名，跨版本会变；结构兜底（按 `innerText` 前 12 字 + 高度 28–36px 定位）**未验证**，不要照做。
```

---

## §6 待办与责任

1. **A 类卡（等负责人排 P48 之后）**：`parseArgv` 布尔名归一 + `queueEmpty` 改名/改语义 + 各补一条单测；**同一次提交带上 §5 两段文档**（同提交同步文档）。
2. **未验项**：WorkBuddy 的 ✕ 作废、豆包队列行的结构兜底定位——要写进文档须先有人实测一次，否则保持「未验」。
3. 本件未改任何脚本、未提交、未写信号（B 类草稿，读数在群里报）。

<!-- DONE -->
