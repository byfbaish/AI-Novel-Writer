状态：在办
持有者：项目总负责人 · AI writer项目组
可写：是
最后变更：2026-11-20 05:2x
卡号：GOAL-stage4
依据件：`.batch/night/org/BACKLOG.md`（10,661B／78 行，2026-11-20 05:20 读）

# stage 4 收口清单（骨架 · 待推送后补证据行）

> 本件只列「哪些 B 项关、哪些转下期、哪些要主人一句话」。**台账证据行不在这里写**——四行证据要等推送后才有数，由我在 stage 4 正式收口时补。写于 `card/1119-H` 工作树，随合并后那笔 docs 提交入库。

## 一、可由本 Goal 结案的（4 条）

| 项 | 结案依据（要写成一行判据） | 现状 |
|---|---|---|
| B-6 `archive/` 193 件从未入库 | 97 件清洗版已入主线并生成 `MANIFEST.sha256`；`git ls-tree -r HEAD -- .batch/night/archive` ＝97（MANIFEST 不计） | 事实成立，**等推送后落结案行** |
| B-17 `archive/` 47 件未登记 | stage 2 已补：README 97 条、五字段齐、`待补` 8 条转 B-21 | 事实成立，**等推送后落结案行** |
| B-22 `--all-tracked` 90 文件／289 处 | H 卡门禁：`adb17d44` 上 `通过（扫描 3363 个文件，0 处命中）` EXIT=0；工具 md5 回 `63e9328f…` | 事实成立，**等推送后落结案行** |
| B-4 合并前清场口径 | 本次合并前未跟踪件＝1（QA 判词），无 255 件撞车；口径本身尚未写进协作规则 | 事实部分成立，**口径条文转下期** |

## 二、转下一期的（7 条，本 Goal 不碰）

| 项 | 为什么转 |
|---|---|
| B-1a／B-1b／B-1c 五个快照目录约 190 MB | 需主人一句话批删；与「单一基线」无关 |
| B-1d 仓库外目录归属 | 结构性口径（仓外仓还是纳入），要单独立规矩 |
| B-2 分支清理 | 与 stage 3 的 ref 收口重叠，推送后统一做更省事 |
| B-3 集成验收 | 同上，推送后才谈得上「集成」 |
| B-5 追加段另存 `<卡号>-rulings.md` | 已在用，但入协作规则要产品经理那侧一起改 |
| B-18 卡与派验单成对出 | 流程纪律，转下一次规范件修订 |
| B-16 `archive/` 整目录豁免 `versioned-filename` | E 卡只豁免了尾行；改规则要单独出卡改码，本 Goal 不动 |
| B-19 `tmp-dev/` 25 件 | 按 B-1e 逐件判归属，下一张清理卡 |
| B-20 `post-merge-check.ps1` MERGE_HEAD 误判 | 改码，单独出卡 |
| B-21 `archive/` 8 条 `待补` | 逐版时间要从台账/派验单追，下一张补登记卡 |

## 三、要主人一句话的（3 条）

1. **五个快照目录删不删**（B-1a/b/c，约 190 MB，均无人认领）。
2. **`C:/tmp/pmo-stage2-quarantine/` 的保留期**（7 件，含会话日志原件）——写「长期」还是「30 天后删」。
3. **97 件原件 bundle 的保留期与过期给谁**（developer 正在做，放在 `C:/tmp/`）。

## 四、stage 4 判据对照（原文，不改）

- `org/BACKLOG.md` 里 B-6／B-16／B-17 有结案行 → §一 落三行，B-16 需在转下期说明里点名「只关了尾行那半」。
- `reports/task-ledger.md` 新版含 4 个 stage 的证据行 → 待推送后写（台账写手是产品经理，我只提供证据文本）。
- 97 件原件 bundle ＋ README（谁建／何时／用途／保留期／过期给谁），bundle 不入库 → developer 交件后 QA 核。
- 无 open 的待主人一句话项（除已明确转下期的） → §三 三条必须先有答复或明确转下期。

## 五、待补（推送后由我补）

- [ ] 四个 stage 的证据行文本（命令＋输出摘要，一 stage 一行）
- [ ] B-6／B-17／B-22 三行结案行写进 BACKLOG
- [ ] README 补登 8 条 `待补` 的最新复核结论（若 B-21 在本期内动过）

## 六、落账（2026-11-20 05:45 补）

本骨架的结论已并入 `.batch/night/org/BACKLOG.md` 末尾「收口 · Goal…stage 4」一节：B-6／B-17／B-22 结案，B-16 只结尾行那半（整目录豁免转 **B-23**），B-4 部分结案；转下期 10 项与「要主人一句话」3 条同节登记。

## 七、台账四行素材（给产品经理抄，台账唯一写入人是产品经理）

1. **stage 1** archive 首次合入主线：`--no-ff` 合并 `ce74268f`（97 件清洗版＋`MANIFEST.sha256`，源 `78d56ea0`），我落 docs 提交 `68fa0381`；判据 97／97、双向差集 0、97 条 sha256 `mismatch=0`、真名 0／0、`--all` 0 项 EXIT=0、`check:fast` EXIT=0；QA 首验 PASS（`reports/GOAL1-archive-first-merge-qa-firstcheck.md`）。
2. **stage 2** archive 登记补齐：`058c0867`；`archive/README.md` 97 条五字段齐，`待补` 38→8（8 条转 B-21），`??`=0、`--all` 0 项、`check:fast` 五段绿；QA 复跑 PASS（`reports/GOAL2-archive-readme-qa-firstcheck.md`）。
3. **stage 3** 脱敏线接主线并推送：`card/1119-H` @ `adb17d44`（工具补丁回滚 md5 `63e9328f…`、`.piiallow` 两行式 149／149／149、`--all-tracked` 0 处命中）；合并 `eba81c43`，推送 `exp/mainline-1119` → `refs/heads/exp/resource-ledger`，旧头 `beeedc26` → 新头 `eba81c43`；`ls-remote` 同 sha、`rev-list --left-right --count` 0 0、`check:fast` EXIT=0、真名 0／0（群管理复跑四条全绿）。
4. **stage 4** 收口：本件＋BACKLOG 结案行；原件 bundle `C:\tmp\aiwriter-archive-bundle-1120.tar.gz`（161,163B，sha256 `8b1ab3f1d8ca971c505a3afbbae42760f478208c24078c6333d2a70b2d3805d7`，97 件 96 条与 MANIFEST 一致、1 条已知例外 `archive/README.md`），README 五段齐、不入库；QA 收口核待判。
