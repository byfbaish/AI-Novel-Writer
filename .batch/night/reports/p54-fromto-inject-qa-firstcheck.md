执行方：QA
model=未采集（QA 侧不读自身档位） | 倍率=未提供 | provider=官方直连

# P54 首验 · relay 注入 From/To 身份头

- 派验单：`.batch/night/review-requests/p54-fromto-inject.md`（3,616B / 52 行）
- 卡面：`.batch/night/cards/p54-fromto-inject.md`（7,957B / 96 行 / `AC84E074149E9A124CF6209752210261`）
- 交付对象：`fdf7b17..40f34b5`（2 笔 / 3 文件）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 首验时刻：13:52–14:02

## 判定

**C1–C9 全过（9/9）；C10 只过信号侧，报告件两类不符** ⇒ 首验结论：**不通过（C10 两条：首行多标题行、末行缺 DONE）**；口径按负责人 14:09 裁定（投递件 From/To、报告件 `执行方：`+`model=`+DONE 各管各的）。

## 逐条判据

### C1 提交范围与 message ✅
- `git log --oneline fdf7b17..HEAD` = 2 笔：
  - `82dfbbe`（13:49:24）`fix: inject From/To identity header into handoff messages` → `54 3 index.js`、`93 2 index.test.mjs`
  - `40f34b5`（13:52:14）`docs: sync README example for From/To header` → `18 1 README.md`
- `git diff --numstat fdf7b17..HEAD` = `18 1 README.md` / `54 3 index.js` / `93 2 index.test.mjs`，文件集合恰为三件。
- `git -c core.quotepath=false status --porcelain=v1` 空；`git diff --cached --numstat` 空；`git tag --points-at HEAD` 空；`origin/master..HEAD` 2 笔（未推送）。

### C2 落点：注入前拼头 + deliver 用 resolved ✅
- 常量：`index.js:798` `IDENTITY_UNKNOWN`、`:799` `IDENTITY_FALLBACK_TITLE`、`:800` `IDENTITY_LINE_RE`。
- 头拼装：`index.js:842` `const head = \`From: ${fromText}\nTo: ${title} | ${id8} | ${kind}\n\``，在 `buildMessage` 内、`stripIdentityLines(text)` 之前前置（`index.js:823`）。
- deliver 取值：`index.js:1241` `resolved.title || sessionTitleOf(...) || IDENTITY_FALLBACK_TITLE`；`:1242` `resolved.id.slice(0,8)`；`:1243` 含 ` · ` 判群分身；`:1246` 传入 `buildMessage`。
- 审计行：`index.js:1251` `注入身份 from=… to=<id8>|<title>|<kind>`（落 relay.log）。

### C2b 三处兜底都没内置 From/To ✅
- `index.js:18` `DEFAULT_MESSAGE = '文件 {path} 已就绪（触发={reason}），请继续。'`
- `index.js:57` `message: z.string().default(DEFAULT_MESSAGE)`
- `index.js:1359` `config.message ? config.message : DEFAULT_MESSAGE`
- 全文 `Select-String 'From:|To:'` 只命中身份实现（798/799/800/806/823/829/830/842/1240/1245），无配置兜底。
- 注：派验单写 apply 兜底在 `:1308`，实际 `:1359`（新增 54 行导致漂移），属预期偏移，不计缺陷。

### C3 From 不由目录名/配置推断 ✅
- `index.js:806-818` `readStubFromLine` 只 `openSync` 桩件本体、读首 `TAIL_BYTES`、按 `/^From: .+$/` 认行（`:814`），无入参 `relName`/`targetSessionId`/cfg。
- 反证见 C9-B：把来源改成文件名 → T1/T2/T3 红。

### C4 自定义 message 无占位符仍有两行头 ✅
- 用例 `P54 T3` PASS（`自定义 message 无占位符 → 仍然有前置两行头（配置不能绕过）`），配置路径无法绕过。

### C5 无 From 写 UNKNOWN / 有则采用原文 ✅
- `P54 T1` PASS → `From: UNKNOWN` + `To: <标题> | <id8> | <kind>`
- `P54 T2` PASS → 原文采用，不重复插第二行

### C6 无标题兜底 + 主身/群分身判定 ✅
- `P54 T4` PASS → `To: (无标题) | <id8> | 主身`
- `index.js:1243` 按标题是否含 ` · ` 判定，与规则一致。

### C7 注入文本 ^From:/^To: 各恰一行 ✅
- `P54 T5` PASS（全用例）；`stripIdentityLines`（`:823`）保证正文同名前缀行让位。

### C8 我自己复跑套件 ✅
- 仓库内 `node index.test.mjs`（13:54）= `TOTAL: 166/166 PASS` / `RESULT: PASS`，执行方自报一致。
- 副本基线（`.batch/night/tmp/p54rev/`，13:58）同样 `166/166 PASS`。

### C9 反证两条真红 ✅
副本 `.batch/night/tmp/p54rev/`（仓库未动），变异脚本 `.batch/night/tmp/p54mutate.mjs`：
- **A 删头**（`:842` 改 `const head = ''`）→ T1/T2/T3/T4/T5 全红 + 「注入身份」日志红，`TOTAL: 162/166`。
- **B 按文件名猜 From**（`:1244` 改读 `relName`）→ T1/T2/T3 红 + 「注入身份」日志红，`TOTAL: 162/166`。

### C10 交付件头 —— ❌ 报告不符 / ✅ 信号符合
- 信号 `signals/doubao/p54-fromto-inject.done`（918B / `76E94D6E625AE89640C79D7FA0157AD5`）：第 1 行 `From:`、第 2 行 `To:`、末行 `<!-- DONE -->` ✅
- 报告 `p54-fromto-inject-report.md`（11,268B / `E8F3C733310A19D7336B14A74CAD9C31` / mtime 13:32:22）：
  - 第 1 行 = `# … · relay 注入头强制写 From/To 身份 · 执行报告`（标题，非 `执行方：`）
  - 第 2 行 = 空行
  - 第 3 行 = `执行方：豆包联络人（AI writer项目组 · 群分身 c12ee7f6）`
  - 第 4 行 = `model=豆包（自动档…） | 倍率=未提供… | provider=官方直连`
  ⇒ 按 C10「首行 `执行方：`、第二行 `model=`」字面判**不符**（内容齐、位置错两行）。
  - 文件内 `<!-- DONE -->` **0 命中**（13:29 投出时为 10,071B / `AEA6662205F2D95223ED5F6F328B9C0D`，其后被追加到 11,268B，DONE 标记随之消失）。

## 另记三笔（不改变 C1–C9 结论，请负责人裁）

1. **报告投出后被追加**：`10,071B → 11,268B`，交付件与投出时不一致，DONE 标记丢失。建议：报告类交付件投出后只读，补写另存 `.vN` 或续篇。
2. **`delivered` 拷回 watch（第 2 笔违约）**：报告末段自述「按原字节把信号拷回 `signals\doubao`」，被 P31 `contentHash` 判 `原因=重复(内容)`、`digest=5aec27d04d54` 兜住未二次投递。11-15 裁定明确禁止该动作（重发须换名或改内容），建议按纪律记一笔。
3. **硬规则冲突（需裁决）**：notice【投递身份 From/To】要求跨会话件正文**前两行**为 From/To，派验单 C10 要求报告**首行** `执行方：`。我在本报告里按 notice 优先（前两行 From/To，第 3 行 `执行方：QA`），若以 C10 为准，我这份同样「不符」。请定唯一口径。

## 未验证项（不作通过依据）

- **真机未验**：执行方报告 §末自述实机 relay 仍是 profile `node_modules` 旧副本，那次自投递消息**不含新头**；本次只有代码 + 单测 + 反证，**不能记「真机已生效」**。新头需插件更新并重启后新开一批才可验。
- `From:` 行的 session 前 8 位、`To:` 的标题，均为桩件自带 / `resolved.title` 派生，未做「第三方伪造头」的抗欺骗验证（按裁定该能力本期不做，只认通道）。
## 补记（14:05，据联络人补报，未独立复核）

4. **报告 model= 与实际档位不符**：报告第 4 行写 model=豆包（自动档；按平台规则不外报版本号），而联络人实测界面芯片为 `DeepSeek V4.1 Flash 高`。若按模板 §9「钉实际档位」，该行应写 `model=DeepSeek-V4.1-Flash`；provider=官方直连 与「不走 magpie」一致，无异议。C10 只要求该行存在且含三字段，故不影响 C10 判；但作为「报告与环境不符」记一笔，请负责人在终审时定是否要求改正。
<!-- DONE -->
