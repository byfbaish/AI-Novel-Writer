From: AI writer总负责人 · AI writer项目组 | 6dc4ab20
To: QA · AI writer项目组 | 待投时由投递方改写 | 群分身

# 派验单 · P54-fix1（relay 注入 From/To 身份）

> 取代：无（本卡首单）
> 卡面：`.batch/night/cards/p54-fromto-inject.md`｜**7,957B / 96 行 / `AC84E074149E9A124CF6209752210261` / crlf=0**
> 判据件：`.batch/night/staging/handoff-usage-criteria-v3.md`（`9E289B857328CFA337D6C739363D9A0A`）
> 首验报告路径：`.batch\night\reports\p54-fromto-inject-qa-firstcheck.md`

执行方：QA

## 一、开工第一步（先核，不跑套件）

在源码仓 `C:\develop\workspace\dsh-handoff-relay` 核，并把六项读数写进报告开头：

1. `git rev-parse --show-toplevel` 规范化后 = `C:/develop/workspace/dsh-handoff-relay`
2. `git branch --show-current` = `master`
3. `git rev-parse --short HEAD` 起点 = `fdf7b17`
4. `git diff --numstat HEAD` 与 `git diff --ignore-cr-at-eol --stat HEAD` **双空**
5. `git -c core.quotepath=false status --porcelain=v1` 空
6. `index.js`、`index.test.mjs` 存在，且 `git ls-files index.js index.test.mjs` 两个都命中（执行方新建的文件 ⇒ 直接判不通过、不跑套件）

## 二、判据

- **C1** 提交存在，message 形如 `fix: inject From/To identity header...`；`git show --numstat` 只含允许文件（`index.js`、`index.test.mjs`，可选 `README.md`）；`git log fdf7b17..HEAD` 无第二笔。
- **C2** `index.js` 改动落点是「注入前拼身份头」+「`deliver()` 用 `resolved.title`/`resolved.id` 传身份」；不加构建链、不引新依赖。\n- **C2b** `DEFAULT_MESSAGE`(`:18`)、`schema default`(`:57`)、`apply()` 兜底(`:1308`) 三处**都没有**内置 `From:`/`To:` 文本（两处都内置 ⇒ 双头，判不通过）。
- **C3** `From` **不得**由目录名、`targetSessionId`、watch 配置推断（读码判：命中此类字符串拼 From ⇒ 不通过）。
- **C4** 身份头**强制前置**：自定义 `message` 不含任何占位符时，注入文本仍有 `From:`/`To:` 两行（对应用例 T3）。
- **C5** 桩件无 `From:` 时注入 `From: UNKNOWN`（T1）；桩件有 `From:` 时原文采用（T2）。
- **C6** 取不到标题时 `To: (无标题) | <id8> | 主身`（T4）；标题含 ` · ` 判 `群分身`，否则 `主身`。
- **C7** 任意注入文本 `^From:` 与 `^To:` 各**恰好 1 行**（T5）。机检：`([regex]::Matches($t,'(?m)^From: ')).Count -eq 1`。
- **C8** `node index.test.mjs` 全绿（自己复跑，不看执行方贴的输出）。
- **C9** 反证两条必须真做真红：删前置→T1 红；改从目录名推 From→T2 红。
- **C10** 报告 `.batch\night\reports\p54-fromto-inject-report.md` 存在，首行 `执行方：<名字>`，第二行含 `model= | 倍率= | provider=`；信号文件前两行 From/To 头、末行 `<!-- DONE -->`。

## 三、机检（写进报告，带命令与输出）

```
git show --numstat --oneline HEAD
node index.test.mjs 2>&1 | Select-Object -Last 10
Select-String -Path index.test.mjs -Pattern 'UNKNOWN' -Quiet
Select-String -Path index.test.mjs -Pattern '^To: ' -Quiet
```

## 四、G1

报告首行 `执行方：QA`，卡面派发方为 `执行方：豆包`（本单由 QA 首验），两处取值必须不相等。

## 五、判完怎么报

判词落 `.batch\night\reports\p54-fromto-inject-qa-firstcheck.md`，首行钉三件：执行方行、`git rev-parse --short HEAD`、`git show --numstat` 摘要；结论只写 **通过 / 不通过** + 逐条 C1–C10 命中情况；不写「基本通过」。群内报：路径 + 字节 + MD5 + 一行结论。
