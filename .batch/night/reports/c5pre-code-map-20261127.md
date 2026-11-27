# C5-pre 21 处抛点码映射（入库副本）· 2026-11-27

来源：豆包回执 `C:\tmp\up-c5pre\doubao\receipt-to-owner.md` §2.1（`C:\tmp` 会被清，把这张表挪进仓里留档）。
落码提交：wt 内 `23dba664b` → 主线 cherry-pick `0e1a73901`（3 文件 +610/−32）。
QA 首验判词：`.batch/night/review-requests/e89400e9-qa.md`（提交 `5ece33e1f`，通过）。
静态固化：新用例把「21 处抛点一一带码」写死（`throw new Error(` = 0、`throw grantError(` = 21、每码恰 1 次）。

## §2.1 21 处码映射表

| 新行 | 原行 | 码 | 中文文案（逐字保留） |
|---|---|---|---|
| 116 | 78 | `EXTERNAL_FILE_GRANT_PATH_ABSOLUTE` | 外部文件授权的相对路径不能是绝对路径 |
| 119 | 81 | `EXTERNAL_FILE_GRANT_PATH_INVALID_NUL` | 外部文件授权的相对路径无效 |
| 122 | 84 | `EXTERNAL_FILE_GRANT_PATH_TRAVERSAL` | 外部文件授权的相对路径不得包含父目录遍历 |
| 131 | 93 | `EXTERNAL_FILE_GRANT_PATH_INVALID_NORMALIZE` | 外部文件授权的相对路径无效 |
| 148 | 110 | `EXTERNAL_FILE_GRANT_TARGET_DIRECTORY_NOT_FOUND` | 外部文件授权目录必须是已存在的目录 |
| 165 | 127 | `EXTERNAL_FILE_GRANT_TARGET_FILE_NOT_FOUND` | 外部文件授权目标必须是已存在的文件 |
| 189 | 151 | `EXTERNAL_FILE_GRANT_TARGET_PARENT_NOT_FOUND` | 外部文件授权的父目录必须是已存在的目录 |
| 192 | 154 | `EXTERNAL_FILE_GRANT_PATH_INVALID_CHILD_NAME` | 外部文件授权的相对路径无效 |
| 233 | 195 | `EXTERNAL_FILE_GRANT_INVALID_TTL_MS` | 外部文件授权有效期必须为正数 |
| 237 | 199 | `EXTERNAL_FILE_GRANT_INVALID_MAX_USES` | 外部文件授权使用次数必须是正整数 |
| 275 | 237 | `EXTERNAL_FILE_GRANT_SCOPE_MISMATCH_EXACT_PATH` | 外部文件授权范围不符 |
| 283 | 245 | `EXTERNAL_FILE_GRANT_TARGET_CHANGED_EXACT_PATH` | 外部文件授权目标已变化 |
| 292 | 254 | `EXTERNAL_FILE_GRANT_SCOPE_MISMATCH_DIRECTORY` | 外部文件授权范围不符 |
| 297 | 259 | `EXTERNAL_FILE_GRANT_TARGET_CHANGED_DIRECTORY` | 外部文件授权目标已变化 |
| 309 | 271 | `EXTERNAL_FILE_GRANT_UNKNOWN_GRANT` | 外部文件授权不存在或已失效 |
| 313 | 275 | `EXTERNAL_FILE_GRANT_EXPIRED` | 外部文件授权已过期 |
| 316 | 278 | `EXTERNAL_FILE_GRANT_EXHAUSTED` | 外部文件授权已用尽 |
| 319 | 281 | `EXTERNAL_FILE_GRANT_WINDOW_MISMATCH` | 外部文件授权不属于当前窗口 |
| 322 | 284 | `EXTERNAL_FILE_GRANT_OPERATION_NOT_GRANTED` | 外部文件授权未授予 `{operation}` 操作（模板串原样） |
| 329 | 291 | `EXTERNAL_FILE_GRANT_EXACT_SUBPATH_REJECTED` | 精确文件授权不接受子路径 |
| 332 | 294 | `EXTERNAL_FILE_GRANT_TARGET_INVALID` | 外部文件授权目标无效 |

码名口径：21 处一一对应、互不复用（同名文案的两处也各自独立，如 NUL／规范化失败、两处「范围不符」按调用面拆成 EXACT_PATH／DIRECTORY）。码表以 `EXTERNAL_FILE_GRANT_ERROR_CODES`（`as const`）导出，类型由它反推，抛点写错码直接编译失败。
