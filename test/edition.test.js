import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEdition } from '../lib/edition.js';
import { inventsNumbers, parseEditorReply } from '../lib/editor.js';

let seq = 0;
const item = (score, source, extra = {}) => ({
  id: ++seq, title: `t${seq}`, source, tier: 'T2', category: '大模型', score, src_count: 1,
  ext_score: 0, selected: 1, rep: 1, noise: '', created_at: '2026-10-06T00:00:00Z', ...extra,
});

test('edition leads with the most important event and caps each source', () => {
  seq = 0;
  const posts = [
    item(80, 'A'), item(79, 'A'), item(78, 'A'), item(77, 'A'),
    item(90, 'B', { category: 'Agent' }),
    item(70, 'C'), item(69, 'D', { category: 'AI创投' }), item(68, 'E'),
    item(99, 'F', { noise: '活动' }),
    item(60, 'G', { selected: 0 }),
  ];
  const e = buildEdition(posts);
  assert.equal(e.headline.source, 'B');
  assert.equal(e.highlights.length, 3);
  // 同一信源正文最多 2 条，多出来的降到简讯
  assert.equal(e.main.filter((p) => p.source === 'A').length, 2);
  assert.deepEqual(e.briefs.map((p) => p.source), ['A', 'A', 'G']);
  // 噪声不上日报；分节按固定的分类顺序
  assert.equal([...e.main, ...e.briefs].some((p) => p.noise), false);
  assert.deepEqual(e.sections.map(([cat]) => cat), ['大模型', 'AI创投']);
  assert.equal(e.total, 9);
});

test('a slow day is topped up from the best unselected events', () => {
  seq = 0;
  const e = buildEdition([
    item(80, 'A'),
    ...['B', 'C', 'D', 'E', 'F', 'G'].map((s, i) => item(50 - i, s, { selected: 0 })),
  ]);
  assert.equal(e.main.length, 5);
  assert.equal(e.headline.source, 'A');
  assert.deepEqual(e.briefs.map((p) => p.source), ['F', 'G']);
  assert.equal(buildEdition([]).headline, null);
});

test('editor replies are accepted only when complete and well-formed', () => {
  const ok = parseEditorReply('```json\n[{"i":1,"score":140,"title":" B ","summary":"s"},{"i":0,"score":61.6,"title":"A","summary":""}]\n```', 2);
  assert.deepEqual(ok, [
    { score: 62, title: 'A', summary: '' },
    { score: 100, title: 'B', summary: 's' },
  ]);
  assert.equal(parseEditorReply('[{"i":0,"score":50}]', 2), null);
  assert.equal(parseEditorReply('[{"i":0,"score":50},{"i":0,"score":50}]', 2), null);
  assert.equal(parseEditorReply('[{"i":0,"score":"高"}]', 1), null);
  assert.equal(parseEditorReply('好的，以下是结果', 1), null);
});

test('summaries that introduce numbers absent from the source are rejected', () => {
  const source = 'Anthropic与Akamai达成116亿美元的AI算力协议 为期七年';
  assert.equal(inventsNumbers('Anthropic 将向 Akamai 支付 116 亿美元。', source), false);
  assert.equal(inventsNumbers('协议总额 116 亿美元，覆盖 30 个数据中心。', source), true);
  assert.equal(inventsNumbers('为期 7 年。', source), false);
});
