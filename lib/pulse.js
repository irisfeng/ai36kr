// 「AI 脉搏」数据：今日新增、热词、各源在线状态
import db from './db.js';
import { hotWords } from './keywords.js';
import { FEEDS, getLastRefreshAt } from './rss.js';
import { beijingNow } from './time.js';
import { cached } from './cache.js';

// 脉搏随全站 layout 每页渲染一次：60s 进程缓存挡掉每页 4 次远端往返
export function getPulse() {
  return cached('pulse', 60 * 1000, computePulse);
}

function computePulse() {
  // 「今日新增」按北京日历日（UTC+8）起算，与全站时间显示统一
  const bjMidnight = beijingNow();
  bjMidnight.setUTCHours(0, 0, 0, 0);
  const dayStart = new Date(bjMidnight.getTime() - 8 * 3600000).toISOString();
  const { c: postCount } = db.prepare('SELECT COUNT(*) AS c FROM posts WHERE created_at >= ?').get(dayStart);
  const { c: flashCount } = db.prepare('SELECT COUNT(*) AS c FROM flashes WHERE created_at >= ?').get(dayStart);
  const todayCount = postCount + flashCount;
  // 热词窗口保持滚动 24h：避免北京凌晨「今日」刚清零时热词空白
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
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
