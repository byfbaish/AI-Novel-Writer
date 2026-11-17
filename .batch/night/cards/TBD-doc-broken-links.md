# TBD-doc-broken-links · 修 2 条指向不入库目录的文档硬链接

> **草案**（2026-11-15，Developer 出，供负责人拿去问主人）。
> **本草案不是可投卡**：状态为「待前置」，未派单、未开卡、未动任何文件。

## 抬头

状态：**待前置**——需作者点头「允许改这 2 行 docs」；点头后即为 **A 类**（产生仓库提交，须配派验单）
估时：改码 **5 分钟**（2 行）＋ 首验 **5 分钟**（`check:fast` 两次，单次 20–30 s）＝ **≤10 分钟**
执行方：待派；首验方：QA（A 类必填）
类型：**A 类**

## 0. 工作区前置【硬】

- 工作目录：**新建** `C:\develop\workspace\AI-writer\wt-docfix`，分支 `docs/fix-workbuddy-links`，起点 HEAD `26627655`（develop 当前 HEAD，`exp/resource-ledger`）。
- 禁在共用主工作区 `C:\develop\workspace\AI-writer\develop` 里改码或提交。
- **本卡的环境反例即验收前置**：工作树内**不得**存在 `.workbuddy/`（`.gitignore:42` 已忽略）。若该目录被拷进来，本卡的红会消失、验收失效——开工前 `ls -d .workbuddy` 必须报不存在。
- `node_modules`：**允许 `pnpm install`**（本卡不改 `src/`，不跑 Electron 套件，切 ABI 不影响任何槽位）；但**禁 `pnpm dev`**（会占端口、抢单实例）。
- 其余同模板 §0 六条（`--show-toplevel` / `--show-current` / `--short HEAD` / `--numstat HEAD` 双空 / `--porcelain=v1` 白名单 / 目标文件存在）。

## 1. 起因与背景

### 失败形态

在**任何缺少本地 `.workbuddy/` 的检出**（worktree、他人机器、干净克隆）里：

```
node scripts/check-doc-links.mjs          → exit 1，broken 2
node scripts/check-doc-placement.mjs --strict → exit 1，新增违规 2（均为 [C6] 断链）
node scripts/check-fast.mjs               → exit 1（typecheck ✓ 20.2s → doc-links 失败 0.1s，placement 未跑到）
```

在 `develop` 里却是绿的（两脚本 exit 0）——**只因为它本地恰好有 `.workbuddy/`**。这是被本地目录掩盖的真缺陷，不是环境差异。

实测时间：2026-11-15 11:00–11:06，wt-p51（无 `.workbuddy`）exit 1；develop（有）exit 0。

### 根因

2 条**已入库的文档**用了 markdown 硬链接指向 `.workbuddy/` 下的文件，而 `.workbuddy/` 在 `.gitignore:42` 里、永远不入库，目标必然不存在。
两个检查脚本的 `SKIP_DIRS` 都已排除 `.workbuddy`，所以与「扫到未跟踪目录」无关，纯粹是链接目标缺失。

### 旁证（决定改法的关键）

全仓 `docs/**/*.md` 里提及 `.workbuddy` 共 **53 处 / 24 个文件**（`git grep -o '.workbuddy' -- 'docs/**/*.md' | wc -l`），**只有这 2 处写成了 markdown 链接**，其余一律是纯文本或代码块（如 `docs/agents/worktree-parallel.md`）。也就是说仓库已有事实口径是「`.workbuddy` 路径只作文字引用、不作导航目标」，本卡只是把这两处拉回同一口径，**不新立规则**。

## 2. 要改成什么（唯一口径）

**两处都改为代码块（行内反引号）引用，并在其后补一句「本机工作记忆，不入库」，删除 markdown 链接语法。** 不新增 IGNORE 规则、不改脚本、不改基线、不拷贝 `.workbuddy/` 进工作树。

理由：改脚本加 `IGNORE` 会让**未来任何**同类断链都静默通过；拷贝 `.workbuddy/` 是喂假数据、且拿到的是别的机器的旧记忆。只有改源头能同时满足「转绿」和「下次不再犯」。

### 改动 1

文件：`docs/design/architecture/p11-plan-validity-and-fact-registry-design.md` 第 **163** 行（`### 4.2 计划水位` 下第一句）

现文：

```markdown
`blueprints` 新增一列（走 lane 六步，见 [`notes/data-and-schema.md`](../../../.workbuddy/memory/notes/data-and-schema.md)）：
```

改为：

```markdown
`blueprints` 新增一列（走 lane 六步，见 `notes/data-and-schema.md`——本机工作记忆，不入库）：
```

### 改动 2

文件：`docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md` 第 **541** 行（表格第 ⑧ 行，行尾）

现文（行尾片段，整行 349 字符，只改这一段）：

```markdown
提交 `c930a92f` / `362f45ba`，实机读数见 [`2026-11-10` 日志](../../.workbuddy/memory/2026-11-10.md) |
```

改为：

```markdown
提交 `c930a92f` / `362f45ba`，实机读数见 `2026-11-10` 日志（`.workbuddy/memory/2026-11-10.md`，本机工作记忆，不入库） |
```

> 两个改动都**只删 `[...](...)` 这一种语法**，`:163` 与 `:541` 的行号不变，整行其余字符一字不动——便于复核用 `git diff --numstat` 对「2 文件 / 2 增 2 删」硬对账。
> 注意 `:541` 是表格行，**结尾的 ` |` 必须保留**，且不得引入 `|` 影响列数。
>
> **行号备注（2026-11-15 11:19 实测复核）**：`:541` 为 ⑧ 行含链接，`:542` 是空行。
> QA 判词里出现过「应为 `:542`」的反向订正，**属误判，以此处实测为准**；引用行号一律写 `:541`。


## 3. 落点与禁改区【硬】

- 改：`docs/design/architecture/p11-plan-validity-and-fact-registry-design.md:163`
- 改：`docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md:541`
- **禁改**：
  - `docs/adr/` 任何既有条目；`docs/plans/novel-quality-*`；`docs/research/novel-quality-modernization/`（AGENTS.md §1 禁动区）
  - `scripts/check-doc-links.mjs`、`scripts/check-doc-placement.mjs`、`docs/agents/doc-placement-baseline.json`（改闸门＝另一种口径，本卡明确不做）
  - `.gitignore`（不得把 `.workbuddy` 从忽略里拿掉）
  - `src/`、`electron/`、`package.json`（本卡零源码改动）
- **禁**：拷 `.workbuddy/` 进工作树、`git commit --no-verify`

## 4. 验收判据【硬】

每条必须能指认（文件:行 或 命令输出原文），缺一条即不通过：

1. `git diff --numstat` **恰为两行**，且为 `1	1	docs/design/architecture/p11-plan-validity-and-fact-registry-design.md` 与 `1	1	docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md`。
2. `git grep -n '](\.\./.*\.workbuddy/' -- 'docs/**/*.md'` **无输出**（当前命中 2 条，即本卡那两条）。
3. `grep -c "" ` 两文件行数**与改动前相同**（163 / 541 行号未漂移），并附 `git diff` 原文。
4. `:541` 表格列数未变：该行 `|` 计数与改动前一致（报告里贴改动前后各一行原文）。
5. **环境前置先自证**：`ls -d .workbuddy` 报「不存在」（否则本判据作废，须换干净工作树）。
6. 点名套件：`node scripts/check-fast.mjs` → **exit 0**，且输出含 `doc links: checked 1470, broken 0`；`node scripts/check-doc-placement.mjs --strict` → **exit 0**，`新增违规 0`。
   **禁** `node vitest`、禁全量、禁 `test:browser`、禁 `pnpm dev`。
7. **回归对照**（证明没把 develop 弄脏）：在 develop 再跑同一命令仍 exit 0（develop 本来就绿）。
8. 提交纪律：一次点名 `git add` 只加上面 2 个文件；**禁 push / tag / publish**；提交信息建议 `docs: 修 2 条指向 .workbuddy 的断链（改为代码块引用）`。
9. **判词首行钉「取数件路径 + 字节数 + MD5」三元组**；本卡取数件为 `git diff` 输出存档与 `check-fast` 输出原文。
10. 档位机检按模板第 8 条（DSH 内 Bot 执行时）；外部执行方按第 9 条钉 `model=…｜倍率=…｜provider=…`。

## 5. 交付物与信号【硬】

- 报告：`.batch/night/staging/TBD-doc-broken-links-report.md`，末行 `<!-- DONE -->`；须含：起点 HEAD、终点 HEAD、`--numstat` 原文、`check-fast` 输出原文、`.workbuddy` 不存在自证、`git grep` 空结果原文。
- 信号文件正文三行：卡号 / 回执路径 / `<!-- DONE -->`。

## 6. 派验单与首验【A 类必填】

- 派验单：`.batch/night/review-requests/TBD-doc-broken-links.md`（开卡时补）
- 首验单：`.batch/night/reports/TBD-doc-broken-links-qa-firstcheck.md`
- G1 机检：派验单 `执行方：<X>` 与首验单 `执行方：QA` 取值必须不相等。

## 7. 风险与边界

| # | 风险 | 判读 |
|---|---|---|
| R1 | 改的是 docs，需作者点头 | **是硬前置**。但注意：这 2 个文件**不在** AGENTS.md §1 的禁动区清单里（禁动区只有 `docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`、`docs/adr/` 既有条目）。P51 卡面把 docs 定成禁改是**卡面级**约束，不是仓库级禁动区——所以本卡的风险等级是「需点头」，不是「动禁地」 |
| R2 | 改成代码块后，点击无法跳到本地记忆 | 接受。目标是**本机**路径、**不入库**，仓库内读者点了本来也打不开；且与其余 20+ 处写法一致 |
| R3 | 日后有人再写进第 3 条 `.workbuddy` 链接，又会红 | **真实残险，且本卡不消除**。那是真缺陷再次出现，红是正确行为（fail-closed）。若要根治得改闸门，属另一张卡，本卡不掺 |
| R4 | 若把 `.workbuddy/` 拷进工作树，验收会假绿 | 已写成 §0 硬前置 + §4.5 自证判据 |
| R5 | 与 P51 抢工作区 | 无交集：本卡新建独立 worktree，`wt-p51` 不动；且本卡不跑 Electron 套件，不切 ABI |
| R6 | `check-doc-placement` 基线是否会被这次改动搅乱 | 不会。这 2 条现在是「新增违规」（基线内 0 条），修掉后即从新增里消失；**不需要** `--update-baseline`。若执行方顺手跑了 `--update-baseline`，判不通过 |

## 8. 待裁问题（给负责人拿去问主人）

1. 允许改这 2 行 docs 吗？（口径：改代码块引用，不加 `IGNORE`、不加基线）
2. 若想**一次性根治**（让未来同类链接不再红），要不要另开一张「改 `check-doc-links.mjs` 加 `.workbuddy` 专用 IGNORE」的卡？——我**不建议**，理由见 §2；但这是主人的选择。
