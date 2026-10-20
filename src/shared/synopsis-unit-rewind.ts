/**
 * 「重写一个单元」的**文本侧**纯函数（P3b，2026-10-21）。
 *
 * 作者裁定：**只做整单元回退，不做单元内某章重写** ——「一个单元是一个完整的局面，
 * 由大模型整体规划」。所以这里的动作只有一个：把某个单元已经写进大纲正文的章条目
 * **整块删掉**，让游标回到该单元起点，下一批重新生成这一个单元。
 *
 * ## 为什么单独一个文件
 *
 * 「哪些行算章条目」必须与 `plot-outline-contract.headings()` / 覆盖章数校验用同一把尺子，
 * 否则删的时候少删一章、或者把设定层当章条目删掉，都是数据事故。
 * 所以本文件只依赖 `chapter-heading.outlineChapterHeading`，不引入任何业务依赖。
 */

import { outlineChapterHeading } from './chapter-heading'

export interface OutlineChapterRange {
  /** 全书起始章号（含） */
  from: number
  /** 全书终止章号（含） */
  to: number
}

export interface OutlineUnitRemoval {
  /** 删除之后的正文 */
  text: string
  /** 实际被删掉的章号（可能为空：正文里这个单元一章都没写） */
  removed: number[]
  /** 被删掉的字符数（给确认弹窗显示"要删多少字"） */
  removedChars: number
}

/**
 * 从大纲正文里**整块**删掉落在 `[range.from, range.to]` 内的章条目。
 *
 * 删除单元 = 从章标题行开始，一直删到「下一个不属于本区间的章标题行」之前。
 * 设定层（第一个章标题之前的文本）永远保留；区间外的章条目永远保留。
 *
 * 为什么按「块」而不是按行号：条目正文可能包含任意行（`选择：`/`收尾：`/引用/空行），
 * 只有下一个章标题才是真正的边界。
 */
export function removeOutlineChapterEntries(text: string, range: OutlineChapterRange): OutlineUnitRemoval {
  const lines = text.split('\n')
  const kept: string[] = []
  const removed: number[] = []
  let removedChars = 0
  let inside = false
  for (const rawLine of lines) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    const fields = outlineChapterHeading(line)
    if (fields) {
      // 章组（`## 第12–15章`）与目标区间有任何交集都算「要删」：整块删比拆半块安全，
      // 半块会让剩下的部分章号既不属于谁、又通不过覆盖校验。
      const overlaps = fields.chapterTo >= range.from && fields.chapter <= range.to
      inside = overlaps
      if (overlaps) {
        removed.push(fields.chapter)
        removedChars += rawLine.length
        continue
      }
    }
    if (inside) {
      removedChars += rawLine.length
      continue
    }
    kept.push(rawLine)
  }
  // 尾部可能留下多余的空白行（删掉最后几章时尤其明显）；只收掉尾部空行，
  // 不碰正文内部，避免把作者手工排的段落间距改掉。
  while (kept.length > 0 && kept[kept.length - 1]!.trim() === '') kept.pop()
  return { text: kept.join('\n'), removed, removedChars }
}
