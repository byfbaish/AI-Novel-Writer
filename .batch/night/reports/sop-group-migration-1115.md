# 群迁移 SOP（AI writer项目组 · 2026-11-15 草案 v0.4）

> v0.4 变化：吸收 QA、总负责人、developer、产品经理 四份评审——交接稿扩到八节（加"现行判据版本与作废清单""配置与绑定现状""复跑能力""未收口不符合项"）；未决项必须写默认值；红线改可机检；增加"迁移后首 24h 核对清单"；阶段 C 增加"冻结派卡"。

> 状态：草案，待项目组过目、主人定稿。
> 核心原则：**对话上下文必然清零，这是省成本的目的；"不能丢"靠三样东西兜住**——①仓库里的真相源 ②各 Bot 自身记忆 ③本次交接稿。

---

## 0. 角色与例外

| 角色 | 职责 |
|---|---|
| 主人 | 创建新管家 Bot（先给角色，不交接）、赋管理员（Main Bot）权限；定稿并粘贴 notice；对高风险动作拍板 |
| 旧管家主身 | 产出《管家交接稿》，投递给新管家分身；收尾后交出身位，不进入新群 |
| 旧管家分身（旧群 admin） | 旧群收尾公告、核对各成员交接稿齐套；**不迁入新群** |
| 新管家 Bot | 先建角色与权限，进新群后生成分身；读《管家交接稿》继承身份；接管新群 admin |
| 群成员 Bot | 在旧群写交接稿投递；在新群报到并接续工作 |

**例外（主人 11-15 定）**：旧群管家分身**不迁移**，只做交接。管家身份**不必在建群前交接**——先把新管家角色创建起来，等新群建好、把他拉进去生成分身之后，旧管家再把交接稿投到他分身的 watch 目录。

---

## 阶段 A · 创建新管家 Bot（第 1 步）

- **A1** 主人创建新 Bot：命名、role、工作目录（建议与旧管家相同，便于读记忆与桥接），赋予**管理员 / Main Bot 权限**。
- **A2** 给新 Bot 装载 skill `bot-group-migration`（capability，attached 即用）。
- **A3** 此时**不做身份交接**。新管家只需知道自己"即将接管"，具体内容等交接稿送达。

---

## 阶段 B · 建群、拉人、报到（第 2–3 步）

- **B1 建群**：`create_group`，成员 = 全体（含新管家），名单按联络人评估结论定（8 人或 6 人）。旧群不动。
- **B2 报到轮（必须先做）**：在新群发一条报到消息，要求每个成员回 `[PASS] 已就位`。
  - 原因：`room.sessions[botId]` 是该成员在新群**首次发言时**才创建的（`groups.js: groupSessionFor`）。不报到就没有分身 id。
- **B3 取 id**：从 `state.json` 新群 `rooms.<新roomId>.sessions` 读出全部新分身 id，形成对照表（含新管家自己的分身）。

---

## 阶段 C · 重绑 watch + 投递管家交接稿（第 4 步）

> 顺序有硬依赖：**必须先有分身 id，才能投递**。所谓"投到新准管家的 watch 目录"，实质是给那个目录配一条 watch、把 `targetSessionId` 指到他的新分身，投递才有去处。所以本阶段先重绑、再投递。

- **C1 新增一条管家交接 watch**：`dir: …\.batch\night\bridge\butler-handoff`（新目录），`targetSessionId` = 新管家分身 id。
- **C2 重绑既有 watch**：
  - `bridge\to-group` → 新管家分身
  - `wakeup-inbox\workbuddy`、`signals\workbuddy` → workbuddy 新分身（若联络人保留）
  - `wakeup-inbox\doubao`、`signals\doubao` → 豆包新分身（若联络人保留）
  - 联络人被移出群时，其两条 watch 须重新定义去向，不能留孤儿
  - `bridge\to-owner` **暂不动**（仍指旧管家），等阶段 F 验收后再切
- **C3 操作红线**：备份 → 一次写完整文件 → `js-yaml` 校验 → 打印 watch 清单（dir / targetSessionId）→ **重启 DSH** 生效。禁止在重载窗口存半份文件。**C 阶段开始即冻结派卡，直到 C5 自检通过**——重绑期间投出的信号会落旧 watch 或被判孤儿。
- **C4 投递《管家交接稿》**：旧管家写入 `bridge\butler-handoff`，由 relay 送到新管家分身。
  - 交接稿必含：身份与边界；记忆文件位置（`MEMORY.md`、`MEMORY-EXT.md`、主题库、团队记忆）；章程与规则文档清单；进行中事项与未决项（带路径）；桥接与投递现状；relay 配置位置与 watch 清单；口径与话术；教训清单（id 随重启刷新、notice 2000 字截断、config 半文件重载等）。
- **C5 新管家自检**：读完交接稿后逐条复述"这条对我意味着什么"，读不懂当场问旧管家；确认能收到探针。

---

## 阶段 D · 新群配置（第 5 步）

- **D1 admin**：`update_group` 把 admin 设为**新管家分身**（不能留主身、不能留旧管家）。插件强制只能一个 admin。
- **D2 notice**：主人定稿并粘贴，我只出稿。建议 ≤300 字路由表 + 指向 `docs/agents/group-conduct.md`；细则文件必须先建好。
- **D3 pinned / section / mode**：从旧群 `rooms.<旧roomId>` 抄齐；`mode` 保持 `admin`。

---

## 阶段 E · 成员交接（第 6 步）

- **E1 发对照表到旧群**：`Bot 名 / 旧分身 id / 新分身 id / 对应 watch 目录 / 交接稿投递路径`；同时落盘 `.batch\night\bridge\migration-map-<日期>.md`。
- **E2 成员各自写交接稿**，投到 `.batch\night\bridge\to-group\`，文件名 `YYYYMMDD-HHMM-<bot名>-handoff.md`，末尾署名 + session id + 时间。
- **E3 模板六节**：身份与范围 / 进度与证据（路径指针，不贴正文）/ 未决与阻塞 / 未消费信号 / 给新分身的第一步（先读哪些文件）/ 风险与红线。
- **E4** 旧管家分身只做齐套核对（缺谁叫谁），不改写内容。

---

## 阶段 F · 验收与收尾（第 7–8 步）

1. 每个成员在新群能收发；admin = 新管家分身；notice/pinned/section 符合预期。
2. `to-group` 与 `butler-handoff` 探针通；`relay.log` 无 `agent-not-found`。
3. 交接稿齐套（缺一人不封旧群）；新分身确认读过章程与自己的交接稿。
4. **最后一步切换 `to-owner`** → 新管家 Bot id，校验后重启；旧管家此后不再接 to-owner。
5. 旧群转只读/归档：`seq`、`ledger`、`segments` 保留可追溯；不再派新任务。
6. 回滚预案：旧群未删、旧 watch 有备份；新群不通时切回旧绑定排查。
7. 归档：迁移记录落 `docs/agents/`。

---

## 模式 M2 · 留在群外、用主身参与工作的 Bot（定期交接，非迁移）

有些 Bot 不进群，用自己的主会话（主身）参与工作：大管家、以及任何"只私聊/只跑单线"的角色。它们不迁群，但**同样会积上下文，同样要按话题轮换**。

- **M2-1 何时换**：主线话题结束、卡或阶段边界、约 10–15 轮、上下文基线到 40–60K token（任一触发）。不要按 token 硬卡点换，要在断点换。
- **M2-2 换前写交接稿**（同附录 A 六节），落到自己的工作目录，文件名 `handoff-<日期>-<序号>.md`，并在最后写明"新会话第一条要读哪些文件"。
- **M2-3 固定规则外置**：工作章程、职责边界、口径、红线写进文档（不要靠会话记忆）；每个新会话第一条先读章程 + 自己的交接稿。这是"新会话不是白纸"的唯一保证。
- **M2-4 触发方式（现状限制）**：Bot 自己的聊天窗口**可以**手动换 part（UI「新建会话」→ 插件内部 `bot-new-part`，确定性交接包、无模型调用）；但**群分身没有这个入口**，Bot 也无法自己调用该入口——需要主人在界面上点，或由具备权限的管家在新群侧安排。写进 SOP 是为了让"该换的时候有人换"，不是假装自动化。
- **M2-5 验收**：新会话能当场答出三件事——当前在做什么、下一步、有哪些待决项；答不出说明交接稿不合格，退回重写。
- **M2-6 主身轮换后的联动**：若该 Bot 是某条 watch 的 `targetSessionId` 指向对象，换 part 后 Bot id 不变（按 Bot id 解析到当前会话），watch **不需要改**；但如果它换的是"群分身"，就必须重绑（对应阶段 C）。

## 模式 M3 · 机械检测与触发（不靠人记）

- **检测脚本**：`C:\Users\<用户名>\.dsh\bot\workspace\rotation\rotation-watch.js`
  - 数据源：Magpie 逐请求日志（`~/.config/magpie/usage.jsonl`，字段 `session/in/cache_read/t`）＋ `~/.dsh/bot/state.json`（Bot、群、`rooms.<id>.sessions` 分身映射）。
  - 指标：**基线 = 最近一次请求的 `in + cache_read`**（该会话当前上下文体量），以及该会话请求步数。
  - 阈值：≥55K 观察；≥80K 或 ≥200 步 建议轮换；≥110K 立即。只统计近 24 小时活跃会话，历史会话不刷屏。
  - 输出：`rotation\latest.md`，命中时首行 `TRIGGER`。
- **调度**：Windows 计划任务 `DSH-ContextRotationWatch`，每小时 :05 运行，纯脚本、**零 token、不调模型**。
- **上报**：管家侧的 DSH 定时任务每日 09:30 读 `latest.md`，三行内报结论；无 `TRIGGER` 只回一句"无异常"。
  - 为什么一天一次而不是每小时：每唤醒一次管家，就要把它的整个上下文重发一遍，正是要省的那笔钱。检测交给脚本，模型只看结论。
- **动作**：主身 → Bot 详情抽屉「新会话」（`bot-new-part`）；群分身 → 目前无换口，见 M4。
- **调阈值**：脚本顶部常量 `WATCH / ROTATE / URGENT / STEPS_*`，改完不需要重启任何服务，下次整点生效。

## 模式 M4 · 群分身没有换会话入口（现状与两条路）

源码事实（`ds-bot@0.3.6`，装在 `C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\ds-bot`）：
- `src/host/channel.js` 的 `bot-new-part` 只走 `rt.newPart(rt.chatOf(bot.id))`——指向 Bot 自己的聊天。
- `src/host/parts.js:1811 newPart` 硬拦 `place?.botId === undefined || place.roomId !== undefined` → 群分身无手动换口，界面上也点不出。

**路线 ①（治本，建议）**：改插件——放开群分身的换口，并让 relay 的 watch 支持「Bot+群」锚点（换会话后无需重绑）。需改源码走正规构建发布，与 P54「换锚点」合并一次做。

**路线 ②（不改插件，可应急）**：`update_group` 先把成员移出、再拉回——`store.js:528 dropGroupSession` 会删 `room.sessions[botId]` 并归档旧会话，下次发言自动新建。副作用：①指向该分身的 watch 全部失效，要重绑并重启 DSH；②`seen` 被清，成员会重读群日志（一次大冷启动）；③旧会话不可再续。适合阶段边界偶发使用，不可高频。



```markdown
# <bot名> 交接稿（<日期时间>）
From: <bot名>（旧群分身 <session-id>）
To: 新群分身 / 项目组
Re: 迁移交接

## 附录 A · 成员交接稿模板（v0.4，已吸收 QA / 总负责人 / developer / 产品经理 评审）

> 通用铁律：**只写结论不写现行版本＝没写**。凡"判据/口径/配置"类信息，必须带版本号 + 字节 + MD5 + 生效时刻；凡"卡/分支/件"，必须带编号或短哈希 + 路径。

```markdown
# <bot名> 交接稿（<日期时间>）
From: <bot名>（旧群分身 <session-id>）
To: 新群分身 / 项目组
Re: 迁移交接
状态: <可切 / 待收口（写明等什么）>

## 1. 我是谁
群内称谓、主身与群分身的区分；边界与红线一律见 §8，不重复。

## 2. 进度与证据
- 在做/刚做完的卡：<卡号 + 派单路径 + 结论>
- 现行判据与版本：<文件名> v<N> / <bytes> / <MD5> / 有效哈希 <时间>
- 作废清单：v5、v6（打回）…；known-gaps 里哪几条不阻塞
- 相关提交：<分支名 + HEAD 短哈希 + 是否已推 origin>
- 下一步谁动手、什么时候

## 3. 配置与绑定现状（宿主 profile，仓库里没有，逐条抄）
- profile：`C:\Users\<用户名>\.dsh\profiles\desktop`
- 我收件的 watch：<dir> → <targetSessionId>
- 我投件的目录：<dir>
- relay 状态目录 `dsh-handoff-relay\`：relay.log 末 5 行基线 / dedupe.json / delivered\
- 其他本机前提：临时实例、探针端口、已装 node_modules、worktree 路径（标 可弃/须留）

## 4. 未决与第一步（合并，≤5 条）
每条：待谁 / 什么条件算解 / 没人拍板时按什么执行（默认值）/ 先读哪个文件

## 5. 未消费信号
- 无则写「无」+ 最后核对时刻；无 watch 者写「不适用」
- 有则：<文件名> / 谁该消费 / 是否已回执 / 投递目录 + delivered 子目录名
- 在途件（已投出、对方未回执）单独列

## 6. 复跑能力
能重跑的命令、变异脚本、探针入口；临时件不在仓库就写「重建步骤」，或先落 `scripts/qa/` 再给路径。

## 7. 已交付未收口的不符合项
<卡号> / <不符合项> / <责任方> / <我给的修法> / <状态>

## 8. 风险与红线（可机检，不写口号）
- 禁 push / tag / publish（除经主人授权）
- 禁碰宿主系统设置、禁改 `cordis.patch.yml`（除迁移流程内且已备份）
- 越界先问主人
```

**验收四问**（QA 补充）：当前做什么 / 下一步 / 待决项 / **上一张卡的判据件版本与有效哈希**。四问答不出即不合格。

**迁移后首 24 小时核对清单**：核 watch 清单 → 核 `relay.log` 无 `agent-not-found` → 核交接稿齐套 → 核新分身已读章程与自己的稿 → 四项全过才算迁完。


## 附录 B · 校验命令

```bash
# watch 结构与清单
node -e "const y=require('js-yaml'),f=require('fs');const d=y.load(f.readFileSync(process.env.USERPROFILE+'/.dsh/profiles/desktop/cordis.patch.yml','utf8'));const p=d.find(x=>x.id==='dsh-handoff-relay');console.log(p.config.watches.length);p.config.watches.forEach(w=>console.log(w.dir,'->',w.targetSessionId));"

# 新群分身 id 清单
node -e "const s=require(process.env.USERPROFILE+'/.dsh/bot/state.json');console.log(JSON.stringify(s.rooms['<新roomId>'].sessions,null,1))"
```

## 附录 C · 已知前提（本次实测）

- 群会话本体与旧管家分身在我的 bot workspace；其余成员分身在各项目 workspace（`--C-develop-workspace-AI-writer-develop--`）。
- 群会话本身成本可忽略（201 次请求 / 0.45M cache_read）；成本在 8 个分身会话（合计约 825M cache_read）。
- 轮换阈值写死为窗口 80%（实测 525K–575K 才换 part），群分身无手动换口；"按话题 10–15 轮轮换"需插件暴露 `checkRatio`（不在本 SOP 范围）。
