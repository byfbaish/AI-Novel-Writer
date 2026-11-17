# P45-fix · README 入口措辞改正（只改两处字）

- 类：A（产生仓库提交）｜派活：22:37｜估时：8 分｜缓冲：5 分｜兜底验收：22:50
- 落点：`C:\develop\workspace\dsh-handoff-relay`｜起点：HEAD `87782339a5cb8d3c6786548f93d355b14a2dea35`
- 依据：`.batch/night/reports/p45-qa-firstcheck.md`（5,067B / `70E9F4C0E34D35A4EA1542F48E75DA3A`）第 ④ 条不通过
- 判据：QA 只重验第 ④ 条，其余七条不重验

## 只做这两处改动

### 1）`README.zh-CN.md:207`
现状：
```
卡片入口较深：**插件 → 已安装 → dsh-handoff-relay → 打开其 README 页 → 页面最下方「包含的组件」→ 点击 `Handoff Relay`** 即进入设置页。
```
改为：
```
卡片入口较深：**插件 → 已安装 → dsh-handoff-relay → 打开其 README 页 → 页面里「包含的组件」一节 → 点击 `Handoff Relay`** 即进入设置页。
```
（只删「最下方」，其余一字不动。中文标签「包含的组件」是对的，不要改。）

### 2）`README.md:242-243`
现状：
```
**Plugins → Installed → dsh-handoff-relay → open its README page → “Included components” at the bottom → click `Handoff Relay`**
```
改为：
```
**Plugins → Installed → dsh-handoff-relay → open its README page → in the “Components” section → click `Handoff Relay`**
```
（`Included components` → `Components`；`at the bottom` → `in the “Components” section`。）

## 硬约束

1. **只改这两处字**。不许顺手改「目标会话（文本输入）」、不许改结构、不许改安装命令、不许改其它任何行。
2. 不许 push、不许打 tag、不许 publish。
3. 一次提交，标题建议 `docs: fix settings card entry wording`。
4. 自证按 R4：`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 双空（除你自己这次提交）；交付时按「提交 SHA + 接收方实测 porcelain」报，不要报 WSL 侧 porcelain 结论。
5. 不要还原任何文件、不要改 `.gitattributes`。

## 交付要报

- 提交 SHA + 父 SHA
- `git show --numstat --format='' <SHA>`（应只有 `README.md` 1 增 1 删、`README.zh-CN.md` 1 增 1 删；以实际为准但只许这两个文件）
- `git diff 8778233 <SHA> -- README.md README.zh-CN.md` 的完整 diff（应只有 2 行 +2 行）
- 信号文件末行写 `<!-- DONE -->`
