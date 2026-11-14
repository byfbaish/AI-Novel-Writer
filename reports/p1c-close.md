# WB-P1c · P1b 收口报告

结论：PASS ｜ 产物：C:\develop\workspace\dsh-file-watch（6 文件，提交 8ae8695）｜ 判定线：bundle patch 在 + 死链已清 + 6/6 PASS + 脱敏 0 命中 ｜ 证据：见下方四段输出原文（① 装配链 ② 自测 ③ 脱敏 ④ 提交）

> 全 sha：`8ae869591898ef1f39047edee908cb7a7795af0f`（`master`，父提交 `bcb6c0e`）
> 本轮只做到「配置齐、文件在、测试过」。**插件尚未被当前 DSH 进程加载，未做真实投递验证**，故本报告不宣称「能装上」。

## 一、本轮动作（按顺序）

| Step | 动作 | 结果 |
|---|---|---|
| 1 | 从 develop 历史只读取出 `fadd95ef:scripts/dsh/wakeup-plugin/cordis.patch.yml`，写入新仓库 | 保留 `- insert:` 结构与三行正文；`id` / `name` 两行改为 `dsh-file-watch`；注释整体重写为通用机制说明（只讲 bundle patch 分层与按 id 覆盖，不出现内部项目名 / 卡号 / 内部路径 / 内部插件名） |
| 2 | 删除死链 `node_modules\dsh-wakeup-plugin`（Junction，目标目录已不存在） | 用非递归删除只移除链接本身；同目录包数 266 → 265（delta = 1），目标目录状态前后均为 `False`，未动其他包 |
| 3 | `node index.test.mjs`；核对 desktop patch 段 | 6/6 PASS、退出码 0；`id` 与 bundle insert 一致，`watchDir` / `targetSessionId` 均为真值、无占位符 |
| 4 | 脱敏自检 + 复核 `.gitignore` | 根目录 0 命中，`.gitignore` 0 命中，内容仅 `node_modules/` 与 `inbox/` |
| 5 | `git add cordis.patch.yml` + 提交 | `docs: add bundle patch layer` → `8ae8695`，工作区干净 |

新仓库 `cordis.patch.yml` 全文（11 行，判定 ① 的直接证据）：

```yaml
# Bundle patch layer for a cordis-based plugin bundle.
# A bundle can ship its own patch file through the `dsh.bundle.patch` field in
# package.json. Loader layers are applied in order: each bundle's `insert`
# entries add plugin rows to the tree, then the profile patch layer can
# override a row's config by matching its id.
# This layer only inserts the row; config values are set in the profile patch
# and matched by the same id.
- insert:
    - id: dsh-file-watch
      name: dsh-file-watch
      config: {}
```

## 二、四段证据原文

### ① 装配链（Step 2 + Step 3.2）

```
=== BEFORE ===
sibling count = 266
dsh-wakeup-plugin LinkType = Junction
dsh-wakeup-plugin Target   = C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-plugin
target dir exists = False
action = deleted junction only (non-recursive)
=== AFTER ===
dead link exists = False
sibling count = 265
sibling delta = 1
target dir exists = False
dsh-file-watch junction Target = C:\develop\workspace\dsh-file-watch
Test-Path node_modules\dsh-file-watch\index.js = True
Test-Path node_modules\dsh-file-watch\cordis.patch.yml = True
```

desktop profile `cordis.patch.yml` 末段（Step 3.2，id 一致 + 真值 + 无占位符）：

```
# --- dsh-file-watch -------------------------------------------------------
- id: dsh-file-watch
  name: dsh-file-watch
  config:
    watchDir: 'C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox'
    targetSessionId: 'session-ad0a0ad1-24dd-4d83-ad98-aad562136ae2'
    stableMs: 5000
```

### ② 自测 6/6 PASS（Step 3.1）

```
=== node index.test.mjs ===
[16:36:16.311] 场景 A 开始：watchDir=C:\Users\<用户名>\AppData\Local\Temp\dfw-a-riSu46，stableMs=5000
[16:36:19.464] PASS  T1 持续写 3 秒不产生任何 followup
[16:36:25.175] PASS  T2a 停止写 5 秒后产生恰好 1 次
[16:36:25.175]        消息原文：文件 growing.txt 已就绪（触发=stable），请继续。
[16:36:25.175]        消息 JSON：{"id":"73673130-950f-4495-ab50-4ee5b3d0e6cf","role":"user","content":[{"type":"text","text":"文件 growing.txt 已就绪（触发=stable），请继续。"}],"source":{"kind":"plugin","plugin":"dsh-file-watch"}}
[16:36:25.175] PASS  T4 UserMessage 形状（id/role/content/source）
[16:36:26.377] PASS  T2b calls.length 稳定（不重复触发）
[16:36:26.379] 场景 B 开始：写入含 <!-- DONE --> 的文件
[16:36:26.845]        触发原因："文件 done.txt 已就绪（触发=DONE），请继续。"
[16:36:26.845] PASS  T3 DONE 立即产生 1 次（真实投递耗时 6ms << stableMs=5000ms ）
[16:36:27.310]        日志：[dsh-file-watch] 会话未加载：get(NO-SUCH-SESSION) 返回 undefined，roots() 中亦无匹配；文件 orphan.txt 未投递。当前可用 roots id: []
[16:36:27.310] PASS  T5 会话未加载：写日志、不抛、不投递===== 自测汇总 =====
PASS  T1 持续写 3 秒不产生任何 followup
PASS  T2a 停止写 5 秒后产生恰好 1 次
PASS  T4 UserMessage 形状（id/role/content/source）
PASS  T2b calls.length 稳定（不重复触发）
PASS  T3 DONE 立即产生 1 次（真实投递耗时 6ms << stableMs=5000ms）
PASS  T5 会话未加载：写日志、不抛、不投递
TOTAL: 6/6 PASS
RESULT: PASS
TEST EXIT CODE = 0
```

### ③ 脱敏自检 0 命中（Step 4 + 终态复核）

```
=== Step 4: Select-String -Path .\* -Pattern "AI-writer|Bot|\.batch|2026-11-1|dsh-wakeup|C:\\develop|WB-P" -Exclude "*.git" ===
HIT COUNT = 0
=== .gitignore content ===
node_modules/
inbox/
=== .gitignore HIT COUNT = 0 ===
=== root files (incl. hidden) ===
.git
.gitignore
cordis.patch.yml
index.js
index.test.mjs
package.json
README.md
=== git status --short ===
?? cordis.patch.yml
```

终态复核（提交后再跑同一条 grep，仍 0 命中）：

```
=== final desensitization re-check ===
HIT COUNT = 0
=== final assembly re-check ===
dsh-wakeup-plugin exists = False
dsh-file-watch\index.js = True
dsh-file-watch\cordis.patch.yml = True
```

### ④ 提交（Step 5）

```
warning: in the working copy of 'cordis.patch.yml', LF will be replaced by CRLF the next time Git touches it
[master 8ae8695] docs: add bundle patch layer
 1 file changed, 11 insertions(+)
 create mode 100644 cordis.patch.yml
=== HEAD sha ===
8ae869591898ef1f39047edee908cb7a7795af0f
=== git log -2 ===
8ae8695 (HEAD -> master) docs: add bundle patch layer
bcb6c0e feat: initial import of dsh-file-watch plugin
=== git status --short (empty = clean) ===
=== tracked file count ===
6
=== tracked files ===
.gitignore
README.md
cordis.patch.yml
index.js
index.test.mjs
package.json
=== HEAD diff stat ===
8ae8695 (HEAD -> master) docs: add bundle patch layer
 cordis.patch.yml | 11 +++++++++++
 1 file changed, 11 insertions(+)
```

## 三、五条判据逐条对照

| # | 判据 | 结果 | 证据 |
|---|---|---|---|
| 1 | `cordis.patch.yml` 存在，`id`/`name` 均为 `dsh-file-watch`，不含内部字样 | PASS | §一全文 + §二③（该文件也在 grep 扫描范围内，0 命中） |
| 2 | `node_modules\dsh-wakeup-plugin` 死链不存在 | PASS | §二① `dead link exists = False` |
| 3 | `node_modules\dsh-file-watch` 能解析到 `index.js` 与 `cordis.patch.yml` | PASS | §二① 两条 `Test-Path ... = True`（junction Target 指向新仓库） |
| 4 | `node index.test.mjs` = 6/6 PASS | PASS | §二② `TOTAL: 6/6 PASS` / `RESULT: PASS` / 退出码 0 |
| 5 | 脱敏 grep = 0 命中，并附新提交 sha | PASS | §二③ `HIT COUNT = 0`；§二④ `8ae869591898ef1f39047edee908cb7a7795af0f` |

反例逐条排除：未重启 / 未杀 DSH 进程；未删 junction 目标目录（前后 `target dir exists = False` 未变）、未删同目录其他包（delta 恰为 1）；报告贴出 `Test-Path` 原文而非「应该能装上」；`cordis.patch.yml` 的 id 已是 `dsh-file-watch`；脱敏 0 命中，不存在「有命中却说不影响」。

### 独立复核签字（上下文隔离）

按项目 T0，另派一名**只读复核员**：只给判定线与三个路径，不给本轮结论、做法或本报告内容，禁止任何写操作。其独立重跑取证结论：五条判定线**全部 PASS**、附加核对全部符合、**无 FAIL**。其取到的 HEAD 同为 `8ae869591898ef1f39047edee908cb7a7795af0f`、`git status --short` 为空、已跟踪 6 文件；`N\dsh-file-watch` 的 `LinkType=Junction` / `Target=C:\develop\workspace\dsh-file-watch` / `Attributes=Directory, ReparsePoint` 亦由其独立确认。

## 四、边界与未做

- 未重启、未杀死任何 DSH 进程；未往 `wakeup-inbox` 丢文件做真实投递测试。
- 未改 develop 仓库任何提交、未把插件本体搬回 develop；develop 侧本次只新增本报告文件（`reports/p1c-close.md`，未纳入索引、未提交）。
- 未 `git push` / force push / `reset` / `amend` / 改写历史；未改 DSH 本体目录。
- desktop profile 的 `cordis.patch.yml` 本轮**未改动**（原已含 `dsh-file-watch` 段且值正确，仅做只读核对）。
- 新仓库提交信息与新增文件内容均为通用描述，未写入卡号、内部名、内部路径或背景叙述。

## 五、待主人执行（不在本轮授权内）

1. 重启 DSH，让 bundle patch 层进入装配链。
2. 重启后往 `wakeup-inbox` 丢一个文件，验真实投递（当前进程未加载该插件，现在丢无人接收）。
