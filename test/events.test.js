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

function cluster(pairs) {
  seq = 0;
  const posts = [
    ...background.map((t, i) => post(t, `bg${i}`, i)),
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
