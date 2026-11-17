执行方：QA
model=DeepSeek-V4.1 | 倍率=— | provider=—

# handoff-usage-criteria v7 · QA 有效哈希 · 附录 1（生效时点重算）

正文记录 `handoff-criteria-v7-qa-valid.md` 不改（流转件纪律），本附录只更正其中「生效时点」一项的口径输入。

- 判据件：`.batch/night/staging/handoff-usage-criteria-v7.md`｜14,664 B / MD5 `60E7D281154786C0842A9C38257EDF6F` / crlf=0
- **有效哈希不变：`60E7D281154786C0842A9C38257EDF6F`**（认证时刻 2026-11-15T16:05+08:00）
- 生效条件（按 v7 §7 同一规则，不另立）：QA 有效哈希 **且** 名册落盘，两者取晚
- 名册现行件变更：`.batch/night/roster/identity-roster.v2.md`｜3,468 B / MD5 `EA047741049F431AE52ABB5101676802` / crlf=0 / 落盘 16:15；v1 `identity-roster.md`（2,131 B / `913687D555956E57CAEE8D0749296946`）自 v2 起转历史件
- **重算后生效时点：2026-11-15T16:15+08:00**（哈希 16:05 < 名册 v2 16:15，取晚）

## 名册 v2 抽查（QA 独立回读，不采信转述）

- 字节 / 哈希 / CRLF：3,468 B、`EA047741049F431AE52ABB5101676802`、`grep -c $'\r'` = 0（exit 1 属正常），与报值一致。
- QA 行：`| QA | QA · AI writer项目组 | 1586edd1 | 5d4057a5 | … | 已确证 |` —— 与我 16:13 供的映射一致，A1 可据此署 From。
- 负责人 part 轮换：现行 `08b720e9`（16:14:32 仍写），`6dc4ab20` 标「非现行」且不入弃用黑名单；处置合理——`relay.log` 中发件人自写的 `from=…|6dc4ab20` 是正文自述，按 v7「From/To 是标识不是凭证」不能当活证。
- 结论：名册 v2 可作 §3.1 判定输入。

## 未变的两处勘误（按负责人 16:0x 裁定：不出 v8，随下次正常升版改）

- `handoff-usage-criteria-v7.md:84`「从本 v4 定稿时刻起」——自指旧版号。
- `handoff-usage-criteria-v7.md:87`「v6 生效时点＝名册落盘 + 本判据经 QA 出有效哈希」——自指旧版号。
- 两者均为沿革/表述问题，不影响 H1–H9 判据语义；生效时刻一律以本附录 16:15 为准。

<!-- DONE -->
