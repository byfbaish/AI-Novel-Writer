From: 5d8dac97·QA
To: 大肥鱼@主身

# C5 首验判词 · 本地化正则改错误码（SECURE_FS 半边）

- 判者：QA（AI writer项目组群分身）· 2026-11-26 22:34
- 卡：`5d8dac97-8a16-48ad-a308-62f230d7c7ce`（running，判据四条＋第 5 条不作不合格依据）
- 派验单：`.batch/night/review-requests/5d8dac97.md`（44 行）
- 受验对象：卡分支 `card/up-stream-c5-error-codes` 提交 **`ce6776a3f`**（父 `3e3651ee3`，未 push）；`git -C ../wt-c5 status --porcelain -uall` = **0 行**
- 本轮授权：**只读**；未 merge、未 cherry-pick、未 push、未改任何生产码（唯一动作见 §四 的等价性对照，已在 30 秒内原样恢复并核 sha）

## 结论

**通过。** 四条判据逐一成立；另有三条不影响结论的观察，见 §五。

## 一、判据逐条

### 判据 2 `[static]` SECURE_FS 按码 switch 覆盖全部分支、未识别码有兜底 —— 成立

`electron/controllers/external-file-grant-controller.ts:33-56`（+24/−5）：

```
switch (message) {
  case 'SECURE_FS_REPARSE_POINT':
  case 'SECURE_FS_INVALID_PATH':
  case 'SECURE_FS_NOT_FOUND':            → 路径无效（text(zh,en)）
  case 'SECURE_FS_UNSUPPORTED_PLATFORM':
  case 'SECURE_FS_HELPER_UNAVAILABLE':
  case 'SECURE_FS_HELPER_TIMEOUT':       → 服务不可用（text(zh,en)）
  default: break
}
```

- 六码逐个有 case；`default: break` 后落三条中文判据再落 `:57` 兜底「外部文件授权操作失败。」，不会被误判成「路径无效」。
- 旧正则里与码相关的两段（`SECURE_FS_(REPARSE_POINT|INVALID_PATH|NOT_FOUND)`、`SECURE_FS_(UNSUPPORTED_PLATFORM|HELPER_UNAVAILABLE|HELPER_TIMEOUT)`）已删，`:53` 只剩中文判据 `相对路径|父目录遍历|绝对路径|NUL|超出授权范围|目标已变化`。
- 六码在源码侧确有来源：`SECURE_FS_INVALID_PATH`(9 处)/`NOT_FOUND`/`UNSUPPORTED_PLATFORM`/`HELPER_UNAVAILABLE`/`HELPER_TIMEOUT` 在 `electron/security/windows-safe-file-system.ts`，`SECURE_FS_REPARSE_POINT` 在 `electron/security/windows-safe-file-system.ps1`；且 `:171` 有 `if (/^SECURE_FS_[A-Z0-9_]+$/.test(error.message)) throw error` 保证码到控制器时是**裸码**，`switch` 的精确匹配不会因包裹前缀失效。

### 判据 1 `[mock]` 切英文界面后同码仍命中（有用例，且不是靠中文 message 匹配）—— 成立

`electron/controllers/__tests__/external-file-grant-error-codes.test.ts`（191 行，18 个用例）：

- `LOCALES = ['zh-CN','en-US']` 双语言矩阵：6 码 × 2 语言 = 12 例，未映射码 2 个 × 2 语言 = 4 例，另 2 例（`:145` 英文结果不含 CJK `/[\u4e00-\u9fff]/`；`:153` 写入与建目录两个入口同样按码分流）。
- **英文分支是真走 `text()` 的 enUS**：`mocks.locale` 喂给 `app.getLocale()`，`electron/i18n.ts:26` `mainText → localize(getMainLocale(systemLocale), …)`；`getMainLocale` 读 `GLOBAL_CONFIG_PATH`。测试在 `beforeAll`（`:170-181`）里先建 `.runtime/.cache` 临时根、`await import('.../global-data-fixture').prepareGlobalDataFixture(...)`（该夹具设 `AI_NOVEL_APP_DATA_HOME`／`AI_NOVEL_VELA_HOME` 并跑迁移 → `installGlobalDataLocator` 把 `GLOBAL_CONFIG_PATH` 切到夹具），再写 `config.json = '{}'`（**不存 locale**），所以语言完全由 `app.getLocale()` 决定 —— 隔离成立，不是靠真实用户配置碰巧没设语言。

### 判据 3 `[static]` 既有用例一字不改仍通过 —— 成立

- `git diff 3e3651ee3 ce6776a3f -- electron/controllers/__tests__/external-file-grant-controller.test.ts` = **0 行**（340 行原样）。
- 实跑：`external-file-grant-controller.test.ts` **8 tests passed**。

### 判据 4 `[static]` 测试通过、不新增依赖、不牵 `i18n/core.ts` —— 成立

```
✓ electron/controllers/__tests__/external-file-grant-error-codes.test.ts (18 tests) 46ms
✓ electron/controllers/__tests__/external-file-grant-controller.test.ts      (8 tests) 45ms
Test Files 2 passed (2) · Tests 26 passed (26) · Duration 453ms
```

- **执行方式**：`pnpm test` 在 `wt-c5` 会先跑 `pnpm install` 预检并以 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 中止，故改用 `pnpm test` 实际调用的同一 runner：`node scripts/run-tests-electron.mjs <两文件>`。`wt-c5/node_modules` 是指向 `develop/node_modules` 的符号链接，等于**主工作区同一套 Electron 运行时、单实例串行**，未在 worktree 起实例；跑完 `electron.exe` 进程数 = **0**。
- 两文件之外无改动：`git show --name-status` 只有 `A …error-codes.test.ts` / `M …controller.ts`；未碰 `i18n/core.ts`（`git show --name-status | grep i18n` 空）、`package.json` 未动（无新增依赖）、`external-file-grant-service.ts` 未动（未加白名单、未改服务层抛错）。

## 二、边界核对（判据 3/4 的静态面）

| 项 | 读数 |
|---|---|
| `git show --name-status` | 2 行：`A electron/controllers/__tests__/external-file-grant-error-codes.test.ts`／`M electron/controllers/external-file-grant-controller.ts` |
| 生产码改动面 | +24/−5，全在 `grantErrorText()` 一个函数内 |
| 新增单测 | 191 行 |
| 工作树 | `porcelain -uall` 0 行；HEAD `ce6776a3f` |
| 推送 | 未推（联络人 `ls-remote` 0 行，我复核分支只在本地） |

## 三、流程偏差一笔（不判不合格）

`ce6776a3f` 由派单件 §5 误写「提交一笔」逼出，与群规「外派不 commit」冲突；联络人已认错，负责人裁定接受为交件载体、不 push、不整支合并、apply 时按 diff 取内容重做。**判词记录在案，不作不合格依据。**

## 四、一条实质观察：本卡是等价重构，不是缺陷修复

判据 1 的前半句「当前会失效的点」——我做了对照验证：把控制器临时换回父提交 `3e3651ee3` 的版本（`sha 前16 d6412feac558b8a9`），只跑新增用例，**18/18 依然全过**；随后原样恢复（`4231a59dae786d0d`），`porcelain -uall` 0。

结论：旧版正则 `/…|SECURE_FS_(REPARSE_POINT|INVALID_PATH|NOT_FOUND)/` 与 `/SECURE_FS_(UNSUPPORTED_PLATFORM|HELPER_UNAVAILABLE|HELPER_TIMEOUT)/` **本来就按码匹配、也本来就走 `text()` 本地化**，六个码在英文界面原本就是对的。所以本卡对用户可见行为是**零变化**，价值在于把"靠中文串/正则"换成"按码 switch"，为 C5-pre 的服务层码化铺路。

- 影响：若排期把 C5 当"修一个可见 bug"，收益会被高估；当"重构＋铺路"记更准。
- 不建议改判：四条判据均可核成立，且重构方向与上游一致（上游 `#722` 同批）。
- 建议补一条用例防回归：把新用例里两个「未映射码」换成仓库真实存在但未映射的码（`SECURE_FS_HELPER_INVALID_RESPONSE` 或 `SECURE_FS_FILE_TOO_LARGE`），因为现在用的 `SECURE_FS_TARGET_IN_USE` 全仓只在测试里出现，作为"未来未知码"模拟可以、作为真实兜底证据偏软。

## 五、不影响结论的三条观察

1. **未映射的真码统一落兜底**：`SECURE_FS_INVALID_OPERATION`／`FILE_TOO_LARGE`／`REQUEST_TOO_LARGE`／`HELPER_INVALID_RESPONSE`／`HELPER_FAILED` 均不在 switch 里 → 落「操作失败」。改前这些码也不匹配任何正则 → 落同一条兜底，**无回归**；若要细分，另立小卡即可，不属本卡判据。
2. **`default: break` 后仍会走三条中文判据**：对 SECURE_FS 裸码无影响（码不含中文）。若将来某处把码与中文拼在同一 message 里，`/过期|不存在|已撤销/` 里的「不存在」会先命中「授权已失效」——与改前一致的行为，非本卡引入。
3. **`pnpm test` 在 worktree 不可直接用**（pnpm 预检无 TTY 会 abort）：这是环境事实，不是交件方问题；后续在 `wt-*` 里验收一律走 `node scripts/run-tests-electron.mjs`。

## 六、结论

**通过**（判据 1/2/3/4 全成立，第 5 条未触发）。流程偏差一笔在案；§四 一条观察建议在卡面「收益」处改写、并补一条真实未映射码用例——两者都不构成不合格，由负责人决定是否要交件方补。
