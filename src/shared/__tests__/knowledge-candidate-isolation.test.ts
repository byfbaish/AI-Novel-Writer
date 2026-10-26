import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * P20-3 §8：「不让正文链 / 审稿链读 `knowledge_candidates`」——用源码扫描钉住。
 *
 * ## 为什么这条要靠扫描而不是靠类型
 *
 * 候选（章末提议）和知情状态（作者登记）**在界面上是同一格**，在库里是两张表：
 * `knowledge_candidates` 是提议，`knowledge_states` 才是真相。
 * 一旦正文链顺手读了候选，就会出现「模型提议过、作者没采纳」的内容被当成本章前提写进正文 ——
 * 那是判据 DE（不造第二个真相）的原样复发，而且**不会有任何类型错误**：
 * 两者都是 `{ characterId, factChapter, factEvidence }` 形状。
 *
 * 所以这里给的是「全库只有这一份白名单能提到它」：多一个文件提到就红，红的时候
 * 报的是文件路径，作者一眼能看出是新链子想读它，还是旧链子被顺手改了。
 *
 * 提示：测试文件本身（`__tests__`）不参与扫描 —— 造数据是它们的本职。
 */

/**
 * 这几条要读全库源码，单跑 ~0.4s，但**全集并行跑时会被 I/O 挤到 5s 默认超时之外**
 * （实测过一次假红）。扫描型用例本来就该给宽一档的预算，别让别人加测试时替它背锅。
 */
const SCAN_TIMEOUT_MS = 30_000

const ROOTS = ['src', 'electron']
const EXTENSIONS = ['.ts', '.tsx']

/** 允许提到知识候选的地方：**定稿后处理链 + 作者确认面**，两条链各占一半。 */
const ALLOWED = new Set([
  // ── 真相层：类型、判据、事实身份 ──────────────────────────────
  'src/shared/knowledge-candidate.ts',
  // ── 定稿后处理链：步骤定义、来源、提交 ────────────────────────
  'src/shared/finalization-generation.ts',
  'electron/services/finalization-generation-source.ts',
  'electron/services/finalization-generation.ts',
  'electron/services/main-generation-owner.ts',
  'src/services/workflows/commands/finalize-chapter.command.ts',
  // ── 提示词资产（新 purpose 的模板与英文版）────────────────────
  'src/services/builtin-prompt-templates.ts',
  'src/services/prompt-language.ts',
  // ── 存储与通道 ──────────────────────────────────────────────
  'electron/migrations/m22-knowledge-candidates.ts',
  'electron/migrations/desktop-registry.ts',
  'electron/repositories/summary-repository.ts',
  'src/shared/ipc-channels.ts',
  'electron/controllers/db-controller.ts',
  // ── 作者确认面：提议条，采纳也只是填草稿 ──────────────────────
  'src/components/editor/KnowledgeRegistryPanel.tsx',
])

/** 命中判据：字段名、IPC 名、步骤 key、类型名，四种写法任取其一。 */
const HITS = /knowledge_candidates|knowledge-candidates|KnowledgeCandidate/u

function walk(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    if (entry === '__tests__' || entry === 'node_modules') continue
    const full = join(directory, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) { walk(full, found); continue }
    if (EXTENSIONS.some(extension => entry.endsWith(extension))) found.push(full)
  }
  return found
}

function projectPath(file: string): string {
  return relative(process.cwd(), file).split(sep).join('/')
}

function mentionsKnowledgeCandidates(file: string): boolean {
  return HITS.test(readFileSync(file, 'utf8'))
}

describe('知识候选的作用域（P20-3 §8）', { timeout: SCAN_TIMEOUT_MS }, () => {
  it('全库只有白名单里的文件提到知识候选', () => {
    const actual = ROOTS
      .flatMap(root => walk(resolve(process.cwd(), root)))
      .filter(mentionsKnowledgeCandidates)
      .map(projectPath)
      .sort()

    expect(actual).toEqual([...ALLOWED].sort())
  })

  it('正文链不读知识候选：只认作者登记的 knowledge_states', () => {
    const draftChain = [
      // 写前查阅装配（知情节的渲染唯一入口）
      'src/shared/prewrite-consultation.ts',
      // 章节材料装配
      'src/services/workflows/chapter-materials.ts',
      // 首稿 / 续写的正文轮
      'src/services/workflows/commands/generate-draft.command.ts',
    ]
    for (const file of draftChain) {
      expect(mentionsKnowledgeCandidates(resolve(process.cwd(), file)), file).toBe(false)
    }
  })

  it('审稿链不读知识候选：审稿看的是作者登记过的事实', () => {
    const reviewChain = [
      'src/shared/review-continuity-bible.ts',
      'src/services/workflows/commands/review-continuity-canon.ts',
      'src/services/workflows/commands/review-revision-materials.ts',
      'electron/services/review-revision-context.ts',
    ]
    for (const file of reviewChain) {
      expect(mentionsKnowledgeCandidates(resolve(process.cwd(), file)), file).toBe(false)
    }
  })

  it('白名单本身不留死项：写进去的文件必须真的还在提它', () => {
    // 反向钉：候选被删掉而白名单没跟着改时，这条会红 —— 否则白名单会慢慢变成
    // 「历史文件清单」，下次有人往里加正文链文件也不会被发现。
    for (const file of ALLOWED) {
      expect(mentionsKnowledgeCandidates(resolve(process.cwd(), file)), file).toBe(true)
    }
  })
})
