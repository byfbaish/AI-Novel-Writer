# 【已作废 2026-11-14】README「设置页」段替换稿（**禁止使用**）

> 作废原因：主人 11-14 明确「内置配置界面属核心功能、必须交付」，界面本期就做。
> 本稿里的「当前版本无内置界面」口径已错，**不得贴进 README、不得按本稿改文档**。
> 留档仅作历史。现行口径见 `.batch/night/essays/p22-interaction-spec.md`（P22 交互规格）。
> 作废后仍有效的部分：`done` 四态与正则四限的事实描述、id 重启后需重接的提醒（P22a 之后该提醒也将失效）。

（以下为历史原文）

用途：替换 `README.zh-CN.md` 第 200–209 行「## 设置页」整节、`README.md` 第 234–246 行「## Settings page」整节。
口径（11-15 修订）：**「当前版本无内置界面」≠「不做界面」**。必须写成「当前版本没有内置界面，配置见 `config.watches`，内置界面在后续版本提供」；不许出现「本插件不做界面 / no UI by design / 永久不提供界面」这类表述。现有段落写着「0.4.0 起贡献一张卡片」，与本版本事实不符，整节替换、不局部修补。

---

## 中文段（替换 README.zh-CN.md「## 设置页」全节）

```markdown
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

## 英文段（替换 README.md「## Settings page」全节）

```markdown
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

## 给发版卡的两条提醒

1. 若仓库里已有「## Settings page / ## 设置页」以外的段落描述卡片（如功能列表、安装说明里的 bullet），一并核一遍，别只替换这一节留下自相矛盾的说法。
2. `client.js` 与槽位注册代码保留在仓库不删（扩展层不动），因此文档里不要写「已移除界面相关代码」。
