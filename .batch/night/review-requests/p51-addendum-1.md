# 派验单补遗 1 · P51 v2（两条环境判据的口径）

补遗人：AI writer总负责人 · 2026-11-15 11:08
适用：`.batch/night/review-requests/p51.md`（07:24 版）+ 卡面 `cards/p51-median-gap.v2.md`
落点不变：`.batch/night/reports/p51-qa-firstcheck.md`

本补遗只改两件事，其余判据一字不动。

## 一、判据 5（点名套件）· 改为「放行一条 ABI 修复命令，再判」

事实（developer 11:00–11:06 实测）：wt-p51 的 `better-sqlite3` 是 node 版（`NODE_MODULE_VERSION 137` = node v24.20.0），Electron 41 需要 145；这是 wt-p51 独立 `.pnpm` 装出来的，不是残缺。卡面禁 `install`/`rebuild`/`dev`，执行方无法自修 —— 所以这一关此前不是「不通过」，是**无法开判**。

**放行命令（只此一条，唯一允许在 wt-p51 内执行的安装类动作）**：

```bash
cd C:/develop/workspace/AI-writer/wt-p51/node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3
node ../../../prebuild-install@7.1.3/node_modules/prebuild-install/bin.js -r electron -t 41.10.7
```

- **相对路径是三级 `../../../`，不是四级**（11:09 实测更正）：从 `better-sqlite3/` 往上三级即 `.pnpm/`，`prebuild-install` 顶层没有 hoist，四级会报 `MODULE_NOT_FOUND`。首次照抄四级是我这张补遗的笔误，已在执行方实测后修正。
- 走包自带的 `install` 机制，命中本地缓存，实测 1.349 秒（执行方在 wt-p51 实跑 2.573 秒、退出码 0、已就位时静默退出），产物 1,903,104B（与 develop 那份字节数相同）。
- **必须在最后一次 `pnpm install` 之后执行**——任何 install 都会把 ABI 刷回 137。
- 缓存被清时的兜底（0 秒，不算安装）：

```bash
cp C:/develop/workspace/AI-writer/develop/node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3/build/Release/better_sqlite3.node \
   C:/develop/workspace/AI-writer/wt-p51/node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

- **不走** `node scripts/prepare-native-for-electron.mjs`：它走 `@electron/rebuild`，缓存未命中会落到 node-gyp 编译，需 VS Build Tools，几分钟起。
- 修复后 ABI 必须实测自证：在 wt-p51 用 Electron 41 加载 `better-sqlite3` 并开库，贴出 `PROBE` 那行输出。

## 二、判据 6（`pnpm check:fast`）· 定为「预置失败」，不进八条分母

**写法固定为**：`预置失败：文档缺陷（2 条指向不入库目录的硬链接），与本轮交付无关`。

不要写「环境不成立（无 .workbuddy）」——那是现象，会被下一个人读成「worktree 天然不支持 check:fast」，然后再踩一遍。

根因（developer 实测）：两条**已入库**的文档硬链接指向 `.workbuddy/`，而 `.workbuddy/` 在 `.gitignore:42`、检出里没有；develop 之所以绿，是本地恰好有这份记忆目录。两个脚本的 `SKIP_DIRS` 本来就已排除 `.workbuddy`，与「扫描到未跟踪目录」无关。

- `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md:163`
- `docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md:541`

**反例条件（唯一）**：这两条链接被修掉、`check:fast` 在干净检出上转绿的那天，本条豁免同时作废。修法是改这 2 行为代码块或改脚本 `IGNORE`，都在禁改区/闸门范围内，**须作者点头，本轮不动**。

## 三、执行纪律（单列，不计入分母）

执行方在收到收窄命令之前多跑过一次 `node scripts/check-doc-placement.mjs --strict`（只读诊断），已主动披露并补进回执 → 记一笔，不判不通过。

## 四、判定合成

- 八条分母仍为 8。判据 5 / 6 按上文标注后不参与「不通过」计数，但**必须各占一节写明判定与证据**。
- 其余六条（1 空章用例、2 断档口径、3 全 ai 行记 0、4 原 5 个手算例不变、7 禁改区、8 提交纪律）照判。
- 结论只有三种：PASS / 退回（写明哪条、要改什么）/ 无法开判（写明缺什么证据）。
