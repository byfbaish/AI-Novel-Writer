# P22b · 设置卡界面（三列自定义行 + 会话选择器 + configForms 写回）

执行：豆包（DeepSeek V4.1 Flash 档位，实际以回执 model 为准）
仓库：`C:\develop\workspace\dsh-handoff-relay`
起点：`de69c8f`（P22a 合并后），基线 `TOTAL: 123/123 PASS`
终版提交：`6a28319`（代码提交 `dee1b9f` + 补充用例 `6a28319`）

## 0. 结论与 B0 边界（先读这段）

- 结构化 schema 已验证可用：`Schema.array(Schema.object({...})).volatile()` 在 schemastery 3.19.0 下解析为 `{get()}` box，`watches` 与 `stableMs` 都能被宿主 `volatileForm()` 识别、被 `isVolatilePath()` 判为可写；**没有退到 `Schema.any()`**。
- **B0 的真机部分未执行**：桌面壳 `0.2.2-rc.1` 正在运行，真实 profile `desktop` 有 7 条生产 watch（`targetSessionId` 绑定、`stableMs:5000`），本轮禁止写它、禁止重启 DSH；隔离 profile `selftest1114` 的宿主是 `0.1.1-rc.2` + `dsh-settings-file`，没有 `configForms`，不能证明 0.2.2 的 configForms→patch 链路。因此本报告给出的是 **schema 层 + YAML 持久化层的离线等价 spike**，不是“宿主 Loader 真机热重载”的实测。B0 的这一条只能标 **不确定 / 未通过字面要求**，不能算已完成。
- 其余 B1–B4、B6 已按命令实测；B5 真机 U1–U8 不在本次首验范围。

## 1. B0 spike：结构化 schema 与 YAML 写回/读回（离线等价）

### 1.1 判定依据（来自抽出源码，逐字复刻）

`%TEMP%\p22b-asar\dsh_node_modules_@deepseek-ai_dsh-settings_lib_index.js`：

```js
function volatileForm(schema) {
	if (schema.meta.volatile) return plainSchema(schema);
	if (schema.type === "object") {
		const dict = Object.fromEntries(Object.entries(schema.dict ?? {}).flatMap(([key, child]) => {
			const field = volatileForm(child);
			return field === void 0 ? [] : [[key, field]];
		}));
		return Object.keys(dict).length === 0 ? void 0 : z.object(dict);
	}
}
function isVolatilePath(schema, path) {
	if (schema.meta.volatile) return true;
	const [key, ...rest] = path;
	const child = key === void 0 ? void 0 : schema.dict?.[key];
	return child !== void 0 && isVolatilePath(child, rest);
}
```

`watches` 节点本身带 `meta.volatile:true`，数组内部对象不需要逐字段 volatile；`volatileForm` 只看对象节点、不递归数组，因此“数组对象 + `.volatile()`”落在正确的节点上。

### 1.2 宿主判定复核命令与原始输出

命令：`node %TEMP%\p22b-b0-check.mjs`

```text
ROOT_TYPE: object
WATCHES_NODE: {"type":"array","meta":{"default":[],"volatile":true},"inner":{"type":"object","meta":{"default":{}},"dict":{"dir":{"type":"string","meta":{"default":""}},"targetTitle":{"type":"string","meta":{"default":""}},"targetSessionId":{"type":"string","meta":{"default":""}},"exact":{"type":"boolean","meta":{"default":true}},"done":{"type":"any","meta":{}}}}}
STABLE_MS_NODE: {"type":"number","meta":{"default":5000,"volatile":true}}
VOLATILE_FORM_FIELDS: watches,stableMs
IS_VOLATILE_PATH_watches: true
IS_VOLATILE_PATH_stableMs: true
IS_VOLATILE_PATH_message: false
```

### 1.3 写前 yml

命令：`node %TEMP%\p22b-spike.mjs`

```yaml
- id: dsh-handoff-relay
  name: dsh-handoff-relay
  config:
    watches:
      - dir: "C:\\Users\\<用户名>\\AppData\\Local\\Temp\\p22b-spike-s0D0Eb\\watch"
        targetTitle: spike-session
        exact: true
        done:
          text: <!-- DONE -->
    stableMs: 5000
```

### 1.4 写后 yml（Config 解析 → form 值 → yaml 落盘）

```yaml
- id: dsh-handoff-relay
  name: dsh-handoff-relay
  config:
    watches:
      - dir: C:\Users\<用户名>\AppData\Local\Temp\p22b-spike-s0D0Eb\watch
        targetTitle: spike-session
        targetSessionId: ''
        exact: true
        done:
          text: <!-- DONE -->
      - dir: C:\Users\<用户名>\AppData\Local\Temp\p22b-spike-s0D0Eb\watch
        targetTitle: spike-session-2
        targetSessionId: ''
        exact: true
        done:
          regex: ^done$
    stableMs: 3000
    message: 文件 {path} 已就绪（触发={reason}），请继续。
```

### 1.5 读回对象（重新 `Config(raw)` + `.get()`）

```json
{
  "watches": [
    {
      "dir": "C:\\Users\\<用户名>\\AppData\\Local\\Temp\\p22b-spike-s0D0Eb\\watch",
      "targetTitle": "spike-session",
      "targetSessionId": "",
      "exact": true,
      "done": { "text": "<!-- DONE -->" }
    },
    {
      "dir": "C:\\Users\\<用户名>\\AppData\\Local\\Temp\\p22b-spike-s0D0Eb\\watch",
      "targetTitle": "spike-session-2",
      "targetSessionId": "",
      "exact": true,
      "done": { "regex": "^done$" }
    }
  ],
  "stableMs": 3000
}
```

```text
watches is array: true
row0 targetTitle: spike-session
row1 done.regex: ^done$
stableMs: 3000
profile: C:\Users\<用户名>\AppData\Local\Temp\p22b-spike-s0D0Eb
```

说明：`targetSessionId: ''`、`message` 默认值是 schemastery 的默认填充；运行时 `apply` 先 unwrap 再判定，空字符串不会当成绑定值。P22b 用例“Config 解析出的 box 直接交给 apply，watch 照常投递”已覆盖这一点。

**未执行**：用桌面壳的 `ConfigEditor.edit()` 真机 `writeFileAtomic` → `reconcileProfilePatches` 热重载。原因见 §0。  
**不确定项**：`configForms.get('dsh-handoff-relay')` 在真实 0.2.2 宿主里的返回值与 `mutate` 实际落盘，本轮没有真机读数。

## 2. 实现落点

### 2.1 `index.js`（只加配置 schema 与读时 unwrap）

- `export const Config = buildConfigSchema()`（`:56`）；`watches: z.array(z.object({ dir, targetTitle, targetSessionId, exact, done })).volatile().default([])`（`:42-48`）；`stableMs: z.number().default(5000).volatile()`（`:49`）；`message` 保持普通字段。
- `unwrapConfigValue()`（`:58-76`）逐层拆函数 / `{get}` / 数组 / 对象；`apply` 第一行 `config = unwrapConfigValue(config) || {}`（`:982`）。
- `git diff -- index.js` 只有这 40 行新增 + `apply` 一行，P22a 的 `resolveNow` / `matchSessionsByTitle` / `describeTargetNow` / 投递 / 重扫 / warn 一行未动。

### 2.2 `client.js`

- `inject` 仍为 `["slots"]`（`:15`）。
- 新宿主：`configForms.get("dsh-handoff-relay")`（`:533`）→ 注册 `plugins.row.config`，key `dsh-handoff-relay#dsh-handoff-relay`（`:535-541`），组件 `SettingsCard`。
- 三列表头 `目录` / `目标会话` / `完成规则`；每行 `删除`；底部 `新增一行`、`保存`、`放弃修改`。
- 目标会话列：按钮 `选择会话` → 内联弹层；搜索框按 `sessions.list.getSnapshot().byId` 的 `displayTitle` 本地过滤；列表项显示标题 + `《cwd》`。新卡片没有任何要求输入会话 id 的输入框。
- 选中后写 `targetTitle`、`targetSessionId`（选中的会话 id，保留兼容兜底）、`exact: true`；不写 `targetCwd`（schema 也不存在该字段）。
- 完成规则三态 `文本` / `正则` / `不使用`；正则输入框下常驻三句约束；坏正则只标红该行。
- 保存用 `controller.mutate([{op:'set',path:['watches'],...}, {op:'set',path:['stableMs'],...}])`；坏行回填 `original[i]`，好行写入；状态串 `已保存，重启宿主后生效；未通过校验：第 N 行：…`。
- 旧宿主只有 `settingsScope` / `configForms.bind` 时保留 P17 的 `settings.plugin.item` 卡片，不改变既有 P15/P17 行为；`apply` 全路径 try/catch，服务缺失只 warn。

### 2.3 `index.test.mjs`

新增 P22b 用例 6 条（见 §3），并保留原有 123 条。

## 3. B1 静态判据

```text
$ git show --numstat --format='%h %s' dee1b9f
dee1b9f feat: add a row-config settings card with title-based session binding

382     35      client.js
40      0       index.js
167     1       index.test.mjs

$ git show --numstat --format='%h %s' 6a28319
6a28319 test: cover switching a row from off to regex

24      2       index.test.mjs
```

```text
$ Select-String client.js -Pattern 'plugins.row.config'
4:// P22b：新宿主走 configForms.get(entryId) 的三列卡片（plugins.row.config）；
535:                    name: "plugins.row.config",
541:            if (typeof ctx.slots.inject === "function") ctx.slots.inject("plugins.row.config", register);
```

```text
$ Select-String client.js -Pattern 'const inject'
const inject = ["slots"];
```

```text
$ Select-String index.js -Pattern 'export const Config','volatile()'
36:// P22b：宿主只为带 .volatile() 的 Config 字段出设置表单，也只接受这些路径写回。
48:      })).volatile().default([]),
49:      stableMs: z.number().default(DEFAULT_STABLE_MS).volatile(),
56:export const Config = buildConfigSchema();
```

```text
$ node -e "const p=require('./package.json'); console.log(p.version, JSON.stringify(p.dependencies||{}), JSON.stringify(p.peerDependencies||{}))"
0.5.0 {} {}
```

## 4. B2 测试

命令：`node index.test.mjs`

```text
PASS  P22b Config：watches 与 stableMs 都是 volatile，解析后是 box 且可取回原值
PASS  P22b 渲染：三列表头、3 个行节点、3 个「选择会话」按钮，且没有 Session ID 输入
PASS  P22b 三态切换：文本 / 正则 / 不使用 三个选项与三个当前值都在
PASS  P22b 三态切换：第三行“不使用”切到“正则”，done 同步变成 { regex: "" }
PASS  P22b 正则约束常驻，编译失败只标红该行
PASS  P22b 保存部分成功：坏行保留旧值、好行写入、列出未通过行号与原因
PASS  P22b 读时 unwrap：Config 解析出的 box 直接交给 apply，watch 照常投递
TOTAL: 130/130 PASS
RESULT: PASS
```

退出码 0。基线 123/123 → 130/130（新增 7 条，无既有用例删改）。

## 5. B3 反证

把 `client.js` 替换成 `74f4cc1` 版本，`index.js` / `index.test.mjs` 用本轮版本，跑同一套测试：

```text
FAIL  P22b 渲染：三列表头、3 个行节点、3 个「选择会话」按钮，且没有 Session ID 输入 :: service.bind is not a function
FAIL  P22b 三态切换：文本 / 正则 / 不使用 三个选项与三个当前值都在 :: service.bind is not a function
FAIL  P22b 三态切换：第三行“不使用”切到“正则”，done 同步变成 { regex: "" } :: service.bind is not a function
FAIL  P22b 正则约束常驻，编译失败只标红该行 :: service.bind is not a function
FAIL  P22b 保存部分成功：坏行保留旧值、好行写入、列出未通过行号与原因 :: service.bind is not a function
TOTAL: 125/130 PASS
RESULT: FAIL
```

FAIL 数：5。旧 client 把 `configForms` 当 `.bind` 服务用，遇到真实 `.get` 服务直接抛，新用例必红。

## 6. B4 桩渲染

与 P15 同款 vm + React 桩（`useState` 返回初值、`createElement` 对函数 child 求值），只换 `configForms.get` 控制器：

```text
HEADERS: 目录=true 目标会话=true 完成规则=true
ROW_NODES: 3
SELECT_SESSION_BUTTONS: 3
SESSION_ID_TEXT_HITS_IN_RENDER_OUTPUT: 0
SESSION_ID_TEXT_HITS_IN_CLIENT_SOURCE: 0
TREE_STRINGS: 配置会写回 cordis.patch.yml；保存后重启宿主生效。目标会话按标题匹配（exact=true 表示完全相等）。 | stableMs | 目录 | 目标会话 | 完成规则 |  | 选择会话 | 会话 A | 文本 | 正则 | 不使用 | 删除 | 选择会话 | 会话 B | 文本 | 正则 | 不使用 | 只扫文件尾部约 4KB | 固定 m 标志，长度 ≤200 字符 | 禁止嵌套量词（如 (a+)+） | 删除 | 选择会话 | 会话 C | 文本 | 正则 | 不使用 | 删除 | 新增一行 | 保存 | 放弃修改 | 已同步 Host（revision 1）
```

`Session ID` 在渲染输出与 client 源码均 0 命中；新卡片没有会话 id 输入框。

## 7. B5 真机项（未执行）

U1–U8 未在桌面壳真机跑，尤其：

- U5 重启后按标题仍可投：需要重启/热重载宿主；
- U7 正则 `(a+)+` 真实配置下只红该行：已由桩渲染与测试覆盖，真机未验；
- configForms 保存是否真的原子改写 `cordis.patch.yml`：只有静态源码与离线 YAML 往返，**无真机读数**。

## 8. B6 提交

```text
$ git show --numstat --format='%h %s' dee1b9f
dee1b9f feat: add a row-config settings card with title-based session binding

382     35      client.js
40      0       index.js
167     1       index.test.mjs

$ git show --numstat --format='%h %s' HEAD
6a28319 test: cover switching a row from off to regex

24      2       index.test.mjs
```

```text
$ git log -2 --format='%h %s'
6a28319 test: cover switching a row from off to regex
dee1b9f feat: add a row-config settings card with title-based session binding
```

```text
$ git status --porcelain
(空)

$ git rev-parse --short=12 HEAD
6a283196f083
```

`git add` 点名 `client.js`、`index.js`、`index.test.mjs`，未用 `-A`；第二次只点名 `index.test.mjs`。未 tag、未 push、未 publish。

## 9. 已知限制 / 不确定项

1. **B0 真机未执行**：如上，结构化 schema 与 YAML 往返已实测，宿主 Loader 热重载与 configForms 落盘未实测，标不确定。
2. `Config` 在 schemastery 解析失败时导出 `undefined`，宿主按“无配置表单”处理；本轮测试环境能解析到桌面 profile 的 schemastery 3.19.0。
3. 旧宿主保留 P17 旧卡片；新宿主只走 `plugins.row.config`，未注册 `plugins.item` 包详情页配置区（按卡面 §2.1 只要求行卡）。
4. 保存部分成功按行号回填旧值；若用户增删行导致索引变化，回填按当前数组位置匹配，未做稳定行 id。此为边界限制，未扩到批量导入/拖拽。
5. `targetSessionId` 在选中会话时写入；若原行只有标题，选中后变成 title + id 双写（id 作兜底），符合“原有 id 保留”的兼容口径。

<!-- DONE -->
