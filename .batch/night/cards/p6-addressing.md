# 卡：P6 会话寻址（title 包含匹配 + 启动解析日志 + 通知带路径）

状态：**已定稿，可投**（主人 06:12 原话裁定：①允许包含 ②不兜底，「不做比做要好，乱发很麻烦」）。

## 背景

`watches[]` 现在只能写 `targetSessionId`（会话 id 字面量）。id 在宿主新建会话时会变，外人也不知道去哪找。取证结论（`.batch\night\reports\relay-addressing-facts.md`）：

- 运行时**真拿得到**的身份：会话标题串（`ctx.get('sessionTitle').get(session)`）、`id`、`session.header.cwd`、`createdAt`、`status`
- **拿不到**：bot 名、侧栏显示名（bot 层 `inject` 不 provide 任何服务，名↔会话只在宿主私有 `~/.dsh/bot/state.json`）

另一个已被真机证实的缺陷：投递通知文本里只有文件名、没有路径，收件方在自己的 cwd 里找不到文件（私聊窗口实例上就是这样栽的）。这一条一并在本卡修掉。

## 要做的事（只改 `index.js` + `index.test.mjs`）

1. `watches[]` 每项改为 **`targetSessionId` 与 `targetTitle` 二选一**：
   - 两个都写 → 该条 watch 加载期 warn 并跳过（不猜哪个优先）
   - 两个都不写 → 同上
   - 保留 `targetSessionId` 现有行为，不破坏已装实例的配置
2. `targetTitle` 的解析在**每次投递前**做，不缓存。现行 `resolveSession`（`index.js:112`）是加载期解析、`index.js:291` 处一次性取用，本卡允许把它下沉到投递路径——把「目标 = id 或标题」的规格传进 `startWatch`（现行签名 `index.js:154`），投递时再解析；这条改动面比原稿大，属预期内：
   - 遍历 `ctx.agents.roots()`，用 `resolveSessionTitle` 取标题比较
   - **包含匹配**（子串命中即可，区分大小写；`简报` 命中 `周简报` 是预期行为）
   - 命中恰好 1 个 → 投递给它的 `id`
   - 命中 0 个 → warn（带该 watch 的 `dir` 与目标标题），**不投递**
   - 命中 >1 个 → warn（列出候选 id + 标题），**不投递**
3. **不做 `cwd` 兜底**：解析不到就跳过并告警，绝不按 `cwd` 猜最近活跃会话。
4. 加载期把每条 watch 的解析结果各打一行日志：`目标=<title 或 id> → 解析到 <id>（<标题>）`，解析不到写「解析不到，投递时会跳过」。现行日志在 `index.js:252`（固定写 `targetSessionId=`）与 `index.js:293`（warn），两处文案同步改，相关断言可等价改写但不得降覆盖。
5. 启动期校验改为「现在能否解析到」：解析不到只 warn，不阻断加载，不影响其他 watch。
6. 投递消息文本里带上**被投递文件的绝对路径**（现在只有文件名）。现行模板在 `index.js:15`：`DEFAULT_MESSAGE = '文件 {file} 已就绪（触发={reason}），请继续。'`，占位符只有 `{file}` 且填的是文件名。**做法：新增 `{path}` 占位符（绝对路径），默认模板改成 `文件 {path} 已就绪（触发={reason}），请继续。`；`{file}` 保留继续填文件名，配置里自定义 `message` 的行为不变。**
7. 测试新增（现有 49 条一条不许删，只许等价改写）：
   - 两个字段都写 / 都不写 → 加载期跳过该条，其他 watch 照常
   - title 命中 0 条 → 不投递且 warn
   - title 命中 2 条 → 不投递且 warn（候选要出现在 warn 里）
   - title 包含匹配命中 1 条（如 `简报` 命中 `周简报`）→ 正常投递
   - title 与 id 各一条 watch 混用 → 各自投各自的目标，不串
   - 投递文案含绝对路径

## 禁忌

- **不许动 `source`**（按内容核验，不按行号：`source: Object.freeze({ kind: `plugin:${PLUGIN_NAME}` })`，现行在 `index.js:150`；真实运行时只认 `plugin:<包名>`）
- 不许改 `cordis.patch.yml`、不许重启 DSH、不许往 `scripts\dsh\wakeup-inbox` 或 `.batch\night\signals` 丢文件
- 不许 `git push`、不许 `npm publish`
- 不许在解析失败时「猜一个目标」

## 产物

`.batch/night/reports/p6-addressing.md`，末尾 `<!-- DONE -->`；另按新约定落 `.batch/night/signals/workbuddy/p6-addressing.done`（三行：产物路径 / 提交 SHA / `<!-- DONE -->`）。

## 判定线

1. 二选一配置生效：双写、双空都只跳过该条，其他 watch 不受影响。
2. title 命中 0 / >1 一律不投递，warn 文案里能看出是哪条 watch、找的是什么标题、命中了几条。
3. 包含匹配生效（`简报` 命中 `周简报`），不是严格相等。
4. 命中唯一时投递正确、`source.kind` 仍为 `plugin:dsh-handoff-relay`。
5. 投递文案含文件绝对路径。
6. `node index.test.mjs` 全绿，**`TOTAL:` 行数字不许低于现在的 49/49**（判定按 TOTAL 行数，不按 `check(` 调用数）。
7. `git diff` 里 `source:` 行 0 变化。
