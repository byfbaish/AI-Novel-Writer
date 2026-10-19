// 临时实验（可删）：刚性内容 × 定性-only 状态块（G1） vs 无状态块（G0）
// 目的：隔离 §12 R 组 -53% 的功劳归谁——「收紧 3-4 章」这个数字，还是定性措辞本身。
// 用法：node scripts/zz-abtest-rigid-qualitative.mjs [每组次数，默认 5]
import { mkdir, writeFile } from 'node:fs/promises';

const MODEL = 'qwen3.5:9b-128k';
const ENDPOINT = 'http://127.0.0.1:11434/api/chat';
const RUNS = Number(process.argv[2] ?? 5);
const OUT = process.env.THINK === '1' ? '.tmp-abtest/think' : '.tmp-abtest/nothink';

const HEAD = `你是长篇小说的章节大纲作者。按给定结构写【单元 2】的章节大纲。每章只写一行：## 第N章：标题 —— 一句话说明这章发生什么。

【全书问题】一个修表匠能不能在不替人背账的前提下，把父亲留下的铺子赎回来？

【本卷结构】卷二「押金与赊账单」，计划 20 章，共 3 个单元。
- 单元 1：把赊账页从柜台上收进抽屉（已完成，写了 10 章）
- 单元 2：让债主接受"用修表的工抵账"
  - 叙事任务：把"还钱"换成"还工"，第一次让债主坐下来谈条件
  - 进入状态：债主每周三来收一次钱，他每次都凑不齐
  - 离开状态：债主答应用工抵账，但要求他先修好一件"不该会修"的东西
  - 逼法：债主用"月底清账"逼 → 变成债主用"修不好就收铺"逼
  - 四道关（必须依次走完，各有独立对手方与场合，不能合并成一场戏）：
    ① 当着伙计的面提出用工抵账，被伙计驳回
    ② 找街头中间人作保
    ③ 中间人抽成后临阵反悔
    ④ 债主松口，但要投名状——先修好那件"不该会修"的东西
- 单元 3：那件东西牵出父亲当年的旧账（未写）
`;

const STATUS_BLOCK = `
【本卷配给状态 · 单元 2/3】
- 本卷已写：10 章；本卷上界：20 章；后面还有单元 3 要用余量
- 状态：不足 —— 本单元请收紧写法：少开新线，压缩铺陈与过渡，把同一个事件写紧凑。多道关可以放在同一章的不同场面里写完，不必一章只写一道关。
  必要情节一个都不能少：叙事任务、离开状态、逼法换代、四道关，一样都不能丢；收紧的是笔墨，不是内容。
`;

const TAIL = `
【本次生成范围】
只写【单元 2】，从第 11 章开始。写到该单元的「离开状态」成立为止，写完立即停笔，不得进入单元 3。

【输出格式】
## 第N章：标题 —— 一句话
（每章只此一行；不写要点列表、不写描写、不写对话）

【最后补一行】
本单元落点：叙事任务✓ / 离开状态✓ / 四道关（1✓2✓3✓4✓）/ 逼法：<起始>→<结束>
`;

const PROMPTS = {
  // G1：刚性内容 + 定性-only 状态块（§6.2 形态：无任何章数目标）
  G1: HEAD + STATUS_BLOCK + TAIL,
  // G0：同内容，整块删掉状态块（唯一差异）
  G0: HEAD + TAIL,
};

const CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function chapterNumbers(text) {
  const nums = [];
  for (const m of text.matchAll(/^\s*#*\s*第\s*([0-9０-９一二三四五六七八九十百]+)\s*章/gm)) {
    const raw = m[1].replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    if (/^\d+$/.test(raw)) nums.push(Number(raw));
    else if (raw === '十') nums.push(10);
    else if (raw.length === 1) nums.push(CN[raw] ?? NaN);
    else if (/^十[一二三四五六七八九]$/.test(raw)) nums.push(10 + CN[raw[1]]);
    else if (/^[一二三四五六七八九]十$/.test(raw)) nums.push(CN[raw[0]] * 10);
    else if (/^[一二三四五六七八九]十[一二三四五六七八九]$/.test(raw)) nums.push(CN[raw[0]] * 10 + CN[raw[2]]);
    else nums.push(NaN);
  }
  return nums.filter(n => Number.isFinite(n));
}

function gatesOf(text) {
  return {
    g1: /伙计[^。\n]{0,40}(驳回|拒|不认|嗤|不认账|说.*不值)/.test(text),
    g2: /(中间人|保人|作保|担保)/.test(text),
    g3: /(反悔|临阵|变卦|抽成[^。\n]{0,20}(退|跑|不干|反悔)|退出)/.test(text),
    g4: /(投名状|那件东西|不该会修)/.test(text),
  };
}

async function runOnce(group, prompt) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      think: process.env.THINK !== '1' ? false : undefined, // 思考型模型：默认关闭；THINK=1 时开启做交叉验证
      options: { temperature: 0.9, num_predict: Number(process.env.NP ?? (process.env.THINK === '1' ? 6000 : 900)) },
    }),
  });
  if (!res.ok) throw new Error(`${group}: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { content: json?.message?.content ?? '', think: json?.message?.thinking ?? '', meta: { done_reason: json?.done_reason, eval_count: json?.eval_count, prompt_eval_count: json?.prompt_eval_count } };
}

await mkdir(OUT, { recursive: true });
const rows = [];
for (const group of ['G1', 'G0']) {
  for (let i = 1; i <= RUNS; i += 1) {
    const started = Date.now();
    const { content: text, think, meta } = await runOnce(group, PROMPTS[group]);
    const file = `${OUT}/${group}-run${i}.md`;
    await writeFile(file, text, 'utf8');
    if (think) await writeFile(`${OUT}/${group}-run${i}.thinking.md`, think, 'utf8');
    const nums = chapterNumbers(text);
    const g = gatesOf(text);
    const row = {
      group, run: i, file,
      chapters: nums.length,
      range: nums.length ? `${Math.min(...nums)}-${Math.max(...nums)}` : '-',
      gates: [g.g1, g.g2, g.g3, g.g4].map(v => (v ? '✓' : '✗')).join(''),
      leave: /(答应用工抵账|同意用工抵账|用工抵账)/.test(text) ? '✓' : '✗',
      spill: /旧账/.test(text) ? '⚠️旧账' : '-',
      chars: text.length,
      thinkChars: think.length,
      done: meta.done_reason,
      eval: meta.eval_count,
      ms: Date.now() - started,
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}

const summary = {};
for (const group of ['G1', 'G0']) {
  const list = rows.filter(r => r.group === group);
  const chapters = list.map(r => r.chapters).sort((a, b) => a - b);
  summary[group] = {
    runs: list.length,
    chapters,
    mean: chapters.reduce((s, n) => s + n, 0) / chapters.length,
    allGates: list.filter(r => r.gates === '✓✓✓✓').length,
    leaveOk: list.filter(r => r.leave === '✓').length,
    spills: list.filter(r => r.spill !== '-').length,
  };
}
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
