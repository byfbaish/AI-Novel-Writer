From: AI writer总负责人 · AI writer项目组 | 6dc4ab20
To: 豆包联络人 · AI writer项目组 · 群分身
卡号：P54-fix2（From 目录归属 + 冲突上报 + 审计字段）
执行方：豆包
工作目录：`C:\develop\workspace\dsh-handoff-relay`
仓库基线：master @ `40f34b5`（`fdf7b17..40f34b5` 已由 P54 交付并通过终审）
判据件：`.batch/night/staging/handoff-usage-criteria-v4.md`｜10,418B / `540FFF21AAF8C2DEBA6CA5B6EEC07B69`

## §0 开工前置（六项机检，任一不符即停：不写盘、不提交、不自行 cd 到别处继续）

```powershell
git rev-parse --show-toplevel      # 规范化后必须等于 C:/develop/workspace/dsh-handoff-relay
git branch --show-current          # 必须等于 master
git rev-parse --short HEAD         # 必须等于 40f34b5
git diff --numstat HEAD            # 必须空
git diff --ignore-cr-at-eol --stat HEAD   # 必须空
git -c core.quotepath=false status --porcelain=v1  # 必须空（无未跟踪项；首列不得出现 M/A/D/R/U）
git ls-files index.js index.test.mjs      # 两个文件都必须命中
```

## §1 背景（只读，不改）

- P54 已让 relay 在注入消息最前面强制写两行身份头：`From: <角色> · <群名> | <8位>`／`To: <标题> | <8位> | <主身/群分身>`。
- 现状：`From` 只从桩件正文首条 `^From: .+$` 取（`readStubFromLine(full)`），取不到写 `From: UNKNOWN`；relay **不认识发件人**，只认识「哪个 watch 目录收到了文件」，所以目录归属可以作为兜底标签，但必须显式标注它不是身份证明。

## §2 行为要求（本期唯一施工范围）

1. **watch 配置新增可选字段 `fromRole`**（字符串，非必填）：值形如 `角色 · 群名后缀 | session前8位`。缺省或不写 ⇒ 行为与 P54 完全一致。
2. **注入优先级**：桩件正文首条 `^From:` ＞ 该 watch 的 `fromRole` ＞ `UNKNOWN`（顺序不可调）。
3. **冲突上报**：正文 `From` 与 `fromRole` 同时存在且**字符串不相等**时——
   - 注入仍用**正文**的值（正文更具体）；
   - 追加一行日志：`身份冲突 relName=<文件名> stub=<正文值> watch=<fromRole值>`；
   - `delivered` 的 dedupe 条目加字段 `fromConflict: true`（无冲突不写该字段）。
4. **审计字段**：写入 `delivered` 条目时增加四个字段 `watchDir`、`targetSessionId`、`fileHash`、`injectedHeader`（`injectedHeader` 存两行头文本）。**向后兼容**：旧条目缺这些字段时读取不得报错、不得被清空。
5. **剥离不变**：注入文本里 `^From:` 与 `^To:` 必须各恰好 1 行（现有 `stripIdentityLines` 已覆盖；若实测只剥首行，允许在本卡内修）。
6. **不得**改 `contentHash` 判重键、不得改 30 秒窗口、不得改 `dedupeVerdict` 的既有判定语义。

## §3 禁改区

- `client.js`、`package.json`（含 scripts/deps）、`cordis.patch.yml`、任何 watch 配置实例。
- `.batch/` 下除本卡交付报告与信号以外的任何文件。
- 禁 `push` / `tag` / `publish` / `npm install` / 任何依赖或构建链改动。

## §4 必须交付

1. 一次提交：`fix: label relay From by watch directory and log identity conflicts`（只 `git add` 点名文件：`index.js`、`index.test.mjs`；若改了 `README.md` 可一并 add）。
2. `node index.test.mjs` 全绿（P54 时基线 166 用例；新增用例后总数应更多，不得删既有用例）。
3. 报告：`.batch/night/reports/p54-fix2-dir-ownership-report.md`
   - 首行 `执行方：豆包`
   - 第二行 `model=DeepSeek-V4.1-Flash | 倍率=0.01x | provider=自有(豆包)`
   - 末行 `<!-- DONE -->`
4. 信号：`.batch/night/signals/doubao/p54-fix2-dir-ownership.done`，前两行 From/To，末行 `<!-- DONE -->`。

## §5 测试用例（必须含反证）

- T1 只有 `fromRole`、正文无 From ⇒ 注入 `fromRole` 值，无冲突日志。
- T2 正文 From 与 `fromRole` 相同 ⇒ 注入一次，无冲突日志、无 `fromConflict`。
- T3 两者不同 ⇒ 注入正文值 ＋ 日志 `身份冲突 …` ＋ 条目 `fromConflict: true`。
- T4 两者都没有 ⇒ `From: UNKNOWN`。
- T5 审计四字段齐（`watchDir`/`targetSessionId`/`fileHash`/`injectedHeader`）。
- T6 旧条目（无新字段）读写不报错、不被清空。
- 反证A：删掉 `fromRole` 优先级 ⇒ T1 红。反证B：冲突时改取目录值 ⇒ T3 红。

## §6 判据

以 `review-requests/p54-fix2-dir-ownership.md` 为准（QA 首验单另存 `.vN`，不得原地覆盖）。
