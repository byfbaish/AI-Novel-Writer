# bot-session-identity 落位前查重与风险记录（developer，2026-11-15 23:25）

对象：`docs/agents/bot-session-identity.md`（未跟踪 / 3,855B / 51 行 / mtime 2026-11-15 12:22 / 无任何提交）
署名人：文件第 51 行「维护：大管家（大肥鱼）」

## 1. 查重（按 documentation-charter §4）
- 检索词：`主身|群分身|isClone|parentBotId`，范围 `docs/**`、`notes/**`
- 命中 2 个文件：本文件自身；`docs/design/prompt/prompt-trace-output-sample.md`（仅词面巧合，非同题）
- 结论：**无重复，不拆篇，可就地落位到 `docs/agents/`**

## 2. 落位前必须处理的正文问题
1. **第 51 行含 session id 占位符**：`维护：大管家（大肥鱼）｜session-a1d48adb-037e-42b5-8436-c14aa468a9f1｜2026-11-15 12:22`
   - 定性（大肥鱼 11-15 更正，我原判「密钥占位」有误）：该占位渲染出来是会话 id `74a01c9a`，**不是密钥**，不存在泄漏
   - 处置理由只写一条：**docs 不收会过期的 id**（session id 每次 DSH 重启整批刷新，写进正文即变成误导性凭据）
   - 处置：删掉该占位，只留「维护：大肥鱼｜2026-11-15」
   - 禁止在落位卡或报告里写成「密钥泄漏／密钥引用」，判据写错比不写更坏
2. **会过期的凭据写死在正文**（负责人判据：docs 不收会烂的凭据）
   - `daeb834f`（第 20 行）、`33494f59` / `7730f863`（第 21/41 行）
   - `C:\Users\<用户名>\.dsh\bot\workspace\notice-backup-1115-1214.md`（第 44 行）
   - 处置：改成「以 `relay.log` 的 `from=` 与 session 前 8 位回读为准」，历史 id 移入本次留痕段落并标明时点
3. §5「本次修复留痕」保留为历史记录，但须标注「2026-11-15 12:06 时点快照，id 已可能失效」

## 3. 待办
- 等主人粘完 notice、回读判定完成后，按上述三条改稿 → 同提交同步 `docs/README.md` 索引
- 落位提交前跑 `pnpm check:fast`

## 版本事故登记（负责人 2026-11-15 23:3x 裁定）

- 事故：developer 改维护行时直接改 `bot-session-identity.v2.md`，未另存 `.v3`。实测 v2 与 v3 字节相同（4,252B / `CDE2D475561326808F0AC915855FA2D3`）。
- 后果：v2 原稿 `F499E404B842DD9833611FCCDB5BD3D5`（4,231B / 2,110 字符 / 55 行）**已被覆盖，内容不可复原**，台账中该哈希作废。因文件未入库，无仓库历史可回滚，无可补措施。
- 交付口径：以 **v3**（`CDE2D475…`）为唯一待判交付物；v2 视同 v3 的同字节副本，不再单独引用。
- 教训：`cp` 后再改副本，改完立即核副本哈希与原稿哈希不同；发现原稿哈希变了即停手报告，不得静默继续。

## 判据与提交口径（负责人 2026-11-15 23:3x 收 QA 两条后定）

- **判据修正（取代「第 51 行 len=28」）**：行号会随删改漂移（v1 是 51 行、v2/v3 是 54 行）。一律写「**含『维护：』的那一行 len=28 且不含 `session-`**」，不写行号。
- **判「真另存 vs 原地覆盖」不看文件名，看两文件 MD5**：同名不同哈希＝另存；同哈希＝覆盖。本次即靠此查出 v2 被覆盖。
- **提交范围（定稿）**：只提交 `docs/agents/bot-session-identity.md`（v1 原稿，未动）与 `bot-session-identity.v3.md`（交付物）。**v2 不入库**（与 v3 同哈希，入库只会制造两份同字节文件让人分不清）；v2 留在工作区，其损耗事实以本节与提交说明记录。
- **提交说明必带**：「v3 为交付物；v2 已被原地覆盖、内容≡v3、原 `F499E404…` 档不可回读」。`git status` 三份均为 `??`，看不出差异，不写说明事后无法分辨。
- **不得补造 v2** 去凑 `F499E404…`——补造即伪造留痕。

## 更正上文一处（2026-11-15 23:36 实测）

前节「v1 原稿未动」的取证值应为：`docs/agents/bot-session-identity.md` 3,855B / `05FCF0CF3DBE7BCE9528B5B0F41B947F` / 2,042 字符 / 52 行（负责人 node 实测，与 QA 的 3,855B 一致；QA 贴出的 `05FCF0CF3DBE7BCE9528B5B0F41B947F` 是显示层掩码，不是文件内容，不得写入任何判据）。

## 落点裁定（负责人 2026-11-15 23:4x，含实测）

- 实测：`docs/agents/bot-session-identity` 检出在 `C:\develop\workspace\AI-writer\develop`，当前分支 `exp/resource-ledger`，HEAD `e3dafb51`（ahead 2）；**仓库无 `develop` 分支**（我此前卡面写「分支 develop」是错的，应按 `git branch` 实测写）。现有分支含 `master`、`dev_byf`、`exp/*`、`agent/*`。
- **裁定：就地提交到 `exp/resource-ledger`**。理由：切分支会把三份未跟踪文件连同整个工作区一起搬，风险远大于收益；本地提交可后续 cherry-pick 到 `dev_byf`/`master`，可逆。
- 提交只 add 两个文件（`bot-session-identity.md`、`bot-session-identity.v3.md`），不 add v2；提交前跑 `pnpm check:fast`；提交后回报 commit SHA + `git status` + `git log -1 --stat`。

## 落点改判（负责人 2026-11-15 23:5x；覆盖上一节的「就地提交」）

- 改判理由：`exp/resource-ledger` 是要进 PR 的实验分支，把文档混进去会成噪音；且 `dev_byf` 本身就是 docs 集成分支（近 3 提交皆 `docs:`），文档落它上面最顺、可 fast-forward 合并。上一节「就地提交」作废，保留作判断记录。
- **定稿落点**：`git switch -c docs/bot-session-identity dev_byf` → 在该新分支提交。实测依据：`dev_byf` = `9070999c`，且是 HEAD 的祖先；全仓未跟踪文件仅这 3 个，工作区其余干净，切分支不会撞车。
- 仍不变：只 add `bot-session-identity.md` 与 `bot-session-identity.v3.md`；不 add v2；提交前跑 `pnpm check:fast`；提交后回报 SHA + `git status` + `git log -1 --stat`；不推送（推送属对外动作，须报主人）。

## 入库内容改判（负责人 2026-11-15 23:5x；覆盖「add 两个文件」）

- 缺陷：前节让 add `bot-session-identity.md`（v1）是错的。v1 维护行 len=73、内嵌 `session-<uuid>` 完整会话 id；一旦入库，该 id 会永久留在这台机器的 git 历史里，正是本卡要清掉的东西。**入库不得包含会过期 id。**
- **定稿做法**：①先把 v1 原文另存为 `.batch/night/staging/bot-session-identity-v1-with-sessionid.txt`（不入库，留取证）；②把 v3 内容写到正式路径 `docs/agents/bot-session-identity.md`（覆盖后该路径字节应 = `CDE2D475561326808F0AC915855FA2D3`）；③**只 add 这 1 个文件**，v2/v3 不入库；④提交说明须写「入库版=v3 内容；v1（含完整 session id）未入库，另存 staging 取证；v2 被原地覆盖、内容≡v3、原 F499E404 档不可回读」。
- 校验：提交前 `git show :docs/agents/bot-session-identity.md | md5sum` 必须等于 `CDE2D475…`，且 `grep -c 'session-' `（对该路径）为 0。

## 更正第 2 节两处与交付物不一致的表述（负责人 2026-11-15 23:39）

- 第 2 节写「处置：删掉该占位，只留『维护：大肥鱼｜2026-11-15』」与交付物不符。v3 实际维护行 = **`维护：大管家（大肥鱼）｜2026-11-15 12:22`**，len=28，保留了「大管家」与时间 12:22。以 v3 为准，本节表述作废。
- 第 2 节「该占位」一词同样作废：文件里是完整 `session-<uuid>`，不是花括号占位符（见 QA 字节核实）。
`ec46779b` 说明中「55 行」系笔误，实为 54 行（`wc -l` / `numstat` 口径），此后一律写 54。
