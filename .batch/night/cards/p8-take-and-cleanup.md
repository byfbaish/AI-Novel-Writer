# 卡：投递后「拿走」+ 旧件清理（取代落盘去重表）

## 基线

- 仓库 `C:\develop\workspace\dsh-handoff-relay`，HEAD `f33748ea3ac3679ecc9c261e9650f3cd0e12b456`，`git status --porcelain` 无输出
- 现有测试 `node index.test.mjs` = `TOTAL: 67/67 PASS`（**一条都不许删**）
- 上一轮提交 `8514269` 加了「落盘去重表」。这一卡要把这套机制**换掉**：改为投递成功后把文件物理移走，状态表整体退役。理由见下。

## 为什么换

「已投」这个状态可以由文件系统本身承载：文件被移走，就不会再被扫到，重启、热重载都天然不重放。这样少一份状态文件、少一套损坏/裁剪/多 profile 共用的逻辑，插件的边界也收回到「只认文件在不在」。

## 要做的事

1. **投递成功后移动文件**
   - 目标目录：`<profile 根>/dsh-handoff-relay/delivered/<dirKey>/<原文件名>`，`dirKey` 用 watch 目录路径的稳定短哈希（如 sha1 前 8 位或 12 位），不要用下标、不要用可读长路径。
   - 必须保留原文件名，便于事后对照。
   - 移动即「取走」：成功后 watch 目录里不再有该文件。
   - `.gitkeep` 永不移动。
2. **移动失败降级**：只 `warn`，投递照常，不重试、不阻塞。下次重载可能再投一次——这是可接受的降级方向（宁可多投，不可不投）。
3. **退役状态表**：删除 `8514269` 引入的落盘表与 `DSH_RELAY_STATE_FILE` 相关的测试钩子；代码里不再有任何去重表写入。状态文件若已存在（本机还没生成），不用管、不删用户文件。
4. **旧件清理（防无限膨胀）**
   - 每次成功移动后顺带清理 `delivered/`：超过 **1000 个文件**删最旧，或单个文件超过 **7 天**删掉。
   - 只清理 `delivered/` 目录自己的内容，绝不碰 watch 目录。
   - 清理失败只 `warn`，不影响投递。
5. **一个目录一个目标**：加载时若发现两条 watch 规范化后指向同一目录，**只保留第一条**（按配置顺序），对第二条 `warn` 说明「一个目录只支持一个目标，多播需走发布订阅模式，本期不支持」。不要两条都跑。
6. **加载日志**：每条 watch 打一行，含最终目录、目标（id 或 title）、done 模式、`delivered/` 目标路径。

## 禁改

- `source:` 那一行逐字不许动（按内容核验，别按行号）
- 配置 schema 不加字段、不加 `watchId`、不加清理阈值配置（1000 / 7 天写死）
- 不碰 `cordis.patch.yml`、`package.json`（version 不动）、README、`docs/`
- 不引入依赖（零依赖）、不许 restart/push/tag、不许往 watch 目录丢探针

## 判定线

1. `TOTAL:` 行不低于 `67/67`；新增测试覆盖：①移走后再次扫描不再投 ②移动失败只 warn 且投递照常 ③清理阈值（>1000 删最旧、>7 天删）④同目录两条 watch 只保留第一条并 warn ⑤停机期间就存在的文件启动后仍投一次 ⑥`.gitkeep` 不被移动。
2. 代码里没有任何去重表读写；`delivered/` 与 watch 目录不重叠（日志能看出）。
3. 提交只含 `index.js` 与 `index.test.mjs`；`porcelain` 落盘后为空。
4. 报告附 `TOTAL:` 行原文与 exit code。

## 提交

`git add index.js index.test.mjs`；`git commit -m "feat: move delivered files out of the watch dir and prune old ones"`。禁止 `-A`、禁止 push。

## 产物

- 提交 SHA
- `.batch/night/reports/p8-take-and-cleanup.md`：改动说明、`delivered/` 最终路径、清理规则、测试 `TOTAL:` 行，末尾 `<!-- DONE -->`
- `.batch/night/signals/doubao/p8-take.done`：三行（产物路径 / SHA / `<!-- DONE -->`）
