import db from './db.js';
import { normalizePostPagination } from './pagination.js';

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

export function listPosts({
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
    // libsql 本地引擎不保证提供 pow/sqrt。先由 SQL 取固定大小的最新
    // 候选集，再复用 hotScore 精确排序，避免旧实现的无界全表读取。
    const candidates = db.prepare(
      `${filteredSql} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
    ).all(...params, MAX_HOT_CANDIDATES);
    rows = candidates
      .map((post) => ({ ...post, _score: hotScore(post) }))
      .sort((a, b) => (
        (b._score - a._score)
        || b.created_at.localeCompare(a.created_at)
        || (b.id - a.id)
      ))
      .slice(pagination.offset, pagination.offset + pagination.limit)
      .map(({ _score, ...post }) => post);
  } else {
    rows = db.prepare(
      `${filteredSql} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    ).all(...params, pagination.limit, pagination.offset);
  }
  return attachReactions(rows, token);
}

export function getPost(id, token = '') {
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
  const where = before ? 'WHERE created_at < ?' : '';
  const params = before ? [before] : [];
  const lim = limit > 0 ? ` LIMIT ${Math.min(limit, 500)}` : '';
  return db.prepare(`SELECT * FROM flashes ${where} ORDER BY created_at DESC${lim}`).all(...params);
}

export function listProducts(period = 'today') {
  const rows = db.prepare('SELECT * FROM products ORDER BY up DESC').all();
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const filtered = period === 'week'
    ? rows
    : rows.filter((p) => new Date(p.created_at).getTime() >= cutoff);
  // 今日不足 3 个时回退到本周，保证榜单有内容
  const list = filtered.length >= 3 ? filtered : rows;
  return list.slice(0, 10);
}

export function weeklyTopPosts(limit = 5) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  return db.prepare(
    'SELECT id, title, title_zh, up, down FROM posts WHERE created_at >= ? ORDER BY (up - down) DESC, created_at DESC LIMIT ?'
  ).all(since, limit);
}

export function latestFlashes(limit = 5) {
  return db.prepare('SELECT * FROM flashes ORDER BY created_at DESC LIMIT ?').all(limit);
}

export function topProducts(limit = 3) {
  return db.prepare('SELECT * FROM products ORDER BY up DESC LIMIT ?').all(limit);
}
