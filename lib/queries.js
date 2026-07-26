import db from './db';

// HN 风格热度分：(up - down) / pow(age_hours + 2, 1.5)
export function hotScore(post) {
  const ageHours = Math.max(0, (Date.now() - new Date(post.created_at).getTime()) / 3600000);
  return (post.up - post.down) / Math.pow(ageHours + 2, 1.5);
}

const WITH_COMMENT_COUNT = `
  SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
  FROM posts p
`;

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

export function listPosts({ sort = 'hot', cat = '', q = '', sinceHours = 0, token = '' } = {}) {
  const where = [];
  const params = [];
  if (cat) { where.push('p.category = ?'); params.push(cat); }
  if (q) { where.push('(p.title LIKE ? OR p.summary LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (sinceHours > 0) {
    where.push('p.created_at >= ?');
    params.push(new Date(Date.now() - sinceHours * 3600 * 1000).toISOString());
  }
  if (sort === 'deep') where.push('p.is_deep = 1');

  const sql = WITH_COMMENT_COUNT + (where.length ? ` WHERE ${where.join(' AND ')}` : '');
  let rows = db.prepare(sql).all(...params);

  if (sort === 'hot') {
    // 热度相同（如都是 0 票）时新的在前，保证信息流新鲜感
    rows = rows
      .map((r) => ({ ...r, _score: hotScore(r) }))
      .sort((a, b) => (b._score - a._score) || (a.created_at < b.created_at ? 1 : -1));
  } else {
    rows = rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  return attachReactions(rows.map(({ _score, ...r }) => r), token);
}

export function getPost(id, token = '') {
  const post = db.prepare(WITH_COMMENT_COUNT + ' WHERE p.id = ?').get(id);
  if (!post) return null;
  const [withReactions] = attachReactions([post], token);
  return { ...withReactions, paragraphs: post.content.split('\n\n').filter(Boolean) };
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

export function listFlashes() {
  return db.prepare('SELECT * FROM flashes ORDER BY created_at DESC').all();
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
    'SELECT id, title, up, down FROM posts WHERE created_at >= ? ORDER BY (up - down) DESC, created_at DESC LIMIT ?'
  ).all(since, limit);
}

export function latestFlashes(limit = 5) {
  return db.prepare('SELECT * FROM flashes ORDER BY created_at DESC LIMIT ?').all(limit);
}

export function topProducts(limit = 3) {
  return db.prepare('SELECT * FROM products ORDER BY up DESC LIMIT ?').all(limit);
}
