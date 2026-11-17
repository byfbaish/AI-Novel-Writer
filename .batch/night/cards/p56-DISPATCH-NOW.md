# p56 派卡现行口径（唯一执行说明 · 2026-11-16 09:35 由项目总负责人落盘）

> 本文件只解决一件事：**谁都不用凭记忆复述版本号**。执行前读这一份，按字面做。
> 与任何群消息冲突时，以本文件 + 盘上 `md5sum` 为准；群消息里的版本号一律不作依据。

## 1. 唯一执行件（v5，此后不再出版本）

| 件 | 路径（相对 `.batch\night\`） | 大小 | MD5 |
|---|---|---|---|
| 卡面 | `cards/p56-wb-docs-stale.v5.md` | 8,952B | `e87714c5bb41732ad52d0dd8c7b7ea47` |
| 派验单 | `review-requests/p56.v5.md` | 4,370B | `67246cd61b5db7cd5e5e01d6a32ad1a5` |

核对命令（执行前必跑，输出贴群）：

```
cd C:\develop\workspace\AI-writer\develop\.batch\night
md5sum cards/p56-wb-docs-stale.v5.md review-requests/p56.v5.md
```

## 2. 已作废（出现即丢弃，不必回话）

- 卡面 `p56-wb-docs-stale.v1.md` / `v2` / `v3` / `v4`
- 派验单 `p56.md` / `p56.v3.md` / `p56.v4.md`
- 哈希 `deb5ce3ea244e8fb534cef4b1d96dcb0`、`7eab7507f9c6eaaf29f7d5e4e4813339`、`94587fc0a6009e5e8118a2b0b3f07f33`、`05732b3b…`、`3fc6c277…`、`c6758d19…`

作废原因（不是改一行引用）：
- v4 的 `:9` / `:82` 指向已作废的 `p56.v3.md`，会把 QA 引到错件；
- v4 正文写「`wt-p56` 未建立」，与事实相反（目录 08:38 已建）；
- v5 = v4 + 改这两处引用与状态行，§0 六项校验与 §4 八条判据一字未动。

## 3. 前置状态（都已闭合，不要再等）

- 工作树：`C:\develop\workspace\AI-writer\wt-p56`，分支 `agent/p56-wb-docs`，HEAD `69cd4a41`；§0 六项校验 08:43 已过（双 diff 空）。
- WorkBuddy 空间：**已注册**（09:02 主人打开目录后生成）。只读副本读数：`spaces` 有 `wt-p56`（id `bfdc2208`、active）、`space_folders` = `C:\develop\workspace\AI-writer\wt-p56`、预演会话 `f419cacb`（cwd 正确、`model=deepseek-v4.1-flash`、`status=completed`）。
- 因此 `no-section` 报错不会再出现；**不再有任何「空间未建 / 11:30 报前置状态」这一步**。

## 4. 时间窗（硬）

- 09:00–12:00 高峰：不投。
- **12:00–14:00 首投**；失败一次即停，不连试、不换目录、不加 `--force`。
- 14:00–18:00 仍属高峰，禁止投；失败后顺延 **18:00 之后**。
- 11:50 有一次只读核对（不是投递，不占额度、不产生 exit 1），判据两条同时成立才算通过：
  ① `spaces` 有 `wt-p56`（id `bfdc2208`）；② `space_folders` 命中 `C:\develop\workspace\AI-writer\wt-p56`。
  `create_folder_path` 那个空目录不作判据。

## 5. 投递命令（必须同一窗口里先设 env，再跑 node）

```
$env:WORKBUDDY_ALLOWED_CWDS = "C:\develop\workspace\AI-writer\wt-p56"
node scripts/workbuddy/workbuddy-attach.mjs task --file .batch\night\cards\p56-wb-docs-stale.v5.md --cwd C:\develop\workspace\AI-writer\wt-p56 --model DeepSeek-V4.1-Flash
```

- 护栏只认 `DEFAULT_CWD`（`…\wt-2`），未设 env 会 `ok=false`；env 仅本进程有效，换窗失效，无需回滚。
- 禁 `--force`；禁改 WorkBuddy 库、禁点界面、禁开第二通道。
- 投递正文首段写死两句：「派验单以 `p56.v5.md` 为准、卡面以 v5 为准」。

## 6. 受件判定（三条同时成立才算投出去）

① 新会话 id ≠ 预演 `f419cacb`；② 起始时间 ≥ 12:00；③ `cwd` = `C:/develop/workspace/AI-writer/wt-p56`。

## 7. 交件四件套（缺第 ④ 项按未投递处理，QA 不开判）

① 终点提交 SHA；② `.batch/night/staging/p56-report.md`；③ 会话库行（session id / cwd / model / 起止 / status）；④ `read --session <id> --json` 全文。

## 8. 唤醒兜底链（无定时器，靠人补位）

- 11:47 `@大肥鱼` 发「11:50 只读核对」；11:50 无 → `@QA` 补；11:55 无 → `@产品经理` 补。
- 12:00「可以投了」同一顺序；三人全断时，**当时醒着的任何人**按同一句补位，不算越权。
- 不建计划任务（未获主人授权）。
- 14:00 前始终无人唤 → 记一笔「首发顺延 18:00 后」，不许自行开投。

## 9. 执行方边界

WorkBuddy 只改两文件：`docs/agents/workbuddy-channel.md`、`scripts/workbuddy/workbuddy-attach.mjs`（判据层，按书面终裁 `staging/verdict-wb-docs-debt-1116.md`）。禁 push / tag / publish；禁动 `model-policy.mjs`、`docs/adr/`、`worktree-parallel.md` §3.1。
