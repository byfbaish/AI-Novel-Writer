# P15 QA 首验 · 卡片括号错修复

- 卡号：P15（`p15-fix-relay-card-render`）· 派验人：AI writer总负责人 · 派验时刻 2026-11-14 01:39
- 仓库：`C:\develop\workspace\dsh-handoff-relay` · 提交 `848c26d`（父 `26ba94c`，未 push）
- 结论：**PASS**（代码级）。页面可见性仍待 developer 的隔离实例截图，本条不替代真机验收。

## 1. 提交与范围

| 项 | 实测 |
|---|---|
| `git rev-parse HEAD` | `848c26d1b1f720951cd89cb530bce9eb79dd12ec` |
| 父提交 | `26ba94c7444ad014306db2fae522220f86c7c366` |
| `git status --porcelain` | 空 |
| `git show --numstat` | `2 2 client.js`、`83 0 index.test.mjs`（只两文件） |
| `client.js` diff | 恰好两处：`:172` `…"删除")),` → `…"删除"),`；`:189` `…h("span", null, ""))),` → `…h("span", null, ""))))` |

没有动 `index.js`、`package.json`、`cordis.patch.yml`，`relay` 投递链路与 `source:` 行未受影响。

## 2. 自测（新代码）

```
TOTAL: 113/113 PASS
RESULT: PASS
exit=0
```
原有 111 条一条未删，净增 2 条（`P15 卡片渲染：rows.map 回调真执行，不抛 ReferenceError`、`P15 卡片渲染：doneKind 分支节点按行出现（text/regex 各一，off 无）`）。

## 3. 旧代码必红（我独立反证，不采信报告）

把 `git show 26ba94c:client.js` 写回工作区后跑同一套：

```
FAIL  P15 卡片渲染：rows.map 回调真执行，不抛 ReferenceError :: 渲染抛错：row is not defined
+ ReferenceError: row is not defined
+     at p15Render (file:///C:/develop/workspace/dsh-handoff-relay/index.test.mjs:2318:18)
FAIL  P15 卡片渲染：doneKind 分支节点按行出现（text/regex 各一，off 无） :: Cannot read properties of null (reading 'tree')
TOTAL: 111/113 PASS
RESULT: FAIL
exit=1
```

与真机控制台同一条错误（`ReferenceError: row is not defined`），说明用例不是空转。

## 4. 用例是否真执行 `rows.map` 回调体

`index.test.mjs` 新增块用 `vm.runInNewContext` 载入 `client.js` 源文本，桩 `createElement` 会**求值函数 child**（`children.map((c) => typeof c === 'function' ? c() : c)`），`React.useState` 返回快照，`apply({ settingsScope, slots })` 捕获注册的组件后直接 `card({ scope })`。

断言：行节点（带 `key` 的 `div`）恰 3 个；`placeholder === '<!-- DONE -->'` 的 input 恰 1；`placeholder === '正则，如 ^done$'` 恰 1；`type === 'checkbox'` 恰 3。不是「组件能导出/能调用」级别的 smoke。

## 5. 字节口径（记，不拦）

`core.autocrlf=true`、仓库无 `.gitattributes`。`git checkout` 后工作区 `client.js` 为 CRLF 9,232B / MD5 `D05605C18DD5AE04C1696AF3342A3F35`；联络人报的 9,021B / `C32194E764B7C08588EDCEF86F182342` 是 LF 形态。两者 `git hash-object` 同为 `e76141cf2a4349a9fb7a27fc7f1e4ce1823d980a`，与 `HEAD:client.js` 相等 ⇒ 内容一致，差异只是 smudge。后续核对字节用 blob 或 `hash-object`，别用工作区 md5 横比。

## 6. 尚未满足的判定项

- 「插件配置」页出现该插件自己的卡片：需 developer 起隔离实例，用 browser-skill 截图；同时记录网络面板里加载的 `/plugins/dsh-handoff-relay/client.js?rev=…` 与改动前不同（`?rev=` 不是内容哈希，不能由 md5 反推）。
- 截图未到之前，本卡按代码级 PASS 计，不算真机通过；插件继续停用、`0.4.1` 继续冻结。

## 7. 复现命令

```powershell
cd C:\develop\workspace\dsh-handoff-relay
git log --oneline -2
git status --porcelain
git show --numstat --format='%H %s' HEAD
node index.test.mjs
# 反证：
Copy-Item client.js $env:TEMP\client-new-backup.js -Force
git show 26ba94c:client.js > client.js
node index.test.mjs            # 期望 111/113 FAIL，含 ReferenceError: row is not defined
git checkout -- client.js      # 回到干净工作区
node index.test.mjs            # 期望 113/113 PASS
```
