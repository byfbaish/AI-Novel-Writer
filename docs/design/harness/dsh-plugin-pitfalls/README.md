# DSH 插件开发避坑指南（索引）

> 状态：已实施（2026-11-14）
> 日期：2026-11-14
> 来源：2026-11-13/14 夜 `dsh-handoff-relay` P11–P14 的真实事故 —— 设置卡挂载把宿主打崩两次（`fatal load failure`）→ P13 去属性访问 → P14 改 `ctx.inject` 就绪挂载 + schemastery 解析基线。原始证据：`.batch/night/reports/p13-settings-inject-crash.md`、`p14-settings-inject-mount.md`、`incident-1114-crash.md`。

**三行一分条，读完就能改。** 本页只做索引与收录规则，正文在四个文件里。

## 1. 怎么用

1. 手上有一条报错/异常现象 → 在 §3 按**现象关键词**找编号（不要从头读）。
2. 点进文件，只看那条的**现象 / 根因 / 解法**三行；根因里带的 `文件:行` 是可核证位置，行号会随提交漂移，以符号名为准。
3. 结论不成立时**另开一条**并在条目里写「分歧：」，不改写别人的根因——这条规则和 `docs/agents/documentation-charter.md` §3 单一事实源同源。

## 2. 文件树

```
docs/design/harness/dsh-plugin-pitfalls/
├── README.md        本页：索引 + 收录规则
├── 01-lifecycle.md  加载期崩溃 / inject / fire-and-forget / 就绪时序（K01–K05）
├── 02-settings.md   设置卡 / schemastery 解析基线 / 槽位性质 / 客户端 inject 改名（K06–K12、K21）
├── 03-evidence.md   冒烟测试有效性 / stub 与真机 / 清理与取证（K13–K16、K22–K24）
└── 04-release.md    投递链断链 / 探针核对 / 改名 / 发版（K17–K20）
```

## 3. 索引（按现象找）

| 编号 | 现象关键词 | 文件 |
|---|---|---|
| K01 | 启动即崩：读了没声明的服务 | [01-lifecycle.md](01-lifecycle.md) |
| K02 | fire-and-forget 没有 catch：异步异常照样能打死宿主 | [01-lifecycle.md](01-lifecycle.md) |
| K03 | 用 `ctx.get` 判「服务不存在」：会得到假修好 | [01-lifecycle.md](01-lifecycle.md) |
| K04 | `apply` 里 await 返回的 fiber：启动链被挂住 | [01-lifecycle.md](01-lifecycle.md) |
| K05 | `inject(cb)` 回调体是子 fiber：里面抛错一样 fatal | [01-lifecycle.md](01-lifecycle.md) |
| K06 | `ERR_MODULE_NOT_FOUND`，但 profile 里明明装了 | [02-settings.md](02-settings.md) |
| K07 | 把「Test-Path False」当成「宿主没带这个包」 | [02-settings.md](02-settings.md) |
| K08 | 「只做只读展示的界面」也是有成本的 client 侧 | [02-settings.md](02-settings.md) |
| K09 | 验收「卡片挂上了没」：看错标签页 | [02-settings.md](02-settings.md) |
| K10 | profile patch 里用 `- insert:` 加同 id 项 | [02-settings.md](02-settings.md) |
| K11 | 「插件配置」页没卡，就判 namespace 没注册 | [02-settings.md](02-settings.md) |
| K12 | 改了插件代码、重启后行为没变 | [02-settings.md](02-settings.md) |
| K13 | 冒烟测试空转：单测全绿，同一输入仍崩 | [03-evidence.md](03-evidence.md) |
| K14 | 手写 stub 模拟 cordis ≠ 验证真实 provide 顺序 | [03-evidence.md](03-evidence.md) |
| K15 | 临时目录清理写在用例内部 `finally` | [03-evidence.md](03-evidence.md) |
| K16 | 拿别人转述的行号当已验证 | [03-evidence.md](03-evidence.md) |
| K17 | 交付落盘了，下游零反应 | [04-release.md](04-release.md) |
| K18 | 用 mtime 核对投递 / 用「有没有 WARN」判成败 | [04-release.md](04-release.md) |
| K19 | 改了插件名，重启后插件不加载 | [04-release.md](04-release.md) |
| K20 | tag 指向的提交本身跑不起来 | [04-release.md](04-release.md) |
| K21 | 整页 `web boot: 1 entry did not activate`，某插件 pending | [02-settings.md](02-settings.md) |
| K22 | 一条 `git` 命令失败就判「仓库通道不通」 | [03-evidence.md](03-evidence.md) |
| K23 | 闷头扒宿主源码，社区早有现成实现 | [03-evidence.md](03-evidence.md) |
| K24 | 同一份交付文件被唤醒两次 | [03-evidence.md](03-evidence.md) |

## 4. 收录规则（防止变成垃圾场）

- **只收**：真实踩过、能指到代码行或日志原文、**会复发**的坑。一次性环境事故（某次网络、某次权限）不收。
- **一条三行**：现象（可搜索的原文）/ 根因（机制，不是「配置不对」）/ 解法（能直接照做）。上限 200 字/条，写祈使句，不写故事。
- **每个文件 ≤ 10 条**：超了先合并同根因条目，或证明前 10 条里有已不成立的，**不新增文件**（文件树是索引，不是垃圾桶）。
- **新增条目必须同批在本页 §3 加一行**，索引行只写现象关键词，不写结论；不加行 = 这条等于没写。
- **不放进上下文**：本指南不写进 `AGENTS.md`（那里受 ≤60 行 / ≤4,500 字符硬顶），靠 `docs/README.md` §1、§4.7 两处指过来。
