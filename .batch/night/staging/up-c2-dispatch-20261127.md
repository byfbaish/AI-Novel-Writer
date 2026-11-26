# 派单 · C2 回收站重名占位（卡 `d9117e48` · 上游吸收 M · 非 cherry-pick）

From: 项目总负责人 · AI writer项目组
To: WorkBuddy（经 workbuddy联络人 转交）
派单方回执对象：项目总负责人
日期：2026-11-27 00:25

> **本件必须与 `.batch/night/staging/ext-dispatch-header.md`（42 行）同读**，那份是标准头（§0 必读五件与开工前三行确认／§0.1 跨 agent 红线／§0.2 回执头／禁交互式提问与 blocker 件路径／派单后只调一次脚本不许轮询）。本件只写卡本身，不重复标准头。

## 0. 一句话

我方发布链路目前**没有**「删除收据占位」机制：上游加了占位目录与「选目标处必填 reserved 入参」，避免续跑清理把刚放回的同名书稿删掉（丢稿，属数据安全）。这卡是**新建机制**，不是给上游改动打补丁。

## 0.1 我方现状（已核，直接用）

| 事实 | 读数 |
|---|---|
| 发布器 | `electron/services/manuscript-publisher.ts`，140 行 |
| 导出面 | `resolveManuscriptTarget`（:65）、`serializeManuscript`（:90）、`publishManuscript`（:102）、`removePublishedManuscript`（:128） |
| `reservedManuscriptTargets` / `republishTarget` / `reserved` 入参 | 全仓 **0 命中**（新建机制的依据） |
| 删除侧 | `electron/repositories/chapter-deletion-repository.ts`（449 行）＋`electron/services/chapter-deletion-service.ts`（268 行） |
| 其他发布调用点 | `electron/services/finalization-service.ts`、`electron/repositories/finalized-draft-import-repository.ts`、`electron/controllers/__tests__/chapter-lifecycle-deletion.test.ts` |
| 上游来源提交（只作参考，不给现成补丁） | `5eb71454`、`7e02aca1`、`0efbdec2`、`5bfbc3b4`、`2cb88ad5`（簇 A2-②） |

取上游内容只许用这条（**不许**对象级 cherry-pick，实测有 modify/delete 冲突）：

```bash
cd /c/develop/workspace/AI-writer/develop
git diff 549522d4..upstream/master -- electron/services/manuscript-publisher.ts
git log --oneline 549522d4..upstream/master -- electron/services/manuscript-publisher.ts
```

## 1. 范围（做什么／不做什么）

**做**：
1. 建立「删除收据占位」：删除书稿时登记一个占位目标（记录在册，含清理时机），续跑清理时能识别「这个目标有删除收据在手」。
2. 选目标处**必填** `reserved` 入参：`resolveManuscriptTarget` 这类选目标函数的调用点必须全部传（新建机制，不是可选参数）。
3. 续跑清理逻辑：遇到「占位在手 ＋ 盘上已有同名新稿」时，**保留新稿、只清收据**，不得按旧规则删。

**不做**（超出本卡即退）：
- 不改上游路线的东西（版本号、发布流程、UI）。
- 不动 `i18n/core.ts`、不扩 `electron/security/` 白名单。
- 不重构 `chapter-deletion-repository.ts` 的既有 API 形状（只加占位登记与查询，不改既有函数签名语义）。

## 2. 判据（三条，缺一不通过）

1. **[mock]** 构造「删除收据未清完 ＋ 盘上刚放回同名稿」的用例：跑续跑清理后，**新稿仍在**、收据被清。必须给出用例名与断言原文；只写「已覆盖」不算。
2. **[static]** 选目标处**全部**传参：先列出调用点清单（文件:行 + 每个调用点传了什么），逐个核过；清单里漏一处或某处没传 `reserved` 即不通过。清单要写进交付件。
3. **[static]** 单测覆盖占位目录的建立与清理两条路径，`pnpm test <你改动的测试路径>` 通过；同时 `pnpm check:fast` 通过。

**判据证据格式**：每条判据对应一条「命令／用例名 → 输出原文」。截图不算。

## 3. 起跑条件与边界

- 起点：`wt-c2`，分支 `card/up-stream-c2-recycle-placeholder`，起点提交 `b81a7fa6a`（已含 `node_modules` junction，勿动）。
- **外派不 commit、不 push、不 merge、不动 develop**：改动留在 `wt-c2` 工作树，提交由我方做。上一轮豆包与 WorkBuddy 都因派单件写「提交一笔」踩过这条，本件明确：**只留工作树**。
- 允许改的路径（超出即停手回报）：`electron/services/manuscript-publisher.ts`、`electron/repositories/chapter-deletion-repository.ts`、`electron/services/chapter-deletion-service.ts`、`electron/services/finalization-service.ts`，以及它们的 `__tests__` 下新用例。
- 不新增依赖。
- 一次只做本卡；做完停下等派下一张。

## 4. 交付与回执

- 产物目录：`C:\tmp\up-c2\workbuddy\`（一卡一目录，别与别卡混写）。
- 回执头两行（缺则 relay 注入行报 from=UNKNOWN）：
  ```
  From: d9117e48 · WorkBuddy
  To: 大肥鱼@主身
  ```
- 回执里必须写：**当前工作模式与模型**（须是工作模式；模型须是派单指定的 DeepSeek V4.1 Flash，写「快速」即不合格）、起点 sha、改动了哪几个文件、三条判据各自证据、调用点清单、`pnpm check:fast` 输出尾部。
- 推不动就写 `.batch/night/bridge/to-owner/blocker-20261127-d9117e48.md`（三段：卡点／已试过什么／需我方裁什么＋2–3 选项），写完继续做其余可做部分——**不许用选项卡／选择题／反问把决策抛回来**。
