import db from './db.js';
import { normalizePostPagination } from './pagination.js';
import { cached } from './cache.js';
import { buildEdition } from './edition.js';
import { FEEDS } from './sources.js';

// 读路径 30s 进程内缓存：页面 SSR 的重复远端往返（TTFB 主因）由暖实例缓存挡掉。
const QUERY_TTL_MS = 30 * 1000;

const postCols = (extScore = 'p.ext_score') => `p.id, p.title, p.title_zh, p.summary, p.summary_zh,
  p.source, p.source_home, p.tier, p.category, p.is_deep, p.created_at, p.url, p.is_external, p.image_url,
  p.score, ${extScore} AS ext_score, COALESCE(p.noise, '') AS noise, COALESCE(p.event_id, p.id) AS event_id,
  p.rep, p.selected, p.src_count, p.hot_score`;
const POST_COLS = postCols();
// 事件里最高的外部讨论分：HN 的热度记在 HN 那一篇上，而代表稿往往是别家
const EVENT_EXT_SCORE = 'COALESCE((SELECT MAX(m.ext_score) FROM posts m WHERE m.event_id = p.event_id), p.ext_score)';

// 列表的三种口径：
//   pick 精选：入选的事件，一件事一条（代表稿），按时间
//   hot  热点：近 48 小时按事件热度（有几家独立信源在报）
//   all  全部：抓到的每一条，不筛不并
export const SORTS = ['pick', 'hot', 'all'];
const SORT_ALIAS = { new: 'all', deep: 'all' }; // 旧版 API 的取值

export function normalizeSort(sort) {
  const s = SORT_ALIAS[sort] || sort;
  return SORTS.includes(s) ? s : 'pick';
}

// 给代表稿补上「同一事件的其他报道」：[{ id, source, url, title }]
function attachCoverage(posts) {
  const eventIds = posts.filter((p) => p.rep && p.src_count > 1).map((p) => p.event_id);
  if (!eventIds.length) return posts.map((p) => ({ ...p, coverage: [] }));
  const marks = eventIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, event_id, source, url, title, title_zh, created_at FROM posts
     WHERE event_id IN (${marks}) AND rep = 0 AND COALESCE(noise, '') = '' ORDER BY created_at`
  ).all(...eventIds);
  const byEvent = new Map();
  for (const r of rows) {
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    byEvent.get(r.event_id).push(r);
  }
  return posts.map((p) => ({ ...p, coverage: (p.rep && byEvent.get(p.event_id)) || [] }));
}

export function listPosts(opts = {}) {
  // 归一化出规范缓存键：缺省值一致、字段顺序固定，避免同查询多键
  const p = {
    sort: normalizeSort(opts.sort), cat: opts.cat || '', q: opts.q || '',
    sinceHours: opts.sinceHours || 0, limit: opts.limit, offset: opts.offset,
  };
  return cached(`lp:${JSON.stringify(p)}`, QUERY_TTL_MS, () => queryPosts(p));
}

function queryPosts({ sort, cat, q, sinceHours, limit, offset }) {
  const pagination = normalizePostPagination({ limit, offset });
  const where = [];
  const params = [];
  // 搜索总是搜全部：读者找的是某条消息，不该被「没入选」挡住
  const scope = q ? 'all' : sort;
  if (scope === 'pick') where.push('p.rep = 1 AND p.selected = 1');
  if (scope === 'hot') where.push("p.rep = 1 AND p.hot_score > 0 AND COALESCE(p.noise, '') = ''");
  if (cat) { where.push('p.category = ?'); params.push(cat); }
  if (q) {
    where.push('(p.title LIKE ? OR p.title_zh LIKE ? OR p.summary LIKE ? OR p.summary_zh LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (sinceHours > 0) {
    where.push('p.created_at >= ?');
    params.push(new Date(Date.now() - sinceHours * 3600 * 1000).toISOString());
  }
  const order = scope === 'hot'
    ? 'p.hot_score DESC, p.created_at DESC, p.id DESC'
    : 'p.created_at DESC, p.id DESC';
  const rows = db.prepare(
    `SELECT ${POST_COLS} FROM posts p${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${order} LIMIT ? OFFSET ?`
  ).all(...params, pagination.limit, pagination.offset);
  return attachCoverage(rows);
}

// 首页用：精选为空（新库刚水合、排序环节还没跑过）时退回最新，不给读者一张白纸
export function listPicks(limit = 60) {
  const picks = listPosts({ sort: 'pick', limit });
  return picks.length ? picks : listPosts({ sort: 'all', limit: Math.min(limit, 30) });
}

export function getPost(id) {
  return cached(`gp:${id}`, QUERY_TTL_MS, () => {
    const post = db.prepare(`SELECT ${POST_COLS} FROM posts p WHERE p.id = ?`).get(id);
    if (!post) return null;
    // 同一事件的其他报道（自己是代表稿就列其余成员，否则把代表稿也列进来）
    const coverage = db.prepare(
      `SELECT id, source, url, title, title_zh, tier, created_at FROM posts
       WHERE event_id = ? AND id != ? AND COALESCE(noise, '') = '' ORDER BY rep DESC, created_at LIMIT 12`
    ).all(post.event_id, post.id);
    return { ...post, coverage };
  });
}

// 日报：时间窗内的事件按 lib/edition.js 的规则编排
export function loadEdition({ start, end }) {
  return cached(`ed:${start}|${end}`, QUERY_TTL_MS, () => {
    const rows = db.prepare(
      `SELECT ${postCols(EVENT_EXT_SCORE)} FROM posts p
       WHERE p.rep = 1 AND p.created_at >= ? AND p.created_at < ?
       ORDER BY p.created_at DESC LIMIT 400`
    ).all(start, end);
    const edition = buildEdition(rows);
    const withCoverage = new Map(attachCoverage(edition.main).map((p) => [p.id, p]));
    const fill = (p) => withCoverage.get(p.id) || { ...p, coverage: [] };
    return {
      ...edition,
      headline: edition.headline && fill(edition.headline),
      highlights: edition.highlights.map(fill),
      sections: edition.sections.map(([cat, items]) => [cat, items.map(fill)]),
      main: edition.main.map(fill),
    };
  });
}

// 最近 24 小时的日报；整天没有内容时放宽到 48 小时（多半是数据链路问题，至少不空）
export function loadLatestEdition(now = Date.now()) {
  // 对齐到整分钟：同一分钟内的请求共用一份缓存
  const end = Math.floor(now / 60000) * 60000 + 60000;
  for (const hours of [24, 48]) {
    const edition = loadEdition({
      start: new Date(end - hours * 3600000).toISOString(),
      end: new Date(end).toISOString(),
    });
    if (edition.total > 0 || hours === 48) return { ...edition, windowHours: hours };
  }
  return null;
}

// 有日报可看的北京日历日（新到旧）：归档页的前后翻页、404 判定和站点地图都读这一份，
// 不让「前一天」一路翻进没有内容的空页。
// 长文源的旧文带着原始发布日期入库（最早到 2018 年），那些日子只有一两条，不算一期日报：
// 至少要有 minEvents 件事，和 lib/edition.js 里正文不少于 5 条的下限一致。
// 有精选的日子总是算：过了保留期只剩入选的事件，清淡的一天可能不到 5 件，归档不能因此消失
export function editionDays(minEvents = 5) {
  return cached(`days:${minEvents}`, 5 * 60 * 1000, () => db.prepare(
    `SELECT substr(datetime(created_at, '+8 hours'), 1, 10) AS day FROM posts
     WHERE rep = 1 AND COALESCE(noise, '') = '' GROUP BY day HAVING COUNT(*) >= ? OR SUM(selected) > 0 ORDER BY day DESC`
  ).all(minEvents).map((r) => r.day));
}

// 信源状态：页脚与 /api/status 用
export function sourceHealth() {
  return cached('health', 60 * 1000, () => {
    const rows = db.prepare('SELECT name, ok, last_fetch, error FROM source_status').all();
    const byName = new Map(rows.map((r) => [r.name, r]));
    const sources = FEEDS.map((f) => {
      const s = byName.get(f.name);
      return { name: f.name, home: f.home, tier: f.tier, ok: s ? !!s.ok : null, lastFetch: s?.last_fetch || null, error: s?.error || '' };
    });
    const lastFetch = sources.reduce((m, s) => (s.lastFetch && s.lastFetch > m ? s.lastFetch : m), '');
    return { total: sources.length, online: sources.filter((s) => s.ok).length, lastFetch: lastFetch || null, sources };
  });
}
