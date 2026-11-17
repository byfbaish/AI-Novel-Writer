// 多帧 zstd 解帧器：按魔数 28 B5 2F FD 切帧，逐帧各自解压后拼接
// 用法：node tmp-zstd-frames.mjs <src.zstd> [out.jsonl]
import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const src = process.argv[2];
const out = process.argv[3];
const buf = readFileSync(src);
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const starts = [];
for (let i = 0; i + 4 <= buf.length; i++) {
  if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) starts.push(i);
}
const parts = [];
for (let k = 0; k < starts.length; k++) {
  const seg = buf.subarray(starts[k], k + 1 < starts.length ? starts[k + 1] : buf.length);
  try { parts.push(zlib.zstdDecompressSync(seg)); } catch (e) { parts.push(Buffer.alloc(0)); }
}
const text = Buffer.concat(parts).toString('utf8');
console.error(`frames=${starts.length} bytes=${Buffer.concat(parts).length} lines=${text.split('\n').length}`);
if (out) writeFileSync(out, text); else process.stdout.write(text);
