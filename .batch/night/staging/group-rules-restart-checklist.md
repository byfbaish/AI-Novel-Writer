执行方：developer
model=DeepSeek-V4.1 | 倍率=— | provider=—
状态：待主人点头（重启会撞主人当前自测，本轮不排窗口）

# 群规则插件·重启后实机验收清单（谁做都能照抄）

前置：主人在场、确认可以重启一次；用**副本 profile**，不动主 profile。
插件仓：`C:\develop\workspace\dsh-group-rules-prompt`（当前 `master` 尖 `951c39f`，无 origin）
现成测试：`node --test lib/index.test.mjs` → tests 14 / pass 14 / fail 0
取证工具（QA 出）：`.batch/night/tools/qa-session-dump.cjs`
判据（QA 出）：`.batch/night/staging/group-rules-acceptance.md`

## 0. 装前记基线（1 分钟）
```
cd C:\develop\workspace\AI-writer\develop
git -C C:\develop\workspace\dsh-group-rules-prompt rev-parse HEAD
node .batch/night/tools/qa-session-dump.cjs --list      # 记下当前阶段各会话条数
```

## 1. 装到副本 profile（2 分钟）
```
dsh plugin --profile <副本profile名> add C:\develop\workspace\dsh-group-rules-prompt
```
装完核对：`dsh plugin --profile <副本profile名> list | findstr group-rules`
注意：装完要开组件开关（历史上官方安装后默认关），确认 `cordis.patch.yml` 里该条不是 `disabled: true`。

## 2. 重启宿主一次（30–60 秒）
只此一次。之后改规则文件靠 mtime 缓存自动生效，不再重启。

## 3. 五条判据取证（15–20 分钟）
```
node .batch/night/tools/qa-session-dump.cjs --grep "群聊规则（AI writer项目组）"
```
① system 段含 `# 群聊规则（AI writer项目组）`
② 连续两轮：user 段长度不随轮次增长（公告已不在 user 段）
③ 同一 Bot 私聊：system 段不含群规则
④ 改规则文件一句 → 下一轮即生效（无需重启）
⑤ 禁用插件 + 重启一次 → user 段重现 `【团队边界·三条底线】`，system 段无群规则

## 4. 回滚（一次重启）
```
dsh plugin --profile <副本profile名> remove dsh-group-rules-prompt
```
**重启与否取决于是否要立即生效**；本轮只动副本 profile，主 profile 全程不碰。

## 估时（我给的实数区间）
- 装 + 开关核对：2–3 分钟
- 重启：30–60 秒
- 五条判据取证：15–20 分钟
- 判据 ⑤（禁用 + 再重启一次）：3–5 分钟
- 合计：**25–30 分钟**（不含主人点头等待时间）

## 我这边的边界
- 不重启宿主、不改主 profile、不建远端、不推送——都要主人点头。
- 我只交命令与估时；五条判据的判定由 QA 出，改动人（我）不自证。

<!-- DONE -->
