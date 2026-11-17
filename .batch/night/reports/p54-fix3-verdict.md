执行方：AI writer总负责人
model=DeepSeek-V4.1 | 倍率=— | provider=—

# p54-fix3-to8 终审（AI writer总负责人）

**裁定：PASS。** 交付边界、D-TO8、空标题三项均按卡面 §2 判据成立，可关闭本卡；线上 `To:` 口径切换另立观察项，不在本裁定通过条件内。

## 1. 判定对象（盘面实测，非转述）

| 件 | 字节 / 哈希 | 落盘 |
|---|---|---|
| 卡面 | `cards/p54-fix3-to8.v2.md`｜3,762B / `83F53EC0427AD642D8D6E70F25438C9F` / SHA256 `30398B1A528A0A8E6D5D67433A9D678FF208E0D9DA4C88C8F3A581759BA9BAE1` | 16:17:38 |
| 派验单 | `review-requests/p54-fix3-to8.v2.md`｜4,624B / `FAB885D7E76FBE7E92AD0907C385145F` / crlf=0 | — |
| 判据件 | `staging/handoff-usage-criteria-v7.md`｜14,664B / `60E7D281154786C0842A9C38257EDF6F` | 认证 16:05、生效 16:15:13 |
| 首验单 | `reports/p54-fix3-qa-firstcheck.v1.md`｜7,497B / `99682a63951d3ee0347c442d31a8b767` / 138 行 | 16:38 |
| 执行方报告 | `reports/p54-fix3-report.md`｜10,404B / `509991907BA98010969A24ADEF0515A2` / 165 行 / 末行 `<!-- DONE -->` | 16:29:39 |
| 信号 | `signals/doubao/p54-fix3.done`｜439B / `493138CA1A7271335DDEE015FBA7E372` | 源 16:30:00；`delivered/dad6df13f302/` 同名同哈希 16:29:47 |

提交：`51a87c5417c61372210c14c1c362b8830e1621e7`（short `51a87c5`）/ 16:28:14 / `fix: strip session- prefix from To id8 and keep To title segment non-empty`。范围 `f41b031..51a87c5`，`origin/master..HEAD` = `0 4` 未推、HEAD 无 tag。

## 2. 终审抽查（我只查 QA 明说未覆盖或需独立确认的项，不复跑套件）

1. relay 仓盘面：`git log --oneline -1` = `51a87c5`；`git status --porcelain` 0 行。
2. `index.js:821 function id8Of(id)` 存在；`:823` 前缀剥离先于 `:824 slice(0,8)`；常量 `:819 SESSION_ID_PREFIX = 'session-'`。与首验 F2 引证一致。
3. `index.js:832 function headerTitleOf(...candidates)` 存在，全空落 `:815 IDENTITY_FALLBACK_TITLE = '(无标题)'`；装配点 `:1312` 调用、`:1313 id8Of`。与首验 F3 引证一致。
4. 首验单格式合规：首行 `执行方：QA`、次行 model 三件、末行 `<!-- DONE -->`。

未复跑 `node index.test.mjs`（QA 两次同 HEAD 复跑 178/178，基线 174，新增 T1–T4 四条），按验收集约不重复同一遍检查。

## 3. QA 首验结论采信

F1–F6 全 PASS；两条反证真红成立（A 回退取位 → 175/178 红在 `| session- |`；B 拆标题兜底 → 173/178 红在 `To:  | P54SESS0 | 主身`）。四项观察项均不构成打回：
- O1 F7 的 `reports/p54-fix2-dir-ownership-report.v2.md` 未落盘 → 派豆包补，**不阻本卡终审**。
- O2 反证 B 红数 5 vs 报告 4（QA 多拆一层兜底）→ 方向一致，不判瑕疵。
- O3 `headerTitleOf` 第三层兜底无单独用例 → 功能无缺口，记技术债，不进本卡。
- O4 线上 `To:` 仍是旧格式 → 归重启后真机复验，不进本次通过条件。

## 4. 本卡流程瑕疵登记（不影响裁定）

- 我（总负责人）：卡面 v2 正文未写 `From:`/`To:` 头（模板 §8 要求），投出前机检未做；已改模板加机检门禁（`_CARD-TEMPLATE.md` 10,252B / `AF1E5A2023B12FC365F1FBDE56FB1E20`），本卡不补投、不出 v3。
- 我：fix2 报告盘面读数曾报错（误写 11,312B / `BC734AB…`，实为 12,742B / `58534E48…`）。
- 豆包：回执手抄卡面哈希错（`82F5B4F4C73CA60E5E4B2C7F93C2F4E1`，盘上从未存在）。
- 豆包：造同哈希副本 `cards/p54-fix3-to8.v3.md` 占版本号（按大肥鱼裁定为无效副本，不进判定）。
- 豆包：信号 `To:` 行带 8 位 id 且把 `6dc4ab20` 标「主身」（该 id 为非现行上一 part）；信号已投出不改，下件起按形态 B。

## 5. D-TO8 过渡口径

临时放行口径随**三者取最晚**失效：①本卡终审通过（本次已达成）＋②宿主重启载入含修复版 ＋③`relay.log` 出现新格式 `To:` 行（id 段为 8 位十六进制）。在此之前接收端遇 `| session- |` 记 D-TO8 放行、不拒件。首验观察项 O4 即为此条的真机侧。

## 6. 引用件的口径版本（本单钉死，不再跟随）

迁移 SOP 以 `reports/sop-group-migration-1115.v1.3.md`｜16,259B / `889BAB72E90A9D1913DD5581F1CD72BF` / crlf=0 为准（`wc -l` 计 217 行，与大肥鱼报的 218 行为计行口径差，不再对账）；v1.2 15,670B / `03114D1A…` 仅作留档。本卡与迁移无依赖：迁移启动前仍须 `p54-open-items.md` 四条全闭。

## 7. 后续（不属本卡）

1. 宿主重启后由 developer 取一条真机注入行，核 `To:` 第二段为 8 位十六进制且标题段非空 → O4 闭、`p54-open-items.md` 第 1 条转闭。
2. 豆包补 `reports/p54-fix2-dir-ownership-report.v2.md`（v1 保持 `58534E48…` 不动）。
3. relay 仓未推 4 笔（`82dfbbe`、`40f34b5`、`f41b031`、`51a87c5`）与发布方式仍等主人授权，本裁定不含推送许可。

<!-- DONE -->
