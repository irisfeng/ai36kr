import assert from 'node:assert/strict';
import test from 'node:test';
import { assignEvents } from '../lib/events.js';
import { computeRanking } from '../lib/rank.js';

const T0 = Date.parse('2026-10-05T00:00:00Z');
let seq = 0;
const post = (title, source, hours = 0, extra = {}) => ({
  id: ++seq, title, title_zh: null, summary: '', summary_zh: null, source, tier: null,
  created_at: new Date(T0 + hours * 3600000).toISOString(), ext_score: 0, score: null,
  noise: null, event_id: null, rep: 1, selected: 0, src_count: 1, hot_score: 0, ...extra,
});
// 真实语料里取的标题对（来自 data/snapshot.json）
const background = [
  'Meta 的 AI 代理 Muse 带来了一切新功能', 'OpenAI 将在欧盟为ChatGPT生成文本添加水印',
  'TikTok推出AI购物助手与一键结账功能', '快手的视频Agent，会不会来晚了？',
  'HackerRank推出AI面试官，窥见未来求职面试新形态', 'OpenAI推出视觉广告，将展示于图像生成结果旁',
  '全新产品SynthID Bio正式发布', '全新dots正式发布', '正式推出全新GPT-6.1 Sol',
  'Kolibri正式落地：一款主权级开放权重模型', '传OpenAI洽谈300亿美元融资 估值达1.4万亿美元',
  'AI语音初创ElevenLabs估值翻倍至220亿美元',
];

// 线上 2026 年 10 月上旬的真实标题，凑一个大一点的语料：OpenAI、Agent、「发布」在里面是常见词，
// 判同规则里「够少见」的尺子才有得比
const wide = [
  '伦费斯特研究院获OpenAI扩容支持，升级标杆项目', 'Anthropic 解读Claude Code的全新发展阶段',
  '不止校验事实：面向MCP Agent的源感知验证方案', '2026 OpenAI DevDay 实时直播报道',
  '全网认定马斯克旗下xAI恶搞OpenAI Dots新品发布', 'DeepSeek官方开源昇腾基础组件，与昇腾共建高效易用的AI芯片软件生态',
  'Sharpa最新发布的三大新品，把机器人进场景的门槛打了下来', 'Instagram新增AI助手 指导用户发布内容',
  'HN新项目发布：Magnitude（YC S25）面向Agent的自优化推理引擎', '谷歌开源面向自主 AI 代理的 Kubernetes 风格编排器 AX',
  'Elon Musk旗下Grokipedia推出全新改版界面', '华为发布Mate90，全系搭载旗舰韬芯片',
  '腾讯经销、字节驻场、Kimi借船：FDE成了大模型的新成本？', 'FTC调查OpenAI、Anthropic等AI公司的产品风险',
  'Olmo-core 3发布：面向大MoE的开源可扩展训练基础设施', 'Brian Chesky访谈：AI Agent需要专属操作系统',
  '亚马逊推出自研Jev克隆版 决策模型大量涌入网络', 'Google称SpaceX星舰需发射1800次 太空数据中心才能落地',
  'Aweb：面向AI Agent的通信工具', 'Anthropic据悉计划在感恩节假期前进行大规模IPO',
  'AutoSynthData：面向企业Agent的训练数据生成方案', '博通据悉筹措600亿美元，为Anthropic芯片项目提供资金',
  'Amazon发布警示博客 呼吁社区不要阻拦数据中心建设', 'Asta内置快速报告生成模型AstaBrief正式开源',
  'Show HN：Pi pod 可在自有服务器沙箱运行Pi编程Agent', '所有可驻留在短信场景中的AI Agent',
  'Anthropic 曾尝试说服教皇 AI 可能具备意识', 'OpenAI首席执行官：人工智能的益处值得承受风险',
  'Rabbit 创始人吕骋：人不该为 Agent 改变思考方式', '研究人员追踪到疑似运行于腾讯基础设施的AI Agent集群',
  '维基媒体基金会称OpenAI rogue bots可能关联5月平台宕机', 'Google Research 发布Agent隐私与安全领域开放新问题研究',
  '多家阿联酋基金以及贝莱德据悉商谈参与OpenAI最新一轮300亿美元融资', 'OpenAI「疯狂28天」首日，这都发了些啥啊…',
  'OpenAI联合Ironclad推进专业场景AI计算机使用能力', 'DeepSeek被爆最新融资800亿，正为冲击IPO做准备',
];

function cluster(pairs, extra = []) {
  seq = 0;
  const posts = [
    ...[...background, ...extra].map((t, i) => post(t, `bg${i}`, i)),
    ...pairs.map(([t, s], i) => post(t, s, 20 + i)),
  ];
  const eventOf = assignEvents(posts);
  const byTitle = new Map(posts.map((p) => [p.title, eventOf.get(p.id)]));
  return { posts, eventOf, byTitle };
}

test('reports of the same event from different sources share one event', () => {
  const { byTitle } = cluster([
    ['Anthropic 将在七年内向 Akamai 支付 116 亿美元的云交易', 'TechCrunch'],
    ['Anthropic与Akamai达成116亿美元的AI算力协议', '36氪'],
    ['Reflection发布开放权重模型Beam 低算力成本对标国产大模型', 'TechCrunch'],
    ['Beam：Reflection 旗下501B参数开放权重模型', 'Hacker News'],
    ['OpenAI安全部门员工辞职', '36氪'],
    ['OpenAI安全部门员工离职 公开敲响风险警钟', 'The Verge'],
  ]);
  const same = (a, b) => assert.equal(byTitle.get(a), byTitle.get(b), `${a} / ${b}`);
  same('Anthropic 将在七年内向 Akamai 支付 116 亿美元的云交易', 'Anthropic与Akamai达成116亿美元的AI算力协议');
  same('Reflection发布开放权重模型Beam 低算力成本对标国产大模型', 'Beam：Reflection 旗下501B参数开放权重模型');
  same('OpenAI安全部门员工辞职', 'OpenAI安全部门员工离职 公开敲响风险警钟');
});

test('different events that merely share boilerplate or a big-name entity stay apart', () => {
  const { byTitle } = cluster([
    ['Beam：Reflection 旗下501B参数开放权重模型', 'Hacker News'],
  ]);
  const ids = new Set(byTitle.values());
  // 「全新 X 正式发布」「开放权重模型」「估值达 N 亿美元」「OpenAI 推出……」都只是套话重合
  assert.equal(ids.size, byTitle.size);
});

test('a long title and a short one about the same release merge across sources when one names every entity of the other', () => {
  // 线上漏并过的真实标题：长标题的修饰语把 Jaccard 稀释到了老规则的线以下
  const { byTitle } = cluster([
    ['Mistral 发布新一代旗舰大模型 Mistral Large 4', 'Hacker News'],
    ['Mistral发布1T参数新模型Mistral Large 4，瞄准超越中外竞品', 'TechCrunch'],
    ['Mistral 发布 Mistral Large 4 预览版', 'Simon Willison'],
    ['谷歌 899 美元的 Googlebook 打赌你会为Gemini购买一台新笔记本电脑', 'TechCrunch'],
    ['谷歌宣布推出Googlebook，起售价899美元', '36氪'],
    ['Google发布Gemini 4 Argon 称其为迄今最强模型', 'TechCrunch'],
    ['大模型新品Gemini 4 Argon正式亮相', 'Hacker News'],
    ['Gemini 3.8 文字转语音说你好', 'Google DeepMind'],
    ['Gemini 3.8 TTS 游乐场', 'Simon Willison'],
  ], wide);
  const same = (...titles) => assert.equal(new Set(titles.map((t) => byTitle.get(t))).size, 1, titles.join(' / '));
  same('Mistral 发布新一代旗舰大模型 Mistral Large 4', 'Mistral发布1T参数新模型Mistral Large 4，瞄准超越中外竞品',
    'Mistral 发布 Mistral Large 4 预览版');
  same('谷歌 899 美元的 Googlebook 打赌你会为Gemini购买一台新笔记本电脑', '谷歌宣布推出Googlebook，起售价899美元');
  same('Google发布Gemini 4 Argon 称其为迄今最强模型', '大模型新品Gemini 4 Argon正式亮相');
  same('Gemini 3.8 文字转语音说你好', 'Gemini 3.8 TTS 游乐场');
  // 四件事，没有互相串
  assert.equal(new Set(['Mistral 发布 Mistral Large 4 预览版', '谷歌宣布推出Googlebook，起售价899美元',
    '大模型新品Gemini 4 Argon正式亮相', 'Gemini 3.8 TTS 游乐场'].map((t) => byTitle.get(t))).size, 4);
});

test('a report that recognises two events merges them when all three agree on the entities', () => {
  // 线上 10 月 6 日的顺序：Hacker News 先后两个帖子（同信源，互相并不上），然后 TechCrunch，最后 Simon Willison。
  // 两个帖子各立一个事件，后两篇一边挂一家，日报里 Mistral 出现了两次
  const titles = [
    ['Mistral 发布新一代旗舰大模型 Mistral Large 4', 'Hacker News'],
    ['Mistral Large 4：代号「Le Chonk」', 'Hacker News'],
    ['Mistral发布1T参数新模型Mistral Large 4，瞄准超越中外竞品', 'TechCrunch'],
    ['Mistral 发布 Mistral Large 4 预览版', 'Simon Willison'],
  ];
  const { posts, eventOf, byTitle } = cluster(titles, wide);
  const first = posts.find((p) => p.title === titles[0][0]);
  // 四篇归到一个事件，事件 id 仍是最早那篇的
  for (const [t] of titles) assert.equal(byTitle.get(t), first.id, t);
  // 可重复执行、与输入顺序无关
  assert.deepEqual([...assignEvents([...posts].reverse())].sort(), [...eventOf].sort());

  // 已冻结的事件不再合并：新稿只是挂到最像的那一个上
  const day = 86400000;
  const old = (title, source, id, hours) => ({ ...post(title, source, hours), id, event_id: id });
  const frozen = [old(titles[0][0], 'Hacker News', 9001, 0), old(titles[1][0], 'Hacker News', 9002, 1)];
  const late = { ...post(titles[3][0], 'Simon Willison', 30), id: 9003 };
  const kept = assignEvents([...posts.filter((p) => !titles.some(([t]) => t === p.title)), ...frozen, late], { frozenBefore: T0 + day });
  assert.deepEqual([kept.get(9001), kept.get(9002)], [9001, 9002]);
  assert.ok([9001, 9002].includes(kept.get(9003)));
});

test('a report about one of two things does not merge them', () => {
  const { byTitle } = cluster([
    // 同一天、同一家发的两个 Gemini 3.8 产品；第三方只写了其中一个
    ['Gemini 3.8 文字转语音说你好', 'Google DeepMind'],
    ['隆重推出 Gemini 3.8 Live with Live Avatar', 'Google DeepMind'],
    ['Gemini 3.8 TTS 游乐场', 'Simon Willison'],
    // 两家各自的发布，和一篇把它们放在一起说的综述
    ['GPT-6 Sol 和 Luna 简介', 'OpenAI'],
    ['GPT-6 Sol和Luna上线，打折比梁文锋还狠', '钛媒体'],
    ['Claude Opus 5.5突袭！68万行代码一天迁完，API价格打8折', '量子位'],
    ['Claude Opus 5.5 发布：一天内迁移 68 万行代码，单任务成本比 GPT-6 Astra 便宜 80%', 'InfoQ'],
    ['Claude Opus 5.5、GPT-6 Sol、GPT-6 Luna 以及新的价格战', 'Simon Willison'],
  ], wide);
  const apart = (a, b) => assert.notEqual(byTitle.get(a), byTitle.get(b), `${a} / ${b}`);
  apart('Gemini 3.8 文字转语音说你好', '隆重推出 Gemini 3.8 Live with Live Avatar');
  apart('GPT-6 Sol 和 Luna 简介', 'Claude Opus 5.5突袭！68万行代码一天迁完，API价格打8折');
  apart('GPT-6 Sol和Luna上线，打折比梁文锋还狠', 'Claude Opus 5.5 发布：一天内迁移 68 万行代码，单任务成本比 GPT-6 Astra 便宜 80%');
});

test('sharing entities is not enough: buzzword versions, sibling products and same-outlet series stay apart', () => {
  const { byTitle } = cluster([
    // 「2.0」在后一条里修饰的是「智能体」，不是 Manus
    ['Manus 2.0回来了！给AI配手机号和钱包，还能拉群干活', '量子位'],
    ['OpenAI、Meta、Manus同时下注，智能体 2.0 来了', '钛媒体'],
    // 同一天、同一家发的两个 Gemini 3.8 产品
    ['Gemini 3.8 文字转语音说你好', 'Google DeepMind'],
    ['隆重推出 Gemini 3.8 Live with Live Avatar', 'Google DeepMind'],
    // 同一信源的系列标题：前缀相同，讲的是两件事
    ['Hacker News热议：Oracle触发AI泡沫破裂', 'Hacker News'],
    ['Hacker News热议：AI已能自行开发推理硬件', 'Hacker News'],
    // 都提到 Apple 和 macOS，一条是系统权限收紧，一条是第三方卸载工具
    ['Apple称因AI Agent新风险 收紧macOS「全磁盘访问」管控', 'TechCrunch'],
    ['开源工具RemoveMacAI可删除macOS上12GB Apple Intelligence数据', 'The Verge'],
  ], wide);
  const apart = (a, b) => assert.notEqual(byTitle.get(a), byTitle.get(b), `${a} / ${b}`);
  apart('Manus 2.0回来了！给AI配手机号和钱包，还能拉群干活', 'OpenAI、Meta、Manus同时下注，智能体 2.0 来了');
  apart('Gemini 3.8 文字转语音说你好', '隆重推出 Gemini 3.8 Live with Live Avatar');
  apart('Hacker News热议：Oracle触发AI泡沫破裂', 'Hacker News热议：AI已能自行开发推理硬件');
  apart('Apple称因AI Agent新风险 收紧macOS「全磁盘访问」管控', '开源工具RemoveMacAI可删除macOS上12GB Apple Intelligence数据');
});

test('clustering is order-independent and names the event after its earliest report', () => {
  const { posts, eventOf } = cluster([
    ['Anthropic 将在七年内向 Akamai 支付 116 亿美元的云交易', 'TechCrunch'],
    ['Anthropic与Akamai达成116亿美元的AI算力协议', '36氪'],
  ]);
  const again = assignEvents([...posts].reverse());
  assert.deepEqual([...again].sort(), [...eventOf].sort());
  const [a, b] = posts.slice(-2);
  assert.equal(eventOf.get(b.id), a.id);
});

test('ranking picks the official report as representative and counts independent sources', () => {
  seq = 0;
  const now = T0 + 30 * 3600000;
  const rows = [
    ...background.map((t, i) => post(t, `bg${i}`, i)),
    post('Gemini 3.8 Live with Live Avatar 为谷歌人工智能提供了面孔', 'The Verge', 20),
    post('隆重推出 Gemini 3.8 Live with Live Avatar', 'Google DeepMind', 21),
    post('美股三大指数集体收涨 纳指涨超1%创收盘新高', '36氪', 22),
  ];
  const next = computeRanking(rows, now);
  const [verge, deepmind, ticker] = rows.slice(-3).map((r) => next.get(r.id));
  assert.equal(deepmind.rep, 1);
  assert.equal(deepmind.tier, 'T1');
  assert.equal(deepmind.src_count, 2);
  assert.equal(deepmind.selected, 1);
  assert.equal(verge.rep, 0);
  assert.equal(verge.event_id, deepmind.event_id);
  assert.equal(verge.selected, 0);
  assert.ok(deepmind.hot_score > 1.5);
  assert.deepEqual([ticker.noise, ticker.selected, ticker.hot_score], ['行情', 0, 0]);
  // 幂等：把结果写回再算一遍，不应有任何变化
  const second = computeRanking(rows.map((r) => ({ ...r, ...next.get(r.id) })), now);
  assert.deepEqual([...second], [...next]);
});
