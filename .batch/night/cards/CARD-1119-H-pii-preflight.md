状态：收口
持有者：项目总负责人 · AI writer项目组
可写：否
最后变更：2026-11-20 06:45
卡号：CARD-1119-H
依据件：`org/board-roadmap.md`、Goal stage 3、`.batch/night/org/stage2-disposition-1119.md`

# CARD-1119-H 推送前脱敏前置（stage 3 门槛卡）

## 一、为什么有这张卡

`node <rotation>/pii-scan.mjs --repo . --all-tracked` 在 `058c0867` 上报 **90 个文件 / 289 处**。stage 3 一旦推送，Goal acceptance 4（远端真名 0）在推送后的 origin 头上自己就红，等于自造返工。故本卡必须在合并推送之前过。

## 二、实测分布（2026-11-20 01:35，`--all-tracked`，HEAD `058c0867`）

命中类型：`user-path` 106、`secret` 37、`email` 24、`phone` 14、`privacy-word` 10、`idcard` 9、`name` 9。

按顶层目录（文件数）：`.batch/` 38、`docs/` 15、`scripts/` 14、`electron/` 10、`src/` 9、`reports/` 2、`test/` 1、`pnpm-lock.yaml` 1。

**关键：真名只占 8 个文件 / 17 处，会话日志 1 件 3 处，其余 81 文件 / 269 处是测试夹具与设计字样**（289 − 17 − 3 ＝ 269；90 文件 − 8 − 1 ＝ 81，QA 02:2x 复算一致）。 两类处置完全不同，禁「扫到就批量改」——改测试夹具会打断断言（`secret` 37 处里 `sk-` 开头的两条设计字样是假数据，`email` 里 `@example.invalid` / `@provider-a.example` 是假域）。

## 三、三类处置（逐类逐件，不许合并动作）

### T1 · 真名（8 文件 / 17 处）→ 改占位符

| # | 文件 | 处数 |
|---|---|---|
| 1 | `.batch/night/staging/vn-history-1119/staging/message-admission.v1.md` | 4 |
| 2 | `.batch/night/staging/vn-history-1119/cards/d1-delivered-path.v1.md` | 2 |
| 3 | `.batch/night/staging/vn-history-1119/cards/d1-delivered-path.v2.md` | 2 |
| 4 | `.batch/night/staging/vn-history-1119/cards/d1-delivered-path.v3.md` | 2 |
| 5 | `.batch/night/staging/vn-history-1119/cards/d1-delivered-path.v4.md` | 2 |
| 6 | `.batch/night/staging/vn-history-1119/cards/d1-delivered-path.v5.md` | 2 |
| 7 | `.batch/night/staging/vn-history-1119/org/process-efficiency-assign-1116.v1.md` | 2 |
| 8 | `.batch/night/staging/vn-history-1119/cards/wb-rules-example.v1.md` | 1 |

改法：真名 → `<用户名>`；含家目录前缀的绝对路径一律把用户名段换成 `<用户名>`（Windows 与 macOS 两侧同规矩）。这 8 件都在 `staging/vn-history-1119/`（本阶段新入库件，**不是** stage 1 冻结的 97 件归档物），改字节合规。

### T2 · 会话日志 `tmp-c9ff5961.jsonl` → 移出跟踪面

- 事实：`.batch/night/staging/tmp-c9ff5961.jsonl`，**1,591,957B**，已跟踪（blob `b5cbf42a`），是 CARD-1117-B 一并入库的完整会话日志，含 system prompt 与群内容。
- 处置：`git rm --cached` 移出跟踪面（保留磁盘件）＋ `.gitignore` 增例外一行（写在 `.batch` 反向包含段内，写清注释）；件本体移到 `C:/tmp/pmo-stage2-quarantine/`，同目录 `README.md` 按 B-1e 写六段（谁建／何时／用途／保留期／过期给谁），保留期写「待主人定」。
- 报告须写：原 blob OID、字节数、md5、移动后路径、md5 一致（证明未改字节）。

### T3 · 假数据（其余 81 文件 / 269 处）→ 不改文本，写 `.piiallow`

- 建 `.piiallow`（仓根，机检脚本已支持）：**一行一条正则 ＋ 同一行行尾 `# 依据：…`**，依据写明「测试夹具」「示例假域」「设计字样」等，能指到代码位置就指（`scripts/__tests__/smoke-win-installer.test.ts` 的随机用户名夹具等）。
- `secret` 37 处必须逐条判：属设计字样（`sk-` 开头的设计字样这类）才进 allow；**形如真密钥的（长度/前缀与真实 key 同形）一律删改**，不得进 allow 了事。
- `idcard` 9、`phone` 14、`privacy-word` 10 同理：先在 82 件里逐条列出，报告给一张「kind × 文件 × 处置（改/allow）」表；**不许用 `.piiignore` 整目录掩盖**。

## 四、判据（命令 + 实输出 + exit）

| # | 判据 | 命令 | 通过线 |
|---|---|---|---|
| 1 | 机检清零 | `node "<rotation>/pii-scan.mjs" --repo . --all-tracked` | `0 个文件 / 0 处命中`，exit 0，贴末三行 |
| 2 | 日志件出跟踪面 | `git ls-files | grep -c 'tmp-c9ff5961.jsonl'` | `0` |
| 3 | 日志件留档可复原 | `md5sum C:/tmp/pmo-stage2-quarantine/tmp-c9ff5961.jsonl`；`git cat-file blob b5cbf42a | md5sum`；`ls C:/tmp/pmo-stage2-quarantine/` | 两条 md5 逐字符相同，文件在，报告贴两条命令原文 |
| 4 | allow 有据 | `grep -vE '^[[:space:]]*(#|$)' .piiallow | wc -l`、`grep -c '^# 依据：' .piiallow`、报告表 allow 行数 | 有效行数＝报告表 allow 行数＝带 `# 依据：` 的行数（三者相等）。**读法（2026-11-20 追认）：`^# 依据：` 行首即命中**，不要求 `#` 之前有内容——原写法 `^[^#]*# 依据：` 与两行式相冲，是出卡笔误 |
| 5 | 归档面未动 | `git diff --name-only 058c0867 HEAD -- .batch/night/archive | wc -l`；`git show HEAD:.batch/night/archive/MANIFEST.sha256 | sha256sum` | `0`；若为 `1` 则唯一件必须是 `README.md` 且报告写明非改不可的理由。本卡正常执行应为 `0`（只动 `staging/` 与 `.gitignore`）。哈希仍 `ab1119a2…` |
| 6 | 机检与门禁 | `node scripts/ops/check-batch-hygiene.mjs --all`；`pnpm check:fast` | `0 项不合规` EXIT=0；末行 `EXIT=0` |
| 7 | 工作区干净 | `git status --porcelain -uall | wc -l` | `0` |

### §四 注解（2026-11-20 01:45 补，判据 1 的读取口径）

1. **判据 1 的通过线读作**：`--all-tracked` 报告 `0 个文件 / 0 处命中` 且 `EXIT=0`。这个 0 是 **`.piiallow` 生效之后**的 0——假数据不靠改文本清零，靠 allow 正则收敛；allow 行数与报告表行数必须对得上（判据 4）。
2. **分母含卡面与台账自身**：本卡与 `org/BACKLOG.md` 也在扫描面内。QA 01:4x 实测本卡原含 5 处、台账 1 处字面量（`sk-` 字样与家目录示例），我 01:45 已改成 `sk-<占位>`／家目录占位写法；`--text` 复扫两件均 exit 0。自此规矩：**写卡时不许把命中字面量抄进卡面**，只写「某文件某行某类型」。
3. 若清理过程中发现某件既不是真名也不是可授权的假数据（例如真密钥），**停下报我**，不进 allow、不等同 T3。

## 五、红线

1. `git push`／`--force`／`rebase`／`merge`／`reset --hard`。
2. 改 `.batch/night/archive/` 下 96 件字节或 `MANIFEST.sha256`。
3. `git add -A`／`git add .`／`-f`。
4. 用 `.piiignore` 整目录或整文件掩盖；把真密钥或真名写进 allow 正则。
5. 改 notice、`AGENTS.md`、`src/` 业务逻辑（`src/` 只许改命中的字面量）。
6. 删除 quarantine 里的任何件。

## 六、判词落点

`.batch/night/reports/CARD-1119-H-qa-firstcheck.md`；判据 1 只认计数与 exit，判据 4 认「allow 行数＝表行数」。

## 七、交付后

本卡 PASS 后才谈合并推送。推送仍只由主身或授权执行人做（Goal rules 第 2 条）。

**2026-11-20 收口**：QA 首验 PASS（受判 `adb17d44`，判词 `.batch/night/reports/CARD-1119-H-qa-firstcheck.md`）；我终审通过；合并 `eba81c43`（`--no-ff` 入 `exp/mainline-1119`）；主身推送至 `eb4bd364`（未 force）。四笔裁定与判据 4 读法见 `.batch/night/review-requests/CARD-1119-H-rulings.md`。
