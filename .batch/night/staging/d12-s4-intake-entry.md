# S4 收口入库条目：D12 流转件四类入库

来源：主身 11-21 23:2x 投件 relay-833e7246（流转件入库面裁定）。
状态：待 S4 收口执行；S1 不因入库未做而阻塞。

## 一、冻结四件（自 11-21 23:2x 到 S4 入库前，任何人不得改任何字节）

| 类别 | 路径 | 行数 | 字节 | sha256 |
|---|---|---|---|---|
| 卡面 | `.batch/night/cards/d12-replay-retry.md` | 223 | 24,236 | `e8942478…96c5` |
| 派验单 | `.batch/night/review-requests/d12-replay-retry.md` | 29 | 3,609 | `31beebe7…d984` |
| QA 判词正本 | `.batch/night/reports/d12-replay-retry-qa-firstcheck.md` | 160 | 13,067 | `2961dedc…3e32` |
| evidence.json | run id `fe9c195b-1cf`（路径见判词正本与 `evidencePath`） | — | — | — |

判据分母依赖这四个 sha：任一改变，判据分母失效、QA 判词 `2961dedc…3e32` 作废。

## 二、执行方式（三条硬要求）

1. 一笔提交，不许拆多笔；`git add` 点名逐个路径，不许 `git add -A`。
2. 提交前跑 `pnpm check:fast` 到末行 `EXIT=0`；不合规先修再提交，不许把违规件塞进去。
3. push 由主身再申请；群里任何人不得 `git push`。

## 三、提交信息

带 `CARD-D12-replay-retry`。

## 四、禁止

- 不新开面（不在 `exp/mainline-1119` 上零星入库）。
- 复跑若 `EXIT≠0`，停手报原文，不许改流转件迁就结果。
