import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectNoise, effectiveScore, eventHeat, isSelected, latestDevelopment, pickRepresentative,
  shownScore, statesWhoDidWhat, THRESHOLDS,
} from '../lib/editorial.js';

test('noise prefilter blocks market tickers, event promos and roundups only', () => {
  assert.equal(detectNoise('美股三大指数集体收涨 纳指涨超1%创收盘新高'), '行情');
  assert.equal(detectNoise('高盛上调台积电12个月目标价至3300元台币'), '行情');
  assert.equal(detectNoise('TechCrunch Disrupt 2026参展倒计时3天 曝光转化全新商机'), '活动');
  assert.equal(detectNoise('当 Vibe Coding 撞上企业级现实｜QCon上海'), '活动');
  assert.equal(detectNoise('早报｜曝苹果新CEO想更快发产品/华为Mate 90真机进店'), '合集');
  assert.equal(detectNoise('The Download: AI adoption paradox'), '合集');
  // 线上漏掉过的合集写法（它们会和里面提到的单条新闻错并成一个事件）
  assert.equal(detectNoise('【数智周报】智谱AI道歉；Anthropic被曝选定纳斯达克上市，目标10月IPO；OpenAI据悉考虑新一轮融资'), '合集');
  assert.equal(detectNoise('【钛晨报】“十五五”民政工作怎么干？四大重点任务，养老排在第一位；马斯克预测未来世界'), '合集');
  assert.equal(detectNoise('8点1氪丨“西贝将彻底倒闭”冲上热搜，最新回应；原钉钉CEO无招履新，年薪10万；黄仁勋出售约4.6万股英伟达股票'), '合集');
  assert.equal(detectNoise('Edge AI Daily 早报（10月3日）'), '合集');
  assert.equal(detectNoise('2026年10月3日 Hacker News 热门头条'), '合集');
  assert.equal(detectNoise('2026-10-04 Hacker News 热门内容汇总'), '合集');
  assert.equal(detectNoise('某大会观察', '现在注册最高可省100美元，第二张门票半价'), '推广');
  // 正常新闻里出现「指数」「大会」「上涨」不算噪声
  assert.equal(detectNoise('OpenAI 在开发者大会上发布 GPT-6.1 Sol'), '');
  assert.equal(detectNoise('Anthropic与Akamai达成116亿美元的AI算力协议'), '');
  // 标题里带 Hacker News 的单条讨论不是合集
  assert.equal(detectNoise('Hacker News热议：Oracle触发AI泡沫破裂'), '');
  assert.equal(detectNoise('为Hacker News已达成的AI相关挑战投票'), '');
  assert.equal(detectNoise('斯坦福 AI 指数报告：模型成本一年下降 90%'), '');
});

test('official sources clear a lower bar than media for the same score', () => {
  assert.equal(isSelected({ score: 62, tier: 'T1' }), true);
  assert.equal(isSelected({ score: 62, tier: 'T2' }), false);
  assert.equal(isSelected({ score: THRESHOLDS.T2, tier: 'T2' }), true);
  // 报道面加成：三家都在报的媒体稿可以补上差的那几分，但封顶 +12
  assert.equal(isSelected({ score: 68, tier: 'T2', sourceCount: 3 }), true);
  assert.equal(effectiveScore({ score: 50, tier: 'T2', sourceCount: 9 }), 62);
  // 噪声无论多少分都不入选
  assert.equal(isSelected({ score: 99, tier: 'T1', noise: '活动' }), false);
});

test('without a model score, selection falls back to tier and coverage', () => {
  assert.equal(isSelected({ score: null, tier: 'T1' }), true);
  assert.equal(isSelected({ score: null, tier: 'T2' }), false);
  assert.equal(isSelected({ score: null, tier: 'T2', sourceCount: 2 }), true);
  assert.equal(isSelected({ score: null, tier: 'T2', extScore: 400 }), true);
  assert.equal(isSelected({ score: undefined, tier: 'unknown-tier' }), false);
});

test('heat counts each independent source once and halves every 24 hours', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  const at = (hoursAgo) => new Date(now - hoursAgo * 3600000).toISOString();
  // 一家发十篇只算一次
  const spam = Array.from({ length: 10 }, () => ({ source: 'A', created_at: at(0), ext_score: 0 }));
  assert.equal(eventHeat(spam, now), 1);
  assert.equal(eventHeat([
    { source: 'A', created_at: at(0), ext_score: 0 },
    { source: 'B', created_at: at(24), ext_score: 0 },
    { source: 'C', created_at: at(49), ext_score: 0 },
  ], now), 1.5);
  // 社区讨论折成信源当量，有上限
  assert.equal(eventHeat([{ source: 'HN', created_at: at(0), ext_score: 100000 }], now), 2.5);
  // 只有 HN 在聊（400 分）排不过两家媒体都在报
  assert.ok(eventHeat([{ source: 'HN', created_at: at(0), ext_score: 400 }], now)
    <= eventHeat([{ source: 'A', created_at: at(0) }, { source: 'B', created_at: at(0) }], now));
});

test('the representative is the most authoritative clean report', () => {
  const members = [
    { id: 1, tier: 'T2', score: 90, noise: '', created_at: '2026-10-06T01:00:00Z' },
    { id: 2, tier: 'T1', score: 60, noise: '', created_at: '2026-10-06T03:00:00Z' },
    { id: 3, tier: 'T1', score: null, noise: '合集', created_at: '2026-10-06T00:00:00Z' },
  ];
  assert.equal(pickRepresentative(members).id, 2);
});

test('the representative is the report that says who did what, and the page shows the selection score', () => {
  // 线上 404033：专栏 30 分，摘要没说出谁做了什么，却因为级别更高当了门面
  const column = {
    id: 404033, tier: 'T1_5', score: 30, noise: '', source: 'Interconnects',
    title: '不依赖Jensen Huang的开源AI',
    summary: '一次斩首式的核心管理层大换血，是时候启动重建工作了。',
    created_at: '2026-11-14T12:23:00Z',
  };
  const wire = {
    id: 401568, tier: 'T2', score: 76, noise: '', source: 'TechCrunch',
    title: 'Jensen Huang卸任引发外界质疑Nvidia的开源AI支持立场',
    summary: 'Jensen Huang辞职让行业质疑Nvidia对开源AI的投入承诺，涉及Hugging Face收购、开源权重模型等布局，公司正处于领导层过渡期。',
    created_at: '2026-11-12T18:39:00Z',
  };
  const official = {
    id: 9, tier: 'T1', score: 70, noise: '', source: 'NVIDIA',
    title: '英伟达宣布黄仁勋卸任，CFO克雷斯出任临时CEO',
    summary: '英伟达宣布黄仁勋卸任CEO，由CFO克雷斯出任临时CEO。',
    created_at: '2026-11-13T01:00:00Z',
  };
  assert.equal(statesWhoDidWhat(column), false);
  assert.equal(statesWhoDidWhat(wire), true);
  assert.equal(pickRepresentative([column, wire]).id, wire.id);
  // 说得一样清楚时，官方一手优先，即使媒体分更高
  assert.equal(pickRepresentative([official, { ...wire, score: 90 }]).id, official.id);
  const face = { ...wire, rep: 1, event_score: 76, score: 30 };
  assert.equal(shownScore(face), 76);
  assert.equal(shownScore({ ...column, rep: 0, event_score: null }), 30);
  const status = latestDevelopment(wire, [column, {
    id: 404418, source: 'TechCrunch', created_at: '2026-11-15T00:08:00Z',
    title: 'TechCrunch发问：英伟达安全团队此前缺位',
    summary: '英伟达安全主管已于8月悄然离职，CEO黄仁勋卸任，前情报官员称这类漏洞属于日常讨论范畴。',
  }]);
  assert.equal(status.id, 404418);
  assert.match(status.summary, /黄仁勋/);
});
