# 外部包评估 · oh-story-claudecode

> 状态：已归档（2026-10-25）· 评估结论见 [`assessment.md`](assessment.md)
> 这是什么：对一个第三方 agent-skill 小说流水线包的**外部方案对比**。不是设计稿，不是待办；结论要动手时另出设计稿。
> 为什么放在 `docs/research/` 而不是 `docs/design/`：它不改我方代码或行为，属「外部材料消化」（[`docs/README.md`](../../README.md) §3.1 第 4 条）。

---

## 1. 评估对象

| 项 | 值 |
|---|---|
| 名称 | `oh-story-claudecode` v0.9.0 |
| 作者 / 许可 | zenstory-ai · **MIT**（原件内含 `LICENSE`） |
| 规模 | 795 文件 / 11.7 MB；13 个 skill；566 md / 69 py / 48 js / 41 sh |
| 采集时间 | 2026-10-25 |
| 采集时原件路径 | `C:/Users/<用户名>/WorkBuddy/2026-10-22-04-19-11/_ohstory/oh-story-claudecode-main`（本机 WorkBuddy 缓存目录，**未移动、未修改**） |
| 形态 | skill 包：用 Markdown 写方法与工作流契约，装进别人的编程 Agent；本身不是应用、不是运行时 |

---

## 2. 本目录文件

| 文件 | 内容 |
|---|---|
| [`assessment.md`](assessment.md) | **评估结论**：28 条术语映射、吸收清单 A1–A5、刻意不为 C1–C8、只归档 B1–B4 |
| [`facts-01-skills.md`](facts-01-skills.md) | 13 个 skill 的职责表（触发/输入/产出/依赖/设计点），逐条带原文行号 |
| [`facts-02-scripts.md`](facts-02-scripts.md) | 8 个关键脚本的判据常量与正则**逐字摘录**（含 AI 味检测 22 类、字数口径、取段器、加载预算） |
| [`source-manifest.json`](source-manifest.json) | 795 文件逐文件 sha256 + 大小 + 原始路径；`skippedSymlinks` 记 1 个跳过项 |
| `vendor/oh-story-claudecode-0.9.0.tar.gz` | **第三方原件归档**（6.0 MB / 907 条目），含 `LICENSE` 与 `VERSION` |

---

## 3. 为什么原件是 tar.gz，而解包后不能直接放进 `docs/`

**这是硬约束，不是洁癖。**

- `scripts/check-doc-placement.mjs:104-114` 对**全部** md 做相对链接检查，断链记为 **C6**；而 `docs/agents/documentation-charter.md` §9 明确 **C6 不允许进基线**。
- `scripts/check-doc-links.mjs` 同样是全库扫描、有错即失败。
- 该包 566 篇 md 含大量指向 `references/` 与同级 skill 的相对链接，**原样解包进 `docs/` 会直接让两个检查失败**。
- 打包后：不是 md ⇒ 不参与文档纪律；单文件 ⇒ 不干扰全库 `grep`；可解压 ⇒ 有据可依。

### 解包与校验

```bash
cd docs/research/2026-10-25-oh-story-absorption
mkdir -p /tmp/ohstory && tar xzf vendor/oh-story-claudecode-0.9.0.tar.gz -C /tmp/ohstory
# 校验（逐文件 sha256 比对 source-manifest.json 的 files[].sha256）
```

> 若需长期对照，解压到**仓库外**目录再读，不要放进 `docs/`。

---

## 4. 采集方法与可信度

| 项 | 做法 |
|---|---|
| 谁读的 | Copilot CLI `DocGuard`（只读 agent）分批读取，每次 2–6 个明确文件路径；判据类问题由主会话直接读源码复核 |
| 出处纪律 | 每条结论必须带 `文件:行号` + **逐字摘句**；无摘句的条目丢弃 |
| 抽检 | `check-ai-patterns.js` 抽检 5 处常量，**5/5 逐字相符**；13 个 skill 的职责表抽检 3 条出处，**3/3 相符** |
| 被推翻的 1 处 | Copilot 在只读 3 个 `SKILL.md` 后回答「没有卷/单元的字数章数区间」——**错**，原文在 `references/workflow-volume.md:42`（1.5–3 万字 / 5–15 章）。详见 [`facts-01-skills.md`](facts-01-skills.md) §4 |

**这条教训已回写通道手册**：`docs/agents/copilot-channel.md` §4.5「派活的已知陷阱」。

---

## 5. 一句话结论

> 它强在「确定性文本质量门禁」，弱在「连续性」——正好与我们互补。值得吸收的 5 项（A1–A5）全部是**给已有要求装判定权**，不新增任何创作规则。
