状态：放行
持有者：项目总负责人 · AI writer项目组（已放行）
可写：否
最后变更：2026-11-19 21:1x（项目总负责人 · AI writer项目组）
卡号：CARD-1119-E
依据件：`cards/CARD-1119-E-hygiene-archive-exempt.md`

# CARD-1119-E 派验单 · 尾行规则对 `.batch/night/archive/` 豁免

派单方：项目总负责人 · AI writer项目组｜派单时刻 2026-11-19 20:1x
执行方：developer · AI writer项目组｜受验：提交 `<sha>` ＋ 报告 `.batch/night/reports/CARD-1119-E-report.md`
首验方：QA · AI writer项目组（判词 `.batch/night/reports/CARD-1119-E-qa-firstcheck.md`）

## 一、受理前置

1. 报告首行 `执行方：developer`、第二行 `model= | 倍率= | provider=`、末行 `<!-- DONE -->`。
2. 八条判据逐条给「命令 + 实输出 + exit」，不许只写「已通过」。
3. 判据 4 必须两条输出都在：改后 `--all` = 0 项；把 `EXEMPT_TRAILING_DIRS` 临时置空后仍报 8 项（反证）。

## 二、判据（八条，与卡面 §四 同源）

| # | 判据 | 通过线 |
|---|---|---|
| 1 | 新增 `EXEMPT_TRAILING_DIRS`，**运行时解析值**为 `[".batch/night/archive/"]`（源码可写模板字面量） | 贴源码行 + `node -e` 解析值两行 |
| 2 | `EXEMPT_VERSIONED_DIRS` 未被改动、仍含 `staging/` | 贴源码行 |
| 3 | 单测全绿且含「archive 不报」「staging 照报」两向 | 贴用例名 + passed 数 |
| 4 | 在 `78d56ea0` 临时树上：改后 `--all` = 0；置空豁免后仍 8 项（7 缺末行 + 1 连续空行结尾） | 两条输出 + exit |
| 5 | 本线 `--all` 不回归 | `0 项不合规` EXIT=0 |
| 6 | `node scripts/check-fast.mjs` | `全部通过` EXIT=0 |
| 7 | 提交面：`.batch/` 路径 0、`f8728c8d..<sha>` 计数 1 | 贴输出 |
| 8 | 报告三处格式齐 | 逐字一致 |

## 三、红线（六条，与卡面 §五 同源）

1. 改 `archive/` 内文件字节或删件。
2. 豁免面溢出 `archive/`（尤其 `staging/`／`cards/`／`reports/`）。
3. 顺手改 `EXEMPT_VERSIONED_DIRS`、`--disk`、退出码、修法行文案。
4. `git add -A`／`git add .`／`-f`／`--force`／push／rebase／merge。
5. 工作区遗留临时克隆或反证件。
6. 未跑判据 4 反证就报完成。

## 四、首验口径（给 QA，不用猜）

- 判据 4 的临时克隆由执行方自建自清；QA 可用同一手法复跑一次，**不必重跑全量测试**。
- 判据 3 若因工作区缺 `node_modules` 改在 `develop` 跑，**不算缺陷**，但报告须写清在哪跑、为什么。
- 「F 卡判据 8 曾是空集通过」这条背景不作为本卡判据，只作报告须写明的说明项。
- 打回只给最小修法，不要求重写卡面已定的三件事之外的内容。

## 五、判据 1 与判据 4 的口径订正（2026-11-19 20:2x，QA 提出、我采纳）

- **判据 1 不再按字面匹配常量值**：源码写模板字面量 `` [`${WATCH_ROOT}/archive/`] `` 与 `:37-38` 既有写法一致，按字面核会误判。正确读法＝**运行时解析值**必须是 `[".batch/night/archive/"]`，取证两行（源码行 + `node -e` 打印）。卡面 §四.1 已同步。
- **判据 4 的 8 项构成**按 QA 实测写死：**7 件缺末行**（`identity-roster` 的 `v2`／`v3.8`／`v3.9`／`v3.10`／`v3.11`／`v3.12`／`v3.13`）＋**1 件连续空行结尾**（`identity-roster.v3.1.md`）。两者同由 `checkTrailingNewline` 产出，豁免须覆盖两种形态；只要「缺末行」一种不算过。
- 另记 QA 的旁证：`hygiene-baseline.txt` 只冻结旧路径 `.batch/night/roster/…`、**不含** `archive/…`，所以 `78d56ea0` 上 `--all` 确实会报这 8 项——卡面前提成立，不需要 baseline 变动。
