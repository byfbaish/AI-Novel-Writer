# AC2／S2 交付与核盘记录（主身补完）

卡号 `4027dbef`｜分支 `card/arch-ac2-s2`｜起点 `681eeb66`｜记录时间 2026-11-24 00:25

## 一、外派与中断事实（不美化）

- 会话 `60e73cbf-1e6c-4f93-8b31-ee117e6e82c0`，22:41 投出（派单 `bc475b00`／实施包 `d1aa2ef1`）。
- 22:44 后该会话再无写入：`C:\tmp\ac2-s2\workbuddy\` 只有 `mutations.log`、`pristine-named-registration-consistency.ts`、`run-mutations.mjs`；**没有 `receipt-to-owner.md`，没有提交**（`wt-2` HEAD 仍 `681eeb66`）。
- 也就是说：代码与 13 条用例、M1–M5 变异是它写的，**收尾三件（typecheck 修、提交、回执）没做**，由主身接管补完。

## 二、主身接管时发现的真实缺口

`tsc --noEmit` 报 5 处（8 个字面量）`ConsistencyPreflightCoverage` 缺 `registeredNamedPeople`／`blueprintCharacterRefs`，全部在既有测试 `src/shared/__tests__/consistency-preflight-space-time.test.ts` 的夹具里：

```
error TS2345 ... missing the following properties from type 'ConsistencyPreflightCoverage': registeredNamedPeople, blueprintCharacterRefs
```

处置：只给这 5 处夹具补两个字段（`0`／`0`，与既有空间覆盖度夹具同义），**不改任何断言、不改被测函数**；新字段保持**必填**（不用 optional 绕过，免得以后有生产者漏填）。

## 三、盘上核验原文（主身自己跑，不采信转述）

```
$ wc -lc
  219 11778 src/shared/named-registration-consistency.ts
  145  5683 src/shared/__tests__/named-registration-consistency.test.ts
  247 12677 src/shared/__tests__/consistency-preflight-space-time.test.ts
  311 13750 src/shared/consistency-preflight.ts
   92  5162 src/services/consistency-preflight.ts

$ sha256sum
a64bf1edc54f3abb04d5d67c9ed9cca8f4b7b4b59472ac52acef4322a7911de2  src/shared/named-registration-consistency.ts
52b5c2249342cdb4c418d0d4b90065765be48ec01d560edb30513f8c72035d67  src/shared/__tests__/named-registration-consistency.test.ts

$ grep -nE "from 'node:|require\(|readFile|writeFile|fs\.|ipc\.|await |async " src/shared/named-registration-consistency.ts
（零命中，rc=1）

$ grep -n "^import" src/shared/named-registration-consistency.ts
1:import type {

$ git diff --stat src/shared/space-time-consistency.ts
（空——既有 trim 全等语义未动）
```

## 四、测试与变异

```
$ node scripts/run-tests-electron.mjs src/shared/__tests__/named-registration-consistency.test.ts src/shared/__tests__/consistency-preflight-space-time.test.ts
 ✓ src/shared/__tests__/named-registration-consistency.test.ts (13 tests)
 ✓ src/shared/__tests__/consistency-preflight-space-time.test.ts (27 tests)
 Test Files  2 passed (2)
      Tests  40 passed (40)
```

变异五发（外派会话 22:44 原样留档，副本 `mutations.log` 已随本笔归档）：M1 `2 failed|11 passed`、M2 `1|12`、M3 `1|12`、M5 `1|12`；每发复原后 `13 passed`。

**M4 存活，主身补证（这是本笔新增的一处诚实记录）**：派单 §6 写「M4 删参考名长度 `continue` ⇒ 用例 8 转红」，实测**转红未发生**（`13 passed`）。原因不是断言空，而是同一行为被**两道冗余闸**各挡一次：

1. `findUnregisteredPersonRisks` 循环首部 `if (!reference || reference.length < MIN_NAMED_ENTITY_LENGTH) continue`；
2. `matchedByName` 首行 `if (reference.length < MIN_NAMED_ENTITY_LENGTH) return true`。

删任一道，另一道仍让单字参考名不产 finding ⇒ **单点变异是等价变异**，必然存活。主身按行为层复核两次：

- `M4'`：只把 `matchedByName` 的 `return true` 改 `return false` ⇒ `13 passed`（被闸 1 挡住，符合预期）。
- `M4''`：同时删闸 1、改闸 2 ⇒ `⑧ 单字名按放行处理；空串/单字指代不产 finding，多字项不崩` **转红**，`Tests 1 failed | 12 passed (13)`；复原后 `13 passed`、文件 sha 回到 `a64bf1ed…`。

结论：用例 8 的负向断言**非空**（组合变异可转红）；M4 该靶是等价变异，判词请按此口径记，不记为「漏了断言」。是否把闸 1 与闸 2 合并成一处（减少冗余）不在本卡射程，留给 S4 收口时判断。

## 五、check:fast

```
[check:fast] typecheck ✓ 23.4s
doc links: checked 1468, broken 0
doc placement: 扫描 439 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] batch-hygiene ✓ 0.7s
[check:fast] 全部通过。
```

## 六、射程四条自查（供 QA 对照）

1. 锚点唯一来源＝第 4 维具名人物登记：`parseNamedPersonRegistrations` 只认「固定四段全非空且不含 `hours=`／`entry=`」的行；台账只作交叉核对（`matchedByName(reference, rosterNames)` 放行，不判谁对）。
2. 抽取对象＝`blueprint.characters[]`（主人 22:29 准 A）；登记名去尾部括注后单向包含于蓝图姓名串；不做自由文本抽名、不做别名归一。
3. 名单空＝显式未判：`registeredNamedPeople === 0` 走独立文案分支；台账读不到（`rosterNames === undefined`）整条 fail-open。
4. 空间半边只出解析器、不发射 finding（`parseRegisteredSpaceNames` 无调用点）；`findSpaceTimeConflicts` 一行未改。

## 七、显式缺口（S2 不得写成「层间引用完整性已达成」）

- 地名侧仍是既有 trim 全等，「逐字包含」未接线；`parseRegisteredSpaceNames` 为未使用导出，不算达成。
- AC2 语义版（从自由文本抽具名人物，需 NER／别名归一）按主人裁定移出本卡，S4 收口时落 BACKLOG。

## 八、仍需补的一件

派单件要求的四行头回执（`From: AC2-S2-WorkBuddy`）由外派会话产出，它中断未写；本件为**主身补完记录**，四行头口径不伪造。QA 判词请以本节声明为准：交付面＝本仓库提交，执行者＝主身补完，外派部分仅代码与用例、变异三者。
