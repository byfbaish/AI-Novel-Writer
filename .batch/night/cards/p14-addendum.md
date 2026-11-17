# P14 追加 · schemastery 解析基线的定论（覆盖 P14 §2.0 的"先查清"部分）

上一轮 P14 卡面 §2.0 里我写的是"先查清它在宿主那边到底在不在"。这句不用再查了，结论已经有了，按下面执行。

## 1. 定论（不是缺依赖，是解析基线站错）

- `C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\@deepseek-ai\schemastery\package.json` **存在**，`@deepseek-ai/schemastery@3.19.0`。
- 在 profile 目录 `require.resolve('@deepseek-ai/schemastery')` → **成功**，`…\lib\index.cjs`。
- 在仓库目录 `C:\develop\workspace\dsh-handoff-relay` 同一句 → **MODULE_NOT_FOUND**。
- 我实测：宿主 `C:\develop\software\DeepSeekHarness\resources\app.asar\dsh\node_modules\@deepseek-ai\schemastery` **不存在**（Test-Path False）。

原因：插件是按 `C:\develop\workspace\dsh-handoff-relay` 这个真实路径被加载的，Node 从这个目录往上找 `node_modules`，永远走不到 profile 那份。

## 2. 因此

- **不许改 `package.json`**（不加依赖、不加 `dependencies`、不加 `peerDependencies`）。
- **不许 `npm install` 往仓库塞任何东西**（装进仓库会把 junction 写脏）。
- **正解是换解析基线**：用 `createRequire(path.join(<profile 根>, 'package.json'))` 去解析；或改从宿主给的服务里取 schema 构造器。两条任选，报告写明选了哪条、为什么。

## 3. 报告必须多写一节

标题「schemastery 基线」，写清楚：**实际走的是哪条基线**、URI/路径原文、以及用该基线解析到的 `index.cjs` 绝对路径。

原因：真机验收时若是"页面无卡"，看这一行才能区分是「时序没修好」还是「解析基线错」。这一行不给，后面真机阶段就是瞎猜。

## 4. 其余不变

P14 卡面的 §1/§2 必做 1–6、§3 边界、§4 判据、§4b 反例、§5 交付全部照旧。

## 5. 交付

- 报告仍是 `.batch/night/reports/p14-settings-inject-mount.md`（在原报告里加第 3 节，不另起文件），末行 `<!-- DONE -->`。
- 信号仍是 `.batch/night/signals/doubao/p14-settings-inject-mount.done`。
- 估时：在此基础上加 5–10 分钟。
