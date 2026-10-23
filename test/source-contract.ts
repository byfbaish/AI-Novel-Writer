import { readFileSync } from 'node:fs'
import ts from 'typescript'

/**
 * Source-level contract tests intentionally ignore checkout line endings.
 * Git may materialize the same tracked source as LF or CRLF on Windows.
 */
export function normalizeSourceEol(source: string): string {
  return source.replace(/\r\n?/g, '\n')
}

/**
 * Read a tracked source file through the same canonical EOL boundary used by
 * source-contract assertions and content hashes.
 */
export function readNormalizedSource(sourcePath: string): string {
  return normalizeSourceEol(readFileSync(sourcePath, 'utf8'))
}

/**
 * 剥掉 TS/TSX 源码里的**注释**，其余内容（字符串、模板、JSX 文本、正则）原样保留；
 * 非 TS 文件（CSS 等）按原样返回。
 *
 * 为什么需要它：视觉契约里的「伪图标」断言要扫的是**用户看得见的文案**，而
 * ⚠️ / ★ 一类记号是本仓库注释的常用记号（判据标记、踩坑警告），裸扫源码会把
 * 注释里的记号误判成 UI 伪图标。走 `ts.transpileModule` 的 `removeComments`
 * 而不是正则：编译器认得字符串/模板/JSX 边界，不会把写在文案里的同一个字符
 * 一起删掉（已 sanity check：注释全剥、字符串/模板/JSX/regex 内容完整保留）。
 *
 * 注意：输出是 transpile 后的文本（缩进/分号被规范化）⇒ 只可用于正则类断言，
 * **不能**用于多行精确串断言（那类断言继续用裸源码）。
 */
export function withoutComments(sourcePath: string, content: string): string {
  if (!/\.[cm]?tsx?$/.test(sourcePath)) return content
  return ts.transpileModule(content, {
    compilerOptions: {
      target: ts.ScriptTarget.Latest,
      removeComments: true,
      newLine: ts.NewLineKind.LineFeed,
    },
    fileName: sourcePath,
  }).outputText
}
