// 排序环节：把近 10 天的条目重算一遍——噪声、事件归属、代表稿、独立信源数、热度、是否精选。
// 全部规则是 lib/editorial.js 与 lib/events.js 里的纯函数；这里只负责读库、比对、把变化写回。
// 可重复执行：同样的输入得到同样的结果，没有变化就一行不写。
import { assignEvents, EVENT_WINDOW_MS } from './events.js';
import { detectNoise, eventHeat, isSelected, pickRepresentative, tierOf } from './editorial.js';
import { tierOfSource } from './sources.js';
import { bustCache } from './cache.js';

const WINDOW_MS = 10 * 86400000;
const NOISE_LABELS = new Set(['', '行情', '活动', '合集', '推广']);

// 纯计算：rows → 每行应有的状态。导出供测试与离线评估用
export function computeRanking(rows, now = Date.now()) {
  const posts = rows.map((r) => ({
    ...r,
    tier: tierOf(r.tier || tierOfSource(r.source)),
    // 原题和中文题都过一遍规则：外文源的推广词只在原题里
    noise: detectNoise(r.title, r.summary) || detectNoise(r.title_zh || '', r.summary_zh || ''),
  }));
  // 窗口之外再留一天余量的老条目冻结归属，只作为被并入的对象
  const eventOf = assignEvents(posts, { frozenBefore: now - EVENT_WINDOW_MS - 86400000 });
  const groups = new Map();
  for (const p of posts) {
    const eventId = eventOf.get(p.id);
    if (!groups.has(eventId)) groups.set(eventId, []);
    groups.get(eventId).push(p);
  }
  const next = new Map();
  for (const [eventId, members] of groups) {
    const rep = pickRepresentative(members);
    const clean = members.filter((m) => !m.noise);
    const sourceCount = new Set((clean.length ? clean : members).map((m) => m.source)).size;
    const scores = clean.map((m) => m.score).filter((s) => Number.isFinite(s));
    const selected = isSelected({
      // 事件的评分取成员里最高的一篇：同一件事，写得最清楚的那篇说了算
      score: scores.length ? Math.max(...scores) : null,
      tier: rep.tier,
      sourceCount,
      extScore: Math.max(0, ...clean.map((m) => m.ext_score || 0)),
      noise: rep.noise,
    });
    const heat = rep.noise ? 0 : eventHeat(clean, now);
    for (const m of members) {
      const isRep = m.id === rep.id;
      next.set(m.id, {
        tier: m.tier,
        noise: m.noise,
        event_id: eventId,
        rep: isRep ? 1 : 0,
        selected: isRep && selected ? 1 : 0,
        src_count: isRep ? sourceCount : 1,
        hot_score: isRep ? heat : 0,
      });
    }
  }
  return next;
}

export function rankPosts(db, now = Date.now()) {
  const rows = db.prepare(
    `SELECT id, title, title_zh, summary, summary_zh, source, tier, created_at, ext_score, score,
            noise, event_id, rep, selected, src_count, hot_score
     FROM posts WHERE created_at >= ? ORDER BY created_at`
  ).all(new Date(now - WINDOW_MS).toISOString());
  const next = computeRanking(rows, now);

  const statements = [];
  let events = 0, selected = 0, noise = 0;
  for (const r of rows) {
    const n = next.get(r.id);
    if (n.rep) events++;
    if (n.selected) selected++;
    if (n.noise) noise++;
    const same = r.tier === n.tier && r.noise === n.noise && r.event_id === n.event_id
      && r.rep === n.rep && r.selected === n.selected && r.src_count === n.src_count
      && Math.abs((r.hot_score || 0) - n.hot_score) < 0.01;
    if (same) continue;
    // 值全部来自代码里的常量集合与数字，直接拼进 SQL 以便成批执行（远端一批只一次往返）
    if (!(n.tier in { T1: 1, T1_5: 1, T2: 1 }) || !NOISE_LABELS.has(n.noise)) continue;
    statements.push(
      `UPDATE posts SET tier='${n.tier}', noise='${n.noise}', event_id=${Number(n.event_id)}, rep=${n.rep}, `
      + `selected=${n.selected}, src_count=${Number(n.src_count)}, hot_score=${Number(n.hot_score)} WHERE id=${Number(r.id)}`
    );
  }
  for (let i = 0; i < statements.length; i += 100) {
    db.exec(statements.slice(i, i + 100).join(';\n'));
  }
  if (statements.length) bustCache();
  return { events, selected, noise, updated: statements.length };
}
