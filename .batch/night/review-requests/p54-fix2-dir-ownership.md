# p54-fix2-dir-ownership 派验单（From 目录归属 + 冲突上报 + 审计字段）

执行方：豆包
派单方：AI writer总负责人 · AI writer项目组 | 6dc4ab20
卡面：`.batch/night/cards/p54-fix2-dir-ownership.md`｜（投出时钉字节＋MD5）
判据件：`.batch/night/staging/handoff-usage-criteria-v4.md`｜10,418B / `540FFF21AAF8C2DEBA6CA5B6EEC07B69`
起点基线：`C:\develop\workspace\dsh-handoff-relay` master @ `40f34b5`
判定范围：`40f34b5..新HEAD`

## 首验第一步（不符即判不通过，不跑套件、不续判）

```
git rev-parse --show-toplevel          # 规范化后 = C:/develop/workspace/dsh-handoff-relay
git branch --show-current              # = master
git rev-parse --short HEAD             # 起点核对：40f34b5 必须是新提交的祖先之一
git ls-files index.js index.test.mjs   # 两文件都必须命中（若是执行方新建的 ⇒ 不通过）
```
报告开头须原样重抄这四条输出。

## C1 交付边界

- `git diff --numstat 40f34b5..HEAD`：文件只允许出现在 `index.js`、`index.test.mjs`、（可选）`README.md`。
- `git -c core.quotepath=false status --porcelain=v1` 为空（无 `M /A /D /R /U` 首列、无未跟踪项）。
- 无 push、无 tag、无 publish、无依赖变更（`package.json` 未在 diff 中）。

## C2 优先级

- 正文首条 `^From:` ＞ 该 watch 的 `fromRole` ＞ `UNKNOWN`。
- 代码位置须给出（函数名＋行号），并说明 `fromRole` 从配置到注入的传递路径。

## C3 冲突上报

- 正文 From 与 `fromRole` 同时存在且不相等 ⇒ 注入正文值；日志出现 `身份冲突 relName=… stub=… watch=…`；条目含 `fromConflict: true`。
- 相等时不得写 `fromConflict`。

## C4 审计字段

- `delivered` 条目含 `watchDir`、`targetSessionId`、`fileHash`、`injectedHeader` 四字段，值与当次投递一致（`fileHash` 必须等于该文件 `sha256` 前 12 位口径，与现内容判重同源）。

## C5 向后兼容

- 旧条目（无新字段）读取不报错、不被清空、不因缺字段被判为重复或非重复。

## C6 剥离

- 注入文本 `^From:` 与 `^To:` 各恰好 1 行（含桩件自带 From/To 的情形）。

## C7 用例

- T1–T6 全过（含 T5 审计四件、T6 旧条目兼容）。

## C8 套件

- `node index.test.mjs` 全绿；总用例数不少于 P54 基线 166，不得删既有用例。QA 须自行复跑一次并记输出。

## C9 反证

- 反证A（去掉 `fromRole` 优先级）⇒ T1 红；反证B（冲突时取目录值）⇒ T3 红。两条都要真红，不得只声明。

## C10 报告格式

- `reports/p54-fix2-dir-ownership-report.md`：首行 `执行方：豆包`；第二行 `model=DeepSeek-V4.1-Flash | 倍率=0.01x | provider=自有(豆包)`；末行 `<!-- DONE -->`（全文恰 1 处）。
- 首验单另存 `reports/p54-fix2-dir-ownership-qa-firstcheck.vN.md`，不得原地覆盖。

## G1 执行方互斥

- 首验单顶部须写 `执行方：QA`；机检：本单 `执行方：豆包` ≠ 首验单 `执行方：QA`。

## 判定口径

- C1–C10 全过 ⇒ 通过；任一不过 ⇒ 不通过并列不符合项，其余照记。
- 只认字节＋MD5 与命令输出，不认行数（行数按 `ReadAllText` 以 `\n` 切分仅作参考）。
