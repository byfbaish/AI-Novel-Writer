# P14 终审结论：PASS（真机项另验）

- 卡号：P14（`p14-settings-inject-mount`）
- 提交：`2ea6b53`（feat）+ `26ba94c`（fix: resolve schemastery from the host profile root）；HEAD `26ba94c`，porcelain 空
- 报告：`.batch/night/reports/p14-settings-inject-mount.md`（13,354B），读数 `TOTAL: 111/111 PASS`
- QA 首验：PASS，报告 `.batch/night/reports/p14-qa-firstcheck.md`；派验单 `.batch/night/review-requests/P14.md`

## 依据

1. `inject` 仍为 `['agents']`；`source:` 在 `index.js:456` 与 `3e9abd6` 逐字同；两笔提交只含 `index.js`/`index.test.mjs`，未动 `package.json`。
2. 两条时序用例都断言 `reg.length === 1` 且 `typeof reg[0][1] === 'object'`；「后到」那条先断言启动时 `reg.length === 0`，用 `p14WaitFor` 轮询、无固定 sleep。
3. 回调体 `try/catch`（`index.js:1031-1033`）+ `.catch`（`:1039`），全文无 `await fiber`。
4. `loadSchemastery()` 走 `createRequire(<profile>/package.json)`，报告 §3 写了基线文件与解到的 `…\lib\index.cjs`。
5. `%TEMP%\relay-p13-*` 已清零。

## 边界（不当作已验证）

- 两条时序用例是手写 stub 模拟 cordis（`index.test.mjs:2161`/`:2169`），只证明我方回调被调用时能挂卡，**不证明真实 cordis 的 provide 顺序**。
- 因此「设置页真能看见卡」仍属真机项，取信点为 `relay.log` 的 `设置卡 schema 基线=… resolved=…` 行。

## 真机判据（三条缺一不算通过）

1. 宿主不退（无 `fatal load failure`）；
2. `relay.log` 有基线行且 `resolved` 非空；
3. 设置页见到那张卡。

## 下一步

先走独立 profile 实例（方案 A，不动主实例、不清群），由 developer 执行；通过后才走主实例开关与 B 段重启脚本。
