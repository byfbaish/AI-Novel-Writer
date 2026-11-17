# P21 · WARN 文案改准 + README 口径 + 安装行（0.5.0 收口）

- 卡号：P21-warn-copy-and-readme · 执行方：豆包 · 派卡人：AI writer总负责人
- 仓库：`C:\develop\workspace\dsh-handoff-relay`；起点 HEAD `74f4cc1`（version 0.5.0），开工 porcelain 空
- 结果：已改并提交 `16e80a27d091`（`fix: report that this version has no built-in settings UI and align the README`），未 push、未打 tag、未 publish

## 1. WARN 文案（`index.js:702`，只改字符串）

改前：

```
    relayLog(ctx, stateDir, 'warn', `[${PLUGIN_NAME}] 设置卡未挂载：宿主无 settings 服务（跳过，不影响 watch）`);
```

改后：

```
    relayLog(ctx, stateDir, 'warn', `[${PLUGIN_NAME}] 设置卡未挂载：本版本不提供设置卡入口（跳过，不影响 watch）；如需配置请直接改 cordis.patch.yml`);
```

该函数其余行（`getService` 判定、`return` 跳过、后续 schema 分支）一字未动；`index.js` 全文件只有这一行的 ±1 改动（numstat `1 1 index.js`）。`inject` 仍 `export const inject = ['agents'];`。

## 2. 测试断言同步（四处，改后原文）

`index.test.mjs:2018`（用例名，`2020` 断言）：

```
    check('P13 严格 ctx：relay.log 写明「不提供设置卡入口」', () => {
      const log = fs.readFileSync(path.join(p9StateDir(root), 'relay.log'), 'utf8');
      assert.ok(log.includes('不提供设置卡入口'), `relay.log 应有降级说明：${log.split('\n').slice(-4).join(' | ')}`);
    });
```

`index.test.mjs:2123`（反向断言：服务存在时不得出现降级 warn）：

```
      assert.ok(!log.includes('不提供设置卡入口'), '服务存在时不应走降级 warn');
```

`index.test.mjs:2216`（轮询等待 warn 出现）：

```
      try { return fs.readFileSync(path.join(p9StateDir(root), 'relay.log'), 'utf8').includes('不提供设置卡入口'); } catch { return false; }
```

`index.test.mjs:2220`（正向断言）：

```
      assert.ok(log.includes('不提供设置卡入口'), '应写降级 warn');
```

四处都只是子串换成新文案里稳定的一段；正反两向语义保持（2123 仍是 `!includes`，其余三处仍是 `includes`）。没有删断言、没有改成恒真；`index.test.mjs` 改动为 `5 5`（5 行等量替换），用例数不变。

## 3. README

### `README.zh-CN.md`「## 设置页」

按 `.batch/night/staging/readme-settings-section.md` 中文段整节替换（原 `200–209` 行的「从 0.4.0 起贡献一张卡片」整段删除），现文：

```
## 设置页

**当前版本没有内置配置界面**；配置只有一处：profile 的 `cordis.patch.yml` 里本插件那一行的
`config.watches`。内置配置界面在后续版本提供——这一版本先把投递能力做稳，等宿主那边的设置卡
入口（槽位）稳定后再接回界面。

一条 watch 就是 `watches` 数组里的一项，三个键就够：

```yaml
- id: dsh-handoff-relay
  name: dsh-handoff-relay
  config:
    stableMs: 5000
    watches:
      - dir: /absolute/path/to/outbox
        targetSessionId: session-xxxxxxxx
        done:
          text: '<!-- DONE -->'
```

- `dir`：要监控的目录，绝对路径。
- `targetSessionId`：接收通知的会话 id；也可以用 `targetTitle` 按标题匹配代替。
- `done`：完成规则。省略 = 默认文本 `<!-- DONE -->`；`{ text: '...' }` = 自定义文本；
  `{ regex: '...' }` = 正则（只扫文件尾部约 4KB、固定 `m` 标志、上限 200 字符、禁止嵌套量词）；
  `null` = 关闭完成规则，只按静默窗口投递。

改完保存文件，**重启宿主后生效**（本版本不做热更新）。`targetSessionId` 在宿主重启后会变，
用 id 接线的 watch 需要重新接线；用 `targetTitle` 的不用。
```

### `README.md`「## Settings page」

按同稿英文段整节替换（原「From `0.4.0` … contributes a card」删除），现文：

```
## Settings page

**This version has no built-in settings UI.** Configuration lives in one place only:
`config.watches` on the plugin's row in the profile's `cordis.patch.yml`. A built-in
settings UI is planned for a later release: this version stabilises delivery first, and the
UI will be wired back once the host's settings-card slot is stable.

One watch is one entry in the `watches` array, and three keys are all you need:

```yaml
- id: dsh-handoff-relay
  name: dsh-handoff-relay
  config:
    stableMs: 5000
    watches:
      - dir: /absolute/path/to/outbox
        targetSessionId: session-xxxxxxxx
        done:
          text: '<!-- DONE -->'
```

- `dir`: absolute path of the directory to watch.
- `targetSessionId`: the receiving session id; `targetTitle` may be used instead to match by title.
- `done`: the completion rule. Omitted = default text `<!-- DONE -->`; `{ text: '...' }` = custom text;
  `{ regex: '...' }` = regular expression (tail of the file only, ~4 KB; `m` flag always on;
  max 200 characters; nested quantifiers rejected); `null` = no completion rule, deliver on the
  quiet window alone.

Save the file and **restart the host** for changes to take effect (no hot reload in this version).
`targetSessionId` values change across host restarts, so id-based watches must be re-wired after a
restart; `targetTitle`-based ones do not.
```

### 其它段落复核

- 两份 README 的功能列表、安装说明、Who gets notified、Config 表内，逐条 `grep -n "设置卡|插件配置|设置页|Settings page|settings card|plugin settings"` 后未再命中「在插件配置页里改」类句子（本轮读取的这两份 README 内未找到需要改的第二处卡片描述）。
- 安装行：`README.md:168`、`README.zh-CN.md:145` 均 `#v0.4.0` → `#v0.5.0`；两份 README 内无其它 `v0.4.0` 引用（`grep v0.4.0` 命中 0）。
- 未写「已移除界面相关代码」之类表述；`client.js` 与槽位注册代码保留在仓库（本卡未动 `client.js`，numstat 里没有它）。

## 4. P1–P5 原始输出

### P1 `node index.test.mjs`（提交后终跑）

```
TOTAL: 117/117 PASS
RESULT: PASS
```

（exit 0，无 `FAIL` 行；提交前同一读数 `117/117`。）

### P2 `git diff --stat`（提交前）

```
 README.md       | 39 +++++++++++++++++++++++++++++----------
 README.zh-CN.md | 34 ++++++++++++++++++++++++++--------
 index.js        |  2 +-
 index.test.mjs  | 10 +++++-----
 4 files changed, 61 insertions(+), 24 deletions(-)
```

### P3 grep

`grep -n "不提供设置卡入口" index.js`：

```
702: relayLog(ctx, stateDir, 'warn', `[${PLUGIN_NAME}] 设置卡未挂载：本版本不提供设置卡入口（跳过，不影响 watch）；如需配置请直接改 cordis.patch.yml`);
count=1
```

`grep -n "宿主无 settings 服务" index.js`：

```
count=0
```

### P4 README 安装行

`README.md`：`v0.5.0 count=1 | v0.4.0 count=0`

```
168: dsh plugin --profile desktop add github:byfbaish/dsh-handoff-relay#v0.5.0
```

`README.zh-CN.md`：`v0.5.0 count=1 | v0.4.0 count=0`

```
145: dsh plugin --profile desktop add github:byfbaish/dsh-handoff-relay#v0.5.0
```

### P5 `git status --porcelain`（提交前）

```
 M README.md
 M README.zh-CN.md
 M index.js
 M index.test.mjs
```

（提交后为空。）

## 5. 提交

```
$ git rev-parse --short=12 HEAD
16e80a27d091

$ git log -1 --stat
16e80a2 fix: report that this version has no built-in settings UI and align the README

 README.md       | 39 +++++++++++++++++++++++++++++----------
 README.zh-CN.md | 34 ++++++++++++++++++++++++++--------
 index.js        |  2 +-
 index.test.mjs  | 10 +++++-----
 4 files changed, 61 insertions(+), 24 deletions(-)

$ git show --numstat --format= HEAD
29	10	README.md
26	8	README.zh-CN.md
1	1	index.js
5	5	index.test.mjs
```

- `git add index.js index.test.mjs README.md README.zh-CN.md`（点名，未用 `-A`）；未 push、未打 tag。
- `package.json` 未动（version 仍 `0.5.0`）；`client.js` 未动；未重启 DSH；未往 watch 目录写文件。

## 6. 未验证 / 风险

- **真机设置页仍不会出现卡片**：本卡按背景口径只改文案与文档，`index.js` 的挂载路径与 `client.js` 的槽位注册都在 0.2.2-rc.1 上取不到入口。真机行为本轮未验证（禁重启 DSH、禁启用插件），标**不确定**；文案现在说的是「本版本不提供设置卡入口」，与此一致。
- 新 WARN 文案发生在「宿主没有 settings 服务或没有 `settings.register`」这一条分支；若宿主将来恢复了 `settings` 但槽位仍缺，日志会走后面的 `settings.register 失败` 分支而不是这一条——届时的第一条 warn 未必是这句。本轮未按宿主分支逐条取证，标**不确定**。

<!-- DONE -->
