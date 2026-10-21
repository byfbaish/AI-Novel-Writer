import { describe, expect, it } from 'vitest'
import {
  buildCastLedger,
  castLedgerTodos,
  type CastLedgerAnchor,
  type CastLedgerCharacter,
  type CastLedgerMention,
} from '../cast-ledger'

const gu = { characterId: 'c-gu', name: '顾长风', aliases: ['顾师兄'] }
const liu = { characterId: 'c-liu', name: '刘三' }
const characters: CastLedgerCharacter[] = [gu, liu]

function entry(name: string, mentions: CastLedgerMention[], extras: {
  characters?: CastLedgerCharacter[]
  anchors?: CastLedgerAnchor[]
} = {}) {
  const ledger = buildCastLedger(extras.characters ?? characters, extras.anchors ?? [], mentions)
  return ledger.find(item => item.name === name)
}

const mention = (name: string, source: CastLedgerMention['source'] = 'review-state-delta'): CastLedgerMention =>
  ({ name, source, chapterNumber: 4 })

describe('buildCastLedger', () => {
  it('reports a mentioned name with neither card nor anchor as an orphan', () => {
    expect(entry('老赵', [mention('老赵')])).toEqual({
      name: '老赵', status: 'orphan', characterIds: [], mentions: [mention('老赵')],
    })
  })

  it('treats a name resolved to exactly one card as carded', () => {
    expect(entry('顾长风', [mention('顾长风')])).toEqual({
      name: '顾长风', status: 'carded', characterIds: ['c-gu'], mentions: [mention('顾长风')],
    })
  })

  // 作者给一张卡加过旧名，说明两个字符串是同一个人。不映射 ⇒ 报成孤儿 ⇒ 作者照着建第二张卡，
  // 才是真的造出重名。这条是归位表最容易帮倒忙的地方。
  it('resolves an alias to its card instead of inventing a second one', () => {
    expect(entry('顾师兄', [mention('顾师兄')])).toMatchObject({
      status: 'carded', characterIds: ['c-gu'],
    })
  })

  // 退休卡是「建卡→补全→退休」的正常产物，不能当落点：状态会显示成无需处理，
  // 而写回时才发现卡不能写。
  it('does not count a retired card as a landing point', () => {
    const retired: CastLedgerCharacter[] = [{ characterId: 'c-r', name: '刘三', retired: true }]
    expect(entry('刘三', [mention('刘三')], { characters: retired })).toMatchObject({
      status: 'orphan', characterIds: [],
    })
  })

  // 两张卡同名：这不是「已归位」，是「归不了位」。动作是作者指定是哪一张，不是建卡。
  it('flags a name that resolves to several cards as ambiguous, not as carded', () => {
    const duplicated: CastLedgerCharacter[] = [
      { characterId: 'c-a', name: '刘三' },
      { characterId: 'c-b', name: '刘三' },
    ]
    expect(entry('刘三', [mention('刘三')], { characters: duplicated })).toMatchObject({
      status: 'ambiguous', characterIds: ['c-a', 'c-b'],
    })
  })

  it('treats an author-registered anchor as anchored but keeps the card when one exists', () => {
    const anchors: CastLedgerAnchor[] = [
      { name: '小郑', anchorRole: '跑腿杂役' },
      { name: '顾长风', anchorRole: '主角' },
    ]
    expect(entry('小郑', [mention('小郑')], { anchors })).toEqual({
      name: '小郑', status: 'anchored', characterIds: [], anchorRole: '跑腿杂役', mentions: [mention('小郑')],
    })
    // 先建的卡比后补的判定更具体：有卡就是 carded，不能被 anchored 盖掉。
    expect(entry('顾长风', [mention('顾长风')], { anchors })).toMatchObject({
      status: 'carded', characterIds: ['c-gu'],
    })
  })

  // 只对账「被提到过的名字」。没被提到的卡不进表 —— 归位表不是角色清单，
  // 混进来会让作者以为那些卡也需要处理。
  it('never lists a card that no chain mentioned', () => {
    expect(buildCastLedger(characters, [], [mention('老赵')]).map(item => item.name)).toEqual(['老赵'])
  })

  it('puts todos first so the shortest path to work is at the top', () => {
    const anchors: CastLedgerAnchor[] = [{ name: '小郑', anchorRole: '跑腿杂役' }]
    const ledger = buildCastLedger(characters, anchors, [
      mention('顾长风'), mention('小郑'), mention('老赵'), mention('老张头'),
    ])
    expect(ledger.map(item => [item.name, item.status])).toEqual([
      ['老张头', 'orphan'], ['老赵', 'orphan'], ['小郑', 'anchored'], ['顾长风', 'carded'],
    ])
  })

  it('deduplicates the same chain mentioning one name twice in one chapter, and caps the list', () => {
    const result = entry('老赵', [
      mention('老赵'), mention('老赵'),
      { name: '老赵', source: 'blueprint', chapterNumber: 4 },
      ...Array.from({ length: 8 }, (_, index) => ({
        name: '老赵', source: 'finalized-proposal' as const, chapterNumber: index + 10,
      })),
    ])
    expect(result!.mentions).toHaveLength(5)
    expect(result!.mentions.slice(0, 2)).toEqual([mention('老赵'), { name: '老赵', source: 'blueprint', chapterNumber: 4 }])
  })

  it('ignores blank names instead of producing an empty orphan row', () => {
    expect(buildCastLedger(characters, [], [{ name: '   ', source: 'blueprint' }])).toEqual([])
  })
})

describe('castLedgerTodos', () => {
  // anchored 是作者的有意决定，carded 是已归位 —— 都不是待办。混进来就是判据 CX 的队列爆炸。
  it('keeps only orphans and ambiguous names', () => {
    const ledger = buildCastLedger(characters, [{ name: '小郑', anchorRole: '跑腿杂役' }], [
      mention('老赵'), mention('老张头'), mention('小郑'), mention('顾长风'),
    ])
    expect(castLedgerTodos(ledger).map(item => item.name)).toEqual(['老张头', '老赵'])
  })
})
