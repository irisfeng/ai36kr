// RSS/Atom 聚合：多源抓取 → 入库 → 编辑（评分 / 写稿）→ 聚簇与排序
import Parser from 'rss-parser';
import db from './db.js';
import { classifyPost, isAiRelated, normalizeTitle } from './classify.js';
import { fetchOgImage } from './ogimage.js';
import { translateTitles, refixTitles, translateSummaries } from './translate.js';
import { editPosts } from './editor.js';
import { rankPosts } from './rank.js';
import { checkSourceAlerts } from './alert.js';
import { normalizeExternalHttpUrl } from './external-url.js';
import { FEEDS } from './sources.js';
import { isExpired, pruneExpired } from './retention.js';

export { FEEDS };

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 20000; // 部分官方源（MS Research/BAIR）响应慢，12s 常超时
const MAX_ITEMS_PER_FEED = 40;
export const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    'User-Agent': UA,
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  },
});

let lastRefreshAt = 0;
let refreshing = null;

export function getLastRefreshAt() {
  return lastRefreshAt;
}

function stripHtml(input) {
  return String(input || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')  // HTML 注释（会包住 style 块导致清理失效）
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function toIsoDate(item) {
  const raw = item.isoDate || item.pubDate || item.updated;
  const t = raw ? new Date(raw) : new Date();
  if (Number.isNaN(t.getTime())) return new Date().toISOString();
  // 个别源时间戳在未来，压回当前时间避免排序异常
  return t.getTime() > Date.now() + 5 * 60 * 1000 ? new Date().toISOString() : t.toISOString();
}

function recordStatus(feed, ok, itemCount, error = '') {
  // 状态记账自身绝不外抛：DB 抖动（hrana 写失败不重试是设计）不应中止整轮聚合
  try {
    // 连续失败计数：成功清零，失败 +1（健康告警按 fail_streak 判断）
    if (ok) {
      db.prepare('UPDATE source_status SET fail_streak = 0 WHERE name = ?').run(feed.name);
    }
    db.prepare(
      `INSERT INTO source_status (name, home, url, ok, last_fetch, item_count, error, fail_streak)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         ok = excluded.ok, last_fetch = excluded.last_fetch,
         item_count = excluded.item_count, error = excluded.error,
         fail_streak = CASE WHEN excluded.ok THEN 0 ELSE source_status.fail_streak + 1 END`
    ).run(feed.name, feed.home, feed.url, ok, new Date().toISOString(), itemCount, error.slice(0, 200), ok ? 0 : 1);
  } catch (e) {
    console.warn(`[听潮] 源状态记账失败（DB，不影响本轮）${feed.name}:`, e?.message || e);
  }
}

// DB 写入失败 ≠ 源抓取失败：打标后由 refreshGroup 分开记账
function runStmt(stmt, ...args) {
  try { return stmt.run(...args); }
  catch (e) { e.isDbError = true; throw e; }
}

// 从 RSS 条目提取缩略图：enclosure → media:* → 正文第一张 <img>
const IMG_TRACKER = /feedsportal|feedburner|~ff|flattr|doubleclick|analytics|pixel|1x1|spacer|stats\.wordpress|logo|icon-|avatar|placeholder|sprite/i;
function okImg(url) {
  return /^https?:\/\//i.test(url || '') && !IMG_TRACKER.test(url);
}
function extractFeedImage(item) {
  const enc = item.enclosure;
  if (enc?.url && okImg(enc.url) && (!enc.type || String(enc.type).startsWith('image'))) return enc.url;
  const media = []
    .concat(item['media:content'] || [])
    .concat(item['media:thumbnail'] || [])
    .concat(item['media:group']?.['media:content'] || []);
  for (const m of media) {
    const u = m?.$?.url || m?.url;
    if (u && okImg(u) && (!m.$?.medium || m.$.medium === 'image')) return u;
  }
  const html = String(item['content:encoded'] || item.content || '');
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m && okImg(m[1])) return m[1].replace(/&amp;/g, '&');
  return null;
}

// og:image 回填：只给精选条目补图（详情页与分享海报用；列表是纯文字的，不需要图）
// 每轮限量，'' 标记已尝试
async function backfillImages(limit = 12) {
  const rows = db
    .prepare(
      `SELECT id, url FROM posts
       WHERE image_url IS NULL AND url IS NOT NULL AND selected = 1
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit);
  if (!rows.length) return 0;
  const stmt = db.prepare('UPDATE posts SET image_url = ? WHERE id = ?');
  let filled = 0;
  // 4 路并发，单页 8s 超时，失败置 '' 不再重试
  for (let i = 0; i < rows.length; i += 4) {
    const batch = rows.slice(i, i + 4);
    const imgs = await Promise.all(batch.map((r) => fetchOgImage(r.url)));
    batch.forEach((r, j) => {
      stmt.run(imgs[j] || '', r.id);
      if (imgs[j]) filled++;
    });
  }
  return filled;
}

const insertPostStmt = () => db.prepare(
  `INSERT OR IGNORE INTO posts
     (title, title_norm, source, tier, category, summary, content, is_deep, up, down, created_at, url, is_external, source_home, image_url, ext_score)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1, ?, ?, ?)`
);

// 失败源指数退避：streak 越长重试间隔越久（10min × 2^streak，封顶 160min）
const BASE_INTERVAL_MS = 10 * 60 * 1000;
const BACKOFF_CAP = 16;

function backoffRemaining(feedName) {
  const row = db.prepare('SELECT fail_streak, last_fetch FROM source_status WHERE name = ?').get(feedName);
  if (!row || !row.fail_streak || !row.last_fetch) return 0;
  const interval = Math.min(2 ** row.fail_streak, BACKOFF_CAP) * BASE_INTERVAL_MS;
  const remaining = interval - (Date.now() - new Date(row.last_fetch).getTime());
  return Math.max(0, remaining);
}

// 解析容错：个别源偶发未转义的裸 &（如 "R&D" 混进 XML），严格解析直接报错。
// 命中此类错误时抓回原文，把裸 & 转成 &amp; 后用 parseString 重试
async function parseFeed(url) {
  try {
    return await parser.parseURL(url);
  } catch (e) {
    if (!/invalid character|entity/i.test(String(e?.message || ''))) throw e;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8' },
        signal: ctrl.signal,
      });
      if (!res.ok) throw e;
      const xml = (await res.text())
        .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');
      return await parser.parseString(xml);
    } finally {
      clearTimeout(timer);
    }
  }
}

// 主备链抓取：主 URL 失败依次试备选；每个 URL 失败即时重试一次（抗网络抖动）
async function parseWithFallback(feed) {
  const urls = [feed.url, ...(feed.fallbacks || [])];
  let lastError = null;
  for (const url of urls) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
        const parsed = await parseFeed(url);
        if (attempt > 0 || url !== feed.url) {
          console.log(`[听潮] ${feed.name} 经${url !== feed.url ? '备选' : '重试'}恢复`);
        }
        return parsed;
      } catch (e) {
        lastError = e;
      }
    }
  }
  throw lastError;
}

async function fetchFeed(feed) {
  const parsed = await parseWithFallback(feed);
  const stmt = insertPostStmt();
  let inserted = 0;
  for (const item of (parsed.items || []).slice(0, MAX_ITEMS_PER_FEED)) {
    const url = normalizeExternalHttpUrl(item.link);
    const title = stripHtml(item.title).slice(0, 200);
    if (!url || !title) continue;
    // 已过保留期的旧文不入库：入了也会被本轮的清理删掉，下一轮再入，白白占远端往返
    const createdAt = toIsoDate(item);
    if (isExpired(createdAt, !!feed.deep)) continue;
    // hnrss 的 description 是「Article URL / Comments URL / Points」模板，
    // 提炼为社区热度信息，分数存为外部热度信号
    let hnPoints = 0;
    const summary = (() => {
      if (feed.name === 'Hacker News') {
        const raw = stripHtml(item.content || item['content:encoded'] || '');
        const pts = raw.match(/Points:\s*(\d+)/i);
        const cmts = raw.match(/#\s*Comments:\s*(\d+)/i);
        hnPoints = pts ? Number(pts[1]) : 0;
        return pts ? `HN 热议 · ${pts[1]} 分 / ${cmts ? cmts[1] : 0} 条评论` : '';
      }
      // 「点击查看原文」这类占位不是摘要
      return stripHtml(item.contentSnippet || item.summary || item.content || item['content:encoded'])
        .replace(/点击查看原文\s*>?/g, '').trim().slice(0, 300);
    })();
    // 泛科技源只放行 AI 相关条目，避免非 AI 科技新闻污染信息流
    if (feed.filterAI && !isAiRelated(title, summary)) continue;
    const category = classifyPost(title, summary || title);
    const content = (summary || title) + '\n\n原文：' + url;
    // 同一件事的多家报道不再丢弃：全部入库，由 lib/rank.js 聚成事件（精确同题仍由 title_norm 索引去重）
    const r = runStmt(stmt, title, normalizeTitle(title), feed.name, feed.tier || 'T2', category, summary || title, content, feed.deep ? 1 : 0, createdAt, url, feed.home, extractFeedImage(item), hnPoints);
    inserted += Number(r.changes);
  }
  return inserted;
}

async function refreshGroup(feeds, fetcher) {
  // 限流并发：serverless 单实例带宽有限，全量并发会互相拖垮导致集体超时
  // 失败源指数退避：还在退避窗口内的源本轮跳过，给对端恢复时间
  const active = [];
  let backoffCount = 0;
  for (const feed of feeds) {
    if (backoffRemaining(feed.name) > 0) backoffCount++;
    else active.push(feed);
  }
  if (backoffCount) console.log(`[听潮] ${backoffCount} 个源处于退避期，本轮跳过`);
  const results = [];
  const POOL = 10;
  for (let i = 0; i < active.length; i += POOL) {
    const batch = active.slice(i, i + POOL);
    const settled = await Promise.allSettled(
      batch.map(async (feed) => {
        const inserted = await fetcher(feed);
        recordStatus(feed, 1, inserted);
        return { name: feed.name, inserted };
      })
    );
    results.push(...settled);
  }
  let totalNew = 0;
  let okCount = 0;
  let dbErrors = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      okCount++;
      totalNew += r.value.inserted;
    } else {
      const msg = r.reason?.code || r.reason?.message || String(r.reason);
      if (r.reason?.isDbError) {
        // DB 写入失败：源无辜，不计 fail_streak、不进退避；下轮正常重抓
        dbErrors++;
        console.warn(`[听潮] 数据库写入失败（不计入源失败）${active[i].name}: ${msg}`);
      } else {
        recordStatus(active[i], 0, 0, msg);
        console.warn(`[听潮] 源抓取失败 ${active[i].name}: ${msg}`);
      }
    }
  });
  return { totalNew, okCount, backoffCount, dbErrors };
}

function step(label, fn) {
  // 每个环节各自兜底：一步失败不影响后面的步骤，也不中止整轮
  return Promise.resolve().then(fn).catch((e) => {
    console.warn(`[听潮] ${label}异常:`, e?.message || e);
    return null;
  });
}

async function refreshAll() {
  const { totalNew, okCount, backoffCount, dbErrors } = await refreshGroup(FEEDS, fetchFeed);
  lastRefreshAt = Date.now();
  console.log(
    `[听潮] 聚合完成：+${totalNew} 条，${okCount}/${FEEDS.length} 个源在线${backoffCount ? `，${backoffCount} 个退避中` : ''}${dbErrors ? `，⚠️ ${dbErrors} 个 DB 写失败` : ''}`
  );

  // 旧内容清理：没入选的留 30 天（长文留 90 天），入选过的事件一直留着
  await step('清理', () => {
    const pruned = pruneExpired(db);
    if (pruned) console.log(`[听潮] 旧内容清理 -${pruned}`);
  });

  // ① 先排一遍：标出噪声（行情 / 活动 / 合集），后面的模型环节不为它们花钱
  await step('预筛', () => rankPosts(db));

  // ② 编辑：评分 + 中文标题 + 答案先行的摘要（一次模型调用；无密钥时跳过）
  await step('编辑', async () => {
    const { edited, failed } = await editPosts(db, process.env.VERCEL ? 18 : 60);
    if (edited || failed) console.log(`[听潮] 编辑 +${edited}${failed ? `，失败 ${failed}` : ''}`);
  });

  // ③ 兜底翻译：编辑环节没覆盖到的外文标题 / 摘要（无密钥时走机翻）
  await step('标题翻译', async () => {
    const zh = await translateTitles(db, process.env.VERCEL ? 12 : 20);
    if (zh) console.log(`[听潮] 标题中文化 +${zh}`);
  });
  await step('摘要翻译', async () => {
    const zs = await translateSummaries(db, process.env.VERCEL ? 8 : 15);
    if (zs) console.log(`[听潮] 摘要中文化 +${zs}`);
  });
  await step('译文校正', async () => {
    const fixed = await refixTitles(db);
    if (fixed) console.log(`[听潮] 存量译文校正 ${fixed} 条`);
  });

  // ④ 再排一遍：这时有了中文标题和评分，聚簇、入选、热度以这一遍为准
  const ranked = await step('排序', () => rankPosts(db));
  if (ranked) console.log(`[听潮] 近 10 天 ${ranked.events} 个事件，精选 ${ranked.selected}，噪声 ${ranked.noise}（更新 ${ranked.updated} 行）`);

  await step('缩略图回填', async () => {
    const imgs = await backfillImages(process.env.VERCEL ? 6 : 30);
    if (imgs) console.log(`[听潮] 缩略图回填 +${imgs}`);
  });

  // 源健康告警：连续失败自动开 GitHub Issue
  await step('源告警', async () => {
    const alerted = await checkSourceAlerts(db);
    if (alerted) console.warn(`[听潮] 新建 ${alerted} 个源告警 issue`);
  });
  return { totalNew, okCount, dbErrors, ...(ranked || {}) };
}

// 并发去重：同一时间只跑一轮
export function refresh() {
  if (!refreshing) {
    refreshing = refreshAll()
      .catch((e) => console.warn('[听潮] 聚合异常:', e?.message || e))
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

// 距上次抓取超过 interval 时触发后台刷新（不阻塞调用方）；返回是否触发
// serverless 冷启动内存为 0：先查 source_status 表里的真实抓取时间，避免每个实例都刷
export function refreshIfStale(interval = REFRESH_INTERVAL_MS) {
  let last = lastRefreshAt;
  if (!last) {
    const row = db.prepare('SELECT MAX(last_fetch) AS m FROM source_status').get();
    last = row?.m ? new Date(row.m).getTime() : 0;
    if (last) lastRefreshAt = last;
  }
  if (Date.now() - last < interval || refreshing) return false;
  if (process.env.VERCEL) {
    // serverless 下响应结束后实例会被冻结，进程内后台抓取不可靠；
    // 改为触发独立的 /api/refresh 函数（maxDuration=60，独立生命周期跑完整轮）
    const origin = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    if (origin) {
      fetch(`${origin}/api/refresh`, { headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {} })
        .catch(() => {});
      lastRefreshAt = Date.now();
      return true;
    }
  }
  refresh();
  return true;
}

// instrumentation register() 调用：启动即抓一次 + 每 10 分钟一轮
export function startAggregation() {
  if (globalThis.__aikrAggStarted) return;
  globalThis.__aikrAggStarted = true;
  refresh();
  const timer = setInterval(() => refresh(), REFRESH_INTERVAL_MS);
  timer.unref?.();
  console.log(`[听潮] RSS 聚合已启动，每 ${REFRESH_INTERVAL_MS / 60000} 分钟刷新`);
}
