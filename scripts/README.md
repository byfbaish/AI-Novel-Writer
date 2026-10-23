# scripts/ 索引

> **这个目录放什么**：仓库级的**开发 / 验收 / 打包 / 发布**工具——门禁检查、Electron 与 Playwright 端到端验收、原生模块准备、打包校验、一次性运维脚本。
>
> **不放什么**：业务代码（去 `src/`、`electron/`）、产品运行时逻辑、临时调试脚本（临时脚本请放仓库根的 `.tmp-*` 或 `.runtime/`，不要进 `scripts/`）。`scripts/` 里的东西**不进产物**，但会被 CI 与发布流程直接调用。

**现状**：顶层 76 个可执行脚本 + 4 个子目录（`lib/` 3 个共享模块、`__tests__/` 46 个测试、`fixtures/` 与 `browser-fixtures/` 测试夹具）。
本页只索引**顶层脚本**；子目录见文末 §7。

---

## 1. 怎么用这张表

反向索引：**我要做 X → 跑哪个脚本**。

| 我要… | 直接跑 | 说明 |
|---|---|---|
| 提交前确认文档没断链 | `node scripts/check-doc-links.mjs` | 唯一的文档门禁，`broken 0` 才算过 |
| 提交前确认中英文案覆盖率 | `pnpm run check:i18n` | 包装了 `check-i18n-coverage.mjs` |
| 本地起开发环境 | `pnpm dev` | `predev` 会自动跑 `prepare-native-for-electron.mjs` |
| 清掉旧构建产物 | `pnpm run clean:build` | 只删 `dist/` `dist-electron/` `release/<version>/` |
| 打未打包目录做本地验证 | `pnpm run build:win-dir` | 末尾自动跑 `verify:win-package` |
| 出正式 Windows 安装包（含全量门禁） | `pnpm run build:win` | 等价 `release:win:verify` → 测试 / 构建 / 三项冒烟全跑 |
| 只出产物、不跑门禁（CI 内部用） | `pnpm run build:win:artifacts` | 先过 `require-release-gate.mjs`，直连会被拦 |
| 校验装出来的包能不能用 | `pnpm run verify:win-package` | 查 asar、原生模块 ABI、LanceDB 绑定 |
| 校验更新产物 / GitHub Release 元数据 | `pnpm run verify:win-update-artifacts`、`pnpm run verify:github-update-release` | |
| 跑渲染层视觉/交互端到端 | `pnpm run test:renderer-surface:e2e` | |
| 验收「启动就能用」（全局 / 项目存储 / WebDAV 备份 / 生成归属） | §4 的 5 个 `*-startup-acceptance.mjs` | 每个都要真起 Electron |
| 某个 F04/F05 用户故事签收 | §5 的 `f04-*` / `f05-*` | 全部要**固定版本的已打包 exe + 三个哈希** |
| 花真钱跑一次真实模型资格 | `node scripts/real-provider-generation-qualification.mjs --dry-run` 先看计划 | 不加 `--dry-run` 会产生账单 |
| 抢救误删的章节正文 | `node scripts/restore-drafts-from-backup.mjs` | 一次性运维，先读文件头注释 |
| 修「定稿后正文被改」的收据失效 | `node scripts/repair-finalization-receipts.mjs` | 一次性运维，先读文件头注释 |

> **凡是不带 npm script 别名的脚本，都是「有明确触发场景才跑」的专项工具**，不要顺手全跑——多数要真起 Electron、装包或调真实模型。

---

## 2. 门禁 / 提交前必跑（6）

| 脚本 | 用途 | 何时跑 | 谁调用 |
|---|---|---|---|
| `check-doc-links.mjs` | 扫 `docs/` 内相对链接，断链即失败 | **每次改动 docs 后、提交前** | 手工；`docs/README.md` §2.5 硬性要求 |
| `check-i18n-coverage.mjs` | 检查渲染层可见文案的中英覆盖，含边界错误路径 | **改 `src/` 里任何用户可见字符串后** | `pnpm run check:i18n` |
| `require-release-gate.mjs` | 占位闸门：校验 `AI_NOVEL_RELEASE_GATE=release-win-verify`，否则拒绝出包 | 由 `build:win:artifacts` 自动前置，**不要手动单跑** | `pnpm run build:win:artifacts` |
| `release-win-launch-gate.mjs` | 启动门禁的 arming 包装：记录 `--armed-path` / `--release-path` 后执行子命令 | 发布流水线内部，包启动前后各一次 | CI（workflow 内联） |
| `canonical-pnpm-lockfile-hash.mjs` | 对 lockfile 只归一化行尾再算哈希，避免 CRLF/LF 造成假差异 | Windows 资格任务与 Linux 提升任务比对 lockfile 时 | CI（`*.yml` 引用） |
| `vitest-worker-diagnostics.cjs` | Vitest reporter，只采 worker 元数据，不改参数/重试/超时 | CI 跑 `pnpm test` 时附加 | CI（`pr-ci.yml` 等） |

---

## 3. 原生模块 / 构建准备（4）

| 脚本 | 用途 | 何时跑 | 谁调用 |
|---|---|---|---|
| `prepare-native-for-electron.mjs` | 把 `better-sqlite3` / `@lancedb/lancedb` 重建到 Electron ABI | **每次装完依赖、每次切 Node/Electron 目标前** | `pnpm dev` 的 `predev`、`pnpm run rebuild`、`pnpm run rebuild:electron` |
| `prepare-native-for-node.mjs` | 反向重建到当前 Node ABI，供 vitest / node 脚本使用 | 跑完 Electron 相关流程、要回跑单测时 | `pnpm run prepare:native-node` |
| `release-native-restore.mjs` | 带独立兜底的 ABI 恢复：监控流程已报失败时再完整恢复一遍 | 发布流程收尾（`release-win-verify` 内部） | `release-win-verify.mjs` 导入 |
| `clean-build-output.mjs` | 删除 `dist/` `dist-electron/` `release/<version>/`，先校验版本号格式 | 打任何包之前，避免旧产物混入 | `pnpm run clean:build`；`build:win-dir` / `build:mac:*` 内部 |

---

## 4. 打包 / 发布 / 证据（12）

| 脚本 | 用途 | 何时跑 | 谁调用 |
|---|---|---|---|
| `release-win-verify.mjs` | **Windows 发布总门禁**：串起 test → 原生准备 → 清构建 → 出包 → 三项 verify → 三项 smoke → 恢复 ABI → 静默收尾 | **出正式 Windows 包只走这一个入口** | `pnpm run release:win:verify`；`pnpm run build:win` |
| `verify-win-package.mjs` | 校验解包目录：asar 内容、原生模块 ABI、LanceDB 绑定文件 | 出完 `--win dir` 或安装包之后 | `pnpm run verify:win-package`；`build:win-dir` 末尾 |
| `verify-win-update-artifacts.mjs` | 校验更新产物（`latest.yml` / blockmap / 渠道 / 仓库归属） | 准备发布前 | `pnpm run verify:win-update-artifacts`；被 `verify-github-update-release` 导入 |
| `verify-github-update-release.mjs` | 校验 GitHub Release 侧的更新元数据与产物一致 | 发布到 GitHub 之后 | `pnpm run verify:github-update-release` |
| `build-release-vector-smoke-runner.mjs` | 用 esbuild 把 `electron/release-vector-smoke-runner.ts` 打成 CJS runner（electron 走 stub） | macOS 出包流程前置 | `build:mac:arm64:artifacts` / `build:mac:x64:artifacts` |
| `release-vector-smoke-electron-stub.mjs` | 上者的 Electron API 桩：调用即抛，逼出「打包冒烟不该碰 Electron 路径」 | 仅被 `build-release-vector-smoke-runner.mjs` alias 引用 | 无（被 import） |
| `release-evidence-v2.mjs` | 发布证据 v2 的生成 / 合并 / 定稿库（`finalizeReleaseEvidence` 等） | 被两个 cloud-build manifest 脚本与 CI 调用 | CI（28 处引用）；`generate-*-manifest.mjs` |
| `generate-cloud-build-manifest.mjs` | 汇总 Windows 云构建产物清单并定稿证据 | Windows 云构建任务收尾 | CI（`windows-cloud-build-test.yml`） |
| `generate-macos-cloud-build-manifest.mjs` | 同上，macOS 版本 | macOS 云构建任务收尾 | CI（`macos-*-cloud-build.yml`） |
| `package-win-zip.ps1` | 打便携 zip（读 `package.json` 版本、算 SHA256） | 需要便携版分发包时 | 手工；CI 便携产物步骤 |
| `monitor-win-release-gate.ps1` | 发布门禁的外部监控：读控制文件 / 写状态与证据，超时或崩溃则判失败 | 由 `release-win-verify.mjs` 作为外部看门狗拉起 | `release-win-verify.mjs` |
| `windows-test-failure-metadata.ps1` | 只读投影 Windows 应用崩溃事件元数据，**绝不打印消息体/路径/dump** | Windows CI 测试失败后排查 | CI（`windows-cloud-build-test.yml`） |

---

## 5. 冒烟 / 端到端（5）

| 脚本 | 用途 | 何时跑 | 谁调用 |
|---|---|---|---|
| `smoke-win-app.ps1` | 装完的 exe 启动冒烟：观察窗口、进程身份、崩溃与残留 | 每次出 Windows 包后 | `pnpm run smoke:win-app`；`release-win-verify` 内；`monitor-win-release-gate.ps1` 反向复用它做库 |
| `smoke-win-installer.ps1` | 安装器冒烟：静默安装 / 升级 / 卸载 / 残留检查 | 每次出安装包后 | `pnpm run smoke:win-installer`；`release-win-verify` 内 |
| `smoke-win-v025-upgrade.ps1` | 从 v0.2.5 旧版升级到当前版的回归冒烟（含固定 SHA 校验） | 需要验证老用户升级路径时 | `pnpm run smoke:win-v025-upgrade` |
| `smoke-macos-dmg.sh` | macOS DMG 冒烟（挂载、启动、架构匹配） | 每次出 macOS 包后 | `pnpm run smoke:mac-dmg` |
| `renderer-surface-e2e.mjs` | 渲染层端到端：跑 `vitest.browser` 用例并比对像素/文本通道容差 | 改动 UI 表面、主题、图谱等之后 | `pnpm run test:renderer-surface:e2e` |

---

## 6. 启动 / 存储 / 备份验收（S04–S06，5）

全部是 `playwright` + `_electron` 真起 Electron，产物落在 `.runtime/.cache/`，**不要并发跑**（会抢同一个 Electron 配置目录）。

| 脚本 | 用途 | 何时跑 | 谁调用 |
|---|---|---|---|
| `global-startup-acceptance.mjs` | 全局启动验收：外观/主题/UI 版本缓存、首次启动落盘 | S 系列改到启动路径后 | 手工 |
| `project-storage-startup-acceptance.mjs` | S04-b01 项目存储布局验收：legacy/canonical/userData 多 profile 迁移 | 改到项目目录解析或存储布局后 | 手工 |
| `webdav-backup-startup-acceptance.mjs` | S04-b02 WebDAV 备份启动验收 | 改到备份链路后 | 手工 |
| `generation-owner-startup-acceptance.mjs` | S05 生成归属验收：生成期间归属标记与并发保护 | 改到生成归属 / 锁后 | 手工 |
| `draft-generation-startup-acceptance.mjs` | S06b 草稿生成启动验收 | 改到草稿生成启动路径后 | 手工；有 `__tests__/draft-generation-startup-acceptance.test.mjs` |

---

## 7. F04 / F05 打包用户故事验收（28）

> ⚠️ **共同前提**：这批脚本**都要求固定版本的 Windows 已打包产物**，参数形如
> `--package-dir=<win-unpacked> --package-source-sha=<sha> --exe-sha256=<hash> --asar-sha256=<hash>`，
> 任何一项对不上就直接失败——这是「证据可复现」的设计意图，不是 bug。
> 多数支持 `node <脚本> --help` 打印确切参数；支持 `--reuse-package=<previous receipt>` 的可复用上一轮构建。
>
> 这批文件**没有头部注释**，下表的「用途」由文件名 + `--help` 文本 + 脚本内 `owner` 标记推断，见 §9 待确认清单。

### 7.1 F04 V3（4）

| 脚本 | 用途 | 何时跑 |
|---|---|---|
| `f04-v3-thin-slice-journey.mjs` | F04 V3 最小纵切：建项目 → 写 → 存 → 读 | F04 V3 竖切改动签收时 |
| `f04-v3-characters-journey.mjs` | F04 V3 角色卡全流程 | 角色资产链路改动签收时 |
| `f04-v3-settings-backup-journey.mjs` | F04 V3 设置与备份 | 设置包 / 备份改动签收时 |
| `f04-v3-history-recovery-journey.mjs` | F04 V3 历史版本与恢复 | 历史 / 恢复链路改动签收时 |

### 7.2 F05 单测号（22）

| 脚本 | 用途 | 何时跑 |
|---|---|---|
| `f05-u01-transitions-journey.mjs` | U01 场景/视图切换；隔离的 V3 项目状态迁移 | U01 改动签收时 |
| `f05-u02-appearance-journey.mjs` | U02 外观/皮肤/背景；支持 `--background-only` 单独验 A04 | U02 外观改动签收时 |
| `f05-u02-migration-journey.mjs` | U02 偏好迁移（v1/v2 → 现行 schema）；`--a07-current` 走现行构建 | 改到偏好 schema 迁移时 |
| `f05-u03-controls-journey.mjs` | U03 控件层交互 | U03 控件改动签收时 |
| `f05-u03-settings-journey.mjs` | U03 设置面板（打包态） | U03 设置改动签收时 |
| `f05-u04-architecture-journey.mjs` | U04 架构视图（五层 / 故事弧呈现） | U04 改动签收时 |
| `f05-u05-blueprint-draft-journey.mjs` | U05 蓝图 → 草稿生成 | U05 改动签收时 |
| `f05-u06-editor-journey.mjs` | U06 编辑器；支持性能 / IME / 历史经典三种互斥模式 | U06 编辑器改动签收时 |
| `f05-u07-dirty-tabs-journey.mjs` | U07 脏标签页与关闭确认 | U07 改动签收时 |
| `f05-u08-shelf-journey.mjs` | U08 书架 | U08 改动签收时 |
| `f05-u11-graph-profile-journey.mjs` | U11 人物关系图谱（焦点模式，互斥单选） | U11 图谱改动签收时 |
| `f05-u12-confirmation-journey.mjs` | U12 确认流 A01–A08；`--a06-only` / `--diagnose-a06-lifecycle` 可单独跑 | U12 确认流改动签收时 |
| `f05-u13-history-seal-journey.mjs` | U13 历史列表 + 工作流状态封存子证据 | U13 历史封存改动签收时 |
| `f05-u14-save-feedback-journey.mjs` | U14 保存反馈 | U14 改动签收时 |
| `f05-u15-export-journey.mjs` | U15 导出（主体路径） | U15 导出改动签收时 |
| `f05-u15-original-copy-journey.mjs` | U15 原文副本 / 对照导出 | U15 原文对照改动签收时 |
| `f05-u15-plot-narrative-journey.mjs` | U15 情节叙事导出 | U15 叙事导出改动签收时 |
| `f05-u16-local-recovery-journey.mjs` | U16 本地 / 云端恢复；`--reuse-package` 复用上一轮 | U16 恢复改动签收时 |
| `f05-u16-packaged-journey.mjs` | U16 打包态主验收，可作其它 journey 的 driver 复用 | U16 打包验收 |
| `f05-u16-recovery-boundaries-journey.mjs` | U16 恢复边界（异常态穷举） | U16 边界改动签收时 |
| `f05-a11-offline-import-journey.mjs` | A11 离线导入（直接调 LanceDB，绕过 UI） | 离线导入链路改动签收时 |
| `f05-u13-writer-journey.mjs` | U13 Writer 主流程，带本地 loopback 合成 provider SSE | U13 Writer 改动签收时 |

### 7.3 F05 辅助工具（2）

| 脚本 | 用途 | 何时跑 |
|---|---|---|
| `f05-u11-graph-browser-receipt.mjs` | 用 `vitest.browser` 给 U11 图谱交互补证据（U10.A07 / U11.A01–A07） | 图谱交互需要浏览器侧补充证据时 |
| `f05-u16-native-picker.ps1` | 原生文件选择对话框自动化（UI Automation），供 U16 打包验收调用 | 由 journey 脚本拉起，不手动跑 |

---

## 8. 质量现代化 / 资格判定（7）

| 脚本 | 用途 | 何时跑 | 谁调用 |
|---|---|---|---|
| `quality-modernization-run.mjs` | Program v3 质量现代化主执行器：分阶段跑真实生成并落证据 | 需要一次完整质量现代化资格跑时 | 手工；`docs/` 里 32 处引用 |
| `quality-modernization-driver.mjs` | 上者的驱动层：场景编排、生产桥接、配对回执校验 | 被 `run.mjs` 导入；单独跑无意义 | `quality-modernization-run.mjs` |
| `quality-modernization-receipt.mjs` | 回执读写与校验（PII 脱敏、哈希、UUID、直连持久化证据） | 被上面两个导入 | `run.mjs` / `driver.mjs` |
| `project-migration-acceptance.mjs` | 跑 Electron 侧迁移套件（角色资产 / 安装车道 / 项目格式 / 访问控制）并汇总回执 | 改到 `electron/migrations/` 或项目格式后 | 手工；`docs/` 里 9 处引用 |
| `real-provider-generation-qualification.mjs` | 真实 provider 资格跑。`--dry-run` 只出计划；真跑需显式确认环境变量 + 剪贴板取 key，**不落盘任何凭据** | 需要证明真实模型可用性时（**会产生费用**） | 手工 |
| `run-continuity-calibration.mjs` | 走 SiliconFlow 的章节连续性校准（固定 source SHA、最多 20 次请求） | 调整连续性审稿 prompt 后复校 | 手工；`scripts/lib/continuity-calibration.mjs` 提供纯函数 |
| `vitest-worker-diagnostics.cjs` | 仅元数据的 Vitest reporter：记录 worker 事件与哈希，**不改** worker 参数、返回值、错误、重试策略与超时 | 由 CI 的 reporter 配置挂载，非手工调用 | CI（仓库内无对应 `pnpm` script，`.github/` 里也未找到挂载点） |

---

## 9. 更新 / 数据 / 探针（5）

| 脚本 | 用途 | 何时跑 | 谁调用 |
|---|---|---|---|
| `windows-in-app-update-e2e.ps1` | 应用内更新端到端编排（读 plan、写证据、超时与残留控制） | 验证 Windows 应用内更新全链路 | CI（`windows-in-app-update-e2e.yml`）；手工 |
| `windows-in-app-update-e2e.mjs` | 上者的 Node 侧实现 / 主入口 | 同上 | 同上 |
| `windows-in-app-update-e2e-driver.mjs` | Playwright 驱动：点「检查更新 / 下载更新 / 立即重启更新」并断言 | 被上面两个拉起，不单独跑 | `windows-in-app-update-e2e.ps1` |
| `upgrade-data-fixture.mjs` | 构造升级用数据夹具（SQLite + LanceDB + Arrow schema） | 需要造老版本数据快照时 | 手工；`docs/` 引用 |
| `probe-legacy-project-open.mjs` | 遗留项目打开探针，`--draft-write-proof` / `--roster-*-proof` 等模式验具体写入 | 排查老项目读写出问题时 | 手工；CI 里由 Playwright 侧拉起 |

---

## 10. 一次性 / 运维 / 待清理（6）

| 脚本 | 用途 | 何时跑 | 现状 |
|---|---|---|---|
| `restore-drafts-from-backup.mjs` | 从备份库按章捞回被误删的草稿与正文（2026-10-23 事故恢复） | **仅当已发生误删**，且产品侧「退回草稿」不可用时 | 有完整中文头部注释，可安全参照执行 |
| `repair-finalization-receipts.mjs` | 补齐 `finalization_outbox` 里失效的定稿快照 / 哈希（2026-10-23）；**并级联更新下游草稿的依赖指纹**（2026-10-24 补） | 出现「定稿正文来源收据已失效」且需批量修时 | 有完整中文头部注释；只改收据与指纹，不动正文 |
| `repair-stale-draft-dependencies.mjs` | 更新 `drafts.source_dependencies` 里过期的前文内容指纹（2026-10-24）。**默认 dry-run**，`--apply` 才写且先备份 | 提交新章报 `GENERATION_DRAFT_SOURCE_STALE`，且确认前文改动是作者认可的之后 | 有完整中文头部注释；只改指纹，不动正文与定稿回执 |
| `watch-backlog-lock.ps1` | 轮询监视 `docs/plans/prompt-assembly-backlog.md` 是否被改（默认 300s，2s 一次） | 多 agent 并行改台账时防止互相覆盖 | 手工调试工具 |
| `zz-abtest-rigid-qualitative.mjs` | 临时 A/B 实验：刚性内容 × 定性-only 状态块 vs 无状态块 | 已跑完，保留结论用 | **文件头自注「临时实验（可删）」**，见 §11 |
| `project-directory-grant.mjs` | 测试辅助：在合成夹具里伪造目录选择对话框并签发授权 | **不是入口脚本**，只被各个 journey / acceptance 导入 | 库文件误放顶层 |

---

## 11. 子目录

| 路径 | 内容 | 说明 |
|---|---|---|
| `lib/` | `continuity-calibration.mjs`、`draft-dependency-repair.mjs`、两个 `*.node-test.mjs` | 纯函数与修复逻辑：`continuity-calibration` 被 `run-continuity-calibration.mjs` 导入；`draft-dependency-repair` 被 `repair-finalization-receipts.mjs` 与 `repair-stale-draft-dependencies.mjs` **共用**（找出/更新过期的来源依赖指纹） |
| `__tests__/` | 46 个 `*.test.ts` / `*.test.mjs` | **`scripts/` 自己的单测**（门禁脚本、release 逻辑、CI workflow 契约）；由 `pnpm test` 一并跑 |
| `fixtures/` | `quality-modernization-production.fixture.mjs`、`s14a-baseline-native-source.json.gz`、`s14c-official-old-sources/`（LanceDB 二进制老版本快照） | 升级 / 迁移测试的输入，**不要手改**；`s14c-*` 内是真实 LanceDB 目录结构 |
| `browser-fixtures/` | `locale-shell-harness.*`、`update-section-harness.*` | `vitest.browser` 的 HTML/TSX 夹具页 |

---

## 12. 未解之谜 / 待清理

**只登记，不删。** 动之前先找作者确认。

### 12.1 被文档/CI 引用但本分支不存在的脚本（16 个）

`.github/workflows/*.yml` 与 `docs/research/novel-quality-modernization/donor-delta.json`（冻结区）里引用了下列路径，但 `scripts/` 下**没有**这些文件，git 历史里也查不到：

`github-desktop-promotion.mjs`、`freeze-release-contract.mjs`、`finalize-legacy-qualification.mjs`、`validate-release-profile.mjs`、`release-artifact-retention.mjs`（含 `.test.mjs`）、`project-legacy-qualification.mjs`、`legacy-qualification-adapter.mjs`、`check-legacy-boundaries.mjs`、`verify-built.mjs`、`qualify-release.mjs`、`qualification-web-backend.mjs`、`link-self.mjs`、`install.js`、`tmp-guard-override.mjs`、`zz-probe-jump-persist2.mjs`

→ **判断**：这批大概是发布分支 / 另一条实验线上才有的脚本。**如果这些 workflow 在本分支要跑，会直接失败**；若只在上游分支跑，则只是索引噪音。需作者裁定是「补回脚本」还是「清理 workflow 引用」。

### 12.2 `release-win-verify.mjs` 引用了不存在的 npm script

`release-win-verify.mjs` 的 `releaseFinalizationSteps` 里写着 `restore:native-node`、`verify:native-node`、`final:quiet`，但 `package.json` 的 `scripts` 里**没有**这三个名字（只有 `prepare:native-node`）。看起来是重命名后漏改，收尾阶段可能空跑或报错。

### 12.3 明确的临时脚本

- `zz-abtest-rigid-qualitative.mjs` —— 文件头自注「临时实验（可删）」，且 `zz-` 前缀是典型临时命名。结论若已进设计稿，可删。
- `watch-backlog-lock.ps1` —— 多 agent 并行时的临时看门狗，不是产品流程的一部分。

### 12.4 命名/位置问题

- `project-directory-grant.mjs` 是**库**不是**入口**，放在顶层容易让人误以为能直接 `node` 它。建议移到 `scripts/lib/`（需同步改 6 处 import）。
- `f04-*` / `f05-*` 共 28 个文件占了顶层 37%，且全部是「固定包 + 三哈希」的重型验收。建议后续收进 `scripts/journeys/` 子目录（本索引暂按现状登记，不动文件）。

---

## 13. 维护约定

1. **新增脚本必须同时在本页登记**：加一行，写清「用途 / 何时跑 / 谁调用」。没有「何时跑」的条目视为无效条目。
2. **脚本改名或删除，必须同一次提交里改本页和所有引用方**（`package.json`、`.github/workflows/*.yml`、`docs/`）。
3. **一次性脚本请在文件头注释里写明「一次性 + 日期 + 触发条件」**，并在 §10 登记；用完记得回来删条目。
4. **注意**：`node scripts/check-doc-links.mjs` 只扫 `docs/**/*.md` 和仓库根的 `*.md`，**本页不在检查范围内**。本页增删脚本后请手工核对一次文件名。
