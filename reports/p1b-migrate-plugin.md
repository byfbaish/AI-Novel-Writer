# WB-P1b · 插件搬出 AI-writer、建独立仓库、修正装配

结论：PASS ｜ 产物：`C:\develop\workspace\dsh-file-watch`（5 文件，首个提交 `bcb6c0ed2784c2301b09b64ba0eb7eb895920051`）｜ 判定线：脱敏 0 命中 + 新仓库 6/6 PASS + develop 目录不存在 + 装配无占位符 ｜ 证据：四段输出原文见 §2

> PASS 只对本卡五条判据成立。§6 的遗留属于「重启后是否真的能挂载并叫醒会话」，卡面 Step 7 明确把重启交给主人，故不改动结论，但必须如实列出、待裁决。
>
> 本轮授权：新建/改独立仓库、改 desktop profile 配置、develop 移除提交、可提交（不推送）。
> 未做：未推送、未 `reset`、未 force push、未改写 `fadd95ef`、未改 DSH 本体、**未重启 / 未杀 DSH 进程**、全程未用 `git add -A`（移除用 `git rm -r <点名路径>`）。
> 执行顺序严格 Step 1 → 7，前一步成功后才进下一步；Step 6 是在 Step 1–3 全部通过之后才动的。

## 1. 五条判据逐条核对

| # | 判据 | 结果 | 证据 |
|---|---|---|---|
| 1 | `C:\develop\workspace\dsh-file-watch` 已 `git init` 且有首个提交 | PASS | `Initialized empty Git repository in C:/develop/workspace/dsh-file-watch/.git/`；`bcb6c0e` 5 files changed；`git ls-files` = 5 行 |
| 2 | 新仓库 `node index.test.mjs` = 6/6 PASS | PASS | §2-B：`TOTAL: 6/6 PASS` / `RESULT: PASS` / `TEST_EXIT=0` |
| 3 | 脱敏 grep = 0 命中 | PASS | §2-A：无任何输出行，`GREP_EXIT=1`（grep 无命中的退出码） |
| 4 | `develop/scripts/dsh/wakeup-plugin/` 不存在且 `ls-files` = 0 行 | PASS | §2-C：`dir exists = False` / `ls-files line count = 0` |
| 5 | `cordis.patch.yml` 无占位符、`watchDir` 指向 `wakeup-inbox` | PASS | §2-D：`PASTE_LIVE_SESSION_ID_HERE present = False`、`new watchDir present = True` |

## 2. 四段输出原文

### A · 脱敏自检（Step 2.4，在独立仓库根跑）

```
Command: cd /c/develop/workspace/dsh-file-watch && grep -rniE "AI-writer|Bot|\.batch|2026-11-1|dsh-wakeup|C:\\\\develop" . --exclude-dir=.git ; echo "GREP_EXIT=$?"
Stdout: GREP_EXIT=1

Stderr: (empty)
Exit Code: 0
Signal: (none)
```

`grep` 无命中 ⇒ 零输出行、退出码 1。首个提交**之前**也用同一条命令预检过一次（同样零输出），所以提交历史里不含敏感串。

独立复核者补了一条如实提醒：Git Bash 下命令里的 `C:\\develop` 分支会被路径转换成正斜杠形式，该分支对反斜杠路径不敏感；但复核用「逐词全 0 命中 + 全仓 `C:` 全扫 0 命中 + 已知词 `dsh-file-watch` 能命中 9 行」三重对照，确认这是**真实 0 命中而非假阴性**（仓库里连一个 `C:` 都没有）。判据 3 结论不变。

### B · 新仓库自测（Step 3，`node index.test.mjs`）

```
[16:16:29.749] 场景 A 开始：watchDir=C:\Users\<用户名>\AppData\Local\Temp\dfw-a-fHlJ1R，stableMs=5000
[16:16:32.813] PASS  T1 持续写 3 秒不产生任何 followup
[16:16:38.515] PASS  T2a 停止写 5 秒后产生恰好 1 次
[16:16:38.516]        消息原文：文件 growing.txt 已就绪（触发=stable），请继续。
[16:16:38.516]        消息 JSON：{"id":"913b29e7-ac9c-47b1-98b4-34e29f7c9467","role":"user","content":[{"type":"text","text":"文件 growing.txt 已就绪（触发=stable），请继续。"}],"source":{"kind":"plugin","plugin":"dsh-file-watch"}}
[16:16:38.516] PASS  T4 UserMessage 形状（id/role/content/source）
[16:16:39.718] PASS  T2b calls.length 稳定（不重复触发）
[16:16:39.720] 场景 B 开始：写入含 <!-- DONE --> 的文件
[16:16:40.175]        触发原因："文件 done.txt 已就绪（触发=DONE），请继续。"
[16:16:40.175] PASS  T3 DONE 立即产生 1 次（真实投递耗时 6ms << stableMs=5000ms ）
[16:16:40.638]        日志：[dsh-file-watch] 会话未加载：get(NO-SUCH-SESSION) 返回 undefined，roots() 中亦无匹配；文件 orphan.txt 未投递。当前可用 roots id: []
[16:16:40.638] PASS  T5 会话未加载：写日志、不抛、不投递===== 自测汇总 =====
PASS  T1 持续写 3 秒不产生任何 followup
PASS  T2a 停止写 5 秒后产生恰好 1 次
PASS  T4 UserMessage 形状（id/role/content/source）
PASS  T2b calls.length 稳定（不重复触发）
PASS  T3 DONE 立即产生 1 次（真实投递耗时 6ms << stableMs=5000ms）
PASS  T5 会话未加载：写日志、不抛、不投递
TOTAL: 6/6 PASS
RESULT: PASS
TEST_EXIT=0
```

（末行 `TEST_EXIT=0` 为PowerShell 记录的 node 进程退出码。`PASS T5 ...不投递===== 自测汇总 =====` 处的换行粘连是终端输出的原样，非报告拼接。）

### C · 从 develop 移除并提交（Step 6）

```
=== [BEFORE] all filesystem entries under the dir ===
scripts\dsh\wakeup-plugin\inbox | dir=True | bytes=-
scripts\dsh\wakeup-plugin\cordis.patch.yml | dir=False | bytes=516
scripts\dsh\wakeup-plugin\index.js | dir=False | bytes=11470
scripts\dsh\wakeup-plugin\index.test.mjs | dir=False | bytes=5599
scripts\dsh\wakeup-plugin\package.json | dir=False | bytes=551
scripts\dsh\wakeup-plugin\inbox\.gitkeep | dir=False | bytes=0
=== [BEFORE] 5 tracked files: path + bytes ===
scripts/dsh/wakeup-plugin/cordis.patch.yml  516 bytes
scripts/dsh/wakeup-plugin/inbox/.gitkeep  0 bytes
scripts/dsh/wakeup-plugin/index.js  11470 bytes
scripts/dsh/wakeup-plugin/index.test.mjs  5599 bytes
scripts/dsh/wakeup-plugin/package.json  551 bytes
tracked count = 5
=== git rm -r scripts/dsh/wakeup-plugin ===
rm 'scripts/dsh/wakeup-plugin/cordis.patch.yml'
rm 'scripts/dsh/wakeup-plugin/inbox/.gitkeep'
rm 'scripts/dsh/wakeup-plugin/index.js'
rm 'scripts/dsh/wakeup-plugin/index.test.mjs'
rm 'scripts/dsh/wakeup-plugin/package.json'
=== staged after rm (name-status) ===
Dscripts/dsh/wakeup-plugin/cordis.patch.yml
Dscripts/dsh/wakeup-plugin/inbox/.gitkeep
Dscripts/dsh/wakeup-plugin/index.js
Dscripts/dsh/wakeup-plugin/index.test.mjs
Dscripts/dsh/wakeup-plugin/package.json
staged count = 5
=== [AFTER] checks ===
dir exists                 = False
ls-files lines             = 0
probe report still exists  = True
```

```
[check:fast] typecheck ✓ 37.2s
doc links: checked 1437, broken 0
[check:fast] doc-links ✓ 0.7s
doc placement: 扫描 432 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
[check:fast] 全部通过。
[exp/resource-ledger 0cf92bee] chore(dsh): 移除误入的唤醒插件目录，已迁至独立仓 库 dsh-file-watch
 5 files changed, 428 deletions(-)
 delete mode 100644 scripts/dsh/wakeup-plugin/cordis.patch.yml
 delete mode 100644 scripts/dsh/wakeup-plugin/inbox/.gitkeep
 delete mode 100644 scripts/dsh/wakeup-plugin/index.js
 delete mode 100644 scripts/dsh/wakeup-plugin/index.test.mjs
 delete mode 100644 scripts/dsh/wakeup-plugin/package.json
=== HEAD log -3 ===
0cf92bee (HEAD -> exp/resource-ledger) chore(dsh): 移除误入的唤醒插件目录，已迁 至独立仓库 dsh-file-watch
fadd95ef feat(dsh): WB-P1 唤醒插件最小可用探针（代码级 PASS + 装配待重启）
a960d709 test(h3): 用例自身裸 rmSync 收口改用 discardTree，两文件单跑 EPERM=0
=== HEAD full sha ===
0cf92bee4ac98bd530f999296e8e938566d59cab
=== HEAD changed files ===
0cf92bee (HEAD -> exp/resource-ledger) chore(dsh): 移除误入的唤醒插件目录，已迁 至独立仓库 dsh-file-watch
 scripts/dsh/wakeup-plugin/cordis.patch.yml |   9 -
 scripts/dsh/wakeup-plugin/inbox/.gitkeep   |   0
 scripts/dsh/wakeup-plugin/index.js         | 256 -----------------------------
 scripts/dsh/wakeup-plugin/index.test.mjs   | 136 ---------------
 scripts/dsh/wakeup-plugin/package.json     |  27 ---
 5 files changed, 428 deletions(-)
=== ls-files wakeup-plugin (expect 0 lines) ===
ls-files line count = 0
dir exists = False
=== probe report still tracked ===
reports/p1-wakeup-plugin-probe.md
=== fadd95ef still in history ===
commit
```

提交信息（两个 `-m` 段）：`chore(dsh): 移除误入的唤醒插件目录，已迁至独立仓库 dsh-file-watch` / `fadd95ef 误入 AI-writer 历史；历史保留不改写，内容已迁至独立仓库 dsh-file-watch。`

### D · `cordis.patch.yml` 三项配置校验（Step 5）

```
=== tail 8 of cordis.patch.yml ===

# --- dsh-file-watch -------------------------------------------------------
- id: dsh-file-watch
  name: dsh-file-watch
  config:
    watchDir: 'C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox'
    targetSessionId: 'session-ad0a0ad1-24dd-4d83-ad98-aad562136ae2'
    stableMs: 5000
=== marker checks ===
PASTE_LIVE_SESSION_ID_HERE present = False
old watchDir (wakeup-plugin\inbox) = False
dsh-wakeup-plugin anywhere         = False
new watchDir present               = True
live targetSessionId present       = True
- id / name = dsh-file-watch       = True
=== YAML parse check ===
YAML_OK rows=22 row=[{"id":"dsh-file-watch","name":"dsh-file-watch","config":{"watchDir":"C:\\develop\\workspace\\AI-writer\\develop\\scripts\\dsh\\wakeup-inbox","targetSessionId":"session-ad0a0ad1-24dd-4d83-ad98-aad562136ae2","stableMs":5000}}]
YAML_CHECK_EXIT=0
```

## 3. 移除前抄录的 5 个文件 · 移除后逐条对上

| 路径（`develop/` 下） | 移除前字节数 | 移除后 |
|---|---|---|
| `scripts/dsh/wakeup-plugin/index.js` | 11470 | 新仓库有 `index.js`（11463 B，见下注） |
| `scripts/dsh/wakeup-plugin/index.test.mjs` | 5599 | 新仓库有 `index.test.mjs`（5578 B，见下注） |
| `scripts/dsh/wakeup-plugin/package.json` | 551 | 新仓库有 `package.json`（468 B，见下注） |
| `scripts/dsh/wakeup-plugin/cordis.patch.yml` | 516 | develop 已删；新仓库**没有**（按卡面不复制） |
| `scripts/dsh/wakeup-plugin/inbox/.gitkeep` | 0 | develop 已删；新仓库**没有**（按卡面不复制） |

注：三个源文件是**先复制、哈希校验一致**后才做最小通用化改名（`dsh-wakeup-plugin` → `dsh-file-watch`、清掉卡号字样、默认投递文案改通用），所以字节数较原件变小；测试里的 `source.plugin` 断言同步改了，否则 §2-B 的 6/6 拿不到。README 与 `.gitignore` 是新写的（1874 B / 21 B）。

逐条结论：**该有的有**（3 份源码在新仓库，且自测 6/6），**该删的少了**（两份装配/运行期文件两边都不在），`reports/p1-wakeup-plugin-probe.md` 仍在 git 跟踪中、未被一并删除。

## 4. 装配选择与备份

- **备份先行**（改动前，SHA256 均一致）：`package.json.bak-watch` 2089 B、`cordis.patch.yml.bak-watch` 9841 B。
- **`file:` 依赖写法**：`profiles/desktop/package.json` 的 `dependencies` 加了 `"dsh-file-watch": "file:C:/develop/workspace/dsh-file-watch"`，`dsh.profile.bundles` 末项 `dsh-wakeup-plugin` → `dsh-file-watch`（25 项，旧名已不存在）。
- **装进 `node_modules` 选了「建 junction」，没跑 `pnpm i`**：新建 `node_modules/dsh-file-watch` → `C:\develop\workspace\dsh-file-watch`，`LinkType=Junction`，链接下可见 5 份仓库文件。理由：该 profile 的 dependencies 里有多条 `github:` 源依赖，非交互安装会撞上已记录的 pnpm safe-delete 批量确认闸门、并可能 prune 掉在用依赖；junction 在 P1 探针里已实测「删链接不碰目标源码」。
- **独立仓库的 `package.json`**：`private: true` 已删、`os: ["win32"]` 已删、`license: MIT` 原样保留；`name` 改为 `dsh-file-watch`、`description` 改通用（跟随 bundles 改名，否则 `file:` 依赖解析出的包名与 bundles 对不上，且脱敏 grep 会命中旧名）。

## 5. 重启后怎么验证（本轮不做，由主人执行）

1. 重启 DSH（desktop profile）。**本轮未重启、未杀任何进程。**
2. 看启动日志是否出现这两行：
   ```
   [dsh-file-watch] 已加载：watchDir=C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox，targetSessionId=session-ad0a0ad1-24dd-4d83-ad98-aad562136ae2，stableMs=5000，doneMarker=<!-- DONE -->
   [dsh-file-watch] 当前 live roots id（可填 targetSessionId）：[...]
   ```
   只看到第一行也算已挂载；**两行都没有**先按 §6 卡点 1 排查，再核对 `dsh.profile.bundles` 名与 `node_modules/dsh-file-watch` 链接。
3. 往 `C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox\` 丢一个 `probe.txt`：
   ```
   hello
   <!-- DONE -->
   ```
   带 DONE 标记应在几毫秒内投递，不用等 5 秒。
4. 目标会话应收到一条用户消息，原文：`文件 probe.txt 已就绪（触发=DONE），请继续。`
5. 想验稳定判据：写一个不含 DONE 的文件，连续追加 3 秒不应投递；停手后 5 秒恰好投递 1 次，再等也不重复。
6. 若日志写「会话未加载」，末尾会附 `当前可用 roots id: [...]`；核对 `session-ad0a0ad1-24dd-4d83-ad98-aad562136ae2` 是否在列，不在就换成实际 id。

## 6. 遗留 / 待裁决（不影响本卡五条判据，影响重启后的生效性）

**卡点 1 · 插件行可能进不了配置树（最重要）。** 按卡面 Step 1，新仓库不带插件自带的 patch 文件；但包描述里仍声明了 `dsh.bundle.patch`。DSH 的加载顺序是「空树 → 各插件自带的插入行 → profile 层按名字覆盖配置」，少了插入行，profile 层那条配置就没有可覆盖的对象，重启后很可能看不到加载日志，自然也不会叫醒会话。本轮**没有擅自补文件、也没改 profile 那条的 YAML 形状**（结构性/契约改动先讨论再落地）。三条路请主人选：① 给独立仓库补一个通用 patch 文件，只负责把插件行插进树（插件形态自洽，将来发布给别人也能直接用，推荐）；② 只改 profile 那条，让它连插入带配置一起做（改动最小，但配置与插件分离，不利于发布）；③ 先维持现状重启看日志，确认确实不加载再决定（多一次重启）。证据：`reports/p1-wakeup-plugin-probe.md` §3 的装配链实证、新仓库 `package.json` 的 `dsh.bundle.patch` 字段；§2-D 只证明**配置层写对了**，不证明插件行进了树。

**卡点 2 · 旧链接残留。** `node_modules/dsh-wakeup-plugin` 仍是指向已被移走目录的坏链；因 bundles 已改名，它不会被加载，不影响判据。本轮未删（删 profile 里的链接属卡面未点名的动作），请主人确认后清理；删时只删链接本身，P1 报告已实测不会碰目标源码。

**卡点 3 · 依赖声明与实际装配方式不同步。** `package.json` 按卡面写了 `file:` 依赖，但本轮选 junction、没跑安装，manifest 与 lockfile 此刻不一致。若主人在该 profile 上执行安装，链接可能被清掉；届时改成正式 `file:` 依赖并装一次即可固化。

**卡点 4 · 新建的 inbox 目录未提交。** `develop/scripts/dsh/wakeup-inbox/.gitkeep`（0 B）已建好，但按「本次提交只许动 5 个删除」没进提交，目前是未跟踪文件。要不要纳入版本管理，主人定。

**未触碰**：`docs/README.md` 的既有未暂存修改、`.batch/night/*` 等大量未跟踪文件，均未进入任何提交。

## 7. 独立复核（上下文隔离、只读）

交付前把 5 条判据与相关路径交给一个未参与执行的只读复核者，只给要求与判定线、不给本报告的自述结论，由其自行跑命令取证。回报：**判据 1–5 全部 PASS**；额外确认报告文件存在、四段输出原文齐备（无「应该可以」类推测措辞）、首段 `结论：PASS` / `产物` / `判定线` / `证据` 四要素齐备。复核全程未改文件、未提交、未重启或结束任何进程。
