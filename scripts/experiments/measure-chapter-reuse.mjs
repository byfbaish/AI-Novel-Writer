#!/usr/bin/env node
/**
 * 卡 caf3f90a · B4 —— 整章复用阈值标定（只测量、只出报告；不接线、不改判定器语义）
 *
 * ## 复用，不另造
 * - 主口径：直接 import 已入库判定器 `src/shared/chapter-reuse-coverage.ts` 的
 *   `analyzeChapterReuse` / `REUSE_RATIO_ADVISORY` / `REUSE_RATIO_BLOCKING`。
 *   `.mjs` 不能直接 import `.ts`（内部相对导入无扩展名），照抄
 *   `scripts/measure-ai-flavor-baseline.mjs:174-187` 的
 *   「esbuild stdin 内存打包 → data:text/javascript;base64 动态 import」。
 *   本脚本**不重写** ratio / runs / severity 的计算，也不改判定器里的常量。
 * - 对照口径：d12 生产守卫的 8-gram 覆盖率，算法逐行搬自
 *   `scripts/experiments/d12-direct-rerun.mjs:33-60`（NGRAM=8 / HEAD=1200 /
 *   norm() / 头 1200 字 vs 上一章结尾 1000 字 / 连续 ≥80 字判重演）。
 *   唯一改动是把 d12 里固定的 `ch1` 参数化为 `previousChapter`；
 *   **不 import d12 脚本本身**（它有读 trace、写 out 目录的顶层副作用）。
 * - 语料只读 `.runtime/corpus/reuse-calibration/*.txt`，不碰 sqlite、不碰 better-sqlite3。
 *
 * ## 用法（路径全部由 import.meta.url 推导，工作目录任意）
 *   node scripts/experiments/measure-chapter-reuse.mjs
 *   node scripts/experiments/measure-chapter-reuse.mjs --json
 *   node scripts/experiments/measure-chapter-reuse.mjs --regen-fixtures
 *
 * 构造样例落盘在 `.batch/reuse-calibration-fixtures/`（组 B / 组 C 各一文件）。
 * 默认复用已存在的 fixtures，缺失才生成；`--regen-fixtures` 强制重建。
 */
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CORPUS_DIR = path.join(repositoryRoot, '.runtime', 'corpus', 'reuse-calibration')
const FIXTURES_DIR = path.join(repositoryRoot, '.batch', 'reuse-calibration-fixtures')
const GROUP_B_FILE = path.join(FIXTURES_DIR, 'group-B-rewrite-previous-chapter.json')
const GROUP_C_FILE = path.join(FIXTURES_DIR, 'group-C-same-setting-new-plot.json')

const ARGS = process.argv.slice(2)
const jsonOnly = ARGS.includes('--json')
const regen = ARGS.includes('--regen-fixtures')

fs.writeSync(2, `[measure-chapter-reuse] node ${process.version} / ABI ${process.versions.modules}\n`)

// ─── 1. 复用已入库判定器（照抄 scripts/measure-ai-flavor-baseline.mjs:174-187）───
const bundled = await build({
  stdin: {
    contents: "export { analyzeChapterReuse, REUSE_RATIO_ADVISORY, REUSE_RATIO_BLOCKING } from './src/shared/chapter-reuse-coverage.ts';",
    resolveDir: repositoryRoot,
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
})
const { analyzeChapterReuse, REUSE_RATIO_ADVISORY, REUSE_RATIO_BLOCKING } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

// ─── 2. d12 生产口径（原样搬 scripts/experiments/d12-direct-rerun.mjs:33-60）───
// d12 :33-35
const NGRAM = 8
const HEAD = 1200
const LONG_RUN = 80
// d12 :37
const norm = (t) => t.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')

/** d12 :39-42 + :48-69。与生产判据 hasSubstantialPreviousChapterReuse 完全同款。
 *  唯一差别：d12 的 endingGrams 在顶层由固定的 ch1 构建一次，这里改由入参
 *  previousChapter 构建（每对章一次）；计算逻辑逐行未动。 */
function guardReading(draft, previousChapter) {
  // d12 :39-42
  const prevEnding = norm(previousChapter.slice(-1000))
  const endingGrams = new Set()
  for (let i = 0; i + NGRAM <= prevEnding.length; i++) endingGrams.add(prevEnding.slice(i, i + NGRAM))
  // d12 :49-68
  const head = norm(draft.slice(0, HEAD))
  const covered = new Uint8Array(head.length)
  for (let i = 0; i + NGRAM <= head.length; i++) {
    if (!endingGrams.has(head.slice(i, i + NGRAM))) continue
    for (let o = i; o < i + NGRAM; o++) covered[o] = 1
  }
  let run = 0
  let longest = 0
  let count = 0
  for (let i = 0; i <= covered.length; i++) {
    if (covered[i]) {
      run++
      count++
      continue
    }
    if (run > longest) longest = run
    run = 0
  }
  return { coverPct: (count / Math.max(1, head.length)) * 100, longest, replay: longest >= LONG_RUN }
}

// ─── 3. 两套读数 ─────────────────────────────────────────────────────────────
/** 主口径：判定器，全章 vs 上一章全文，中文 16 字 n-gram，ratio / severity。 */
function primaryReading(prose, previousChapter) {
  const r = analyzeChapterReuse(prose, previousChapter, { writingLanguage: 'zh-CN' })
  return {
    ratio: r.ratio,
    coveredUnits: r.coveredUnits,
    runs: r.runs.length,
    longestRun: r.longestRun,
    severity: r.severity,
  }
}

function measurePair(prose, previousChapter) {
  return {
    primary: primaryReading(prose, previousChapter),
    d12: guardReading(prose, previousChapter),
  }
}

// ─── 4. 语料：只读 .txt + manifest 校验（不碰 sqlite）─────────────────────────
const manifest = JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, 'manifest.json'), 'utf8'))
const corpus = {}
const verify = []
for (const entry of manifest.files) {
  const raw = fs.readFileSync(path.join(CORPUS_DIR, entry.file))
  const bom = raw.length >= 3 && raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF
  const sha = crypto.createHash('sha256').update(raw).digest('hex')
  const text = bom ? raw.toString('utf8').slice(1) : raw.toString('utf8')
  const chars = Array.from(text).length
  corpus[entry.file] = text
  verify.push({
    file: entry.file,
    bytes: raw.length,
    bom,
    sha,
    shaMatch: sha === entry.sha256,
    chars,
    manifestChars: entry.chars,
    charsMatch: chars === entry.chars,
  })
}

// ─── 5. 组 B：整章重写上一章、只换开头（人工构造，正文落盘）──────────────────
/** 三段「全新开头」均为本任务自写，不含任何存量章节的整句。 */
const B_OPENINGS = [
  {
    id: 'B1',
    basedOn: 'ch03.txt',
    minReplacedChars: 170,
    newOpening: `雨停之后碑坪上起了一层薄雾，石板缝里积着水，踩上去先陷半分再回弹。陈砚从南边绕过来，没走度支房门前那条直道，贴着墙根拐进闸机房后头的小院。院里堆着几只空矿篓，篓沿上凝了一圈白霜，他伸手抹了一把，指腹沾到的不是霜，是细石粉。
老刘把油灯挂在檐下，灯芯压得很低，见他进来只抬了抬下巴，没出声。台面上摊着一本翻到中间的册子，纸角被风掀起又落下。陈砚站着看了一会儿，才把袖口里那块裂灵石按在桌沿上，石头面凉，压出一圈浅印。
“昨夜谁翻过考课簿？”他问。老刘拨算盘的手停了停，珠子靠在档上没滑下去。`,
  },
  {
    id: 'B2',
    basedOn: 'ch07.txt',
    minReplacedChars: 220,
    newOpening: `天没亮透，碑坪北边的石阶上落了一层碎叶。陈砚数着台阶往上走，走到第七级停住，回头看了一眼度支房半开的门。门里算盘声断断续续，拨两下停一停，不像在算账，倒像在等谁先开口。
他把左手从袖子里抽出来，虎口那道暗红在晨光底下颜色发沉，指头屈伸了两回才拢住。石阶尽头值房的窗纸破了一角，风灌进去，纸边噗噗地拍。
廊下站着个外门弟子，抱着一摞卷边的册子，见他上来往旁边让了半步，眼神却一直黏在他左袖上。陈砚没理会，抬手扣了扣值房的门框，扣了三下，里头没人应。
“李执事不在。”那弟子终于出声，“卯时就上后山了，留话说查账的册子搁窗台上，谁要翻自己翻。”
陈砚走到窗台边。册子最上头压着一枚朱红小印，印泥还没干透。`,
  },
  {
    id: 'B3',
    basedOn: 'ch10.txt',
    minReplacedChars: 260,
    newOpening: `清退名册是隔夜送来的，纸还带着潮气，摊在柜台上自己卷了边。陈砚进门时先看见那本窄册，再看见压在它上头的朱笔，笔杆上一道新裂，用细线缠了两圈。
柜台后头没人。里间传来算盘珠子落档的声音，不紧不慢，拨到一半忽然停了，隔了几息才接上。窗外的日头刚爬过飞檐，把柜面上的木纹照得一根根清楚。
陈砚把手插在袖筒里站着，没去碰那本册子。灵配袋贴在腰上，袋底那点分量他自己清楚，不必摸也知道。墙上钉着几张散页，最上头一张写的是本月灵灰核销，落款处空着，没盖章。
里间的算盘又停了一回。这回停得久，久到院里那棵老槐上的雀鸟叫了两轮，才有人把椅子往后拖了半寸，木头腿在砖地上刮出一声闷响。`,
  },
]

function buildGroupB() {
  return {
    group: 'B',
    description: '人工构造：整章重写上一章、只换开头（期望高，验证 blocking 灵敏度）。lines.join(separator) 即完整正文。',
    separator: '\n',
    samples: B_OPENINGS.map((spec) => {
      const source = corpus[spec.basedOn]
      let cut = spec.minReplacedChars
      const newline = source.indexOf('\n', spec.minReplacedChars)
      if (newline >= 0 && newline + 1 <= 300) cut = newline + 1
      const text = `${spec.newOpening}\n${source.slice(cut)}`
      if (cut < 150 || cut > 300) throw new Error(`${spec.id} 替换开头 ${cut} 字符，超出 150–300 约定`)
      return {
        id: spec.id,
        basedOn: spec.basedOn,
        previousChapterFile: spec.basedOn,
        construction: `取 ${spec.basedOn} 全文，把开头 ${cut} 字符换成全新文字（${Array.from(spec.newOpening).length} 字），其余逐字不动；模拟「新章整章复用上一章、只换开头」`,
        replacedChars: cut,
        newOpeningChars: Array.from(spec.newOpening).length,
        chars: Array.from(text).length,
        lines: text.split('\n'),
      }
    }),
  }
}

// ─── 6. 组 C：同题材、同人物、剧情不同（人工构造，正文落盘）──────────────────
/** 三例均为本任务自写的全新剧情，只共用人物名与设定名词；不整段复制任何上一章。 */
const C_PARAGRAPHS = [
  {
    id: 'C1',
    previousChapterFile: 'ch05.txt',
    construction: '自写全新剧情「夜雨修闸机，考课簿被借走」；共用陈砚 / 老刘 / 李执事 / 度支房 / 考课簿 / 闸机 / 碑坪 / 算盘，未复用任何原句。',
    paragraphs: [
      '雨是后半夜落下来的。碑坪靠东那排瓦檐存不住水，一道一道往下淌，把闸机铁罩子冲得发亮。陈砚蹲在罩子底下，拿一截废布擦铜齿上的锈，指头一蹭就是一层红褐色的泥。',
      '老刘提着油灯从闸机房出来，灯罩上蒙了水汽，光晃成一团。“这个时辰还不回去？”他把灯往铁架上一挂，“考课簿明日要送度支房，你别在这儿添乱。”',
      '陈砚没抬头。“齿条卡了三天，明早刷契的人一多，铁口子又得咬住。”他把布条绕进齿缝里来回拉，锈屑簌簌落在膝头，“刘叔，昨夜谁来过闸机房？”',
      '老刘的手在灯罩上停了一下。“李执事来查过一回账。”“查账翻闸机？”老刘把灯芯拨小了些，“翻的是名册。说是月底核对，把考课簿借走半宿，天亮前送回来的。”',
      '陈砚把布条从齿缝里抽出来，指腹顺着铜齿摸过去，摸到一处新划痕，斜的，不是锈磨出来的。他把油灯挪近，痕底下压着半点朱砂，红得发暗。',
      '“刘叔，考课簿借走的时候，你抄过页码没有？”“抄它做什么，一本烂册子。”老刘嘟囔了一句，转身要去关门，脚底踩着水滑了半步，扶住门框才站稳。',
      '陈砚站起来，把废布叠好塞进袖口。雨顺着瓦檐滴在他后颈上，凉得有点扎。他想起前世在碑坪见过的那种朱砂印，盖在谁的页边，谁的名字下个月就得从册子上挪走。',
      '“明早我跟你一起去度支房。”他说。老刘在门里头应了一声，含糊得像没听清。雨把闸机铁罩敲出细密的响，一下一下，跟算盘珠子落在木档上是一个节奏。',
      '陈砚把左手从袖子里抽出来，虎口那道暗红被雨水泡得发白，摸上去还是硬的。他攥了攥拳，指节咔地响了一声，转身往碑坪南边走。身后老刘把油灯提起来，灯影在湿石板上拖得很长，一直拖到闸机脚下才断。',
    ],
  },
  {
    id: 'C2',
    previousChapterFile: 'ch08.txt',
    construction: '自写全新剧情「药房签借据兑灵石，药气压住因果纹」；共用青苓 / 灵配袋 / 考课簿 / 裂灵石 / 断脉岭 / 度支房 / 碑坪 / 下品灵石，未复用任何原句。',
    paragraphs: [
      '药房在正街拐角，门脸上挂着一串晒干的青苓草，风一过就互相磕，声音又轻又碎。陈砚掀帘子进去的时候，屋里正熬着药，白气顶着房梁，把窗纸洇得发软。',
      '柜台后头坐着个姑娘，手里捏着小秤，秤杆上挂着一枚铜砝码。“换灵石？”她没抬眼，“押东西还是签借据？”',
      '“签借据。”陈砚把灵配袋搁在柜面上，袋口一松，滚出三块下品灵石，棱角都磨圆了，“先兑两块整的，剩一块留着。”',
      '姑娘把秤挪过来，一块一块过。“青苓。”她忽然报了个名字，像是说给自己听，“你要是押考课簿，利息按月算；签借据，药房只认人，不认册子。上头查起来，我这儿没你的账。”',
      '药气裹着热气扑到袖口上，陈砚小臂一紧。裂灵石贴着腕根自己跳了一下，不烫，反倒凉，像有谁拿指头在皮底下按了按。他把手压在柜沿上，等那一阵过去。',
      '“你这胳膊，”姑娘的秤杆停在半空，“抬起来我看看。”陈砚把袖子撸到肘弯。那道暗红的线比昨夜短了一截，原本要往肘弯爬的枝杈收了回去，只剩虎口往上两指宽，颜色淡成一层旧疤。',
      '姑娘没问缘由，从柜底摸出一只粗瓷碗，倒了大半碗深褐的药汤推过来。“药渣里带灵气，喝下去压得住火。不收钱，算在借据里头。”她把秤杆挂回架上，“不过喝完别立刻进矿洞，底下潮，药性返上来更难受。”',
      '陈砚端起碗，药汤苦得发涩，咽下去一路凉到胸口。袖子里那块裂灵石安静下来，连着两息没跳。他把碗搁回柜台，指头上沾的药汁在木面上留了个圆印。',
      '出门时日头已经斜了，青苓草在门框上撞出一串细响。他摸了摸灵配袋，两块整的硌着胯骨，一块碎的垫在袋底。街上有人推着料车往碑坪去，木轮碾过积水，溅起的泥点子落在他鞋面上，他没擦，径直往度支房那头走了。',
    ],
  },
  {
    id: 'C3',
    previousChapterFile: 'ch10.txt',
    construction: '自写全新剧情「封洞后下甲九巷道找残简，老刘数息」；共用生死契 / 闸机 / 老刘 / 甲九 / 东二岔道 / 赵铎 / 戒尺 / 度支房 / 算盘 / 铁牌，未复用任何原句。',
    paragraphs: [
      '封洞的木牌是辰时挂上去的，两块，一块钉在闸机口，一块钉在东二岔道的木撑上。牌面上只写了四个字：暂缓下洞。墨还没干透，被穿堂风舔出一道斜痕。',
      '陈砚到的时候，闸机铁罩前头已经堵了七八个人，都是外门弟子，手里拎着空篓子，谁也不先开口。老刘坐在台面后头，算盘搁在膝上，珠子一颗没拨。',
      '“三天。”老刘见他挤过来，先报了个数，“顶板昨天又响了一回，度支房让封到初三。挖不够的车数照记，不扣功勋。”',
      '陈砚往铁栅里头看了一眼。巷口的油灯还亮着，照到第一个拐弯就断了，再往里全是黑。甲九那段的号码刷在洞壁上，石灰遇潮就淌，这会儿该糊成一片了。',
      '“我进去取件东西。”他说。老刘的算盘珠子终于响了一下，只响一下。“取什么？”“上月塌方翻出来的石片子，落在甲九岔口底下。我记着位置。”',
      '“记着位置的人多了。”老刘把算盘往台面上一放，“前天赵铎也来问过甲九，带着戒尺，说是替度支房清点损耗。他没进去，站在闸机口数了半炷香的息，转身走了。”',
      '陈砚没接这句。他伸手把生死契按在感应处的铁面上，闸门没开，红灯也没亮——断电了。老刘从台面底下摸出那块磨得发亮的铁牌，在手里掂了掂，没递过来。',
      '“四十息。”老刘忽然说，“我给你数着，顶板再响一声你就退。牌子我不给你作保，铁栅我自己开。”他把算盘拨到头一排，珠子靠成一列，“从前数到后，别回头。”',
      '铁栅抬起来的时候带起一股潮气，凉的，裹着一点药味。陈砚侧身进去，靴底踩上湿车辙，往东二岔道走。身后的算盘珠子一颗一颗往下掉，声音被巷道吞得很快，走到第三盏油灯底下就听不见了。',
      '洞壁上那道灰白的东西还嵌在岩缝里，只露出半截，缺了一角。他蹲下来，拿指头把浮土拨开，没有去掰。石片子底下压着一枚旧铁钉，钉帽上刻着半个字，不是度支房的记号。他把土重新掩回去，站起来，转身往巷口走。',
    ],
  },
]

function buildGroupC() {
  return {
    group: 'C',
    description: '人工构造：同题材、同人物、剧情不同（期望低，防误报）。每例 ≥600 字，lines.join(separator) 即完整正文。',
    separator: '\n\n',
    samples: C_PARAGRAPHS.map((spec) => {
      const text = spec.paragraphs.join('\n\n')
      if (Array.from(text).length < 600) throw new Error(`${spec.id} 正文不足 600 字`)
      return {
        id: spec.id,
        previousChapterFile: spec.previousChapterFile,
        construction: spec.construction,
        chars: Array.from(text).length,
        lines: spec.paragraphs,
      }
    }),
  }
}

function ensureFixtures() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true })
  const defs = [
    { file: GROUP_B_FILE, build: buildGroupB },
    { file: GROUP_C_FILE, build: buildGroupC },
  ]
  const states = []
  for (const def of defs) {
    const exists = fs.existsSync(def.file)
    if (regen || !exists) {
      fs.writeFileSync(def.file, `${JSON.stringify(def.build(), null, 2)}\n`, 'utf8')
      states.push({ file: path.relative(repositoryRoot, def.file).split(path.sep).join('/'), state: regen ? 'regenerated' : 'generated' })
    } else {
      states.push({ file: path.relative(repositoryRoot, def.file).split(path.sep).join('/'), state: 'reused' })
    }
  }
  return states
}

const fixtureStates = ensureFixtures()
const fixtureB = JSON.parse(fs.readFileSync(GROUP_B_FILE, 'utf8'))
const fixtureC = JSON.parse(fs.readFileSync(GROUP_C_FILE, 'utf8'))

// ─── 7. 四组样例 ────────────────────────────────────────────────────────────
const groupA = []
for (let n = 2; n <= 11; n += 1) {
  const proseFile = `ch${String(n).padStart(2, '0')}.txt`
  const previousChapterFile = `ch${String(n - 1).padStart(2, '0')}.txt`
  groupA.push({
    id: `A${n - 1}`,
    proseFile,
    previousChapterFile,
    label: `${proseFile} vs ${previousChapterFile}`,
    ...measurePair(corpus[proseFile], corpus[previousChapterFile]),
  })
}

const groupB = fixtureB.samples.map((sample) => ({
  ...sample,
  text: sample.lines.join(fixtureB.separator),
  ...measurePair(sample.lines.join(fixtureB.separator), corpus[sample.previousChapterFile]),
}))
const groupC = fixtureC.samples.map((sample) => ({
  ...sample,
  text: sample.lines.join(fixtureC.separator),
  ...measurePair(sample.lines.join(fixtureC.separator), corpus[sample.previousChapterFile]),
}))

const D_PAIRS = [
  { id: 'D1', proseFile: 'ch06-v2-draft.txt', previousChapterFile: 'ch05.txt', note: '第 6 章 v2 改写 vs 上一章（ch05）' },
  { id: 'D2', proseFile: 'ch06-v2-draft.txt', previousChapterFile: 'ch06.txt', note: '第 6 章 v2 改写 vs 同章 v1' },
  { id: 'D3', proseFile: 'ch10-v2-draft.txt', previousChapterFile: 'ch09.txt', note: '第 10 章 v2 改写 vs 上一章（ch09）' },
  { id: 'D4', proseFile: 'ch10-v2-draft.txt', previousChapterFile: 'ch10.txt', note: '第 10 章 v2 改写 vs 同章 v1' },
]
const groupD = D_PAIRS.map((pair) => ({
  ...pair,
  label: `${pair.proseFile} vs ${pair.previousChapterFile}`,
  ...measurePair(corpus[pair.proseFile], corpus[pair.previousChapterFile]),
}))

// ─── 8. 汇总（只统计，不给判定、不改阈值）────────────────────────────────────
const extreme = (rows, key, mode) => rows.reduce((best, row) => (
  best === null || (mode === 'max' ? row.primary.ratio > best.primary.ratio : row.primary.ratio < best.primary.ratio)
    ? row : best
), null)

const aMax = extreme(groupA, 'ratio', 'max')
const bMin = extreme(groupB, 'ratio', 'min')
const cMax = extreme(groupC, 'ratio', 'max')
const summary = {
  advisory: REUSE_RATIO_ADVISORY,
  blocking: REUSE_RATIO_BLOCKING,
  groupAMaxRatio: aMax.primary.ratio,
  groupAMaxPair: aMax.label,
  groupBMinRatio: bMin.primary.ratio,
  groupBMinCase: bMin.id,
  groupCMaxRatio: cMax.primary.ratio,
  groupCMaxCase: cMax.id,
  gapBetweenAAndB: bMin.primary.ratio - aMax.primary.ratio,
  separable: bMin.primary.ratio > aMax.primary.ratio,
  groupAMisflagged: groupA.filter(row => row.primary.severity !== 'ok').map(row => `${row.label}=${row.primary.severity}`),
  groupBMissed: groupB.filter(row => row.primary.severity !== 'blocking').map(row => `${row.id}=${row.primary.severity}`),
  groupCMisflagged: groupC.filter(row => row.primary.severity !== 'ok').map(row => `${row.id}=${row.primary.severity}`),
  groupBD12ReplayHits: groupB.filter(row => row.d12.replay).length,
  groupBD12MinCoverPct: Math.min(...groupB.map(row => row.d12.coverPct)),
  groupD: groupD.map(row => ({ id: row.id, label: row.label, ratio: row.primary.ratio, severity: row.primary.severity })),
}

// ─── 9. 输出 ────────────────────────────────────────────────────────────────
const fmt = (value, digits = 4) => typeof value === 'number' ? Number(value.toFixed(digits)) : value
const yesNo = (value) => value ? '是' : '否'
const p = (row) => row.primary
const g = (row) => row.d12

const report = {
  generatedAt: new Date().toISOString(),
  repositoryRoot,
  corpus: {
    source: '.runtime/db-copy/project.db 只读导出 → .runtime/corpus/reuse-calibration/',
    encoding: manifest.encoding,
    manifestFileCount: manifest.files.length,
    verify,
  },
  import: {
    source: 'src/shared/chapter-reuse-coverage.ts（analyzeChapterReuse）',
    method: 'esbuild stdin 内存打包 + data:text/javascript;base64 动态 import（scripts/measure-ai-flavor-baseline.mjs:174-187）',
    copiedConstants: { REUSE_RATIO_ADVISORY, REUSE_RATIO_BLOCKING },
  },
  d12: {
    source: 'scripts/experiments/d12-direct-rerun.mjs:33-60（算法原样搬，未 import 该脚本）',
    NGRAM, HEAD, LONG_RUN, prevEndingChars: 1000,
  },
  fixtureStates,
  groupA, groupB, groupC, groupD,
  summary,
}

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('=== IMPORT ===')
  console.log(`import 来源: src/shared/chapter-reuse-coverage.ts（analyzeChapterReuse）`)
  console.log(`方式: esbuild stdin 内存打包 + data:text/javascript;base64 动态 import（照抄 scripts/measure-ai-flavor-baseline.mjs:174-187）`)
  console.log(`常量（从模块读出，未硬编码）: REUSE_RATIO_ADVISORY=${REUSE_RATIO_ADVISORY} / REUSE_RATIO_BLOCKING=${REUSE_RATIO_BLOCKING}`)
  console.log(`主口径: 全章 vs 上一章全文 / 中文 16 字 n-gram / ratio+severity；对照口径: d12-direct-rerun.mjs:33-60 / 头 ${HEAD} 字 vs 上章结尾 1000 字 / 8-gram / 连续 ≥${LONG_RUN} 字判重演`)

  console.log('\n=== CORPUS VERIFY ===')
  console.log(`来源: ${report.corpus.source} · 编码: ${manifest.encoding} · 文件数: ${manifest.files.length}`)
  console.log('| 文件 | 字节 | BOM | sha256 匹配 | chars | manifest.chars | chars 匹配 |')
  console.log('|---|---:|---|---|---:|---:|---|')
  for (const row of verify) {
    console.log(`| ${row.file} | ${row.bytes} | ${yesNo(row.bom)} | ${yesNo(row.shaMatch)} | ${row.chars} | ${row.manifestChars} | ${yesNo(row.charsMatch)} |`)
  }
  console.log(`全量校验: sha 匹配 ${verify.filter(r => r.shaMatch).length}/${verify.length} · chars 匹配 ${verify.filter(r => r.charsMatch).length}/${verify.length}`)

  console.log('\n=== FIXTURES ===')
  for (const state of fixtureStates) console.log(`${state.state}: ${state.file}`)

  const tableHead = '| 对 | 主口径 ratio | coveredUnits | runs | longestRun | severity | d12 头覆盖% | d12 最长段 | d12 ≥80 |'
  const tableSep = '|---|---:|---:|---:|---:|---|---:|---:|---|'
  const tableRow = (row) => `| ${row.label} | ${fmt(p(row).ratio)} | ${p(row).coveredUnits} | ${p(row).runs} | ${p(row).longestRun} | ${p(row).severity} | ${fmt(g(row).coverPct, 1)} | ${g(row).longest} | ${yesNo(g(row).replay)} |`

  console.log('\n=== GROUP A · 真实相邻章（ch01 为基准章，无上一章）===')
  console.log(tableHead)
  console.log(tableSep)
  for (const row of groupA) console.log(tableRow(row))

  console.log('\n=== GROUP B · 整章重写上一章、只换开头（人工构造）===')
  console.log('| 例 | 基于 | 替换开头 | 新开头 | vs | 主口径 ratio | longestRun | severity | d12 头覆盖% | d12 最长段 | d12 ≥80 |')
  console.log('|---|---|---:|---:|---|---:|---:|---|---:|---:|---|')
  for (const row of groupB) {
    console.log(`| ${row.id} | ${row.basedOn} | ${row.replacedChars} | ${row.newOpeningChars} | ${row.previousChapterFile} | ${fmt(p(row).ratio)} | ${p(row).longestRun} | ${p(row).severity} | ${fmt(g(row).coverPct, 1)} | ${g(row).longest} | ${yesNo(g(row).replay)} |`)
  }

  console.log('\n=== GROUP C · 同题材、同人物、剧情不同（人工构造）===')
  console.log('| 例 | 字数 | vs | 主口径 ratio | coveredUnits | longestRun | severity | d12 头覆盖% | d12 ≥80 |')
  console.log('|---|---:|---|---:|---:|---:|---|---:|---|')
  for (const row of groupC) {
    console.log(`| ${row.id} | ${row.chars} | ${row.previousChapterFile} | ${fmt(p(row).ratio)} | ${p(row).coveredUnits} | ${p(row).longestRun} | ${p(row).severity} | ${fmt(g(row).coverPct, 1)} | ${yesNo(g(row).replay)} |`)
  }

  console.log('\n=== GROUP D · 真实改写样本（bonus）===')
  console.log(tableHead)
  console.log(tableSep)
  for (const row of groupD) console.log(tableRow(row))

  console.log('\n=== SUMMARY ===')
  console.log(`组 A 最高 ratio: ${fmt(aMax.primary.ratio)}（${aMax.label}）`)
  console.log(`组 B 最低 ratio: ${fmt(bMin.primary.ratio)}（${bMin.id}）`)
  console.log(`组 C 最高 ratio: ${fmt(cMax.primary.ratio)}（${cMax.id}）`)
  console.log(`A 最高 → B 最低 间隔: ${fmt(summary.gapBetweenAAndB)} · 可分: ${yesNo(summary.separable)}`)
  console.log(`按现行 0.15/0.35：组 A 误报 ${summary.groupAMisflagged.length} 对 ${summary.groupAMisflagged.length ? `(${summary.groupAMisflagged.join(', ')})` : '（无）'}；组 B 漏报 ${summary.groupBMissed.length} 例 ${summary.groupBMissed.length ? `(${summary.groupBMissed.join(', ')})` : '（无）'}；组 C 误报 ${summary.groupCMisflagged.length} 例 ${summary.groupCMisflagged.length ? `(${summary.groupCMisflagged.join(', ')})` : '（无）'}`)
  console.log(`组 B 的 d12 生产口径：≥80 连续命中 ${summary.groupBD12ReplayHits}/${groupB.length}，最低头覆盖 ${fmt(summary.groupBD12MinCoverPct, 1)}%，各例最长段 ${groupB.map(row => `${row.id}=${g(row).longest}`).join(' / ')}`)
  console.log('组 D 各对:')
  for (const row of summary.groupD) console.log(`  ${row.id} ${row.label} → ratio=${fmt(row.ratio)} / ${row.severity}`)
  console.log('\n说明: 本脚本只测量与统计，未改判定器常量、未接线、未产出阈值裁定；建议值见报告正文。')
}
