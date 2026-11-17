#!/usr/bin/env bash
# 生成 wb-rules-example.v2.md：只换第 1 行 From，其余逐字节保留，并自证 diff 只差这一行。
# 用法：bash make-wb-v2.sh "<新群名>" "<新群分身session前8位>"
# 例   ：bash make-wb-v2.sh "DSH 插件组" "abcdef12"
# 拒绝：参数为空 / 前缀不是 8 位十六进制 —— 不编造值。
set -euo pipefail
GROUP="${1:-}"; PREFIX="${2:-}"
if [ -z "$GROUP" ] || [ -z "$PREFIX" ]; then echo "REFUSE: 需要 群名 与 session前8位 两个实参" >&2; exit 2; fi
if ! printf '%s' "$PREFIX" | grep -qE '^[0-9a-f]{8}$'; then echo "REFUSE: 前缀不是 8 位十六进制小写: $PREFIX" >&2; exit 2; fi

D="$(cd "$(dirname "$0")/.." && pwd)"
V1="$D/cards/wb-rules-example.v1.md"
V2="$D/cards/wb-rules-example.v2.md"
[ -f "$V1" ] || { echo "REFUSE: 缺 $V1" >&2; exit 2; }
[ -e "$V2" ] && { echo "REFUSE: $V2 已存在，按版本纪律不覆盖" >&2; exit 2; }

NEW1="From: workbuddy联络人 · ${GROUP} | ${PREFIX}"
{ printf '%s\n' "$NEW1"; sed -n '2,$p' "$V1"; } > "$V2"

echo "--- 行数 v1/v2 ---"; grep -c '' "$V1"; grep -c '' "$V2"
echo "--- 首两行 v2 ---"; sed -n '1,2p' "$V2"
echo "--- diff v1 v2（应只有第 1 行） ---"; diff "$V1" "$V2" || true
echo "--- diff 行数（应为 4：1c1 + < + > + ---） ---"; diff "$V1" "$V2" | grep -c '' || true
echo "--- 字节 / MD5 ---"; wc -c < "$V2"; md5sum "$V2" | cut -d' ' -f1
echo "--- crlf 计数（应为 0） ---"; grep -c $'\r' "$V2" || true
echo "--- 机检 From/To 同时为真 ---"; sed -n '1p' "$V2" | grep -qE '^From:' && sed -n '2p' "$V2" | grep -qE '^To:' && echo BOTH_TRUE
