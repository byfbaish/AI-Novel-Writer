# P4 卡面 · done 完成规则四态 + 启动校验（不依赖上下文，照此执行）

## 0. 本项目是什么（先读这段，别去猜）
仓库：`C:\develop\workspace\dsh-file-watch`（将来改名 `dsh-handoff-relay`，**本卡不改名**，身份里仍是 `dsh-file-watch`）。
一个零依赖的 DSH 插件，ESM 单文件实现（`index.js`，197 行），无构建、无打包。
它监视一个或多个目录，当目录里某个文件「写完了」，就往该目录配置的目标会话投 **一条** 消息。
现有能力：多目录多目标（每个目录一条 watch），`stableMs` 稳定判定（文件 size+mtime 连续 N 毫秒不变才算写完），可选完成标记 `<!-- DONE -->`。
当前测试基线：`node index.test.mjs` → 31/31 PASS。**这 31 条一条都不许删、不许改判定语义。**
**一条例外**（见 §1.5）：其中「自定义 doneMarker」这条钉的是即将删掉的旧键，必须改写。

## 1. 只做这五件事
1. 给每条 watch 加 `done` 完成规则，支持四种状态（见 §2）。
2. `done` 命中只是**加速投递**：命中就走，不等 stableMs；未命中仍按 `stableMs` 稳定后投。**不许变成「必须命中才投」。**
3. 加载时对每条 watch 做 `targetSessionId` 校验：能解析出会话标题就通过；解析不到就 `warn`，日志里带上该 watch 的 `dir`，**不影响其他 watch 继续工作**（零新增依赖）。
4. 加载时每条 watch 记一行日志，说明它最终落在哪种模式：`default` / `text` / `regex` / `off`。
5. 删掉全局 `doneMarker` 键与它的一切痕迹（见 §1.5）。

## 1.5 现状与目标的差（照这个改，别自己找）
- `index.js:11` `const DONE_MARKER = '<!-- DONE -->';` 会被 §2 每 watch 的 `done` 取代。
- `index.js:12` `const TAIL_BYTES = 2048;` —— 旧值 **2048**，§3 要求 **4096**，改常量并把值写死为 4096。
- `index.js:23` `tailHasDone(full, size, marker)` 现在只认字符串。要扩成能判定三种判据（text / regex / off），调用点有 3 处：`index.js:107`、`index.js:111`、`index.js:132`。**三处都要走新逻辑，漏一处就是没做完。**
- `index.js:158` `doneMarker: config && typeof config.doneMarker === 'string' && config.doneMarker ? config.doneMarker : DONE_MARKER,` 是旧键的唯一入口，**整行删掉**，不许保留兼容分支。
- 还有两行日志在打印旧键，一起改掉（换成打印该 watch 最终落在哪种 `done` 模式）：
  - `index.js:150` `... stableMs=${cfg.stableMs}，doneMarker=${cfg.doneMarker}`
  - `index.js:188` `... stableMs=${cfg.stableMs}，doneMarker=${cfg.doneMarker}`
- **`index.test.mjs:284-300` 有一组「自定义 doneMarker」用例**（`L290` 传 `doneMarker: '<!-- FIN -->'`，`L296` 的 `check('自定义 doneMarker 命中即投递，默认标记不再立即投递', ...)`）。这条钉的是要删掉的键，**必须改写**：同一条用例改成用 `done: { text: '<!-- FIN -->' }` 表达同样的判定（自定义标记命中即投、默认标记不再立即投），断言强度不许降。改写后 PASS 条数不变，**不许直接删掉这条**。
- README 里若写了 `doneMarker`，同步改成 `done`（`README.md` / `README.zh-CN.md` 都要看）。

## 2. 配置 schema（唯一权威，按这个写）
```yaml
stableMs: 5000            # 全局，数字，毫秒
watches:
  - dir: 'C:\...\inbox-a'
    targetSessionId: 'session-xxxx'
    done: { text: '<!-- DONE -->' }
  - dir: 'C:\...\inbox-b'
    targetSessionId: 'session-yyyy'
    done: { regex: '^## 章末' }
  - dir: 'C:\...\inbox-c'
    targetSessionId: 'session-zzzz'
    done: null
```
`done` 四种状态：
- **省略**（不写这个键）→ 默认 `{ text: '<!-- DONE -->' }`，当加速判据
- `{ text: '...' }` → 文本判据（文件尾部出现该字符串即命中）
- `{ regex: '...' }` → 正则判据
- `null`（写了键但值为空，YAML 里是 `done:` 或 `done: null`）→ 关闭完成规则，只按 `stableMs` 投递
**不新增 `enabled` / `mode` 之类的键**，四种状态靠「键在不在 / 值是什么键」区分。全局 `doneMarker` 已经删了，不许恢复、不许留兼容分支。

## 3. 正则四条硬约束（必须实现，且各有测试）
1. **只扫文件尾部 4096 字节**，不许全文读——日志类大文件每轮全文扫会拖慢宿主。
2. 固定带 `m` 标志编译（`new RegExp(src, 'm')`）。
3. 模式串限长 ≤ 200 字符，且拒绝嵌套量词（形如 `(a+)+`、`(x*)*`）——防灾难性回溯卡死事件循环。
4. 超限或编译失败：**只跳过这一条 watch**（这条 watch 退回只按 stableMs 投递），`warn` 出来，不影响其他 watch。

## 4. 不许碰的地方
- `index.js:48` 这一行，一字不改（真机已验证这个形状被当前宿主接受，改了就崩接收方会话）：

  ```js
      source: Object.freeze({ kind: `plugin:${PLUGIN_NAME}` }),
  ```

  pin 住的是**形状**：`kind` 的值必须正好是 `` `plugin:${PLUGIN_NAME}` `` 这个模板串，`Object.freeze` 不许去掉，不许换成 `{ kind: 'plugin', plugin: ... }`、不许拆成多行改写法、不许加别的键。
- `watches` 数组的解析与遍历结构（多条 watch 各自独立的方式）。
- `~/.dsh/profiles/desktop/cordis.patch.yml`（本机在用，改它会热重载线上插件）。
- 不许重启 DSH；不许往 `scripts\dsh\wakeup-inbox` 里丢文件测投递（会真的唤醒别人的会话）。

## 5. 测试要求
在 `index.test.mjs` 里为每条判定线各加测试（现有风格：断言具体值，不写「大概有」）：
- 省略 `done` → 默认文本命中提前投递；文本不出现则按 stableMs 投
- `{ text }` → 命中/不命中各一条
- `{ regex }` → 命中/不命中各一条；`m` 标志生效一条（多行文本中第二行命中）
- `done: null` → 忽略完成标记，只按 stableMs
- 尾部截断：命中串落在第 4097 字节之前（头部）→ 不算命中；落在尾部 → 命中
- 正则超长 / 编译失败 → 该 watch 跳过、其他 watch 照常、有 warn
- 失效 `targetSessionId` → warn 且不抛错，其他 watch 照常
最后必须跑：`node index.test.mjs`，输出 TOTAL 全 PASS、RESULT PASS、exit 0（新增条数不限，旧的 31 条要在）。

## 6. 提交与产物
- 改完点名提交：`git add index.js index.test.mjs`（README 若要同步说明 `done` 四态，就再点名 `README.md README.zh-CN.md`）。
- **禁止 `git add -A` / `git add .`**；不许 `git push`；不许改 `.gitignore`。
- 报告写到：`C:\develop\workspace\AI-writer\develop\.batch\night\reports\p4-done-rules.md`
  - 第一节写 `结论：PASS/FAIL ｜ 提交：<sha>` ｜ 测试：TOTAL n/m
  - 正文逐条对应 §1–§5，每条给出改在哪个函数/哪一行、对应哪条测试
  - 最后一行必须是 `<!-- DONE -->`
