/**
 * 情节大纲的**卷/单元/章 三层树**（E4j-4，2026-10-19）。
 *
 * 设计稿：`docs/design/architecture/volume-quota-context-budget-design.md` §7A.1b。
 *
 * ## 回答的问题
 *
 * 作者原话：「我随便挑一章，问你它属于哪一卷、哪一单元，还能找出这种关系么？」
 *
 * ## 关键事实：这个关系是**算出来的**，不是**存下来的**
 *
 * 大纲正文里**没有**「本章属于哪一卷哪个单元」这种字段。每章的「覆盖：」行只写
 * **逼法**（一次性转折位）或「无」，它不表达归属。真实项目的读数：10 章里 8 章写「覆盖：无」。
 *
 * 所以归属只能由 `arcSpanForChapters`（卷/单元区间**按计划等分折算**）反推。
 * ⚠️ 这意味着：**一旦某个单元实际写超，后续章号与单元的对齐会整体错位**
 * （设计稿 §7 的硬前置）。本模块因此给每个章标 `source`：
 *
 * | source | 含义 |
 * |---|---|
 * | `declared` | 该章写了 `覆盖：<本单元ID>`，归属是**声明**的，可信 |
 * | `computed` | 只能按等分折算反推，**可能因实际章数偏离而错位** |
 * | `mismatch` | 声明指向的单元与折算结果**不一致** —— 这是漂移的早期信号，要显式暴露 |
 */

import {
  arcSpanForChapters,
  parseArcStructure,
  type ParsedArcStructure,
} from './arc-position'
import { parseChapterArcCovers } from './arc-node'
import { parseOutlineChapterHeading } from './chapter-heading'
import { buildArcTree, type ArcTree, type ArcTreeUnit, type ArcTreeVolume } from './arc-tree'

export type ChapterUnitSource = 'declared' | 'computed' | 'mismatch'

export interface OutlineTreeChapter {
  /** 章号，1 起 */
  number: number
  title: string;
  /** 本章标题在大纲正文里的行号（0 起）；解析不到为 null */
  line: number | null;
  source: ChapterUnitSource;
  /** 声明值（`覆盖：` 行原文里的结构位 ID），没有声明为 null */
  declaredId: string | null;
}

export interface OutlineTreeUnit extends ArcTreeUnit {
  chapters: readonly OutlineTreeChapter[];
}

export interface OutlineTreeVolume extends Omit<ArcTreeVolume, 'units'> {
  units: readonly OutlineTreeUnit[];
}

export interface OutlineTree {
  volumes: readonly OutlineTreeVolume[];
  twoLevel: boolean;
  /** 归属不是「声明」而是「折算」的章数 —— 0 表示每一章都能追溯到声明 */
  computedCount: number;
  /** 声明与折算不一致的章数 —— 大于 0 说明结构已经漂移 */
  mismatchCount: number;
}

/** 从 `覆盖：M1-2/逼法` 里取出单元序号（`M1-2` → 2）。取不到返回 null。 */
function unitIndexFromCoverId(id: string): number | null {
  const match = /^M[0-9]+-([0-9]+)/u.exec(id.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/** 章节标题与 `覆盖：` 行在原文里的行号（0 起）。 */
function scanChapterLines(synopsis: string): Map<number, number> {
  const lines = new Map<number, number>();
  for (const [index, raw] of synopsis.split(/\r?\n/u).entries()) {
    const fields = parseOutlineChapterHeading(raw.trim());
    // 本模块的约束：恰好 `##`、单章、章号阿拉伯数字、只认「第N章」（不认 `Chapter N`）。
    if (!fields || fields.hashLevel !== 2 || fields.grouped || !fields.arabic || fields.style !== 'cn') continue;
    if (!lines.has(fields.chapter)) lines.set(fields.chapter, index);
  }
  return lines;
}

/**
 * 构造大纲的卷/单元/章 三层树。
 *
 * 结构不可解析或大纲没有章级条目时返回 `null`（调用方据此不渲染树）。
 */
export function buildOutlineTree(
  plan: string | null | undefined,
  synopsis: string | null | undefined,
  totalChapters: number,
): OutlineTree | null {
  if (!plan?.trim() || !synopsis?.trim()) return null;
  if (!Number.isSafeInteger(totalChapters) || totalChapters < 1) return null;
  const parsed: ParsedArcStructure | null = parseArcStructure(plan);
  if (!parsed) return null;
  const base: ArcTree | null = buildArcTree(plan);
  if (!base) return null;
  const chapterLines = scanChapterLines(synopsis);
  if (chapterLines.size === 0) return null;
  const covers = new Map(parseChapterArcCovers(synopsis).map(item => [item.chapterNumber, item]));

  let computedCount = 0;
  let mismatchCount = 0;
  const buckets = new Map<string, OutlineTreeChapter[]>();

  for (const chapter of [...chapterLines.keys()].sort((left, right) => left - right)) {
    const span = arcSpanForChapters(parsed, totalChapters, chapter, chapter);
    if (!span) continue;
    const declaredId = covers.get(chapter)?.covers[0] ?? null;
    const declaredUnit = declaredId ? unitIndexFromCoverId(declaredId) : null;
    // ⚠️ `ArcSpan` 没有 `midCount`（它只带 midIndex / endMidIndex）；单元数要从 parsed 取。
    const midCount = parsed.majors[span.majorIndex - 1]?.mids.length ?? 0;
    // 只有「声明指向本卷内某个单元」才有比对意义；跨卷声明或解析不出序号一律按折算处理。
    const declaredInThisVolume = declaredUnit !== null && declaredUnit >= 1 && declaredUnit <= midCount;
    const source: ChapterUnitSource = !declaredInThisVolume
      ? 'computed'
      : declaredUnit === span.midIndex ? 'declared' : 'mismatch';
    if (source === 'computed') computedCount += 1;
    if (source === 'mismatch') {
      mismatchCount += 1;
      computedCount += 0;
    }
    const unitIndex = declaredInThisVolume ? declaredUnit! : span.midIndex;
    const key = `${span.majorIndex}:${unitIndex}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(Object.freeze({
      number: chapter,
      title: covers.get(chapter)?.title ?? '',
      line: chapterLines.get(chapter) ?? null,
      source,
      declaredId,
    }));
    buckets.set(key, bucket);
  }

  const volumes: OutlineTreeVolume[] = base.volumes.map(volume => {
    const units: OutlineTreeUnit[] = volume.units.map(unit => {
      const chapters = buckets.get(`${volume.index}:${unit.index}`) ?? [];
      return Object.freeze({ ...unit, chapters: Object.freeze(chapters) });
    });
    return Object.freeze({ index: volume.index, name: volume.name, line: volume.line, units: Object.freeze(units) });
  });

  return Object.freeze({
    volumes: Object.freeze(volumes),
    twoLevel: base.twoLevel,
    computedCount,
    mismatchCount,
  });
}
