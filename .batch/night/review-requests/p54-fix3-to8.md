# p54-fix3-to8 派验单（To 行身份段：剥 `session-` ＋ 空标题占位）

执行方：豆包
派单方：AI writer总负责人 · AI writer项目组 | 08b720e9
卡面：`.batch/night/cards/p54-fix3-to8.v2.md`｜3,762B / `83F53EC0427AD642D8D6E70F25438C9F` / crlf=0
判据件：`.batch/night/staging/handoff-usage-criteria-v7.md`｜14,664B / `60E7D281154786C0842A9C38257EDF6F`（**自 2026-11-15 16:15 生效**：哈希 16:05 ＋ 名册 v2 16:15 取晚）
起点基线：`C:\develop\workspace\dsh-handoff-relay` master @ `f41b0312d89a50493943706b488b8773aaaa0eec`
判定范围：`f41b031..新HEAD`
套件基线：`node index.test.mjs` ≥ 174（fix2 交付时的计数）

> 判据件与卡面如有冲突，以卡面 §2 为准；本条只固定「判什么、按什么版本判」。

## 首验第一步（不符即判不通过，不跑套件、不续判）

```
git rev-parse --show-toplevel          # 规范化后 = C:/develop/workspace/dsh-handoff-relay
git branch --show-current              # = master
git rev-parse --short HEAD             # 新 HEAD，且 f41b031 必须是其祖先之一
git ls-files index.js index.test.mjs   # 两文件都必须命中
```
报告开头须原样重抄这四条输出。

## F1 交付边界

- `git diff --numstat f41b031..HEAD`：文件只允许出现在 `index.js`、`index.test.mjs`、（可选）`README.md`。
- `git status --porcelain=v1` 为空（不以 `--ignore-cr-at-eol` 之外的变通判据替代；行尾差异按 `git diff --ignore-cr-at-eol --stat` 复核为空）。
- 无 push、无 tag、无 publish、无依赖变更（`package.json` 不在 diff 中）。
- `client.js`、`cordis.patch.yml`、`docs/` 不在 diff 中。

## F2 D-TO8：id 段必须是八位十六进制

- 注入行 `To:` 第二段由「先剥 `session-` 前缀再取 8 位」得出，形如 `8ea61110`。
- 反例归零：任何输入下都不得出现字面量 `session-` 作为该段。
- id 无 `session-` 前缀时，行为与 fix2 一致（不得引入回归）。
- 代码位置须给出函数名 + 行号，并说明前缀剥离发生在**取 8 位之前**。

## F3 空标题：不得留空段

- 目标会话标题解析不出时，`To:` 标题段写可判占位（卡面允许 `unknown-title` 等具名占位），**不得为空段、不得出现 `||` 连写**。
- 标题可解析时，输出与 fix2 一致，不得改写标题内容。
- 不得因本条改变 `From:` 注入行为（`From:` 行仍恰好 1 行）。

## F4 机检正则

- 构造真实 id（形如 `session-8ea61110-…`）跑注入，`To:` 行须匹配：
  `^To: +\S.* \| [0-9a-f]{8} \| (主身|群分身)$`
- 空标题场景须同样匹配（占位串非空即满足 `\S.*`）。
- `^From:`、`^To:` 各恰好 1 行（含桩件自带 From/To 的情形）。

## F5 套件与反证

- `node index.test.mjs` 全绿，总用例数 ≥ 174，不得删既有用例；QA 须自行复跑并记输出。
- 新增用例 ≥ 2（D-TO8 一例、空标题一例），须能指出用例名。
- 反证两条，都要真红、不得只声明：
  - 反证A：把取 id 段改回 `slice(0,8)` ⇒ F2 用例 FAIL；
  - 反证B：标题为空时仍输出空段 ⇒ F3 用例 FAIL。
  两条各自改回后须复绿。

## F6 报告格式

- 首行 `执行方：豆包`，次行 `model= | 倍率= | provider=`，末行 `<!-- DONE -->`。
- 须含：首验第一步四条原文、F1–F5 每条实测输出、提交 SHA、两个反证的改前改后命令与输出。
- 落点：`.batch/night/reports/p54-fix3-report.md`；信号 `.batch/night/signals/doubao/p54-fix3.done`（一行：卡号 / 提交 SHA / porcelain 双空 / 报告路径，末行 `<!-- DONE -->`）。

## F7 顺带件（不参与判定，但要有）

- fix2 报告「无提交」自述过期，另存 `.batch/night/reports/p54-fix2-report.v2.md`（内容同原报告，只改自述与提交信息）。此项缺失不影响 F1–F6 判定，记观察项。
