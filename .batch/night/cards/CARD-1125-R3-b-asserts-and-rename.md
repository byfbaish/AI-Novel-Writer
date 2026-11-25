From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组 · 群分身

# CARD-1125-R3：B 三字段断言化 ＋ 四字段改名

状态：**等前置**（前置＝CARD-1125-R1 第 0 步取证落地；不与之并行，避免同批改数据与改判据）
估时：assert 文本 40 分钟 + 改名落盘 40 分钟 + 首验 20 分钟
执行方：developer（出 4–6 条 assert ＋ 互斥规则文本）；改名由 admin（数据单一写者）落盘；首验方：QA；终审：项目总负责人
类型：**B 类**（产出为文本 ＋ 数据件改名，`.runtime/` 在 gitignore 内，不产生仓库提交；若 assert 要进库另开 A 类）

依据：`.batch/night/staging/res-next/next-round-card-allocation.md`；`.batch/night/org/book-meta-requirements.md`（102 行／14,338 B／`b8e559c1…`）§2.5；`ext-review-1125-four-way-synthesis.md` §一·4、§四（Qwen 表外组合）。

## 0. 前置【硬】

- 工作目录 `C:\develop\workspace\AI-writer\develop`；只读脚本区 `.runtime/res-corpus/`。
- 开工前：`node .runtime/res-corpus/audit-coverage.mjs` 出表（现读 `files 14 rows 1197 completionBasis 143`）；文件 mtime 静默 ≥5 分钟才可作结论性读数，写盘中快照只作过程记录。
- 禁改需求件字段定义（只按 §2.5 现值名改数据）；禁动 `src/`。

## 1. 起因

四家一致：`confidence`／`completionVerified`／`statusClaimTrust` 各管一事没错，但四行情景表是人读约定、不是入库校验；盘上 14 个 jsonl 键名各异、`null` 483 行／缺键 639 行并存，靠 grep 捞不住矛盾样本。Qwen 具体举出表外组合：`statusClaimTrust:high + completionBasisSource:statusRaw + completionVerified:false`——报表第 4 行只统计「正文与状态位冲突」，不统计「字段互斥冲突」。

## 2. 要交什么

### 2.1 断言与互斥规则（developer，4–6 条）
新增 `.batch/night/reports/res-b-asserts-1125.md`，每条写：规则原文、触发条件、命中后动作（拒绝入库／标 `conflict`／降级）、可复现命令。至少覆盖：
1. `completionVerified:true` ⇒ `completionBasisSource ∈ {chapterText}`；
2. `completionBasisSource:statusRaw ⇒ statusClaimTrust ≠ high`（状态位不可信，只能 low）；
3. `statusRaw` 缺键 ⇒ `completionBasis` 必须以非 `no-status-tag` 前缀开头（缺键不等于「页面无标签」）；
4. 同一本书多件并存时的合并优先级（哪件胜出、其余如何记 `conflict`）；
5. `platformId` 为空 ⇒ `matchBasis ≠ id`。

### 2.2 四字段改名（admin 落盘）
`qidianBookId`／`platformBookId` → `platformId`；`matchMethod` → `matchBasis`（按五值映射，映不上写 `manual` 加理由）；单值 `titleAlias` → `akaTitles[]` 一项（`type` 按六值中取一）。改名前逐件留 `wc -lc` ＋ `sha256`。

## 3. 判据（每条带分层标）

1. `[static]` assert 条数 4–6，每条有触发条件与命中后动作；缺动作即打回。
2. `[static]` 五类覆盖齐（上列 1–5），可用 `grep -c '^### \|^[0-9]\. '` 计数核对。
3. `[mock]` 拿盘上现样本跑一遍规则（只读），至少一条规则能命中真实表外组合或明确报「0 命中及原因」；命令与输出原文进件。
4. `[static]` 改名前后逐件 `wc -lc` ＋ `sha256` 两列并列，行数不变、键名全部命中锁版（`grep -c '"platformId"'` 与总行数相等）。
5. `[static]` 改名后 `node .runtime/res-corpus/audit-coverage.mjs` 出表，`rows` 与改名前一致。
6. `[live]` 不改码证据：`git diff --name-only -- src` 为空；`git status --porcelain -uall` 无新增非 `.runtime` 件。

## 4. 回执四行头

```
From: CARD-1125-R3 · developer
To: 大肥鱼@主身
卡号：CARD-1125-R3｜会话：<会话标识>｜起点 sha：<HEAD 短 sha>
模式：工作模式｜模型：<派单指定模型原文>
```

## 5. 交付后

QA 重判「字段名与锁版一致」——**此前一律按未达标记**；改名那轮结束、本卡 3–5 条判据过之后才可改口径。我终审只核一条：表外组合是否真有规则拦住（拿 Qwen 举的那组做样本）。
