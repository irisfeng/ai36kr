// 「AI 脉搏」数据：今日新增、热词、各源在线状态
import db from './db';
import { hotWords } from './keywords';
import { FEEDS, getLastRefreshAt } from './rss';

export function getPulse() {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { c: postCount } = db.prepare('SELECT COUNT(*) AS c FROM posts WHERE created_at >= ?').get(since);
  const { c: flashCount } = db.prepare('SELECT COUNT(*) AS c FROM flashes WHERE created_at >= ?').get(since);
  const todayCount = postCount + flashCount;
  const recent = db.prepare('SELECT title, summary FROM posts WHERE created_at >= ?').all(since);

  const statusRows = db.prepare(
    'SELECT name, ok, last_fetch, item_count, error FROM source_status'
  ).all();
  const statusMap = new Map(statusRows.map((r) => [r.name, r]));
  // 各路由 bundle 各自持有 lib/rss 模块实例，内存中的 lastRefreshAt 不互通；
  // 统一以 source_status 表（跨 bundle 共享）的最大抓取时间为准
  const { lastFetch: lastDbFetch } = db.prepare(
    'SELECT MAX(last_fetch) AS lastFetch FROM source_status'
  ).get();
  // 以 FEEDS 清单为底，未抓过的源显示为待抓取（ok=null）
  const sources = FEEDS.map((f) => {
    const s = statusMap.get(f.name);
    return {
      name: f.name,
      home: f.home,
      ok: s ? !!s.ok : null,
      lastFetch: s?.last_fetch || null,
      itemCount: s?.item_count ?? 0,
      error: s?.error || '',
    };
  });

  return {
    todayCount,
    hotWords: hotWords(recent, 8),
    sources,
    lastRefresh: lastDbFetch || (getLastRefreshAt() ? new Date(getLastRefreshAt()).toISOString() : null),
  };
}
