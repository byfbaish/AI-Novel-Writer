# P22c · 旧宿主分支收口（只读提示 + 文案纠正）

执行：豆包（自动档）
仓库：`C:\develop\workspace\dsh-handoff-relay`
起点：`6a28319`（P22b 最新 HEAD，130/130）
终版：`8d562a052e8f`

## 1. 改动内容

只动 `client.js` 与 `index.test.mjs`。

### 1.1 旧宿主 `RelayCard` 改为只读

- 删除旧卡片的 `input` / `select` / `textarea` / `checkbox` / `button` 渲染；不再有 `新增一行`、`保存`、`放弃修改`、`删除`。
- 删除旧卡片的 `scope.set("watches", ...)` 保存路径；旧分支不再调用任何写回方法。
- 保留 `scope.getSnapshot()` + `scope.subscribe()` 只读展示真实 watches。
- 只读提示原文：
  `当前宿主版本较旧，不支持本插件的配置界面。请直接编辑 cordis.patch.yml 里的 dsh-handoff-relay 配置，重启后生效。`
- 列头改为 `目录` / `目标会话` / `完成规则`，不再出现手填 id 的列头或输入框。
- 现有 watch 展示：目录、目标会话（`targetTitle` 或 `targetSessionId` 的值）、完成规则与 exact 说明；无保存入口。

### 1.2 exact 文案纠正

改前：

```text
exact 表示标题完全相等（缺省为包含匹配）。
```

改后：

```text
exact 为 true 时标题必须完全相等（缺省 true）；填 false 则按包含匹配。
```

新宿主 `plugins.row.config` 三列卡片与会话选择器没有改动；`client.js` 的 diff 只有一段：

```text
@@ -95,117 +95,44 @@ window.__ModuleLoader__.load({
```

### 1.3 测试调整说明（重要）

P15 原用例 `P15 卡片渲染：doneKind 分支节点按行出现（text/regex 各一，off 无）` 断言旧卡存在完成标记输入框与 3 个 exact 复选框。该断言与 P22c「旧宿主只读、不得有 input/select/textarea」直接冲突。处理方式是把这条旧断言替换成新的只读断言（不是删除用例）：

- `P22c 旧宿主渲染：只读、无 input/textarea/select/button，提示文案与真实 watch 命中`
- 新增 `P22c 旧宿主文案：无「缺省为包含匹配」，无 session id 手填字样`

P15 第一条「rows.map 回调真执行」保留原样。其余 P22b/P17 用例未动。

## 2. 判据与原始输出

### 判据 1：diff 只含两个文件

```text
$ git diff --numstat 6a28319 HEAD
21      94      client.js
14      7       index.test.mjs
```

### 判据 2：无「缺省为包含匹配」

```text
$ git show HEAD:client.js | Select-String -Pattern '缺省为包含匹配' | Measure-Object | Select-Object -ExpandProperty Count
0
```

### 判据 3：无「session id」字样

```text
$ git show HEAD:client.js | Select-String -Pattern 'session id' | Measure-Object | Select-Object -ExpandProperty Count
0
```

说明：字段名 `targetSessionId` 仍在（P22a 绑定字段与兜底解析要用），但它不是界面文案；旧卡已不再渲染 `目标会话（session id）` 列头、也没有 `session-xxxxxxxx` 占位输入框。全文件按 `session id` 短语检索 0 命中。

### 判据 4：旧宿主桩渲染

测试内以 `settingsScope.bind` 桩挂载旧卡，断言 `input` / `textarea` / `select` / `button` 节点数为 0，且提示文案、exact 文案、真实 watch 值均命中：

```text
PASS  P22c 旧宿主渲染：只读、无 input/textarea/select/button，提示文案与真实 watch 命中
PASS  P22c 旧宿主文案：无「缺省为包含匹配」，无 session id 手填字样
```

### 判据 5：全量测试

```text
$ node index.test.mjs
PASS  P15 卡片渲染：rows.map 回调真执行，不抛 ReferenceError
PASS  P22c 旧宿主渲染：只读、无 input/textarea/select/button，提示文案与真实 watch 命中
PASS  P22c 旧宿主文案：无「缺省为包含匹配」，无 session id 手填字样
TOTAL: 131/131 PASS
RESULT: PASS
```

exit 0；起点 130/130 → 131/131。

### 判据 6：提交与工作区

```text
$ git show --numstat --format='%h %s' HEAD
8d562a0 fix: make the legacy settings card read-only

21      94      client.js
14      7       index.test.mjs
```

```text
$ git status --porcelain
(空)

$ git rev-parse --short=12 HEAD
8d562a052e8f
```

`git add` 点名 `client.js`、`index.test.mjs`，未用 `-A`；未 tag、未 push、未 publish。

## 3. 文件读数

```text
client.js      21,494 B  MD5 3F79975762092FF057DBCD67830A7E02
index.test.mjs 124,750 B MD5 641F20BADB7C27907A224E0C6563945C
```

## 4. 已知限制

- 旧宿主只读展示不包含 stableMs 单独展示；本轮判据只要求 watches 只读可见。
- 旧卡片的 `validateRows` 辅助函数已不再被调用（保留原函数与注释，未删代码）；不影响新卡与旧卡的只读渲染。
- 本次只做桩渲染与单元测试，真机旧宿主界面未截图；真机项不在 P22c 首验范围。

<!-- DONE -->
