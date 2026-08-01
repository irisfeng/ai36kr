import db from './db.js';
import { normalizePostPagination } from './pagination.js';
import { cached } from './cache.js';

// 读路径 30s 进程内缓存：页面 SSR 的重复远端往返（TTFB 主因）由暖实例缓存挡掉。
// 带 token 的调用（要实时 my_reactions）与写操作后的即时一致性不受影响。

// HN 风格热度分：(up - down) / pow(age_hours + 2, 1.5)
// 外部信号（HN 分数）开平方后计入，500 分≈22 票、100 分≈10 票，不喧宾夺主
export function hotScore(post) {
  const ageHours = Math.max(0, (Date.now() - new Date(post.created_at).getTime()) / 3600000);
  const ext = Math.sqrt(post.ext_score || 0);
  return (post.up - post.down + ext) / Math.pow(ageHours + 2, 1.5);
}

const WITH_COMMENT_COUNT = `
  SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
  FROM posts p
`;
const MAX_HOT_CANDIDATES = 1000;
const QUERY_TTL_MS = 30 * 1000;

// 批量取 reaction 计数：{ postId: { '🔥': n, ... } }
export function reactionCountsFor(postIds) {
  if (!postIds.length) return {};
  const marks = postIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT post_id, emoji, COUNT(*) AS c FROM reactions WHERE post_id IN (${marks}) GROUP BY post_id, emoji`
  ).all(...postIds);
  const map = {};
  for (const r of rows) {
    if (!map[r.post_id]) map[r.post_id] = {};
    map[r.post_id][r.emoji] = r.c;
  }
  return map;
}

// 某 token 在这些帖子下已选的 emoji：{ postId: ['🔥', ...] }
export function myReactionsFor(postIds, token) {
  if (!postIds.length || !token) return {};
  const marks = postIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT post_id, emoji FROM reactions WHERE token = ? AND post_id IN (${marks})`
  ).all(token, ...postIds);
  const map = {};
  for (const r of rows) {
    if (!map[r.post_id]) map[r.post_id] = [];
    map[r.post_id].push(r.emoji);
  }
  return map;
}

export function attachReactions(posts, token = '') {
  const ids = posts.map((p) => p.id);
  const counts = reactionCountsFor(ids);
  const mine = myReactionsFor(ids, token);
  return posts.map((p) => ({
    ...p,
    reactions: counts[p.id] || {},
    ...(token ? { my_reactions: mine[p.id] || [] } : {}),
  }));
}

export function listPosts(opts = {}) {
  // 归一化出规范缓存键：缺省值一致、字段顺序固定，避免同查询多键
  const p = { sort: 'hot', cat: '', q: '', sinceHours: 0, token: '', limit: undefined, offset: undefined, ...opts };
  if (p.token) return queryPosts(p); // 带 token 要实时 my_reactions，不缓存
  return cached(`lp:${JSON.stringify(p)}`, QUERY_TTL_MS, () => queryPosts(p));
}

function queryPosts({
  sort = 'hot',
  cat = '',
  q = '',
  sinceHours = 0,
  token = '',
  limit,
  offset,
} = {}) {
  const pagination = normalizePostPagination({ limit, offset });
  const where = [];
  const params = [];
  if (cat) { where.push('p.category = ?'); params.push(cat); }
  if (q) { where.push('(p.title LIKE ? OR p.summary LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (sinceHours > 0) {
    where.push('p.created_at >= ?');
    params.push(new Date(Date.now() - sinceHours * 3600 * 1000).toISOString());
  }
  if (sort === 'deep') where.push('p.is_deep = 1');

  const filteredSql = WITH_COMMENT_COUNT
    + (where.length ? ` WHERE ${where.join(' AND ')}` : '');
  let rows;
  if (sort === 'hot') {
    // 热度已在聚合/投票时预计算进 hot_score 列：直接 SQL 排序分页，
    // 不再每次访问触发全表 Node 排序（Turso Rows Read 与 CPU 双降）
    const ordered = db.prepare(
      `${filteredSql} ORDER BY p.hot_score DESC, p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`
    ).all(...params, pagination.limit, pagination.offset);
    return attachReactions(ordered, token);
  } else {
    rows = db.prepare(
      `${filteredSql} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    ).all(...params, pagination.limit, pagination.offset);
  }
  return attachReactions(rows, token);
}

export function getPost(id, token = '') {
  if (token) return queryPost(id, token); // 带 token 要实时 my_reactions，不缓存
  return cached(`gp:${id}`, QUERY_TTL_MS, () => queryPost(id, ''));
}

function queryPost(id, token = '') {
  const post = db.prepare(WITH_COMMENT_COUNT + ' WHERE p.id = ?').get(id);
  if (!post) return null;
  const [withReactions] = attachReactions([post], token);
  // 聚合帖正文 = 摘要 + 原文链接：摘要已有中译时正文同步用译文展示
  //（content 不另译——与摘要同文，另译是双份存储 + 重复 LLM 调用）
  const body = post.is_external && post.summary_zh
    ? `${post.summary_zh}\n\n原文：${post.url}`
    : post.content;
  return { ...withReactions, paragraphs: body.split('\n\n').filter(Boolean) };
}

export function listComments(postId) {
  const rows = db.prepare(
    'SELECT * FROM comments WHERE post_id = ? ORDER BY up DESC, created_at ASC'
  ).all(postId);
  const top = rows.filter((r) => !r.parent_id);
  const replies = rows.filter((r) => r.parent_id);
  return top.map((t) => ({
    ...t,
    replies: replies
      .filter((r) => r.parent_id === t.id)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
  }));
}

export function listFlashes({ before = '', limit = 0 } = {}) {
  return cached(`lf:${before}|${limit}`, QUERY_TTL_MS, () => {
    const where = before ? 'WHERE created_at < ?' : '';
    const params = before ? [before] : [];
    const lim = limit > 0 ? ` LIMIT ${Math.min(limit, 500)}` : '';
    return db.prepare(`SELECT * FROM flashes ${where} ORDER BY created_at DESC${lim}`).all(...params);
  });
}

export function listProducts(period = 'today') {
  return cached(`lprod:${period}`, QUERY_TTL_MS, () => {
    const rows = db.prepare('SELECT * FROM products ORDER BY up DESC').all();
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const filtered = period === 'week'
      ? rows
      : rows.filter((p) => new Date(p.created_at).getTime() >= cutoff);
    // 今日不足 3 个时回退到本周，保证榜单有内容
    const list = filtered.length >= 3 ? filtered : rows;
    return list.slice(0, 10);
  });
}

export function weeklyTopPosts(limit = 5) {
  return cached(`wtp:${limit}`, QUERY_TTL_MS, () => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    return db.prepare(
      'SELECT id, title, title_zh, up, down FROM posts WHERE created_at >= ? ORDER BY (up - down) DESC, created_at DESC LIMIT ?'
    ).all(since, limit);
  });
}

export function latestFlashes(limit = 5) {
  return cached(`lat:${limit}`, QUERY_TTL_MS, () =>
    db.prepare('SELECT * FROM flashes ORDER BY created_at DESC LIMIT ?').all(limit)
  );
}

export function topProducts(limit = 3) {
  return cached(`tprod:${limit}`, QUERY_TTL_MS, () =>
    db.prepare('SELECT * FROM products ORDER BY up DESC LIMIT ?').all(limit)
  );
}
