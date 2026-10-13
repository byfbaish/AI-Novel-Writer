# 用户级设置包（创作资产导出/导入）设计

> 提出：2026-10-13 · 触发：为「旧项目升级」前置备份 + 把「番茄文风 / 起点风」这类可复用 prompt 资产固化为一等能力
> 状态：**待审核，未编码**（本轮只做了现场备份，见 §1）
> 关联：`docs/design/prompt-payload-scoping-design.md`、`docs/design/chapter-prompt-pileup-triage.md`

---

## 0. 一句话结论

已存在的备份能力**全部以「项目」为作用域**，而且**必须先打开一个项目**才能用；用户级（`VELA_HOME`）的 `prompts/` `skills/` `skins/` 目前**没有任何导出/导入通道**。

固化时最关键的判断不是"打包"，而是：**不能把创作资产和个人环境打进同一个包**。
「番茄文风」是可以给别人的（创作资产）；`models.json` 里的 API Key 是绝对不能外流的（个人环境）。这两类必须在**内核层就切开**。

---

## 1. 本轮已完成的现场备份（不是设计，是既成事实）

| 项 | 值 |
|---|---|
| 备份位置 | `C:\develop\workspace\AI-writer\backups\user-settings-20261013-0230\` |
| 生效数据根 | `%USERPROFILE%\.ai-novel-writer-dev\generations\88ac198e-…-bb2bf88cb542\` |
| 迁移前旧根 | `%USERPROFILE%\.vela\` |
| 校验 | `vela-home-active` 104 文件、`vela-home-legacy` 23 文件，**逐文件 sha256 全等，0 缺失 / 0 多余 / 0 不符** |
| 清单 | 同目录 `MANIFEST.md`（含逐文件 hash、20 个 prompt 覆盖的可复用属性判定） |

附带结论（来自清单）：**20 个用户级 prompt 覆盖里，18 个判为「文风资产（可跨项目复用）」**——这正是"需要复用"的实际规模，也说明固化功能有真实需求，不是设想。

---

## 2. 现状核实（证据）

### 2.1 用户级数据根的实际内容

`VELA_HOME = %USERPROFILE%\.ai-novel-writer-dev\generations\<generation-uuid>\`

| 文件/目录 | 内容 | 体积 | 复用属性 | 含敏感 |
|---|---|---|---|---|
| `prompts/*.json` | 20 个 zh-CN 全局模板覆盖 | 104K | ✅ 可分享 | 否 |
| `skills/<name>/SKILL.md` | 用户级写作 Skill（**当前不存在**，从未使用） | — | ✅ 可分享 | 否 |
| `skins/` | `manifest.json`（activeSkin）+ `assets/` | 1K | ✅ 可分享 | 否 |
| `models.json` | 3 个模型定义 | 4K | ❌ 个人环境 | **明文 apiKey** |
| `config.json` | 主题/字号/代理/defaultModelId/单位偏好等 | 4K | ❌ 个人环境 | 代理配置 |
| `recent-projects.json` | 3 条**本机绝对路径** | 4K | ❌ 个人环境 | 本机路径 |

### 2.2 已有备份设施——全部项目级

| 设施 | 落点 | 作用域 | 前提 |
|---|---|---|---|
| 本地便携存档 | `project-archive-controller.ts:196 project:archive-export` / `:220 project:archive-restore` | **项目**（完整项目含 23M 正文库） | 必须打开项目 |
| 云备份 | `cloud-backup-controller.ts` + `webdav-backup-service.ts` | **项目**（世代化上传 WebDAV） | 必须打开项目 + 显式绑定 |
| 面板 | `src/components/backups/ProjectBackupPanel.tsx:131` | — | 明写「**请先打开一个项目**，再导出存档或配置云备份」 |

容器与安全机制（**可复用，不必另造**）：
- 容器 = **zip + manifest**（读用 `yauzl`；schema 在 `electron/services/portable-project-format.ts`）
- 有完整错误码体系（`PORTABLE_ARCHIVE_INVALID` / `_LIMIT_EXCEEDED` / `_SOURCE_UNSAFE` / `_TARGET_EXISTS`）与体积上限
- 文件授权走 `ExternalFileGrantService`：`issueSelectedGrant`（`project-archive-controller.ts:111`）→ **不透明 grantId、绑定窗口、一次性、TTL、窗口销毁即撤销**，渲染层永远拿不到真实路径

### 2.3 缺口

1. **用户级没有任何导出/导入入口**——`app-data-controller.ts` 只提供 `prompt:load/save/delete-global`（`:211/:258/:275`）与 `skills:*`（`:288~:384`），全是**单文件 CRUD**，没有"整包"概念。
2. **现有面板要求先打开项目**——用户"升级前备份用户设置"时可能**根本没有项目可开**，这条前提直接卡死。
3. **没有任何机制阻止把 API Key 分享出去**——`models.json` 与 `prompts/` 同处一根目录，手工复制极易连带外传。

---

## 3. 核心判定：两类内容必须分包

| | 创作资产包（可分享） | 个人环境包（不外传） |
|---|---|---|
| 内容 | `prompts/`、`skills/`、`skins/` | `config.json`、`models.json`、`recent-projects.json` |
| 典型用途 | 「番茄文风包」「起点文风包」「我的审稿规则包」 | 换机迁移、升级前兜底 |
| 分享风险 | 无 | **含明文密钥 + 本机路径** |
| 默认勾选 | ✅ 是 | ❌ 否 |

> 这条直接回答你的直觉：**"番茄文风"和"起点文风"是同一类东西（创作资产），应该能被不同用户互相交换**；
> 而"我的 DeepSeek Key / 我的代理"不属于文风，属于环境，默认不出包。

---

## 4. 包格式

```
<name>.vela-pack            （zip 容器，复用 portable-project-format 的 manifest 解析范式）
├── manifest.json
│     {
│       "formatVersion": 1,
│       "kind": "user-settings-pack",
│       "packKind": "creative-assets" | "full-settings" | "environment-only",
│       "createdAt": "2026-10-13T02:30:00+08:00",
│       "appVersion": "...",
│       "contains": { "prompts": [...keys], "skills": [...names], "skins": true },
│       "excludes": ["models", "config", "recent-projects"],
│       "entries": [ { "path": "prompts/xxx.zh-CN.json", "sha256": "…", "bytes": 3125 } ]
│     }
├── prompts/*.json
├── skills/<name>/SKILL.md
└── skins/manifest.json + skins/assets/**
```

设计要点：
- `manifest.contains/excludes` **显式声明**，导入侧据此判断能否接受，不靠猜文件名。
- `entries[].sha256` 逐文件指纹 → 导入时校验，兼作"包是否被手改过"的证据。
- **`models.json` 若被显式勾选，`packKind` 必须为 `full-settings`**，且导入侧要额外确认（见 §6）。

---

## 5. 包类型档位

| 档位 | 含 | 场景 | 本轮 |
|---|---|---|---|
| **创作资产包** | prompts + skills | 分享文风、备份创作规则 | ✅ **已实施** |
| 完整设置包 | 上述 + config + models | 换机整体迁移 | ⏸ 未做 |
| 仅环境包 | config + models | 只想搬模型/代理配置 | ⏸ 未做 |

> **v1 范围收窄（2026-10-13 拍板）**：创作资产包**只含 `prompts` 与 `skills`，不含 `skins`**。
> 理由：皮肤是**外观**而非创作规则，且皮肤 `manifest.json` 携带 `activeSkin` —— 原样导入会顺带
> 改掉使用者当前皮肤，属于隐式副作用；而当前皮肤数据约 1K、复用价值≈0。
> `UserSettingsPackChannels` 与 manifest 已为「按 kind 扩展」留好形状（`kind` + `excludes`），
> 后续要加回 skins 或另开两档，属于增量而非改形。

---

## 6. 落点（文件级）

| 层 | 文件 | 动作 |
|---|---|---|
| 主进程控制器 | `electron/controllers/user-settings-package-controller.ts`（新） | 导出/检查/导入三个 handler；写盘落点复用 `app-data-controller` 已有的路径守卫 |
| IPC | `settings-pack:export` / `settings-pack:inspect` / `settings-pack:import` | 命名与 `project:archive-*` 并列 |
| 文件授权 | 复用 `ExternalFileGrantService` + `issueSelectedGrant` | 新增 `dialog:select-settings-pack-export` / `-import`（**复用同一套不透明 grant，不新造**） |
| 打包 | 复用 `portable-project-archive.ts` 的写入器 + `portable-project-format.ts` 的 manifest 校验范式 | 只换 manifest 的 `kind` |
| 路径守卫 | 复用 `app-data-controller.ts:30 promptKeyPath()` 与 `:62 writingSkillDirectory()` | **禁止任何把包内路径直接拼到文件系统的写法** |
| 渲染层 | `src/components/settings/SettingsModal.tsx:65` 的 `backup` 分区 | 从「项目备份」升格为「**备份与迁移**」，下分两个作用域：项目存档（已有）/ 用户设置包（新增） |

---

## 7. 冲突策略与安全红线

### 冲突策略（导入时）
同名 prompt / 同名 skill 命中本地已有 → 三个选项，**不静默覆盖**：
1. **覆盖**（本地文件先落 `.bak-<ts>`，与既有 `prompts.bak-*` 惯例一致）
2. **跳过**
3. **并存**（重命名导入，如 `first_chapter_draft.qidian.zh-CN.json` —— 仅当 key 段合法）

### 红线（不可越）
1. **不信任包内容**：每个 JSON 必须过与 `prompt:save-global` 完全相同的校验（`isPromptTemplate` + `promptKeyPath` 的 key 正则 + 语言白名单）；skill 名过 `WRITING_SKILL_NAME` 正则；体积过 64K/文件上限。
2. **不引入任意路径写**：包内 header 只用于**选择**，实际落点永远是 `VELA_HOME/{prompts|skills|skins}/` 下的合法子路径（`isContainedPath` 校验 + `realpathSync.native` 防符号链接逃逸）。
3. **导入后必须提示遮蔽**：用户级覆盖会按 `project > global > builtin` **静默遮蔽内置模板**——这是既有机制，导入后要在 `PromptSettings` 显示来源与生效范围（可扩展现有 W1「内置已更新」徽标）。
4. **分享路径默认排除密钥**：`packKind ≠ full-settings` 时，`models.json` 根本不该进包，而不是"进了再提醒"。

---

## 8. 与既有设施的关系

- **不冲突**：项目存档（23M 正文库）↔ 设置包（<1M 配置）是不同作用域，独立入口。
- **可复用**：容器格式、错误码、grant 机制、路径守卫——**四处都不需要新造**，这是本设计能低成本落地的主要原因。
- **顺手补齐**：现有面板"必须先打开项目"的前提，在设置包入口处**不成立**（备份用户设置时通常没有项目），所以新入口必须**独立于项目会话**。

---

## 8.5 为什么不能拿「项目存档」当设置包用（2026-10-13 核实）

常见设想：*"项目备份里应该就有这些 prompt 吧？打开删掉小说信息就行。"*

**核实结论：不行，两个独立理由。**

### 理由一：项目存档里没有用户级 prompt

收集范围由白名单决定（`portable-project-assets.ts:84-92` 遍历 `CANONICAL_RAW_PROJECT_ASSETS`，定义在 `project-format-migration.ts:177`）：

| 进包 | 不进包 |
|---|---|
| `.ai-novel/prompts/`（**项目级**） | `VELA_HOME/prompts/`（**用户级 20 个覆盖**） |
| `.ai-novel/skills/`、`writing-skills.json` | `VELA_HOME/skills/` |
| `project.db`（sanitize 后）、`portable-knowledge-source.json` | `models.json`、`config.json`、`recent-projects.json`、`skins/` |
| `partial_arch(.json)`、`chapter_creation_log.json` | — |

实测当前项目级 `prompts/` 下**只有 1 个文件**（`refine_chapter.zh-CN.json`），承载「番茄文风」的 20 个覆盖**全在用户级**。
→ **删掉小说信息后剩下的是 1 个 prompt，不是你要的 20 个。**

> 附带发现（建议单独立项）：这 1 个项目级文件与用户级同名文件**字节完全相同**（sha256 前 32 位一致）。
> 按 `project > global` 优先级，**项目级遮蔽用户级** —— 即改用户级那份对本项目不生效。这是一处独立隐患。

### 理由二：存档是「有 schema + 逐文件指纹的 zip」，手改即失效

- manifest 由 `parsePortableProjectManifest` 严格校验（`exactKeys` + `PORTABLE_ENTRY_DISPOSITIONS` 白名单 + 逐文件 sha256）
- 手工删改 → 导入侧直接 `PORTABLE_ARCHIVE_INVALID`
- 即便把散文件抠出来手工摆回 `VELA_HOME/prompts/`：`prompt:load-global`（`app-data-controller.ts:236-242`）要求
  `promptFilename(parsed) === 文件名`，命名或语言后缀不符会**逐条进 diagnostics 并被跳过**

### 结论

「升级前备份用户设置」与「项目存档」是**两件事**，前者无法用后者替代 —— 这正是本设计存在的理由。

---

## 9. 实施结果（2026-10-13，已编码）

| 层 | 文件 | 说明 |
|---|---|---|
| 共享契约 | `src/shared/user-settings-pack.ts`（新） | 包类型/摘要/请求回执/错误码；`parsePromptFileName` 供两侧共用 |
| IPC | `src/shared/ipc-channels.ts` | 新增 `UserSettingsPackChannels` 并并入 `AllInvokeChannels` |
| 路径守卫 | `electron/services/user-asset-paths.ts`（新） | 从 `app-data-controller` **抽出**，保存/导入共用同一份判据 |
| 提示词读写 | `electron/services/user-prompt-store.ts`（新） | 同上；`readGlobalPromptTemplates`/`writeGlobalPromptTemplate` 唯一实现 |
| manifest | `electron/services/user-settings-pack-format.ts`（新） | 严格校验：精确键集合 + 路径白名单 + 限额 + 清单/条目交叉核对 |
| 容器 | `electron/services/user-settings-pack-archive.ts`（新） | store-only zip；临时文件 + 无覆盖硬链接发布；逐文件 sha256 复核 |
| 业务 | `electron/services/user-settings-pack-service.ts`（新） | 收集资产 / 冲突判定 / 三种策略落盘 / 备份 |
| IPC | `electron/controllers/user-settings-package-controller.ts`（新） | `export`/`inspect`/`import` + 两个选择器；**不依赖项目会话** |
| UI | `src/components/settings/UserSettingsPackPanel.tsx`（新） | 导出 / 检查（含冲突明细）/ 策略选择 / 导入回执 |
| UI | `SettingsModal.tsx` | `backup` 分区由「项目备份」升格为「备份与迁移」，双作用域并挂 |

### 相对原设计的两处偏离（有理由）

1. **没有复用 `portable-project-archive` 的写入器**。它的 manifest 被 `parsePortableProjectManifest` 用
   `exactKeys` 冻结在项目存档的 12 个字段上，承载不了另一种语义；且写入器面向「从磁盘大文件流式拷贝 +
   TOCTOU 身份复核」。创作资产包是 <16 MiB 的小包，因此独立实现 zip 编码，但**保留同样的安全姿态**
   （临时文件、无覆盖硬链接发布、逐文件 sha256、未知形状一律失败）。
2. **`inspect` 返回 `inspectId`，`import` 只消费该快照**。原来的 grant 是「一次性」的，检查会把它消耗掉，
   再导入就得重新选文件；而且重新读盘会把"检查后被替换"的空档放进来。改为**导入的正是你预览过的字节**。

### 测试（28/28）

- `user-settings-pack-format.test.ts`（9）：精确键集合、路径穿越/白名单外、清单与条目错配、大小写重复、非法时间与哈希。
- `user-settings-pack-archive.test.ts`（6）：中文路径往返、目标已存在拒绝、payload 被换（sha256 复核）拒绝、
  manifest 非首条目拒绝、zip 内目录穿越拒绝、非 zip 拒绝。
- `user-settings-package-controller.test.ts`（5）：导出**不含**个人环境四类；覆盖导入先备份；跳过；重命名并存；未知 `inspectId` 拒绝。
- 回归：`app-data-controller.test.ts` / `issue-88-global-prompt-persistence.test.ts`（重构后行为不变）、`preload-bridge.test.ts`。

---

## 10. 决策记录（2026-10-13 已拍板）

| 问题 | 结论 |
|---|---|
| 包类型档位 | **只做「创作资产包」**（最小、最安全、最贴合文风复用）；另两档挂起 |
| 扩展名 | **`.vela-pack`**（防被 Windows 当普通 zip 双击乱解） |
| 项目级 `.ai-novel/prompts/` 是否进包 | **不进**（它是项目资产，进包就要定义"跨项目"语义，本轮不做） |
| 是否合并「备份中心」 | **合并**：`backup` 分区升格「备份与迁移」，无项目时只显示资产包部分 |
| 是否加密钥「分享前检查」提示 | **加**（`SettingsModal` 模型表单 API Key 下方一行说明，**只提示不自动改**） |

### 仍未做（后续可增量）

- 「完整设置包 / 仅环境包」两档（含密钥强确认流程）。
- `skins` 纳入资产包（需先定义「导入皮肤是否切换 activeSkin」的语义）。
- 端到端 journey（`scripts/f04-v3-settings-backup-journey.mjs` 风格）；当前以控制器单测覆盖。
- 已登记的独立隐患：项目级 `refine_chapter.zh-CN.json` 与用户级同名文件字节相同 → 项目级静默遮蔽用户级（§8.5）。

---

## 附：本轮证据锚点速查

| 结论 | 锚点 |
|---|---|
| 用户级 prompt 落点与 key 校验 | `electron/controllers/app-data-controller.ts:30-45` |
| 用户级 skill 落点与守卫 | 同上 `:59-128` |
| 用户级读写 IPC 仅单文件 CRUD | 同上 `:211 / :258 / :275 / :288 / :314 / :331 / :384` |
| 项目存档 IPC 与 grant 模式 | `electron/controllers/project-archive-controller.ts:111 / :142 / :163 / :196 / :220` |
| 存档容器与错误码 | `electron/services/portable-project-archive.ts:1-30`、`portable-project-format.ts` |
| 备份面板与"必须先打开项目" | `src/components/backups/ProjectBackupPanel.tsx:131`、`SettingsModal.tsx:65` |
| 遮蔽优先级 | `promptCatalog`：`project > global > builtin` |
