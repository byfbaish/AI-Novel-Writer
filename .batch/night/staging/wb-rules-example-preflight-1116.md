# WB-01 投前留证（不越护栏的准备工作已完成部分）

执行方：workbuddy联络人
时间：2026-11-16 06:05（本机 CST）
结论一句话：**除「投出去」这一步，其余投前检查全部做完并留证；唯一未解＝归属护栏。**

## 1. CDP 通道（通）

```
curl -s http://127.0.0.1:9333/json/version
{"Browser": "Chrome/138.0.7204.251", "Protocol-Version": "1.3",
 "User-Agent": "... WorkBuddy/5.11.3 Chrome/138.0.7204.251 Electron/37.10.3 ..."}
```

## 2. 目标空间（存在、路径正确）

`~/.workbuddy/workbuddy.db` → `spaces` 表：

| 字段 | 值 |
|---|---|
| name | `dsh-group-rules-prompt` |
| primary_folder_path | `C:\develop\workspace\dsh-group-rules-prompt` |
| create_folder_path | `C:\Users\…\WorkBuddy\spaces\2026_11_16_05-24-57` |
| source_kind | `user`（主人手建） |
| id | `2e04df79-9e01-4a11-b2d7-0b8f2e908b5d` |

## 3. 该窗口已投任务数（1 条，干净可复用）

`sessions` 表 where `cwd like '%dsh-group-rules-prompt%'`：

| id | model | status | created_at |
|---|---|---|---|
| `8ac906da-8c7e-499a-8d42-e169c278bef1` | `deepseek-v4.1-flash` | completed | 2026-11-16 05:24:57 |

对照：wt-2 空间 26 条（历史积压，不复用）。

## 4. 目标仓起点（干净）

`C:\develop\workspace\dsh-group-rules-prompt`：

- `git rev-parse --short HEAD` = `951c39f`，分支 `master`
- `ls-files` 7 项：`LICENSE`、`README.md`、`README.zh-CN.md`、`cordis.patch.yml`、`lib/index.js`、`lib/index.test.mjs`、`package.json`
- `git status --porcelain` 空（QA 05:4x 复核口径同）
- `git remote -v` **空**（无 origin，推送卡另议）

## 5. 卡面（已落盘、机检过）

- 路径：`.batch/night/cards/wb-rules-example.v1.md`
- 6,983B / MD5 `62BCF6EFDDC61E31E0CE82B307FC0706`
- From/To 机检：`sed -n '1p' | grep -qE '^From:'` 与 `sed -n '2p' | grep -qE '^To:'` 同时为真 → `FromTo=MACHINE-OK`
- 硬字段齐：§0 工作区前置（六项校验＋R4 双空）、§3 落点与禁改区、§4 G1–G6、§5 交付物与信号、§6 派验单

## 6. 唯一卡点（原文照抄）

```
$ node scripts/workbuddy/workbuddy-attach.mjs status --cwd "C:\develop\workspace\dsh-group-rules-prompt"
[refuse] 目标目录不在本通道的固定归属里：
  请求=C:\develop\workspace\dsh-group-rules-prompt
  归属=C:\develop\workspace\AI-writer\wt-2
（WorkBuddy 固定用 wt-2，见 docs/agents/worktree-parallel.md §3.1；确需排障时加 --force，并在报告里写明）
```

负责人 06:02 已定：**不许 `--force`**，护栏报警即停手上报。本文件即停手留证。

## 7. 已核出的护栏实现事实（供 developer 取证省一轮，免重复搜索）

| 位置 | 事实 |
|---|---|
| `scripts/workbuddy/workbuddy-attach.mjs:65` | `const DEFAULT_CWD = path.resolve(REPO_ROOT, '..', 'wt-2')` —— **裸常量，无环境变量、无配置文件、无参数覆盖** |
| `scripts/workbuddy/workbuddy-attach.mjs:817` | `cwd: path.resolve(options.get('cwd') ?? DEFAULT_CWD)` —— 仅 `--cwd` 可换请求值 |
| `scripts/workbuddy/workbuddy-attach.mjs:831` | `checkPinnedCwd({ cwd: args.cwd, pinnedCwd: DEFAULT_CWD, force: args.force })` —— 归属值恒为常量 |
| `scripts/workbuddy/attach.mjs:483-495` | `checkPinnedCwd`：`samePath(cwd, pinnedCwd)` 精确相等才放行，否则一律 refuse |
| `scripts/workbuddy/attach.mjs:376-380` | `samePath`：只做分隔符归一＋去尾斜杠＋小写，**不做前缀/父子目录匹配** |

推论（留待 developer 定性，我不下判定）：归属只能整路径相等，所以「把插件仓登记进去」在现有实现里没有受支持的入口——不存在清单文件或配置项；改动必落到 `:65` 常量或 `checkPinnedCwd` 的匹配语义。

## 8. 不越护栏还能先做的（剩余清单）

1. 信号文件模板预写（命中 `<!-- DONE -->` 走快通道）——待卡可投时与卡同投。
2. 推送卡卡面——尚未收到；需先定仓库公开/私有与凭据。
3. 落点核对命令块——已写进卡面 §0，投出后照抄执行即可。

## 9. 文件自证

- 路径：`.batch/night/staging/wb-rules-example-preflight-1116.md`
- 本文件不写死自身 MD5：写入即改变哈希，自引用必然失效。核验时现场取 `wc -c` 与 `md5sum` 为准。

<!-- DONE -->
