# dsh-group-rules-prompt

把「群规则」注入到**该群成员的会话**系统提示词里。一个 DSH 会话只在一处说话：
群会话拿到那个群的规则，私聊会话什么都不拿。规则就是一个普通 Markdown 文件，
改完下一轮即生效，不用重启。

## 它做什么

- 注册一个系统提示词段：`group-rules`，order `645`，`interpolate: false`。
- 每次拼装提示词时，把「调用方会话 id → 它所属的 room → 该 room 的规则文件」解析出来，渲染成：

  ```
  # 群聊规则（<群名>）

  <两句导语>

  <规则文件全文>
  ```

- 以下情况一律不注入：会话不是群成员、文件不存在或为空、`state.json` 读不到/解析失败、
  插件被禁用。所有失败路径都返回空串——本插件绝不向提示词拼装抛错。

## 依赖

- DSH 桌面端运行时，且带 `systemPrompt` 服务（宿主需含 `ds-bot/src/host/prompt.js` 的段注册）。
- bot 主目录：`$DSH_HOME`（默认 `%USERPROFILE%\.dsh`），其中要有 `bot/state.json`。

## 安装

本地 link 进 profile（与 `dsh-handoff-relay` 同构）：

```bash
cd <克隆目录>
npm link                     # 或 npm pack 后装 tarball
dsh plugin --profile desktop add dsh-group-rules-prompt
```

装完重启一次应用；此后开关只在 **插件 → 已安装 → 包含的组件** 里切换，不需要再重启。

## 配置

| 键 | 默认 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 总开关；`false` 时不渲染任何内容 |
| `defaultFile` | 无 | 所有群共用的规则文件绝对路径 |
| `fileByRoom` | `{}` | 按 room 覆盖：`{ "<roomId>": "<path>" }` |
| `maxChars` | `20000` | 渲染块硬上限，超出截断并注记 |
| `refreshMs` | `2000` | `state.json` 多久重新 stat 一次（规则文件始终按 mtime 变化重读） |

`cordis.patch.yml` 片段示例（本 bundle 自带的文件已经插入插件，这里只是选项长什么样）：

```yaml
- insert:
    - id: dsh-group-rules-prompt
      name: dsh-group-rules-prompt
      config:
        defaultFile: C:/Users/you/.dsh/bot/workspace/GROUP-RULES.md
        maxChars: 20000
```

## 规则文件放哪

任何可读路径都行。项目内约定放 bot 工作区：`~/.dsh/bot/workspace/GROUP-RULES.md`。
只装「每轮都必须遵守的硬约束」——它每一轮都会注入，等于每轮都计一次输入 token。

## 用法：把规则从 notice 里搬出来

群 `notice` 有 2000 字符上限，而且每一轮都会被塞进 **user** 消息里重发一次，所以它的全部长度
每轮都计费。本插件让规则改住在系统提示词里：注入一次、作为前缀被缓存、不再逐轮重发。

1. 把全文写进规则文件（`defaultFile`），例如 `~/.dsh/bot/workspace/GROUP-RULES.md`。
2. 把群 notice 缩成一行指针，例如
   `群规则已作为系统提示词注入；全文见 GROUP-RULES.md，修订以该文件为准。`
   这行由**人**手动粘贴——本插件从不写 notice。
3. 重启 DSH 一次。之后改规则文件下一轮即生效（按 mtime 判定）：不用重启，也不用改 notice。

## 迁移模板：rules.example.md

仓库里带了一份现成起点 `rules.example.md`，不用从零写规则文件：

- 正文是一个真实群的 `notice` 硬约束，**逐条搬运**——无遗漏，也不掺入本插件自己编的口径。
- 另外收了原本只存在群记忆里的三条日常做法（每轮开工前读一次台账、只 @ 真正要动手的人、
  正文贴得进群就直贴），连同各自的例外一起写清。
- 它是模板不是教条：复制到你配置的路径（`defaultFile`），把里面的群名、文件路径换成你自己的，
  之后改你那份。仓库里这份文件运行时不读。

```bash
cp rules.example.md ~/.dsh/bot/workspace/GROUP-RULES.md
```

然后把 notice 缩成上面那行指针。模板里除了它引用的示例，没有依赖本机的东西——照抄前先核那些路径。

## 边界

- **不碰群 notice。** 把它的正文换成指针是人的动作。
- **不替任何人改配置** —— 不改 notice、不改别的插件的 watch、不动宿主设置。
- 对 `state.json` 只读；无任何网络调用；不记录 session id。
- 卸载即回滚：段消失、规则不再注入，人手把 notice 还原就回到原来的行为。

## room 怎么定位

`state.json` → `rooms[roomId]`：

- `rooms[*].sessions[botId] === agentId` —— 常态。注意这个 map 的**值是会话 id**，
  所以要比对值，不是比对键。
- `rooms[*].parts[].sessionId === agentId` —— 旧格式 room 记录的回退。

先命中先用。都没命中 ⇒ 私聊/独立会话 ⇒ 不注入。

## 安全

- 只读：不写 `state.json`、不碰 notice、不发任何网络请求。
- 缓存按路径分键：规则文件用 `mtime + size`，`state.json` 用 `refreshMs` 节流；
  导出 `clearCache()` 供测试使用。
- 不打印任何 session id、路径或密钥。

## 测试

```bash
node --test lib/index.test.mjs
```

14 例：命中 / 群名缺失 / 非群会话 / `parts[]` 回退 / 文件缺失 / `state.json` 损坏 /
mtime 失效 / TTL 节流 / 截断 / 配置默认值 / `enabled:false` / 空规则 / 段名与顺序 /
`apply()` 降级路径。

## 许可

MIT
