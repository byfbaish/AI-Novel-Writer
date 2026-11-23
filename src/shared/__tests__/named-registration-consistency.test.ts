import { describe, expect, it } from 'vitest'
import {
  MIN_NAMED_ENTITY_LENGTH,
  NAMED_PERSON_KEY_PREFIX,
  findUnregisteredPersonRisks,
  namedPersonStableFactKey,
  parseNamedPersonRegistrations,
  parseRegisteredSpaceNames,
} from '../named-registration-consistency'

/**
 * AC2／S2：第 4 维【具名人物登记】× 蓝图 `characters[]` 的层间引用完整性。
 *
 * 断言分工（与空间—钟点那套同纪律）：
 * - **正向**：确有登记/台账命中 ⇒ 必须放行；
 * - **负向（更重要）**：没有可判定形式（登记 0 条 / 台账缺失 / 章号不可信）⇒
 *   **必须不判** —— 这是「静默 ≠ 通过」与 fail-open 纪律的落点。
 */

/** 照抄实施包 §4 的夹具：一行空间机读行 + 三行人物登记（含尾部括注、列表符号）。 */
const WORLD = [
  '## 4. 空间结构',
  '老陈记｜hours=07:00-09:00｜entry=直接进入',
  '★【具名人物登记】',
  '老陈｜老陈记早餐摊摊主｜"还是老样子，加辣？"｜主角每天早上的熟客',
  '林昭（主角）｜本书主角｜"走吧"｜本人',
  '门卫老周｜厂区南门门卫｜"证件"｜主角进厂要过的关卡',
  '',
  '## 5. 时间历法',
].join('\n')

const CHAPTER = 7

describe('findUnregisteredPersonRisks', () => {
  it('① 登记行命中 / 台账命中 ⇒ 都不报（台账只作交叉核对）', () => {
    const findings = findUnregisteredPersonRisks(WORLD, {
      chapterNumber: CHAPTER,
      characterNames: ['老陈', '林某'],
      rosterNames: ['林某', '主角'],
    })
    expect(findings).toEqual([])
  })

  it('② 两处都查不到 ⇒ 1 条 warning，键/层级/章号正确', () => {
    const findings = findUnregisteredPersonRisks(WORLD, {
      chapterNumber: CHAPTER,
      characterNames: ['陌生甲'],
      rosterNames: ['主角'],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]!.stableFactKey).toBe(`${NAMED_PERSON_KEY_PREFIX}陌生甲`)
    expect(findings[0]!.severity).toBe('warning')
    expect(findings[0]!.sourceChapter).toBe(CHAPTER)
  })

  it('③ 登记名去尾部括注后与蓝图名互认（「林昭」对「林昭（主角）」）', () => {
    const findings = findUnregisteredPersonRisks(WORLD, {
      chapterNumber: CHAPTER,
      characterNames: ['林昭'],
      rosterNames: ['主角'],
    })
    expect(findings).toEqual([])
  })

  it('④ 设定层读取失败（undefined）⇒ 不判', () => {
    const findings = findUnregisteredPersonRisks(undefined, {
      chapterNumber: CHAPTER,
      characterNames: ['陌生甲'],
      rosterNames: ['主角'],
    })
    expect(findings).toEqual([])
  })

  it('⑤ 世界观整块写「无」⇒ 名单空即显式未判，不误报', () => {
    const findings = findUnregisteredPersonRisks('## 4. 空间结构\n无', {
      chapterNumber: CHAPTER,
      characterNames: ['陌生甲'],
      rosterNames: ['主角'],
    })
    expect(findings).toEqual([])
  })

  it('⑥ 角色台账读失败（rosterNames undefined）⇒ 整条 fail-open', () => {
    const findings = findUnregisteredPersonRisks(WORLD, {
      chapterNumber: CHAPTER,
      characterNames: ['陌生甲'],
      rosterNames: undefined,
    })
    expect(findings).toEqual([])
  })

  it('⑦ 章号不可信（0 / 非整数）⇒ 不判', () => {
    const scope = { characterNames: ['陌生甲'], rosterNames: ['主角'] }
    expect(findUnregisteredPersonRisks(WORLD, { ...scope, chapterNumber: 0 })).toEqual([])
    expect(findUnregisteredPersonRisks(WORLD, { ...scope, chapterNumber: 3.5 })).toEqual([])
  })

  it('⑧ 单字名按放行处理；空串/单字指代不产 finding，多字项不崩', () => {
    expect(MIN_NAMED_ENTITY_LENGTH).toBe(2)
    // 单字名（含单字指代「他」）低于门槛 ⇒ 不参与比对、不报缺失。
    expect(findUnregisteredPersonRisks(WORLD, {
      chapterNumber: CHAPTER,
      characterNames: ['陈', '', '他'],
      rosterNames: ['主角'],
    })).toEqual([])
    // 多字指代/纯标点：模板 `characters:["完整姓名"]` 只是提示词形状约束，不是编译期保证
    // ⇒ 至少不许抛错（本卡不加指代词表，见回执「已知不足」）。
    expect(() => findUnregisteredPersonRisks(WORLD, {
      chapterNumber: CHAPTER,
      characterNames: ['那女人', '！！！'],
      rosterNames: ['主角'],
    })).not.toThrow()
  })

  it('⑨ 豁免命中 ⇒ 不报', () => {
    const findings = findUnregisteredPersonRisks(WORLD, {
      chapterNumber: CHAPTER,
      characterNames: ['陌生甲'],
      rosterNames: ['主角'],
    }, [{ stableFactKey: namedPersonStableFactKey('陌生甲'), reason: 'x', revoked: false }])
    expect(findings).toEqual([])
  })

  it('⑩ 豁免已撤销 ⇒ 仍然报', () => {
    const findings = findUnregisteredPersonRisks(WORLD, {
      chapterNumber: CHAPTER,
      characterNames: ['陌生甲'],
      rosterNames: ['主角'],
    }, [{ stableFactKey: namedPersonStableFactKey('陌生甲'), reason: 'x', revoked: true }])
    expect(findings).toHaveLength(1)
  })

  it('⑪ 键稳定：首尾空白不影响 stableFactKey', () => {
    expect(namedPersonStableFactKey(' 陌生甲 ')).toBe(namedPersonStableFactKey('陌生甲'))
  })

  it('⑫ 空间机读行不被当成人物登记行', () => {
    expect(parseNamedPersonRegistrations(WORLD).map(registration => registration.name))
      .toEqual(['老陈', '林昭（主角）', '门卫老周'])
  })

  it('⑬ 空间名解析器只回答「登记了哪些空间名」，且不吞人物登记行', () => {
    expect(parseRegisteredSpaceNames(WORLD)).toEqual(['老陈记'])
  })
})
