# 派单件 · CARD-S3-D16B（状态栏模型指示器：常态显示默认、实际不同时并列）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（apply 位＋live）；QA · AI writer项目组（首验方）
派单时间：2026-11-22 13:0x（S3 第五张）
卡面：`.batch/night/cards/d16b-statusbar-default-first.md`（借卡，见 `.batch/night/staging/d16b-card-borrow.md`）
派验单：`.batch/night/review-requests/d16b-statusbar-default-first.md`

## 1. 起点与分支

- 起点：**`9f31562f`**（admin 定）；主线现头 `57a526a1`（只改本卡卡面文档，R4 用这个值），评审作用域 `fb2c5d6f..961eaa05`。
- 分支：`card/d16b-statusbar-default-first`，**头 `961eaa05`＝参考实现**，不入主线。`git merge-base --is-ancestor 961eaa05 9f31562f` → no，已在 QA 首验里核过。
- 一卡一分支、点名路径 `git add`（禁 `-A`／`-f`／`--no-verify`）；不 commit、不 push、不动 `develop` 主区。
- **apply 一次一张**：D10 在前（包 `f268ca86`），D16B 排其后；两卡不许同时改码。

## 2. 开工前三步（做完再动手，报一句）

1. `git rev-parse --short HEAD`、`git rev-parse --short 961eaa05`、`git status --porcelain -- src electron scripts`（须空）三项原文；
2. 读卡面 §2 六条判据 + 本件 §1 定位 + `.batch/night/staging/d16b-card-borrow.md` §4 数字口径，照抄「必读确认三行」进交件报告（缺三行不 start）；
3. 群里回「已领卡＋HEAD＋三项校验结果」，再按下面二选一表态。

## 3. 二选一（必须明确表态，不许两头挂；各给一句理由）

**① 采纳参考实现**：出「实施评审」——逐条对卡面判据 1–6 说明参考实现如何满足、指认风险点（含 `max-w-[180px]` 布局、`resolveStatusbarModel` 保留后旧 API 死代码风险）；认为可采纳就只做 apply（把 `961eaa05` 落到卡分支的提交，点名路径）＋判据 5 那次 live。代码作者署主身。
**② 要求重做**：出实施包（改动点 文件:行／改法／边界／风险／验证命令）＋独立认可件，再走 apply；代码作者署实施包提供方。
两条都要写进交件报告，QA 判词里要能看见这个选择。

## 4. 白名单（超出即停手报，不自行扩）

`src/shared/statusbar-model.ts`、`src/components/layout/StatusBar.tsx`、`src/shared/__tests__/statusbar-model.test.ts`、`src/components/layout/__tests__/StatusBar.test.tsx`。
禁改：`electron/` 任何文件、`actual-model-store.ts`、`actual-model-hydration.ts`、`generation:*` 契约、D16 卡的判词与报告、卡面判据文字。

## 5. 交付与回执

- 交件报告：`.batch/night/staging/d16b-statusbar-report.md`，须含：二选一与理由、判据 5 的三段界面原文、evidence 四项、单测汇总行＋末行 `EXIT=`、`check:fast` 末行、署名句。
- 判据 5 live：单实例、跑完即关、软限 30 分钟；跑不起来照实写「未跑成＋原文报错」，不许拿 mock 顶。
- 群里 @ 项目总负责人 与 QA；合并与 push 只由主身做，developer 只报卡分支 ref 与旧头。

## 6. 停手条件

- 参考实现与卡面判据有口径冲突 ⇒ 停手报负责人，先改卡面留痕再走，判据不让给实现。
- live 起不来／实例数 >1 未清干净 ⇒ 贴原文停手。
- 需要动白名单外文件才能满足判据 ⇒ 先报，负责人定是否放行。
