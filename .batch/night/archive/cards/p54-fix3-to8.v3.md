# To 行身份段修复（D-TO8 ＋ To 标题段为空）

派单方：AI writer总负责人
派单时刻：2026-11-15 16:17（本地）
版本：v2（v1 `cards/p54-fix3-to8.md` 标题行误带占位串，未投出、已作废；正文内容与 v1 相同）
类型：A 改码（须提交）
执行方：豆包
通道：豆包联络人转投（`To:` 只写「豆包 · 主身/群分身」，不写 session id）

---

## §0 工作目录 / 分支 / 起点 SHA（硬字段，缺一不许开工）

| 项 | 值 |
|---|---|
| 工作目录 | `C:\develop\workspace\dsh-handoff-relay` |
| 分支 | `master` |
| 起点 SHA | `f41b0312d89a50493943706b488b8773aaaa0eec` |

### 开工前三项校验（逐条贴命令原文＋原始输出，缺一即停）

1. `git -C C:\develop\workspace\dsh-handoff-relay rev-parse HEAD` → 必须等于 `f41b0312d89a50493943706b488b8773aaaa0eec`
2. 目标文件存在：`index.js`、`index.test.mjs` 均在仓根
3. diff 双空：`git diff --numstat HEAD` 与 `git diff --ignore-cr-at-eol --stat HEAD` 均无输出；
   另读 `git diff --cached --numstat` 也须为空。判据只认这三条，**不用** `git status --porcelain` 作准（行尾差异会假阳）。

三项任一不符：停手、在群里报差异、不自行 checkout/stash/还原。

## §1 问题（两条同根，一张卡修）

- **D-TO8**：注入行的 `To:` 第二段输出字面量 `session-`。
  根因 `index.js:1290`：`String(resolved.id).slice(0, 8)`，而 id 形如 `session-8ea61110-…`，前 8 字符恒为 `session-`。
  修法：先剥前缀再取八位十六进制；前缀不存在时保持原行为。
- **To 标题段为空**：两次实证 `to=session-|大肥鱼|主身`、`to=session-|豆包联络人 · AI writer项目组|群分身`，标题段空。
  要求：目标会话标题解析不出时，写可判的占位（如 `unknown-title`），不得留空段；不得因此改变 From 注入行为。

## §2 验收判据（QA 首验逐条核）

1. 单测：`node index.test.mjs` 全绿，且新增用例数 ≥ 2（D-TO8 一例、空标题一例），基线为 174。
2. 反证两条，须真红（改坏实现后分别 FAIL，改回即绿）：
   - A：仍按 `slice(0,8)` 取 id → 断言 `To:` 第二段为八位十六进制的用例 FAIL；
   - B：标题为空时仍输出空段 → 空标题用例 FAIL。
3. 机检样例：注入行须匹配 `^To: +\S.* \| [0-9a-f]{8} \| (主身|群分身)$`（用真实 id 形如 `session-8ea61110-…` 构造）。
4. 提交后 `git diff --numstat f41b031..HEAD` 只含 `index.js`、`index.test.mjs`（是否动 README 由执行方自选，动了要单列）；
   提交后 `git diff --numstat HEAD` 与 `--ignore-cr-at-eol --stat HEAD` 双空。
5. 不得改动 `client.js`、`package.json`、`cordis.patch.yml`、`docs/`。

## §3 禁改区

- 不得改主人 profile 下任何文件（`~/.dsh/**`、`cordis.patch.yml` 实例配置）。
- 不得 push、不得打 tag、不得改 origin。提交只落本地。
- 不得改 P54/P54-fix2 的任何已交付件（报告、判据、台账）。

## §4 交付物

1. 提交：一个提交，message 以 `fix: ` 开头，正文写明 D-TO8 与空标题两条。
2. 报告：`.batch/night/reports/p54-fix3-report.md`，首行 `执行方：豆包`，次行 `model= | 倍率= | provider=`，
   末行 `<!-- DONE -->`；须含 §0 三项校验原文、§2 五条实测输出、提交 SHA。
3. 信号：`.batch/night/signals/doubao/p54-fix3.done`，一行「卡号 / 提交 SHA / porcelain 双空 / 报告路径」，末行 `<!-- DONE -->`。

## §5 边界

- 只改本卡 §1 两条；顺手重构、顺手修别的缺陷、顺手改格式一律不算交付。
- 发现第三个缺陷：停手报，不自行扩范围。

<!-- DONE -->
