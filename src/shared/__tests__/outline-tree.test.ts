import { describe, expect, it } from 'vitest'
import { buildOutlineTree } from '../outline-tree'

// E4j-4：大纲的卷/单元/章 三层树。
// 关键事实：归属不是存下来的，是按「计划等分」折算出来的；只有写了「覆盖：<本单元>」才算声明。
const PLAN = [
  '## 卷一：开局',
  '### 单元一：门牌',
  '### 单元二：定价',
  '',
  '## 卷二：销档',
  '### 单元一：配合',
].join('\n')

const synopsisOf = (covers: readonly string[]) => covers
  .map((cover, index) => `## 第${index + 1}章：第${index + 1}章标题` + (cover ? `\n覆盖：${cover}` : '') + '\n正文。')
  .join('\n');

describe('buildOutlineTree：卷/单元/章 三层', () => {
  it('60 章两卷：卷一半 30 章，单元边界 1–15 / 16–30', () => {
    const synopsis = synopsisOf(Array.from({ length: 60 }, () => ''));
    const tree = buildOutlineTree(PLAN, synopsis, 60)!;
    expect(tree.volumes).toHaveLength(2);
    const unitOne = tree.volumes[0]!.units[0]!;
    expect(unitOne.chapters.map(c => c.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(tree.volumes[0]!.units[1]!.chapters[0]!.number).toBe(16);
  })

  it('没写「覆盖：」的章标 computed（折算出来的，可能漂移）', () => {
    const tree = buildOutlineTree(PLAN, synopsisOf(['', '', '', '']), 60)!;
    for (const volume of tree.volumes) for (const unit of volume.units) for (const c of unit.chapters) {
      expect(c.source).toBe('computed');
      expect(c.declaredId).toBeNull();
    }
    expect(tree.computedCount).toBe(4);
    expect(tree.mismatchCount).toBe(0);
  })

  it('写了「覆盖：M1-1/逼法」且折算一致 ⇒ declared', () => {
    const tree = buildOutlineTree(PLAN, synopsisOf(['M1-1/逼法', '', '']), 60)!;
    const first = tree.volumes[0]!.units[0]!.chapters[0]!;
    expect(first.source).toBe('declared');
    expect(first.declaredId).toBe('M1-1/逼法');
  })

  it('声明指向别的单元 ⇒ mismatch（漂移的早期信号）', () => {
    // 第 1 章落在单元一，却声明 M1-2 ⇒ 不一致
    const tree = buildOutlineTree(PLAN, synopsisOf(['M1-2/逼法', '', '']), 60)!;
    expect(tree.mismatchCount).toBe(1);
    const declaredUnit = tree.volumes[0]!.units[1]!;
    // 按声明归入单元二，但 source 标 mismatch
    expect(declaredUnit.chapters[0]!.source).toBe('mismatch');
    expect(declaredUnit.chapters[0]!.number).toBe(1);
  })

  it('「覆盖：无」不算声明，仍按折算', () => {
    const tree = buildOutlineTree(PLAN, synopsisOf(['无', '', '']), 60)!;
    expect(tree.volumes[0]!.units[0]!.chapters[0]!.source).toBe('computed');
  })

  it('章节点带原文行号，能在正文里定位', () => {
    const synopsis = synopsisOf(['M1-1/逼法', '', '']);
    const tree = buildOutlineTree(PLAN, synopsis, 60)!;
    const chapter = tree.volumes[0]!.units[0]!.chapters[0]!;
    expect(chapter.line).not.toBeNull();
    expect(synopsis.split('\n')[chapter.line!]).toContain('第1章');
  })

  it('没有章级条目 / 结构不可解析时返回 null', () => {
    expect(buildOutlineTree(PLAN, '没有章标题的散文', 60)).toBeNull();
    expect(buildOutlineTree('', synopsisOf(['']), 60)).toBeNull();
    expect(buildOutlineTree(PLAN, synopsisOf(['']), 0)).toBeNull();
  })
});
