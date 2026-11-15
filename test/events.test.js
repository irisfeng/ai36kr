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

test('a developing leadership change stays one pick while a different Nvidia story stays apart', () => {
  // 2026-11-12 至 11-15 的真实标题。换帅及其后续角度应并成一条；
  // 芯片追踪法案（芯片安全法案）只是也写到英伟达，仍然分开。
  seq = 0;
  const samples = [
    ['黄仁勋时代落幕，英伟达宣布其卸任，CFO克雷斯出任临时CEO', '钛媒体', 70, {
      score: 90, summary: '英伟达宣布黄仁勋卸任CEO，由CFO克雷斯出任临时CEO，巨头正式开启权力交接过渡期。',
    }],
    ['黄仁勋卸任英伟达CEO，CFO Colette Kress出任临时接替者', 'TechCrunch', 71, {
      score: 83, summary: '长期担任英伟达CFO的Colette Kress将作为临时负责人，接替深陷丑闻的前CEO黄仁勋。',
    }],
    ['炸了！英伟达最大的雷，是没接班人', '36氪', 72, {
      score: 92, summary: '英伟达当地时间2026年11月12日宣布，执掌公司33年的黄仁勋即刻辞去相关职务，未披露辞任原因，董事会已启动新任CEO遴选程序。',
    }],
    ['黄仁勋辞职，英伟达33年首换帅，市值蒸发超3万亿', '量子位', 74, {
      score: 88, summary: '英伟达成立33年来首次换帅，黄仁勋不再担任CEO，事件发生后公司市值蒸发超过3万亿。',
    }],
    ['报道称黄仁勋未对英伟达继任者展现信心', 'TechCrunch', 76, {
      score: 78, summary: '据相关报道，黄仁勋在夏季的一次内部会议上，将继任者Kress形容为车灯前的鹿，未对其展现出足够的信心。',
    }],
    ['黄仁勋离任后AI初创融资出现明显缺口，VC与创始人预期投资收缩', 'TechCrunch', 78, {
      score: 78, summary: '此前英伟达在黄仁勋主导下向AI初创投入数百亿资金，他离任后行业普遍预期后续单笔投资规模将缩小。',
    }],
    ['Jensen Huang卸任引发外界质疑Nvidia的开源AI支持立场', 'TechCrunch', 80, {
      score: 76, summary: 'Jensen Huang辞职让行业质疑Nvidia对开源AI的投入承诺，涉及Hugging Face收购、开源权重模型等布局，公司正处于领导层过渡期。',
    }],
    ['不依赖Jensen Huang的开源AI', 'Interconnects', 82, {
      score: 30, tier: 'T1_5', summary: '一次斩首式的核心管理层大换血，是时候启动重建工作了。',
    }],
    ['多国亚洲政府就Nvidia CEO Jensen Huang离职作出回应', 'TechCrunch', 84, {
      score: 78, summary: '部分亚洲国家政府已出面确认芯片供应承诺，其余政府正监测该事件对本地项目的影响。',
    }],
    ['Elon Musk等科技高管签署请愿书 呼吁Nvidia恢复Jensen Huang职务', 'TechCrunch', 86, {
      score: 75, summary: 'Elon Musk等一众科技高管签署请愿书，呼吁Nvidia恢复Jensen Huang的职务，截至周六下午该请愿书已累计获得超过11.5万个签名。',
    }],
    ['TechCrunch发问：英伟达安全团队此前缺位', 'TechCrunch', 88, {
      score: 78, summary: '英伟达安全主管已于8月悄然离职，CEO黄仁勋因涉及包括与涉嫌向中国输送芯片的企业高管的往来关系卸任，前情报官员称这类漏洞属于日常讨论范畴。',
    }],
    ['英伟达私下确认可追踪芯片打击走私，行业此前公开质疑可行性', 'MIT TR', 75, {
      score: 76, summary: '英伟达代表周四向美国议员Bill Foster证实，落实《芯片安全法案》要求的反芯片走私措施技术上可行，此前行业团体公开质疑该方案可行性。',
    }],
    ['谷歌一次发布两颗TPU，英伟达的“通用”招牌开始松动', '钛媒体', 77, {
      score: 78, summary: '谷歌推出两款专业TPU产品，向英伟达主导的通用AI芯片路线发起挑战。',
    }],
    ['研究显示中国当前最强AI模型均采用受出口管制的英伟达芯片训练', 'TechCrunch', 79, {
      score: 77, summary: '最新研究结果显示，目前国内性能最领先的AI大模型，全部使用被美国列入出口管制清单的英伟达芯片完成训练。',
    }],
    ['美国国会传唤NVIDIA CEO黄仁勋出席涉华相关闭门简报会', 'TechCrunch', 68, {
      score: 82, summary: '美国众议院共和党人要求黄仁勋在周三当日结束前出席闭门简报会，就所谓涉中国间谍相关事件作出回应。',
    }],
    // 「回归常规」不是请他回来。快照里这篇专栏不该被换帅吞掉。
    ['黄仁勋的麻烦，才刚开始', '钛媒体', 66, {
      score: 30, summary: '文章认为黄仁勋已脱离此前的狂热状态，英伟达将回归常规制度管理体系。',
    }],
  ];
  const posts = [
    ...[...background, ...wide].map((t, i) => post(t, `bg${i}`, i)),
    ...samples.map(([title, source, hours, extra]) => post(title, source, hours, extra)),
  ];
  const eventOf = assignEvents(posts);
  const again = assignEvents([...posts].reverse());
  assert.deepEqual([...again].sort(), [...eventOf].sort());
  const idOf = (title) => posts.find((p) => p.title === title).id;
  const eventOfTitle = (title) => eventOf.get(idOf(title));
  const succession = [
    '黄仁勋时代落幕，英伟达宣布其卸任，CFO克雷斯出任临时CEO',
    '黄仁勋卸任英伟达CEO，CFO Colette Kress出任临时接替者',
    '炸了！英伟达最大的雷，是没接班人',
    '黄仁勋辞职，英伟达33年首换帅，市值蒸发超3万亿',
    '报道称黄仁勋未对英伟达继任者展现信心',
    '黄仁勋离任后AI初创融资出现明显缺口，VC与创始人预期投资收缩',
    'Jensen Huang卸任引发外界质疑Nvidia的开源AI支持立场',
    '不依赖Jensen Huang的开源AI',
    '多国亚洲政府就Nvidia CEO Jensen Huang离职作出回应',
    'Elon Musk等科技高管签署请愿书 呼吁Nvidia恢复Jensen Huang职务',
    'TechCrunch发问：英伟达安全团队此前缺位',
  ];
  const lead = eventOfTitle(succession[0]);
  for (const title of succession) assert.equal(eventOfTitle(title), lead, title);
  const apart = (title) => assert.notEqual(eventOfTitle(title), lead, title);
  apart('英伟达私下确认可追踪芯片打击走私，行业此前公开质疑可行性');
  apart('谷歌一次发布两颗TPU，英伟达的“通用”招牌开始松动');
  apart('研究显示中国当前最强AI模型均采用受出口管制的英伟达芯片训练');
  apart('美国国会传唤NVIDIA CEO黄仁勋出席涉华相关闭门简报会');
  apart('黄仁勋的麻烦，才刚开始');

  const ranked = computeRanking(posts, T0 + 120 * 3600000);
  const reps = succession.filter((title) => ranked.get(idOf(title)).rep === 1);
  assert.equal(reps.length, 1);
  assert.notEqual(reps[0], '不依赖Jensen Huang的开源AI');
  const face = ranked.get(idOf(reps[0]));
  assert.equal(face.event_score, 92);
  assert.equal(face.selected, 1);
  assert.equal(ranked.get(idOf('不依赖Jensen Huang的开源AI')).rep, 0);
  assert.equal(ranked.get(idOf('英伟达私下确认可追踪芯片打击走私，行业此前公开质疑可行性')).selected, 1);
  const second = computeRanking(posts.map((p) => ({ ...p, ...ranked.get(p.id) })), T0 + 120 * 3600000);
  assert.deepEqual([...second], [...ranked]);
});
