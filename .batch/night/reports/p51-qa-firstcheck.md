执行方：QA

# P51 首验 · 连续 10 章口径的动作数中位数

- 依据：`.batch/night/review-requests/p51-v2.md`（3,778B / MD5 `FA150DB9DA0BC5D141380163C574C722`），取代旧单 `p51.md`。
- 卡面（投出版）：`.batch/night/cards/p51-median-gap.v2.md`（4,279B / `146C148B43027626C9FEB2C4625200B7` / 07:52:10）
- 工作树：`C:\develop\workspace\AI-writer\wt-p51` · 分支 `agent/p51-median` · 基点 `26627655` · 句点 `e3dafb51`
- 报告件：`.batch/night/staging/p51-median-gap-report-v2.md`（14,859B / `556F8B8EB8134A9BB72EAB4DFDD3F7F9` / 10:38:05 / 末行 `<!-- DONE -->`）
- 信号：`delivered/462e69db07b3/p51-median-gap.done`（134B / `64DA8A0409D7572C50C2E8BB42DD081F`）
- 裁定件：`.batch/night/staging/p51-env-blockers-ruling.md`（5,322B / `A951CBEED5A40266C2497116F0FF2AB6`），含 11:39 对 `747fdbb4` 的追认口径

## 〇、前置四项（首验第一步固定读数）

```
toplevel = C:/develop/workspace/AI-writer/wt-p51   （规范化后＝C:/develop/workspace/AI-writer/wt-p51 ✓）
branch   = agent/p51-median                        ✓
head     = e3dafb51                                ✓（基点 26627655 的后代）
ls-files = src/components/editor/__tests__/draft-edit-median.test.ts
           src/components/editor/draft-edit-median.ts     ✓ 两文件命中，非就地新建
```

`git rev-list --count 26627655..HEAD` = 2（`e3dafb51` 与 `747fdbb4`）。
`porcelain` 0 行、`--cached` 空。

## 一、判据逐条

**判据 1：通过（空章用例存在且断言到位）**
- 用例在 `src/components/editor/__tests__/draft-edit-median.test.ts:61`（`counts chapters with no measurement rows as zero actions instead of dropping them`）。
- 数据 `:65-74`：章 3..12 连续，5、8 两章一行都没有；其余八章动作数 1,1,1,9,9,9,9,9。
- 我手算：把 5、8 记 0 得 `0,0,1,1,1,9,9,9,9,9`，第 5、6 位是 1 与 9 ⇒ (1+9)/2 = **5**，样本 10。断言 `:75` `{ median: 5, sampleChapters: 10 }` 与手算一致。
- 反证在注释 `:64` 写明：任一章被跳过则只剩 9 个样本 ⇒ `median: null`，读数不会是 5。

**判据 2：通过（断档按连续章号补 0；不足 10 ⇒ null + N）**
- 断档：`:96` 用例，行只落在 3、4、7..12，当前章 12 ⇒ 窗口 3..12 共 10 个章号，5、6 补 0，断言 `:100` `{ median: 1, sampleChapters: 10 }`；手算 10 个 1 ⇒ 1 ✓，不是 8 个样本。
- 不足 10：`:103` 用例，当前章 5 ⇒ 够得着 1..5 共 5 个章号，断言 `:106` `{ median: null, sampleChapters: 5 }` ✓（文案「样本不足（N/10 章）」由 `sampleChapters` 提供）。
- 实现侧对应 `src/components/editor/draft-edit-median.ts`（`e3dafb51` 版）：按当前章向前连续取号、无行章记 0 进样本，注释 `:7-11` 写明口径与 B10 由来。

**判据 3：通过（全 ai 行章仍算 0，P48 行为未退化）**
- 原用例 `:35` `treats all-AI rows as zero author actions but keeps the chapters as samples` 断言 `:38` `{ median: 0, sampleChapters: 10 }`，仍绿；另 `:78` 用例证明「空章」与「有 ai 行但 0 作者动作」同解（都判 5）。

**判据 4：通过（原 5 个手算例一个都没变）**
- `git diff --numstat 26627655..HEAD -- src/components/editor/__tests__/draft-edit-median.test.ts` = `64 0` ⇒ **纯新增、零删除**，原 `:18`/`:23`/`:29`/`:35`/`:41`/`:45` 六条一字未改。
- 跑原有用例全绿（见判据 5）。

**判据 5：通过（点名套件全绿，11:41:00 我自己跑）**
```
$ pnpm test src/components/editor/__tests__/draft-edit-median.test.ts \
            electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts
 ✓ src/components/editor/__tests__/draft-edit-median.test.ts (11 tests) 4ms
 ✓ electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts (1 test) 170ms
 Test Files  2 passed (2) | Tests  12 passed (12) | Duration 1.24s
```
- 环境前置（11:09:04 记录）：本卡首轮该仓储用例曾因 native ABI 不符而必红，developer 处理后我在 11:09:04 复跑同一条通过（1 test passed / 1.18s），ENV-BLOCKED 解除。
- 补一条事实边界：`wt-p51/node_modules/better-sqlite3/build/Release/better_sqlite3.node` 与 develop 那份**逐字节相同**（1,903,104B / `0D39C0E1C591053207EFF5AED1634478` / mtime `2026-03-14 07:42:02`），所以这步只记「用例可跑通」，**不记「现场重新编译成功」**。

**判据 6：通过（按 11:39 新口径）**
```
$ pnpm check:fast
[check:fast] typecheck ✓ 16.4s
doc links: checked 1468, broken 0
doc placement: 扫描 437 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] 全部通过。
```
- 另按新口径核「分支上另有的提交须逐个登记且 `--stat` 与声明一致」：见判据 8。

**判据 7：通过（禁改区未被触碰）**
- 全量 `git diff --numstat 26627655..HEAD` 只有 5 个文件：docs 两个（各 1/1，见判据 8）＋`ReviewReport.tsx` 12/6、测试 64/0、`draft-edit-median.ts` 48/18。
- 逐项核：`src/shared/review-generation-report.ts`、`src/services/workflows/commands/review-chapter.command.ts`、`src/services/workflows/commands/generate-draft.command.ts` 均 0 命中；`electron/controllers/db-controller.ts` 的 diff 为 0 行（SQL 仍只投影三列）；`draft-edit-stats` / `draft-edit-stats-recent-chapters` 两个通道签名 diff 0 行。
- docs 两个被改文件是 `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md` 与 `docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md`，**不在 AGENTS.md 禁动区三种**（`docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`、`docs/adr/`）内；但卡面 §3 落点只点名 3 个代码文件，故 docs 改动属**越界**，见判据 8。

**判据 8：通过（三文件一笔提交；另有 1 笔越界提交已追认）**
- 本卡代码提交：`e3dafb513137d4e6a6da1e76b5bbb20e51a917ec`（11:36:02），恰好 3 个点名文件，`--numstat` 为 `12/6`、`64/0`、`48/18`，与卡面落点一致；`porcelain` 0、`--cached` 空。
- 越界提交：`747fdbb4aaf7a4ca48da9f2ab0024b9da32ec89f`（11:32:52，`docs: 修 2 条指向 .workbuddy 的断链`），2 文件各 1/1，`--stat` 与声明一致；**不在本卡交付内**，按裁定「越界—追认保留」记违约一笔，不回退。
- 无 push/tag/publish：`@{u}` = `fatal: no upstream configured for branch 'agent/p51-median'`；`git tag --points-at HEAD` 空；`refs/remotes` 无 p51 分支。
- 仓库根未跟踪的 `开篇试样 02/` 未被顺手提交：`porcelain` 全空，且该目录在 develop、已被移入 `.batch/night/staging/samples-02/`。

## 二、判定

**PASS（限派验单 p51-v2 判据 1–8）**，附两条限定：

1. 判据 5 的通过只作「用例可跑通」解，不作为「native 重新编译成功」的证据（产物与 develop 逐字节相同，mtime 仍是 03-14）。
2. `747fdbb4` 判越界一笔、已追认保留、不计入本卡交付；合并时须单独说明这笔 docs 改动不在卡面授权范围内。

界面读数（`ReviewReport.tsx` 那行人话）本轮仍无真机验证——按派验单禁跑 `test:browser`，与 P48 同一条遗留。

证据三元组复述：报告 `p51-median-gap-report-v2.md` 14,859B / `556F8B8EB8134A9BB72EAB4DFDD3F7F9`；信号 `p51-median-gap.done` 134B / `64DA8A0409D7572C50C2E8BB42DD081F`。

<!-- DONE -->
