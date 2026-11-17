
## WorkBuddy 空间只读核对（2026-11-16 作者要求固化）

用途：派 WorkBuddy 任务前/后，只读取证「空间已注册 + 落点正确、最近会话 cwd 对得上」。不占额度、不受投递时间窗限制、不点界面。

- 脚本：`scripts/workbuddy/space-readonly-check.mjs`（仓内）。默认核空间 `wt-p56`、期望路径 `C:\develop\workspace\AI-writer\wt-p56`；`--all` 列全部空间，`--expect <path>` 换期望路径。
- 命令（必须走 Electron 运行时）：
  `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe scripts/workbuddy/space-readonly-check.mjs`
- 退出码：0=PASS / 2=空间缺失（打印全量 LIST）/ 3=路径不一致 / 1=错误。
- 判据两条缺一不可：`spaces` 里有该空间且 active **且** `space_folders` 命中目标目录。`spaces.create_folder_path`（如 `C:\Users\<用户名>\WorkBuddy\spaces\2026_11_16_09-02-07`）是自动建的空目录，不作判据；`space_folders` 落点优先。
- 三条边界：①只读副本（`workbuddy.db` + `-wal` + `-shm` 三件抄到 `%TEMP%\wbdb-*`），不开原库、不用 `?immutable=1`（WAL 模式会忽略 WAL 读到作废快照）；②不点界面、不写库、不改 space；③只输出事实（spaces 行 / 附加文件夹 / 最近 session 的 cwd、model、status）。
- 数据目录：`C:\Users\<用户名>\.workbuddy\workbuddy.db`（同级另有 `edge-sync-mapping-v4.db`）。表清单看脚本里 `listTables()` 输出。
- ABI 坑：系统 Node 24 是 `NODE_MODULE_VERSION 137`，仓库 `better-sqlite3` 按 Electron 的 `145` 编译，直接 `node -e require(better-sqlite3)` 报 `was compiled against a different Node.js version`；要 `ELECTRON_RUN_AS_NODE=1` + `electron.exe`。另：仓库 package.json 是 `type: module`，`.mjs` 属 ESM，用 `require` 会 `ReferenceError: require is not defined in ES module scope`，须 `createRequire(import.meta.url)`。
- Python 备件（无 Electron 时可用）：`.batch/night/tools/wb-spaces-readonly.py`（stdlib sqlite3，`RESULT: PASS`，缺空间退出 2）。
