# 重启后接线与单探针终审（REWIRE-1113）

- 结论：**PASS**（2026-11-13 21:26）
- 宿主：21:16–21:19 重启，GUI 端口 59075 → 57613；`~/.dsh/dsh-handoff-relay-state.json` 未生成 ⇒ 跑的是 P8 新语义（`6563d27`）。

## 三条判定线（`.batch/night/review-requests/rewire-1113.md`）

1. 源文件消失 —— ✅ `scripts\dsh\wakeup-inbox` 下只剩 `.gitkeep`，`probe-rewire-2125.txt` 已不在。
2. `delivered/<dirKey>/` 同名文件 —— ✅ `~\.dsh\profiles\desktop\dsh-handoff-relay\delivered\90caa0a2de22\probe-rewire-2125.txt`，214B，21:26:02。
3. **目标会话**恰好 1 条、带绝对路径 —— ✅ 我（`daeb834f`）21:26:07 收到 1 条，文案为 `C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox\probe-rewire-2125.txt 已就绪（触发=stable），请继续。`
   - 口径更正（QA 21:29 指出）：根收件箱 `wakeup-inbox` 的 dirKey = `90caa0a2de22`，目标是**我的会话**，不是群；「群里 1 条」是错的说法，判据应为「目标会话 1 条」。`abf70c44921e` = `bridge\to-group`（→`f6f51eef`）。

## 防伪两条

- 基线：探针前 `delivered/` 里只有 `abf70c44921e\decision-permission-b-2124.md`（1077B，21:24:29，to-group 通道产物）；探针后只新增 1 件。
- 字节一致：214B ↔ 214B，md5 由 developer 报一致。

## 附带结论

- **本次重启没有换 session id**：`daeb834f`/`33494f59`/`4380d607`/`f6f51eef`/`a1d48adb` 全部仍在写（scan 21:25–21:26），7 条 watch 一条都不用改，`to-owner` 也不缺。此前 03:49、03:57、21:16 三次重启同样未换 ⇒ 「重启后 id 必变」不成立，配对仍须每次实扫，不能写死。
- `decision-permission-b-2124.md` 经 `to-group` 投进群窗并落 `delivered/abf70c44921e/`，说明桥接在新代码下同样走「移源文件」路径。
- 7 条 watch 的 `targetSessionId` 在配置里仍为原值；未做「重填 6 条」动作，也不需要。
