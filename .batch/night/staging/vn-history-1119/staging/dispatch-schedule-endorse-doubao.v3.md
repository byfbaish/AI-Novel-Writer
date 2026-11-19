执行方：豆包联络人 · AI writer项目组
model=（DSH 会话，非外部执行产出） | 倍率=不适用 | provider=DSH
会签对象：`staging/dispatch-schedule.v3.md`｜8,749B｜`2cb471cbd7d910bdd7bc9c6484965385`｜121 行（我这边按行尾换行数 122，口径差 1，见 §二 末尾）｜crlf=0｜mtime 2026-11-17 12:28:22
受签 v2 未动：`dispatch-schedule.v2.md`｜7,030B｜`27d365a3813833b841817ae135f18b2a`｜116 行｜crlf=0｜mtime 2026-11-16 20:37:08 —— 与终审时逐字节一致
会签时刻：2026-11-17 12:36 CST（按终审「只复签四处、不全量重跑」执行；我的 v2 会签 `a65d0e26…`／3,581B／36 行 留档不动）
会签结论：**四处全部通过**。另有两项须记：① 一处**行号引用错**（`:43`／`:117` 的 `:35` 应为 `:40`，错源是我自己的 v2 会签件）；② 我 12:30 在群里说错的一条（豆包 `--no-wait` 派卡**能**拿到 `model`），订正在 §四。

## 一、核验方式

`Compare-Object` 逐行比 v2/v3：差异 13 行 ＝ 1 行标题 + 6 行版本说明 + 3 行旧句被替换 + 3 行新句，全部落在你申报的四区（A `:43`、B `:117`、C `:118`、版本说明），**无第五区改动**。下文每条我自己实数，不采信本件自述。

## 二、逐条

**A `:43`（原 `:38`）行号漂移＋白名单断言 —— 通过**
- 现盘 `scripts/workbuddy/model-policy.mjs` 逐行：`:30` `export const HY4_DISABLED = true`；`:34` `export const MODEL_HY4_FLASH = 'Hy4 flash'`；`:35` `export const MODEL_DEEPSEEK_FLASH = 'DeepSeek-V4.1-Flash'`；`:36-38` `export const ALLOWED_MODELS = HY4_DISABLED ? [MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH] : [MODEL_HY4, MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH]`。v3 的引用逐字无误，`HY4_DISABLED=true` 下白名单＝`['Hy4 flash','DeepSeek-V4.1-Flash']` 成立。
- 「白名单只决定允许出现什么、不决定实际选了哪个」成立：我 12:19 实跑 `:23` 命令 exit 0，输出 `{"ok":true,"model":"DeepSeek-V4.1-Flash","window":"deepseek-off-peak",…}` —— `pickModel()` 自动路径仍出 DeepSeek。
- 删掉「HY4 不会出现」这句是对的，可放行。

**B `:117`（原 `:112`）名字已到＋过渡期硬约束 —— 通过，但行号引用错**
- 数逐字对上：`reports\hy4-modelname-probe-20261117.md`（4,512B／mtime 2026-11-17 01:05:22）`:14` `<Hy4> — 0.29x`、`:15` `<Hy4 flash> — 0.00x ＋ 角标「限时免费」` ⇒ v3 引的 0.29x／0.00x 有出处。
- 过渡期硬约束（显式 `--model DeepSeek-V4.1-Flash`、回执附发起命令全文＋`chips.model` 原文）与终审口径一致。
- **错处**：`:117` 末句「依据是 §一 `:35`」—— v3 的 `:35` 是取样表那一行（「现在 20:33（周一非高峰）」），真正的 model 字段判据在 **v3 `:40`**：`ok === true` 且 `model === "DeepSeek-V4.1-Flash"` → 可派。同错见 `:43`「唯一硬闸是 `:35` 的 `model` 字段判据」。
- 成因（我的责任）：v2 的 `:35` 确是那条判据，v3 头部加了标题＋6 行版本说明，全篇行号后移 5 ⇒ `:40`。错源是我 v2 会签件第 30 行写的 `:35`，v3 照抄。
- 建议：两处 `s/:35/:40/`，或改写成「§一 判据段第一项」不带行号。**不阻塞四处结论**。

**C `:118`（原 `:113`）无 @ 基线 9.99% —— 通过**
- 复算自洽：`72/721 = 9.986% → 9.99%`；`72/722 = 9.972% → 9.97%`。
- 分母＝`text` 非空的 bot 发言（`who` 不含 `User`/`DS Bot`）、分子＝其中正文不含 `@名字` 的条数，与产品经理 v68 落的口径逐字一致；「9.97% 只作含 User 的 B 口径存档、不作基线」与终审 12:3x 那句一致。

**D 版本说明 —— 通过**
- 六行说明的四处改动与 `Compare-Object` 结果一一对应；「v2 字节留档不动」实测成立（3,581B 会签件与 7,030B 受签件 hash/mtime 均未变）。
- 计数口径：我按「行尾换行数」得 122，你报 121（末行 `<!-- DONE -->` 后是否计空行），差异与本组既有 335/337 口径差同类，不阻塞；判件以字节＋hash 为准。

## 三、豆包侧两行口径（按终审「不另出件」，写在这里）

1. **回执的 model 原文取自 `task` 输出 JSON 的 `"model"` 行**，不是 `[turns=… model=…]` 那行：`scripts/doubao/doubao.mjs:607` `const model = await readModelLabel(client)`，`:620-631` `console.log(JSON.stringify({ … model, … }))`，这段在 `:632` 的 `--no-wait` 提前 return **之前**打印 ⇒ 带 `--no-wait` 也拿得到，一次命令够用。派后回查用 `markers`（`:647`；字段在 `:657` `model: await readModelLabel(client)`，同源，不打架）。
2. **红线判据用「含 `DeepSeek` 子串」，不得等值比较**：豆包界面原文是 `DeepSeek V4.1 Flash 高`（我 12:28 实跑 `markers`：`"model": "DeepSeek V4.1 Flash 高"`，带空格与「高」字），字面**不等于** `DeepSeek-V4.1-Flash`；等值比较会把每次正常派卡判成「未按口径」。只有出现 `Hy4` 或空 `?` 才记违规。豆包侧无 `--model` 参数、不碰选择器，这条是唯一防线。

## 四、我自己的订正（留痕，防再传错）

我 12:30 在群里说「`--no-wait` 拿不到 model、只能另跑 `markers`」——**错**：只看了 `:642` 那行，漏了 `:620` 那个 JSON。workbuddy联络人 指出后我逐行复核，确认 JSON 路径成立。豆包侧口径以 §三 为准。

## 五、`:98` 指向 v1 的处置（已裁定，记在这里）

`:98` 仍指 `staging/dispatch-schedule-endorse-doubao.v1.md`（2,833B／`5f66b1e1dcd93da20d760d576c75e2f`／51 行），现行是 v2（`a65d0e26c7668ba4b7da4d12faf896ca`）与本职本 v3。

项目总负责人 2026-11-17 12:3x 裁定原文（引自本群）：「**不出 v4、v3 字节不动**（`2cb471cb…`）。理由与首卡报告 `:2` 采用「不通过、不出件」的做法相同：引用错了元数据，不必为此重出文件。会在 v3 会签件和台账中各记一句「`v1` 为历史，正式以 `v2`（`a65d0e26…`）为准，文字随下次自然改订」。口径落盘 `.batch\night\org\ruling-dispatch-v3-1117.md`｜1,769B｜`22b6f05700b1fa0eb03155fdf80867d7`。

据此记录：**`v1` 为历史，正式以 `v2`（`a65d0e26…`）为准，文字随下次自然改订**；v3 字节不动（`2cb471cbd7d910bdd7bc9c6484965385`／8,749B）。§二 B 的 `:35`→`:40` 同按此口径随下次自然改订，不单独出件。

<!-- DONE -->
