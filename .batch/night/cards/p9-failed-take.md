# 卡 P9：投递后移走失败的止血（重试 + 不再重投 + 最小日志）

## 背景（已取证，勿重复调研）

- 投递语义是「先投消息，再把源文件 move 进 `delivered/<dirKey>/`」，靠 move 本身做持久化去重（`index.js:30-31`、`takeDelivered:97-120`）。
- 内存 `Set`（`index.js:302`、`345-346`）重启即空，所以 **move 失败 = 该文件每次重载都会被再投一次**。
- 现场（本机，2026-11-13 21:54 那次）：`.batch\night\signals\doubao\wake-later.done`（176B，md5 `EAE979C60EFCAE0F25758B2593E71229`）投递成功，`delivered\dad6df13f302\` **目录已创建但是空的**，源文件仍在原地；同目录手工 `Move-Item` 成功 ⇒ 不是权限/占用，最可能是「建目录与 rename 的顺序/竞态」或 rename 瞬时失败后不重试。
- `takeDelivered` 失败只 warn、不重试、不落盘（`:116-119`），本机又没有插件日志 ⇒ 事后无法定位。
- 7 条 watch 的 `dir` 与 `delivered/` 零重叠，`index.js:56-61` 防自激闸未触发 ⇒ 配置没问题。

## 现场说明（重要，已由 developer 复现否决）

- 21:54 那次现场**不能给代码定性**：`delivered\dad6df13f302` 目录 mtime 比源文件 ctime 晚 6ms（成功 rename 过一次的痕迹），但现在目录是空的、源文件在原地且 ctime 未变；`.__rename_test` 是负责人（我）手工 probe 造成的污染，`%TEMP%` 干净实测也证明「文件被占用导致 rename 失败」不成立（Node 用 FILE_SHARE_DELETE）。
- 因此本卡**不预设根因**。第一条产出的核心价值是**让 warn 能落盘**，凭日志再定性三个候选：`index.js:351`、`:363`、`:101-111`。

## 目标（只修这一条链路，不扩功能）

1. `takeDelivered`：目标目录**先 `mkdir -p` 再 rename**；rename 失败**重试 3 次**（间隔 100ms，可用短 sleep），仍失败才 warn。
2. **失败也不许重投**：新增 `<profile 根>/dsh-handoff-relay/failed.json`，记录 `{ finger, name, dirKey, at, err }`（finger 与现有一致：`dir|relName|mtime|size`）。加载期 `consider()` 命中该 finger 时**跳过投递**并记一行 warn。该文件最多保留 200 条，超出按 `at` 删最旧；坏档整表丢弃 + warn；写失败只 warn 不阻塞。
3. **最小日志**：`<profile 根>/dsh-handoff-relay/relay.log`，追加写，只在三条路径写行（启动、move 失败、跳过已失败件），每行 `ISO 时间 + 级别 + 消息`；文件超过 256KB 时截断保留末尾一半。不加配置项、不加日志级别。
4. 不动 `source`（`index.js:296` 附近，按内容核验不按行号）、不动 watches 解析、不动 `delivered/` 清理逻辑。

## 判定线（QA 首验按此判）

1. 新增测试证明：rename 前先建目录；第一次 rename 抛错时重试并在第二次成功（可用注入 stub/临时目录模拟），最终文件确实在 `delivered/<dirKey>/`。
2. 新增测试证明：rename 三次全失败时写入 `failed.json`，且**再次加载同一文件不会二次投递**（消息只发 1 次）。
3. 新增测试证明：`failed.json` 超过 200 条按 `at` 裁掉最旧；坏 JSON 不抛、只 warn。
4. `relay.log` 在 move 失败时确有对应行；超过 256KB 会被截断。
5. `TOTAL:` 行不许低于 69/69；`source:` 与父提交逐字相同；porcelain 只有本次两个文件。

## 边界

- 只改 `index.js`、`index.test.mjs`；`git add` 点名这两个文件，禁 `-A`；不 push。
- **绝对落点（必读，别按相对路径解析）**：仓库根是 `C:\develop\workspace\dsh-handoff-relay`，改的是 `C:\develop\workspace\dsh-handoff-relay\index.js` 与 `C:\develop\workspace\dsh-handoff-relay\index.test.mjs`。不是 `AI-writer\wt-1`，也不是 `AI-writer\develop`，也不是 `.runtime\_tmp\asar-out\` 里的任何副本。开工先 `cd C:\develop\workspace\dsh-handoff-relay` 再动手。
- 开工基线：`git -C C:\develop\workspace\dsh-handoff-relay rev-parse --short HEAD` 应为 `6563d27`，`git status --porcelain` 应为空（我 22:02 实测：HEAD `6563d27`、porcelain 空、`index.js` 24,052B）。不是这个基线就先停下回传。
- 报告写 `.batch\night\reports\p9-failed-take.md`，末行 `<!-- DONE -->`；信号 `.batch\night\signals\doubao\p9-failed-take.done`，三行：报告路径、提交 SHA、`<!-- DONE -->`。
- 不许重启 DSH、不许往生产 watch 目录丢测试文件（一律用临时目录）。
- 报告 `.batch/night/reports/p9-failed-take.md`，末行 `<!-- DONE -->`；另落信号 `.batch\night\signals\doubao\p9-failed-take.done`。
- 估时：60 分钟（含四类新测试）。
- 交付时**不要**顺手清理现存那件 `signals\doubao\wake-later.done`，留给重启后验「不再重投」用。
