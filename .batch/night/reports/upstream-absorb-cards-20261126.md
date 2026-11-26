# 上游吸收：立卡清单（主人 11-26 21:5x 裁定：推荐包，五张）

- 依据：`.batch/night/reports/upstream-diff-eval-20261126.md`（提交 `50e7c23a`，140 行／`326e3104…`）
- 主人裁定：按推荐包立卡 = P0 三条 + S 两条；`i18n/core.ts`（L）与 `monitor-win-release-gate.ps1`（L）**暂缓**，不立卡。
- 铁律：**不 merge、不 cherry-pick**，按我方接口重写；上游行号一律不作依据（我方已脱敏重写）。

## 五张卡

### C1 · 取消与失败分离（M）
- 上游依据：`src/services/workflows/workflow-utils.ts`（`ee7b305b` `832d480b` `768735c4` `d4e31ca9` `27fdf08e` `ff9192b8` `edfd5c81`）
- 我方现状：`isWorkflowCancellation` 全仓 0 命中；`workflow-utils.ts:57`／`:60`／`:63`／`:236` 四处直抛 `new Error('工作流已取消')`。
- 范围：**新建**取消类型与判定函数，收口上述 4 个抛点；重试链不得把取消当失败；失败原因单一出口。
- 判据：4 个抛点各有单测；取消不计入失败统计；真实失败不被记成取消；既有红不扩大。
- 风险：最容易把「真失败」改记成取消，必须带回归单测。

### C2 · 回收站重名占位（M）
- 上游依据：`electron/services/manuscript-publisher.ts`（`5eb71454` `7e02aca1` `0efbdec2` `5bfbc3b4` `2cb88ad5`）＋ `ChapterDeletionRepository`
- 我方现状：`reservedManuscriptTargets`／`republishTarget` 0 命中，publisher 无 `reserved` 入参——**不是改调用点，是新建机制**。
- 范围：删除收据占位目录 + 选目标处必填入参，避免续跑清理删掉刚放回的书稿。
- 判据：构造「删除收据未清完 + 刚放回同名稿」用例，续跑清理后新稿仍在。
- 注意：与 C1 都会碰 `workflow` 侧代码，**不要与 C1 并行**在同一个 worktree。

### C3 · 网络失败三因细分（S/M）
- 上游依据：`src/services/generation/prompt-budget-failure.ts`（`674273e1` `5992318b`）
- 我方现状：`prompt-budget-failure.ts:62` 已有 `'network'` 一档、`:116` `NETWORK_FAILURES` 归入；上游同簇的 `electron/llm/transport-diagnostics.ts` 我方 **ABSENT**。
- 范围：先新建传输诊断载体，再分三因（未连上／中途断／代理不可达），三类文案同一套。
- 判据：三类各有构造用例；文案与原因一致；不新增依赖。

### C4 · 导入失败分项文案（S）
- 上游依据：`electron/controllers/import-controller.ts`（`589d20b4` `c3c2692a` `23249954` `626a6417`）
- 范围：编码／单文件 64MB 上限／总量上限／EPERM-EACCES 权限分项说明；系统权限类只在解析路径时报「系统不让打开」。
- 判据：单文件超限不再报成总量超限；四类各有用例。

### C5 · 本地化正则改错误码（S）
- 上游依据：`electron/controllers/external-file-grant-controller.ts`（与 #722 同批）
- 范围：按 `EXTERNAL_FILE_GRANT_*`／`SECURE_FS_*` 码 switch，删掉匹配中文文案的正则。
- 判据：切英文界面后同码仍命中；不牵引 i18n 大改（`i18n/core.ts` 不在此卡内）。

## 排期建议

1. **先起 C4、C5**（S 级、互不耦合，可两个 worktree 并行）。
2. **C1 单开设计先行**（新建类型，先给 3 行设计再落码），落码期间 C2 不动同一处。
3. **C2 在 C1 之后**（同触 workflow／发布侧，避免冲突）。
4. **C3 最后**（要先建载体，收益是细分，不阻塞别人）。

## 交付纪律

- 一卡一 owner，卡面写「来源簇／范围／判据／量级」四项，判据必须可跑（命令或构造用例）。
- 每卡提交独立，同提交带设计说明与判据证据；`pnpm check:fast` 必过。
- 卡面开头写「本卡为上游重写，非 cherry-pick」。
- 通道备注：本机 `github.com:443` 的 git／ssh 大流量不通，本次评估走 API＋codeload；**对象级 cherry-pick 不可用，一律按重写执行**。
