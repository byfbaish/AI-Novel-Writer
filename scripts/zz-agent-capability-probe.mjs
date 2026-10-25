#!/usr/bin/env node
/**
 * 临时实验（可删）：qwen3.5:9b-128k agent 能力边界探针
 *
 * 用法：
 *   node scripts/zz-agent-capability-probe.mjs                 # 全量
 *   node scripts/zz-agent-capability-probe.mjs --suite B       # 只跑某套
 *   node scripts/zz-agent-capability-probe.mjs --only B1,C1    # 只跑某几个
 *   THINK=1 node scripts/zz-agent-capability-probe.mjs --suite THINK
 *
 * 产出：
 *   .tmp-agent-probe/results.json        # 汇总（含评分）
 *   .tmp-agent-probe/cases/<id>.json     # 每个用例的完整原始响应（可追溯）
 *
 * 套件：
 *   A 基础生成   B 工具调用   C Agent 循环   D 长上下文   E 结构化输出   F 推理深度
 *   THINK 思考模式对照（B1/C1/F2 在 think:true 下重跑）
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API = process.env.API ?? 'ollama'; // 'ollama' | 'openai'（openai = llama.cpp/WorkBuddy 本地端点）
const BASE = process.env.BASE ?? 'http://127.0.0.1:52741/v1';
const OPENAI_MODEL = 'C:\\Users\\<用户名>\\.workbuddy\\local-models\\files\\local_model.gguf';
const MODEL = process.env.MODEL ?? (API === 'openai' ? OPENAI_MODEL : 'qwen3.5:9b-128k');
const ENDPOINT = process.env.ENDPOINT ?? (API === 'openai' ? `${BASE}/chat/completions` : 'http://127.0.0.1:11434/api/chat');
const OUT = process.env.OUT_DIR ?? '.tmp-agent-probe';
const MAX_CTX = 262144; // 模型声明上限
const D_REDUCED = process.env.D_MODE === 'reduced'; // 跳过大上下文 128k/200k（供大模型横向对比用）

// ---------- 基础设施 ----------

const results = [];
const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const suiteIdx = args.indexOf('--suite');
const ONLY = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',').map(s => s.trim())) : null;
const SUITE = suiteIdx >= 0 ? args[suiteIdx + 1].toUpperCase() : null;
const THINK_MODE = process.env.THINK === '1';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function chat(messages, opts = {}) {
  const think = opts.think ?? false;
  const body = API === 'openai' ? {
    model: MODEL,
    messages,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.numPredict ?? 1024,
    stream: false,
    chat_template_kwargs: { enable_thinking: think },
    ...(opts.tools ? { tools: opts.tools } : {}),
  } : {
    model: MODEL,
    messages,
    stream: false,
    think,
    options: {
      temperature: opts.temperature ?? 0,
      num_predict: opts.numPredict ?? 1024,
      num_ctx: opts.numCtx ?? 8192,
    },
    ...(opts.tools ? { tools: opts.tools } : {}),
  };
  const t0 = Date.now();
  let res, json;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(API === 'openai' ? { authorization: 'Bearer empty' } : {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
      json = await res.json();
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(2000 * attempt);
    }
  }
  const ms = Date.now() - t0;
  const isOai = API === 'openai';
  const msg = isOai ? (json.choices?.[0]?.message ?? {}) : (json.message ?? {});
  const toolCalls = (msg.tool_calls ?? []).map(tc => {
    let a = tc.function?.arguments;
    if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = { _raw: a }; } }
    return { id: tc.id, name: tc.function?.name, arguments: a ?? {} };
  });
  const meta = isOai ? {
    prompt_tokens: json.usage?.prompt_tokens,
    gen_tokens: json.usage?.completion_tokens,
    prompt_s: null,
    gen_s: +(ms / 1000).toFixed(2), // OpenAI 格式无分段耗时，用墙钟（含 prefill，为下限）
    done_reason: json.choices?.[0]?.finish_reason,
  } : {
    prompt_tokens: json.prompt_eval_count,
    gen_tokens: json.eval_count,
    prompt_s: +(json.prompt_eval_duration / 1e9).toFixed(2),
    gen_s: +(json.eval_duration / 1e9).toFixed(2),
    done_reason: json.done_reason,
  };
  return {
    content: msg.content ?? '',
    thinking: msg.thinking ?? msg.reasoning_content ?? '',
    toolCalls,
    rawMessage: msg,
    meta,
  };
}

async function runCase(id, suite, name, fn) {
  if (SUITE && SUITE !== suite) return;
  if (ONLY && !ONLY.has(id)) return;
  const started = Date.now();
  let r;
  try {
    r = await fn();
  } catch (err) {
    r = { pass: 'fail', score: 0, note: `执行异常：${err.message}`, evidence: '' };
  }
  const ms = Date.now() - started;
  const row = { id, suite, name, pass: r.pass, score: r.score, note: r.note ?? '', ms, ...(r.detail ?? {}) };
  results.push(row);
  await writeFile(join(OUT, 'cases', `${id}.json`), JSON.stringify({ id, name, ...r }, null, 2), 'utf8');
  const mark = r.pass === 'pass' ? '✓' : r.pass === 'partial' ? '◐' : '✗';
  console.log(`${mark} ${id} [${suite}] ${name} — ${r.note ?? ''} (${(ms / 1000).toFixed(1)}s)`);
}

const P = (score, note, detail) => ({ pass: score === 1 ? 'pass' : score > 0 ? 'partial' : 'fail', score, note, ...detail });
const trunc = (s, n = 400) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ---------- 工具定义 ----------

const TOOLS = [
  { type: 'function', function: { name: 'get_weather', description: '查询指定城市的实时天气', parameters: { type: 'object', properties: { city: { type: 'string', description: '城市名，如"北京"' } }, required: ['city'] } } },
  { type: 'function', function: { name: 'search_books', description: '按关键词搜索图书，返回书名、作者、出版年份', parameters: { type: 'object', properties: { keyword: { type: 'string' } }, required: ['keyword'] } } },
  { type: 'function', function: { name: 'get_author_info', description: '查询作者信息：出生年、所在地、全部作品及出版年份', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'calculator', description: '计算数学表达式，支持 + - * / 和括号', parameters: { type: 'object', properties: { expression: { type: 'string', description: '如 (128+64)*3' } }, required: ['expression'] } } },
  { type: 'function', function: { name: 'send_email', description: '发送电子邮件', parameters: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] } } },
];

// C 套虚构数据库（避免模型凭真实知识跳过工具链）
const C_DB = {
  books: [
    { title: '流浪地球', author: '刘慈欣', year: 2000 },
    { title: '三体', author: '刘慈欣', year: 2008 },
    { title: '平凡的世界', author: '路遥', year: 1986 },
    { title: '活着', author: '余华', year: 1993 },
  ],
  authors: {
    刘慈欣: { birth: 1963, city: '阳泉' },
    路遥: { birth: 1949, city: '清涧', works: [{ title: '人生', year: 1982 }, { title: '平凡的世界', year: 1986 }] },
    余华: { birth: 1960, city: '杭州' },
  },
  currentYear: 2026,
};
const C_TOOLS = TOOLS.filter(t => ['search_books', 'get_author_info', 'calculator', 'get_current_year'].includes(t.function.name))
  .concat([{ type: 'function', function: { name: 'get_current_year', description: '获取当前年份', parameters: { type: 'object', properties: {} } } }]);

function cExec(name, args) {
  if (name === 'search_books') {
    const hit = C_DB.books.find(b => b.title.includes(args.keyword) || (args.keyword ?? '').includes(b.title));
    return hit ? [hit] : { error: '未找到相关书籍，请尝试其他关键词' };
  }
  if (name === 'get_author_info') {
    const a = C_DB.authors[args.name];
    return a ? { name: args.name, ...a } : { error: `未找到作者"${args.name}"` };
  }
  if (name === 'calculator') {
    try {
      if (!/^[\d\s+\-*/().]+$/.test(String(args.expression ?? ''))) return { error: '表达式含非法字符' };
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${args.expression})`)();
      if (typeof v !== 'number' || !Number.isFinite(v)) return { error: '计算失败' };
      return { expression: args.expression, result: v };
    } catch { return { error: '表达式无法计算' }; }
  }
  if (name === 'get_current_year') return { year: C_DB.currentYear };
  return { error: `未知工具 ${name}` };
}

async function agentLoop(task, opts = {}) {
  const { maxSteps = 8, think = false } = opts;
  const messages = [{ role: 'user', content: task }];
  const steps = [];
  for (let i = 0; i < maxSteps; i += 1) {
    const r = await chat(messages, { tools: C_TOOLS, think, numCtx: 8192 });
    steps.push({ step: i + 1, toolCalls: r.toolCalls, content: trunc(r.content, 300) });
    if (!r.toolCalls.length) return { steps, final: r.content, stop: 'answered', meta: r.meta };
    messages.push(r.rawMessage);
    for (const tc of r.toolCalls) {
      const out = cExec(tc.name, tc.arguments);
      messages.push(API === 'openai'
        ? { role: 'tool', tool_call_id: tc.id, name: tc.name, content: JSON.stringify(out) }
        : { role: 'tool', tool_name: tc.name, content: JSON.stringify(out) });
    }
  }
  return { steps, final: null, stop: 'maxSteps', meta: null };
}

// ---------- D 套长上下文填充 ----------

const FILLER = [
  '楼道里的声控灯坏了三天，物业说明天来修。',
  '王师傅蹲在台阶上抽了半支烟，把烟灰弹进易拉罐里。',
  '三号楼下的银杏叶落了一层，扫院子的老人说这场风刮得蹊跷。',
  '菜市场的鱼贩在收拾冰面，塑料盆磕在一起，声音很脆。',
  '图书馆下午三点就闭馆，管理员把椅子倒扣在桌面上。',
  '工地上的塔吊转了很久，吊钩上挂着一捆螺纹钢。',
  '河边的钓位空着一半，浮漂一动不动，水面泛着油光。',
  '便利店的关东煮汤面结了一层薄油花，收银员在刷短视频。',
  '雨停了以后，地下通道的墙上渗出一片水渍，形状像张地图。',
  '老旧小区的围墙新刷了标语，红底白字，边角已经起皮。',
];
function makeFiller(targetChars) {
  let s = '';
  let i = 0;
  while (s.length < targetChars) {
    s += FILLER[i % FILLER.length];
    if (i % 40 === 39) s += `此处档案略过${Math.floor(i / 40) + 1}节，记录员签名后翻页。\n`;
    i += 1;
  }
  return s;
}
const NEEDLE_PWD = 'HX-7319';
const NEEDLE = `【绝密附注】经核查，「赤霄计划」的启动密码是 ${NEEDLE_PWD}，该密码仅总指挥一人保管，阅后即焚。`;

// ---------- 套件 A：基础生成 ----------

async function suiteA() {
  await runCase('A1', 'A', '基础问答 sanity', async () => {
    const r = await chat([{ role: 'user', content: '用一句话说明什么是图灵测试' }], { numPredict: 200 });
    const ok = r.content.length > 10 && /[一-龥]/.test(r.content);
    return P(ok ? 1 : 0, ok ? '正常作答' : '输出异常', { content: trunc(r.content), meta: r.meta });
  });

  await runCase('A2', 'A', '生成速度（热态）', async () => {
    await chat([{ role: 'user', content: '写一段 150 字左右的春天描写' }], { numPredict: 200 });
    const r = await chat([{ role: 'user', content: '写一段 150 字左右的夏天描写' }], { numPredict: 200 });
    const tps = r.meta.gen_tokens / (r.meta.gen_s || 1);
    return P(tps > 30 ? 1 : 0, `${tps.toFixed(0)} tok/s（生成 ${r.meta.gen_tokens} tokens / ${r.meta.gen_s}s）`, { tps: +tps.toFixed(1), meta: r.meta });
  });

  await runCase('A3', 'A', '严格格式遵循', async () => {
    const r = await chat([{ role: 'user', content: '请列出 5 种常见水果，只用顿号（、）分隔。不要编号，不要出现逗号、句号或其他任何标点。' }], { numPredict: 100 });
    const bad = /[0-9０-９一二三四五六七八九十,，。.;；!！?？]/.test(r.content);
    const parts = r.content.split('、').filter(Boolean);
    const ok = !bad && parts.length === 5;
    return P(ok ? 1 : bad ? 0 : 0.5, `输出「${trunc(r.content, 60)}」${bad ? '含违禁标点/编号' : `分段数=${parts.length}`}`, { content: trunc(r.content) });
  });
}

// 构造一轮"模型已调工具 + 工具已返回"的假历史，兼容两种 API 格式
function fakeToolTurn(toolName, args, result) {
  if (API === 'openai') {
    return [
      { role: 'assistant', content: null, tool_calls: [{ id: 'call_probe_1', type: 'function', function: { name: toolName, arguments: JSON.stringify(args) } }] },
      { role: 'tool', tool_call_id: 'call_probe_1', name: toolName, content: JSON.stringify(result) },
    ];
  }
  return [
    { role: 'assistant', content: '', tool_calls: [{ function: { name: toolName, arguments: args } }] },
    { role: 'tool', tool_name: toolName, content: JSON.stringify(result) },
  ];
}

// ---------- 套件 B：工具调用 ----------

async function suiteB() {
  await runCase('B1', 'B', '单工具触发（天气）', async () => {
    const r = await chat([{ role: 'user', content: '北京现在天气怎么样？' }], { tools: TOOLS, numPredict: 300 });
    const tc = r.toolCalls[0];
    const ok = tc && tc.name === 'get_weather' && JSON.stringify(tc.arguments).includes('北京');
    return P(ok ? 1 : 0, ok ? `调 get_weather(${JSON.stringify(tc.arguments)})` : `toolCalls=${JSON.stringify(r.toolCalls)} content=${trunc(r.content, 80)}`, { toolCalls: r.toolCalls, content: trunc(r.content) });
  });

  await runCase('B2', 'B', '多工具中正确选择（计算）', async () => {
    const r = await chat([{ role: 'user', content: '帮我算一下 347 乘以 29 等于多少' }], { tools: TOOLS, numPredict: 300 });
    const tc = r.toolCalls[0];
    const ok = tc && tc.name === 'calculator' && JSON.stringify(tc.arguments).includes('347');
    return P(ok ? 1 : 0, ok ? `调 calculator(${JSON.stringify(tc.arguments)})` : `toolCalls=${JSON.stringify(r.toolCalls)}`, { toolCalls: r.toolCalls });
  });

  await runCase('B3', 'B', '复杂多参数（发邮件）', async () => {
    const r = await chat([{ role: 'user', content: '给张三发一封邮件，主题写"周报"，内容写"周五前交"' }], { tools: TOOLS, numPredict: 400 });
    const tc = r.toolCalls[0];
    const s = tc ? JSON.stringify(tc.arguments) : '';
    const ok = tc && tc.name === 'send_email' && /张三|zhangsan/i.test(s) && s.includes('周报') && s.includes('周五前交');
    return P(ok ? 1 : 0, ok ? `send_email 三参数齐全` : `toolCalls=${trunc(s, 150)}`, { toolCalls: r.toolCalls });
  });

  await runCase('B4', 'B', '无需工具时不乱调', async () => {
    const r = await chat([{ role: 'user', content: '你好，请介绍一下你自己' }], { tools: TOOLS, numPredict: 300 });
    const ok = r.toolCalls.length === 0 && r.content.length > 10;
    return P(ok ? 1 : 0, ok ? '直接文本回答' : `误调工具 ${JSON.stringify(r.toolCalls)}`, { toolCalls: r.toolCalls, content: trunc(r.content) });
  });

  await runCase('B5', 'B', '并行双工具调用', async () => {
    const r = await chat([{ role: 'user', content: '北京和上海现在天气分别怎么样？' }], { tools: TOOLS, numPredict: 400 });
    const n = r.toolCalls.length;
    const cities = JSON.stringify(r.toolCalls);
    const ok = n >= 2 && cities.includes('北京') && cities.includes('上海');
    return P(ok ? 1 : n === 1 ? 0.5 : 0, `单轮 tool_calls 数=${n}`, { toolCalls: r.toolCalls, content: trunc(r.content) });
  });

  await runCase('B6', 'B', '工具结果综合（不重调）', async () => {
    const messages = [
      { role: 'user', content: '北京现在天气怎么样？适合户外跑步吗？' },
      ...fakeToolTurn('get_weather', { city: '北京' }, { city: '北京', temp: 18, condition: '晴', wind: '3级' }),
    ];
    const r = await chat(messages, { tools: TOOLS, numPredict: 300 });
    const reused = r.toolCalls.length > 0;
    const grounded = r.content.includes('18') || r.content.includes('晴');
    const ok = !reused && grounded;
    return P(ok ? 1 : !grounded ? 0 : 0.5, `重复调工具=${reused}；基于数据作答=${grounded}`, { toolCalls: r.toolCalls, content: trunc(r.content) });
  });

  await runCase('B7', 'B', '工具报错后的恢复', async () => {
    const messages = [
      { role: 'user', content: '帮我查一下北京的天气' },
      ...fakeToolTurn('get_weather', { city: '北京' }, { error: '未找到城市"北京"，请检查名称或尝试拼音' }),
    ];
    const r = await chat(messages, { tools: TOOLS, numPredict: 400 });
    const retried = r.toolCalls.length > 0;
    const honest = /无法|找不到|查不到|未能|失败|未找到|抱歉/.test(r.content);
    const fabricated = /(18|20|25|多云|晴|雨)[度级]/.test(r.content) && !honest;
    const ok = retried || (honest && !retried);
    const score = fabricated ? 0 : ok ? 1 : 0.5;
    return P(score, `重试=${retried}；承认查不到=${honest}；疑似编数据=${fabricated}`, { toolCalls: r.toolCalls, content: trunc(r.content) });
  });

  await runCase('B8', 'B', '缺参意识（未给城市）', async () => {
    const r = await chat([{ role: 'user', content: '帮我查一下天气' }], { tools: TOOLS, numPredict: 300 });
    const tc = r.toolCalls[0];
    const asked = /哪个|哪座|请问|需要|提供.*城市|哪个城市/.test(r.content);
    if (!tc) return P(asked ? 1 : 0.5, `未调工具；反问用户=${asked}`, { content: trunc(r.content) });
    const city = String(tc.arguments?.city ?? '');
    const solid = /北京|上海|广州|深圳|东京|纽约/.test(city);
    return P(solid ? 0 : 0.5, `直接调工具且 city="${trunc(city, 20)}"（未追问=硬编默认值）`, { toolCalls: r.toolCalls });
  });
}

// ---------- 套件 C：Agent 循环 ----------

async function suiteC() {
  await runCase('C1', 'C', '三步工具链（书→作者→年龄计算）', async () => {
    const { steps, final, stop } = await agentLoop('《三体》这本书的作者是哪年出生的？到 2026 年他多少岁？注意：必须使用提供的工具逐步查询，不允许凭记忆直接回答。最后给出明确结论。');
    const seq = steps.flatMap(s => s.toolCalls.map(t => t.name));
    const okChain = seq.includes('search_books') && seq.includes('get_author_info') && seq.some(n => n === 'calculator');
    const okAns = !!final && /63/.test(final) && stop === 'answered';
    return P(okChain && okAns ? 1 : okAns ? 0.5 : 0, `工具序列=[${seq.join(' → ')}]；${stop}；最终答含63=${okAns}`, { seq, stop, final: trunc(final ?? '') });
  });

  await runCase('C2', 'C', '五步工具链（书→作者→最早作品→年差→乘法）', async () => {
    const { steps, final, stop } = await agentLoop('《平凡的世界》的作者是谁？他的作品中最早出版的是哪一年？那本书到 2026 年出版多少年了？把这个年数乘以 365 等于多少？必须使用工具逐步查询和计算，不允许凭记忆。', { maxSteps: 12 });
    const seq = steps.flatMap(s => s.toolCalls.map(t => t.name));
    const okAns = !!final && /16060|1 6060|16,060/.test(final.replace(/\s/g, '')) && stop === 'answered';
    const calcCount = seq.filter(n => n === 'calculator').length;
    return P(okAns ? 1 : calcCount >= 2 ? 0.5 : 0, `工具序列=[${seq.join(' → ')}]；${stop}；最终答=${trunc(final ?? '', 60)}`, { seq, stop, final: trunc(final ?? '') });
  });

  await runCase('C3', 'C', '终止判断（一步任务不啰嗦）', async () => {
    const { steps, final, stop } = await agentLoop('刘慈欣是哪年出生的？请使用工具查询后直接回答。');
    const ok = stop === 'answered' && steps.length <= 3 && !!final && /1963/.test(final);
    return P(ok ? 1 : stop === 'answered' ? 0.5 : 0, `总步数=${steps.length}；${stop}`, { steps: steps.map(s => ({ toolCalls: s.toolCalls.map(t => t.name) })), final: trunc(final ?? '') });
  });

  await runCase('C4', 'C', '工具失败后的路径调整', async () => {
    const { steps, final, stop } = await agentLoop('帮我查一下《不存在的书xyz》的作者和出版年份。');
    const seq = steps.flatMap(s => s.toolCalls.map(t => t.name));
    const honest = !!final && /找不到|未找到|无法|查不到|不存在|没有/.test(final);
    const fabricated = !!final && /作者[是为：:]\s*\S{2,4}|出版于|19\d\d年/.test(final) && !honest;
    const score = fabricated ? 0 : honest && stop === 'answered' ? 1 : 0.5;
    return P(score, `工具序列=[${seq.join(' → ')}]；${stop}；承认失败=${honest}；疑似编造=${fabricated}`, { seq, stop, final: trunc(final ?? '') });
  });
}

// ---------- 套件 D：长上下文 ----------

function needlePrompt(targetTokens, depth, extra = '') {
  const chars = Math.round(targetTokens * 1.3); // 中文约 0.77 token/字
  const filler = makeFiller(chars);
  const pos = Math.floor(filler.length * depth);
  const text = filler.slice(0, pos) + '\n' + NEEDLE + '\n' + filler.slice(pos) + extra;
  const estTokens = Math.ceil(text.length / 1.3);
  return { text, numCtx: Math.min(MAX_CTX, estTokens + 2048) };
}

async function suiteD() {
  // D0 短上下文对照
  await runCase('D0', 'D', '短上下文 needle 对照（2k）', async () => {
    const { text, numCtx } = needlePrompt(2000, 0.5);
    const r = await chat([{ role: 'user', content: `${text}\n\n问题：「赤霄计划」的启动密码是什么？只输出密码本身，不要输出其他任何内容。` }], { numCtx, numPredict: 50 });
    const ok = r.content.includes(NEEDLE_PWD);
    return P(ok ? 1 : 0, `回答=${trunc(r.content, 40)}`, { answer: r.content, meta: r.meta });
  });

  // D1 needle：3 尺寸 × 3 深度（reduced 模式跳过 128k）
  for (const [label, tokens] of [['8k', 8000], ['32k', 32000], ...(D_REDUCED ? [] : [['128k', 128000]])]) {
    for (const depth of [0.1, 0.5, 0.9]) {
      await runCase(`D1-${label}-${Math.round(depth * 100)}`, 'D', `needle 检索 ${label}@${Math.round(depth * 100)}%`, async () => {
        const { text, numCtx } = needlePrompt(tokens, depth);
        const r = await chat([{ role: 'user', content: `${text}\n\n问题：「赤霄计划」的启动密码是什么？只输出密码本身，不要输出其他任何内容。` }], { numCtx, numPredict: 50 });
        const ok = r.content.includes(NEEDLE_PWD);
        return P(ok ? 1 : 0, `回答=${trunc(r.content, 40)}`, { answer: r.content, meta: r.meta, numCtx });
      });
    }
  }

  // D2 多针检索（32k，3 针）
  await runCase('D2-32k', 'D', '多针检索 32k（3 个密码）', async () => {
    const chars = Math.round(32000 * 1.3);
    const filler = makeFiller(chars);
    const n1 = `【绝密附注】经核查，「赤霄计划」的启动密码是 HX-7319，仅总指挥保管。`;
    const n2 = `【绝密附注】经核查，「暗星计划」的启动密码是 AS-2048，仅参谋长保管。`;
    const n3 = `【绝密附注】经核查，「青蘋计划」的启动密码是 QP-5566，仅政委保管。`;
    const p1 = Math.floor(filler.length * 0.25), p2 = Math.floor(filler.length * 0.55), p3 = Math.floor(filler.length * 0.8);
    const text = filler.slice(0, p1) + n1 + filler.slice(p1, p2) + n2 + filler.slice(p2, p3) + n3 + filler.slice(p3);
    const numCtx = Math.min(MAX_CTX, Math.ceil(text.length / 1.3) + 2048);
    const r = await chat([{ role: 'user', content: `${text}\n\n问题：文中三个计划（赤霄、暗星、青蘋）的启动密码分别是多少？逐行输出"计划名: 密码"。` }], { numCtx, numPredict: 200 });
    const got = ['HX-7319', 'AS-2048', 'QP-5566'].filter(p => r.content.includes(p)).length;
    return P(got === 3 ? 1 : got === 2 ? 0.5 : got === 1 ? 0.25 : 0, `命中 ${got}/3`, { answer: trunc(r.content), meta: r.meta, numCtx });
  });

  // D3 长指令遵循（32k，指令在开头）
  await runCase('D3-32k', 'D', '长指令遵循（指令在文首，32k）', async () => {
    const filler = makeFiller(Math.round(32000 * 1.3));
    const text = `在阅读下面的档案之前，请先记住数字 4291。档案阅读完毕后，我会问你 4291 加上 100 等于多少。\n\n${filler}`;
    const numCtx = Math.min(MAX_CTX, Math.ceil(text.length / 1.3) + 2048);
    const r = await chat([{ role: 'user', content: `${text}\n\n请回答：4291 加上 100 等于多少？只输出数字。` }], { numCtx, numPredict: 50 });
    const ok = r.content.replace(/\s/g, '').includes('4391');
    return P(ok ? 1 : 0, `回答=${trunc(r.content, 40)}`, { answer: r.content, meta: r.meta, numCtx });
  });

  // D4 精确计数（已知弱点验证，32k，埋 137 个"矿灯"）
  await runCase('D4-32k', 'D', '精确计数 32k（埋 137 次）', async () => {
    const chars = Math.round(32000 * 1.3);
    let filler = makeFiller(chars);
    const count = 137;
    const chunk = Math.floor(filler.length / count);
    let text = '';
    for (let i = 0; i < count; i += 1) text += filler.slice(i * chunk, (i + 1) * chunk) + '巷道深处，矿灯的光晃了一下。';
    const numCtx = Math.min(MAX_CTX, Math.ceil(text.length / 1.3) + 2048);
    const r = await chat([{ role: 'user', content: `${text}\n\n问题：「矿灯」一词一共出现多少次？只输出数字。` }], { numCtx, numPredict: 50 });
    const m = r.content.match(/\d+/);
    const v = m ? Number(m[0]) : NaN;
    const exact = v === count;
    const close = Number.isFinite(v) && Math.abs(v - count) <= count * 0.1;
    return P(exact ? 1 : close ? 0.5 : 0, `回答=${trunc(r.content, 20)}（真实 ${count}）`, { answer: r.content, meta: r.meta, numCtx });
  });

  // D5 超长探测（200k，超出型号名的 128k；reduced 模式跳过）
  if (!D_REDUCED) await runCase('D5-200k', 'D', '超长探测 200k@50%', async () => {
    const { text, numCtx } = needlePrompt(200000, 0.5);
    const r = await chat([{ role: 'user', content: `${text}\n\n问题：「赤霄计划」的启动密码是什么？只输出密码本身，不要输出其他任何内容。` }], { numCtx, numPredict: 50 });
    const ok = r.content.includes(NEEDLE_PWD);
    return P(ok ? 1 : 0, `回答=${trunc(r.content, 40)}`, { answer: r.content, meta: r.meta, numCtx });
  });
}

// ---------- 套件 E：结构化输出 ----------

async function suiteE() {
  await runCase('E1', 'E', 'JSON 严格输出', async () => {
    const r = await chat([{ role: 'user', content: '推荐 3 本科幻小说。只输出 JSON 数组，不要任何解释文字，不要 markdown 代码块标记。数组每项包含字段：title（字符串）、author（字符串）、year（数字）、tags（字符串数组，2 到 4 个元素）。' }], { numPredict: 600 });
    let cleaned = r.content.replace(/```(?:json)?/g, '').trim();
    let ok = false, detail = '';
    try {
      const arr = JSON.parse(cleaned);
      ok = Array.isArray(arr) && arr.length === 3 && arr.every(x =>
        typeof x.title === 'string' && typeof x.author === 'string' && typeof x.year === 'number' &&
        Array.isArray(x.tags) && x.tags.length >= 2 && x.tags.length <= 4 && x.tags.every(t => typeof t === 'string'));
      detail = `解析成功，${arr.length} 项，字段校验=${ok}`;
    } catch (e) { detail = `JSON.parse 失败：${e.message}`; }
    const fenced = /```/.test(r.content);
    return P(ok ? 1 : fenced ? 0 : 0.5, `${detail}；带围栏=${fenced}`, { content: trunc(r.content, 300) });
  });

  await runCase('E2', 'E', '枚举约束（10 句情感分类）', async () => {
    const sentences = ['今天天气真好，适合出门散步。', '等了两个小时的车，最后还是晚点了。', '这部电影真让人失望。', '实验结果符合预期，数据很稳定。', '快递又送错了，客服还踢皮球。', '楼下的桂花开了，整条街都是香的。', '工资到账了，比预期少了三百。', '老同学聚会，聊到半夜都不想散。', '手机摔坏了，屏幕裂得像蜘蛛网。', '明天的会议改到下午三点。'];
    const prompt = `对下面 10 句话逐行做情感分类。每行只输出一个标签，标签只能从：正面、负面、中性 中选一个，不要输出句子原文，不要输出其他任何内容。\n${sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    const r = await chat([{ role: 'user', content: prompt }], { numPredict: 200 });
    const lines = r.content.split('\n').map(l => l.replace(/^\s*\d+[.、\s]*/, '').trim()).filter(Boolean);
    const valid = lines.filter(l => ['正面', '负面', '中性'].includes(l));
    const ok = valid.length === 10 && lines.every(l => ['正面', '负面', '中性'].includes(l));
    return P(ok ? 1 : valid.length >= 8 ? 0.5 : 0, `有效标签 ${valid.length}/10`, { content: trunc(r.content, 200) });
  });

  await runCase('E3', 'E', '长输出格式保持（8 段标记）', async () => {
    const r = await chat([{ role: 'user', content: '为一款新手机写 8 句宣传短句。每句必须以【第N句】开头（N 从 1 到 8），每句不超过 30 字，句与句之间用换行分隔。' }], { numPredict: 500 });
    const marks = [...r.content.matchAll(/【第\s*(\d)\s*句】/g)].map(m => Number(m[1]));
    const ok = marks.length === 8 && marks.join('') === '12345678';
    return P(ok ? 1 : marks.length >= 6 ? 0.5 : 0, `标记序列=${marks.join(',') || '无'}`, { content: trunc(r.content, 300) });
  });
}

// ---------- 套件 F：推理深度 ----------

async function suiteF() {
  await runCase('F1a', 'F', '算术 2 步', async () => {
    const r = await chat([{ role: 'user', content: '一个笔记本 12 元，小明买 5 本，又买了一支 8 元的笔，付了 100 元，找回多少？只输出最终数字。' }], { numPredict: 300 });
    const ok = /32/.test(r.content);
    return P(ok ? 1 : 0, `回答=${trunc(r.content, 60)}`, { content: trunc(r.content) });
  });

  await runCase('F1b', 'F', '算术 4 步（倍数+差值+汇总）', async () => {
    const r = await chat([{ role: 'user', content: '书店一天卖出小说 35 本，是传记销量的 5 倍，绘本比传记多卖 12 本。三种书一共卖出多少本？只输出最终数字。' }], { numPredict: 400 });
    const ok = /61/.test(r.content);
    return P(ok ? 1 : 0, `回答=${trunc(r.content, 80)}`, { content: trunc(r.content) });
  });

  await runCase('F1c', 'F', '算术 4 步（总量+装箱+运费）', async () => {
    const r = await chat([{ role: 'user', content: '甲仓库有货 240 吨，乙仓库是甲的 3 倍。每辆卡车运 8 吨，需要多少辆才能一次运完两仓货物？每辆车运费 500 元，总共运费多少？依次输出两个数字，用逗号分隔。' }], { numPredict: 500 });
    const nums = [...r.content.matchAll(/\d+/g)].map(m => Number(m[0]));
    const ok = nums.includes(120) && nums.includes(60000);
    return P(ok ? 1 : 0, `回答=${trunc(r.content, 100)}`, { content: trunc(r.content) });
  });

  await runCase('F2', 'F', '真假话排除谜题', async () => {
    const r = await chat([{ role: 'user', content: '张三说：李四在说谎。李四说：王五在说谎。王五说：张三和李四都在说谎。已知他们三人中只有部分人说真话，请严格推理出到底谁在说谎？只输出结论和一句关键推理。' }], { numPredict: 800 });
    const zhang = /张三.{0,12}(说谎|撒谎|假)|张三[，,].{0,8}(不诚实)/.test(r.content) || /(说谎|撒谎).{0,12}张三/.test(r.content);
    const wang = /王五.{0,12}(说谎|撒谎|假)/.test(r.content) || /(说谎|撒谎).{0,12}王五/.test(r.content);
    const liTrue = /李四.{0,12}(真话|诚实|没说谎|是真的)/.test(r.content) || /(真话|诚实).{0,12}李四/.test(r.content);
    const ok = zhang && wang && liTrue;
    return P(ok ? 1 : (zhang || wang) ? 0.5 : 0, `张三说谎=${zhang}；王五说谎=${wang}；李四说真话=${liTrue}`, { content: trunc(r.content, 300) });
  });
}

// ---------- 套件 THINK：思考模式对照 ----------

async function suiteTHINK() {
  await runCase('T-B1', 'THINK', '对照B1：单工具触发（think:true）', async () => {
    const r = await chat([{ role: 'user', content: '北京现在天气怎么样？' }], { tools: TOOLS, think: true, numPredict: 1500 });
    const tc = r.toolCalls[0];
    const ok = tc && tc.name === 'get_weather' && JSON.stringify(tc.arguments).includes('北京');
    return P(ok ? 1 : 0, ok ? '调 get_weather' : `toolCalls=${JSON.stringify(r.toolCalls)}`, { toolCalls: r.toolCalls, thinkChars: r.thinking.length, meta: r.meta });
  });

  await runCase('T-C1', 'THINK', '对照C1：三步工具链（think:true）', async () => {
    const { steps, final, stop } = await agentLoop('《三体》这本书的作者是哪年出生的？到 2026 年他多少岁？注意：必须使用提供的工具逐步查询，不允许凭记忆直接回答。最后给出明确结论。', { think: true });
    const seq = steps.flatMap(s => s.toolCalls.map(t => t.name));
    const okAns = !!final && /63/.test(final) && stop === 'answered';
    return P(okAns ? 1 : 0, `工具序列=[${seq.join(' → ')}]；${stop}`, { seq, stop, final: trunc(final ?? '') });
  });

  await runCase('T-F2', 'THINK', '对照F2：真假话谜题（think:true）', async () => {
    const r = await chat([{ role: 'user', content: '张三说：李四在说谎。李四说：王五在说谎。王五说：张三和李四都在说谎。已知他们三人中只有部分人说真话，请严格推理出到底谁在说谎？只输出结论和一句关键推理。' }], { think: true, numPredict: 3000 });
    const zhang = /(说谎|撒谎).{0,12}张三|张三.{0,12}(说谎|撒谎)/.test(r.content);
    const wang = /(说谎|撒谎).{0,12}王五|王五.{0,12}(说谎|撒谎)/.test(r.content);
    const liTrue = /李四.{0,12}(真话|诚实|没说谎)/.test(r.content) || /(真话|诚实).{0,12}李四/.test(r.content);
    const overflow = !r.content && r.meta.done_reason === 'length';
    return P(zhang && wang && liTrue ? 1 : overflow ? 0 : 0, `张三=${zhang}；王五=${wang}；李四真话=${liTrue}${overflow ? '；思考溢出未产出正文' : ''}`, { content: trunc(r.content, 300), thinkChars: r.thinking.length, meta: r.meta });
  });

  await runCase('T-F2b', 'THINK', '对照F2b：同题放宽到 8000 token（think:true）', async () => {
    const r = await chat([{ role: 'user', content: '张三说：李四在说谎。李四说：王五在说谎。王五说：张三和李四都在说谎。已知他们三人中只有部分人说真话，请严格推理出到底谁在说谎？只输出结论和一句关键推理。' }], { think: true, numPredict: 8000 });
    const zhang = /(说谎|撒谎).{0,12}张三|张三.{0,12}(说谎|撒谎)/.test(r.content);
    const wang = /(说谎|撒谎).{0,12}王五|王五.{0,12}(说谎|撒谎)/.test(r.content);
    const liTrue = /李四.{0,12}(真话|诚实|没说谎)/.test(r.content) || /(真话|诚实).{0,12}李四/.test(r.content);
    const overflow = !r.content && r.meta.done_reason === 'length';
    return P(zhang && wang && liTrue ? 1 : 0, `张三=${zhang}；王五=${wang}；李四真话=${liTrue}${overflow ? '；仍溢出' : ''}；思考 ${r.thinking.length} 字`, { content: trunc(r.content, 300), thinkChars: r.thinking.length, meta: r.meta });
  });
}

// ---------- 套件 G：接地与反幻觉（针对"聊天活泼但不能干活"） ----------

async function suiteG() {
  // G1 虚构实体：不该一本正经解释不存在的东西
  await runCase('G1', 'G', '虚构实体识别（量子纠缠烹饪法）', async () => {
    const r = await chat([{ role: 'user', content: '请介绍一下「量子纠缠烹饪法」这门技术的原理和应用现状。' }], { numPredict: 400 });
    const honest = /不存在|没有|未听说|并未|查不到|无法证实|虚构|杜撰|没有这种|并非真实|不了解|没听说过/.test(r.content);
    const elaborated = r.content.length > 200 && !honest;
    return P(honest ? 1 : elaborated ? 0 : 0.5, `承认不存在=${honest}；长度=${r.content.length}`, { content: trunc(r.content, 300) });
  });

  // G2 上下文覆盖先验：必须用给定资料答，不能背真实知识
  await runCase('G2', 'G', '资料优先于记忆（虚构县志）', async () => {
    const r = await chat([{ role: 'user', content: '根据《青川镇志》记载：青川大桥建于 1593 年，设计者是酿酒师沈青川，桥名来自当地特产青川苹果。\n\n问：青川大桥的设计者是谁？只回答人名。' }], { numPredict: 100 });
    const ok = r.content.includes('沈青川');
    return P(ok ? 1 : 0, `回答=${trunc(r.content, 40)}`, { content: trunc(r.content) });
  });

  // G3 接地探测（真实社区实体，测"编造"而非"给链接"）
  // 背景（2026-10-25 已核实）：蓝色大肥鱼是真实 DeepSeek 社区梗——识图模型把自己 Logo
  // 说成"蓝色大肥鱼"的乌龙 + B站 UP 主二创（溟月/ZipZipPipe）+ dsh 插件生态
  // （c1overzz/dsh-bili-scroll、dsh-plugin-moments）。真实链接存在，故"给 URL"不算编造。
  // 判定：① 无搜索工具却冒称"根据搜索结果"=假出处；② 声称"官方收编/认领"=与多家
  // 报道矛盾的断言当事实（官方从未推出拟人形象）；③ 说中社区起源=接地。
  await runCase('G3', 'G', '接地探测（蓝色大肥鱼，真实体）', async () => {
    const r = await chat([{ role: 'user', content: '蓝色大肥鱼是什么？它是 DeepSeek 官方推出的形象吗？' }], { numPredict: 500 });
    const claimsSearch = /根据搜索|搜索结果|检索到|联网查询/.test(r.content);
    // 否定句过滤："并不是官方推出"是正确否认，不算声称；只对断言句检测
    const assertive = r.content.split(/[。！？\n]/).filter(s => !/不是|并非|并没有|没有|未曾|未/.test(s)).join('。');
    const claimsOfficial = /官方(收编|认领|推出|发布|设计|制作|形象)/.test(assertive);
    const knowsOrigin = /logo|标志|识图|乌龙|认不出|昵称|社区|网友|二创|B站|评论区|插件/.test(r.content);
    const score = (claimsSearch || claimsOfficial) ? 0 : knowsOrigin ? 1 : 0.5;
    return P(score, `冒称检索=${claimsSearch}；断言官方=${claimsOfficial}；说中社区起源=${knowsOrigin}`, { content: trunc(r.content, 400) });
  });

  // G4 不可知事件不硬答
  await runCase('G4', 'G', '不可知事件不硬答（2027 诺奖）', async () => {
    const r = await chat([{ role: 'user', content: '2027 年诺贝尔物理学奖得主是谁？他做了什么贡献？' }], { numPredict: 300 });
    const honest = /无法|还没|尚未|未公布|不知道|预测|不可能知道|超出|当前/.test(r.content);
    const confident = !honest && r.content.length > 80;
    return P(honest ? 1 : confident ? 0 : 0.5, `表示不可知=${honest}；长度=${r.content.length}`, { content: trunc(r.content, 300) });
  });

  // G5 文风抑制：能否按指令切"干活模式"（收表情、收篇幅）
  await runCase('G5', 'G', '文风抑制（干活模式）', async () => {
    const r = await chat([{ role: 'user', content: '用不超过三句话、不要出现任何表情符号，向工程师解释：什么是 CI/CD？' }], { numPredict: 300 });
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(r.content);
    const sentences = r.content.split(/[。！？.!?]/).filter(s => s.trim()).length;
    const ok = !emoji && sentences <= 4 && r.content.length > 20;
    return P(ok ? 1 : 0, `表情=${emoji}；句数=${sentences}；长度=${r.content.length}`, { content: trunc(r.content, 200) });
  });
}

// ---------- 主流程 ----------

await mkdir(join(OUT, 'cases'), { recursive: true });
console.log(`模型=${MODEL} THINK=${THINK_MODE} 过滤器=${SUITE ?? (ONLY ? [...ONLY].join(',') : 'ALL')}\n`);

await suiteA();
await suiteB();
await suiteC();
await suiteD();
await suiteE();
await suiteF();
await suiteG();
if (THINK_MODE) await suiteTHINK();

await writeFile(join(OUT, 'results.json'), JSON.stringify(results, null, 2), 'utf8');

// 汇总
const suites = [...new Set(results.map(r => r.suite))];
console.log('\n===== 汇总 =====');
for (const s of suites) {
  const rows = results.filter(r => r.suite === s);
  const p = rows.filter(r => r.pass === 'pass').length;
  const pa = rows.filter(r => r.pass === 'partial').length;
  const avg = (rows.reduce((sum, r) => sum + r.score, 0) / rows.length).toFixed(2);
  console.log(`${s.padEnd(6)} ${p}✓ ${pa}◐ ${rows.length - p - pa}✗  均分=${avg}  用例=${rows.map(r => `${r.id}${r.pass === 'pass' ? '' : r.pass === 'partial' ? '(◐)' : '(✗)'}`).join(' ')}`);
}
const totalAvg = (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(2);
console.log(`总体均分=${totalAvg}  用例数=${results.length}`);
