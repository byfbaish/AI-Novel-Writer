# P39 首验报告 · 设置卡路径框沿标色

- 派验单：`.batch/night/review-requests/P39.md`（19:17:28 登记，1,351B）
- 卡面：`.batch/night/cards/p39-frame-color.md`
- 执行方交付：插件仓库 `C:\develop\workspace\dsh-handoff-relay` 提交 `8e4ad642095e9f239038e86468d9dced459361fa`「feat: color directory input border by probe state」，父 `d535dc148c761b0cc8518ee3d84061b96bdfaefe`
- 交办报告：`.batch/night/staging/p39-frame-color-report.md`（3,502B / 87 行 / `E5E76E4F4EE488E06E54D0CE1647AB6B` / 19:38:59 / 末行 `<!-- DONE -->`）
- 判定：**建议通过（5/5），附两条备注**，终审归负责人

## C1 起点与提交范围 —— 过

- `git rev-parse 8e4ad64^` = `d535dc148c761b0cc8518ee3d84061b96bdfaefe`，与卡面起点一致。
- `git rev-list --count d535dc1..8e4ad64` = **1**，恰一笔提交。
- `git show --numstat` 只有一行：`54	25	client.js`；无测试文件、无 README、无配置。
- 复核时刻 `git status --porcelain` **空**（见备注①）。
- 无新 tag（仍 4 个），未 push（远端另核不算本条）。

## C2 四态渲染与 none 文案 —— 过

`client.js`（HEAD blob `a20ba79af7dc0389fb334aaecf7f0b26bd910c67`）原文逐行：

- 绿沿只有 `ok`：`:244 if (kind === "ok") return { borderColor: "#2e7d32", boxShadow: "0 0 0 1px #2e7d32 inset" };`
- 红沿只有 `bad`：`:245 if (kind === "bad") return { borderColor: "#d33", boxShadow: "0 0 0 1px #d33 inset" };`
- `checking` 与 `none` 同为中性灰：`:246 if (kind === "checking" || kind === "none") return { borderColor: "#9e9e9e", boxShadow: "0 0 0 1px #9e9e9e inset" };`
- `none` 文案：`:253 if (kind === "none") return "宿主未提供目录核验";`（title）与 `:291 kind === "none" ? h("div", { … color: "#9e9e9e" … }, "宿主未提供目录核验") : null`
- 原静默分支已删：diff 中 `-if (kind === "none") return null;`；现文 `none` 不再有 `return null`。
- 样式挂载点：`:278 style: { ...S.input, ...dirFrameStyle(kind), … }`，title 挂载点 `:281 title: title || undefined`。
- 空 `dir` 不标灰：`:259 hasDir`、`:273 const kind = hasDir ? … : "idle"`，`dirFrameStyle("idle")` 走 `:247 return {};`。
- 全文件已无 `DirStatusDot` 残留（`Select-String -Pattern DirStatusDot` 0 命中，`client.js` 673 行）。

## C3 禁改区未动 —— 过

起点 `d535dc1` 与 `8e4ad64` 同文件 blob 逐项比对：

| 文件 | 结果 | blob |
|---|---|---|
| `index.js` | SAME | `8293cc1461341e2d8142b25d932b2b37acbb02a5` |
| `cordis.patch.yml` | SAME | `02261f84a25a9b5a389fc58b7e6675851d70a10b` |
| `package.json` | SAME | `1b04240d94d3b8fe97094cb06224d1717a2eb20b` |
| `README.md` | SAME | `fd5f586a742cd491adb6f62978119ed3a7f862c4` |
| `README.zh-CN.md` | SAME | `9b8f38dc06c19f61515b9451bac7696961b7e456` |
| `client.js` | DIFF | `a20ba79af7dc0389fb334aaecf7f0b26bd910c67` |

## C4 报告落点与内容 —— 过

- 落盘 `C:\develop\workspace\AI-writer\develop\.batch\night\staging\p39-frame-color-report.md`，3,502B / 87 行 / MD5 `E5E76E4F4EE488E06E54D0CE1647AB6B`（与联络人读数一致）。
- 首行同时含起点 HEAD 与提交 SHA：`起点 HEAD：d535dc148c761b0cc8518ee3d84061b96bdfaefe · 提交 SHA：8e4ad642095e9f239038e86468d9dced459361fa`。
- 末行 `<!-- DONE -->`。
- `none` 成因写的是取证结果而非猜测：§3 列出六个返回点（`:208/:213/:215/:217/:230/:234`，我逐行核对全部命中），并明写「本次读取的文件内未找到宿主侧运行态证据，取不到，不猜」。
- 报告行号抽查 10 处（`244/245/246/251/252/253/254/278/281/259-260/273/290/291`）与盘面逐字一致。

## C5 测试 —— 过

`node index.test.mjs` 实际输出末行：

```
TOTAL: 150/150 PASS
RESULT: PASS
EXIT=0
```

- 未删既有用例；P29 d（`:3112`）、P29 e（`:3127`）仍 PASS。
- 说明：按派验单 C5 只要求跑既有套件，本卡未新增用例（见备注②）。

## 备注（不拦，交终审记账）

① **交付时刻 porcelain 非空**：报告 §6 自述提交后 `M .gitignore` / `M README.md` / `M README.zh-CN.md`，`git diff --ignore-space-at-eol --stat` 为空、numstat `1/1`、`289/289`、`251/251`，属 CRLF 行尾差异。我 19:52 复核时 porcelain 已为空，且两 README 与 `.gitignore` 的 blob 与起点相同 ⇒ **无内容污染、提交未受影响**；但「是谁在何时清掉这 3 个改动」无记录，建议记一笔到运维侧（不影响本卡判定）。

② **本卡无用例咬住框沿颜色**：P29 d/e 断言的是「不崩 / 文案」，改色后仍绿，属预期；框沿绿/红/灰本身无单测覆盖，与 P27/P38 同类（UI 形态靠真机）。建议随下次动 `client.js` 时补一条，或在真机轮由负责人合并核。

③ **用例文案与形态不同步**：`index.test.mjs:3112/:3127` 的标题仍写「绿点/红点」「不显示任何点」，实际已是框沿。低风险、不拦，随 ② 一并改。

## 复算命令（可重放）

```powershell
cd C:\develop\workspace\dsh-handoff-relay
git rev-parse 8e4ad64^
git rev-list --count d535dc1..8e4ad64
git show --numstat --format='%H %s' 8e4ad642095e9f239038e86468d9dced459361fa
git status --porcelain
git diff d535dc1..8e4ad64 -- client.js
node index.test.mjs
```
