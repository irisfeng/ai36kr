// RSS/Atom 聚合：多源抓取 → 去重入库 → 源状态记录
// 信息源清单参考了 GitHub 热门开源聚合项目（SuYxh/ai-news-aggregator 的 OPML、
// newsnow、aihot-site 等），全部经 curl 逐个实测可用（2026-07）。
import Parser from 'rss-parser';
import db from './db.js';
import { classifyPost, isAiRelated, normalizeTitle } from './classify.js';
import { fetchOgImage } from './ogimage.js';

// ---- 文章源（进 posts 流）----
// filterAI: 泛科技源只放行 AI 相关条目；deep: 长文源，进「深度长读」tab
export const FEEDS = [
  // -- 中文 --
  { name: '36氪', url: 'https://36kr.com/feed', home: 'https://36kr.com', filterAI: true },
  { name: '量子位', url: 'https://www.qbitai.com/feed', home: 'https://www.qbitai.com', deep: true },
  { name: '爱范儿', url: 'https://www.ifanr.com/feed', home: 'https://www.ifanr.com', filterAI: true, deep: true },
  { name: 'InfoQ', url: 'https://www.infoq.cn/feed', home: 'https://www.infoq.cn', filterAI: true },
  { name: 'SuperTechFans', url: 'https://www.supertechfans.com/cn/index.xml', home: 'https://www.supertechfans.com/cn/', filterAI: true },
  { name: '宝玉', url: 'https://baoyu.io/feed.xml', home: 'https://baoyu.io', filterAI: true, deep: true },
  { name: '阮一峰', url: 'http://feeds.feedburner.com/ruanyifeng', home: 'https://www.ruanyifeng.com/blog/', filterAI: true, deep: true },
  // -- 英文媒体 --
  { name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', home: 'https://techcrunch.com/category/artificial-intelligence/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', home: 'https://www.theverge.com/ai-artificial-intelligence' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', home: 'https://arstechnica.com', filterAI: true, deep: true },
  { name: 'MIT TR', url: 'https://www.technologyreview.com/feed/', home: 'https://www.technologyreview.com', filterAI: true, deep: true },
  { name: 'VentureBeat', url: 'https://venturebeat.com/category/ai/feed/', home: 'https://venturebeat.com/category/ai/' },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage', home: 'https://news.ycombinator.com', filterAI: true },
  // -- 官方博客 / 研究机构 --
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', home: 'https://openai.com/news' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', home: 'https://deepmind.google/blog' },
  { name: 'Google Research', url: 'https://research.google/blog/rss', home: 'https://research.google/blog/' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', home: 'https://huggingface.co/blog' },
  { name: 'Microsoft Research', url: 'https://www.microsoft.com/en-us/research/feed/', home: 'https://www.microsoft.com/en-us/research/' },
  { name: 'BAIR', url: 'https://bair.berkeley.edu/blog/feed.xml', home: 'https://bair.berkeley.edu/blog/', deep: true },
  // -- 深度专栏 --
  { name: 'Import AI', url: 'https://importai.substack.com/feed', home: 'https://importai.substack.com', deep: true },
  { name: 'Interconnects', url: 'https://www.interconnects.ai/feed', home: 'https://www.interconnects.ai', deep: true },
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', home: 'https://simonwillison.net', filterAI: true, deep: true },
  // -- 国际顶级专栏 / Newsletter（2026-07 实测）--
  { name: 'AI News', url: 'https://buttondown.email/ainews/rss', home: 'https://buttondown.email/ainews', deep: true },
  { name: 'Last Week in AI', url: 'https://lastweekin.ai/feed', home: 'https://lastweekin.ai', deep: true },
  { name: 'Ahead of AI', url: 'https://magazine.sebastianraschka.com/feed', home: 'https://magazine.sebastianraschka.com', deep: true },
  { name: 'One Useful Thing', url: 'https://www.oneusefulthing.org/feed', home: 'https://www.oneusefulthing.org', deep: true },
  { name: 'Latent Space', url: 'https://www.latent.space/feed', home: 'https://www.latent.space', deep: true },
  { name: 'Lilian Weng', url: 'https://lilianweng.github.io/index.xml', home: 'https://lilianweng.github.io', deep: true },
  { name: 'Chip Huyen', url: 'https://huyenchip.com/feed.xml', home: 'https://huyenchip.com', deep: true },
  { name: 'Eugene Yan', url: 'https://eugeneyan.com/rss/', home: 'https://eugeneyan.com', deep: true },
  { name: 'Hamel Husain', url: 'https://hamel.dev/index.xml', home: 'https://hamel.dev', deep: true },
  { name: 'Meta Engineering', url: 'https://engineering.fb.com/feed/', home: 'https://engineering.fb.com', filterAI: true, deep: true },
  // -- 中文补充 --
  { name: '钛媒体', url: 'https://www.tmtpost.com/rss.xml', home: 'https://www.tmtpost.com', filterAI: true },
];

// ---- 快讯源（短资讯，进 flashes 时间线）----
export const FLASH_FEEDS = [
  { name: 'Readhub', url: 'https://readhub.cn/rss', home: 'https://readhub.cn' },
  // RSSHub 公共实例的 36氪快讯路由（rsshub.app 已 403，bestblogs 实例实测可用）
  { name: '36氪快讯', url: 'https://rsshub.bestblogs.dev/36kr/newsflashes', home: 'https://36kr.com/newsflashes' },
  { name: '钛媒体快讯', url: 'https://www.tmtpost.com/feed', home: 'https://www.tmtpost.com' },
];

// ---- 新品源（进新品榜）----
export const PRODUCT_FEEDS = [
  { name: 'Product Hunt', url: 'https://www.producthunt.com/feed', home: 'https://www.producthunt.com' },
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 12000;
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
  db.prepare(
    `INSERT INTO source_status (name, home, url, ok, last_fetch, item_count, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       ok = excluded.ok, last_fetch = excluded.last_fetch,
       item_count = excluded.item_count, error = excluded.error`
  ).run(feed.name, feed.home, feed.url, ok, new Date().toISOString(), itemCount, error.slice(0, 200));
}

// 快讯自动打标：按内容关键词归类（展示色块用）
const FLASH_TAGS = [
  ['融资', ['融资', '投资', '估值', '收购', 'ipo', '上市', 'funding', 'raises', 'raised', 'acquire', 'billion', 'million']],
  ['政策', ['监管', '政策', '法案', '禁令', '起诉', '罚款', '制裁', 'regulation', 'ban', 'law', 'sues', 'court', 'ftc', 'eu ']],
  ['数据', ['报告', '数据', '榜单', '份额', '财报', '营收', '用户量', 'study', 'report', 'revenue', 'market share', 'survey']],
  ['人事', ['任命', '离职', '加入', '出任', '辞职', '创始人', 'ceo', 'cto', 'hires', 'joins', 'departs', 'steps down']],
];
export function tagFlash(text) {
  const t = String(text || '').toLowerCase();
  for (const [tag, words] of FLASH_TAGS) {
    if (words.some((w) => t.includes(w))) return tag;
  }
  return '发布';
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

// og:image 回填：RSS 无图的条目，抓原文页解析（每轮限量，'' 标记已尝试）
async function backfillImages(table, idColumn = 'id', limit = 12) {
  const rows = db
    .prepare(
      `SELECT ${idColumn} AS id, url FROM ${table}
       WHERE image_url IS NULL AND url IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit);
  if (!rows.length) return 0;
  const stmt = db.prepare(`UPDATE ${table} SET image_url = ? WHERE ${idColumn} = ?`);
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
     (title, title_norm, source, category, summary, content, is_deep, up, down, created_at, url, is_external, source_home, image_url)
   VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1, ?, ?)`
);

async function fetchFeed(feed) {
  const parsed = await parser.parseURL(feed.url);
  const stmt = insertPostStmt();
  let inserted = 0;
  for (const item of (parsed.items || []).slice(0, MAX_ITEMS_PER_FEED)) {
    const url = String(item.link || '').trim();
    const title = stripHtml(item.title).slice(0, 200);
    if (!url || !title) continue;
    const summary = (() => {
      // hnrss 的 description 是「Article URL / Comments URL / Points」模板，提炼为社区热度信息
      if (feed.name === 'Hacker News') {
        const raw = stripHtml(item.content || item['content:encoded'] || '');
        const pts = raw.match(/Points:\s*(\d+)/i);
        const cmts = raw.match(/#\s*Comments:\s*(\d+)/i);
        return pts ? `HN 热议 · ${pts[1]} 分 / ${cmts ? cmts[1] : 0} 条评论` : '';
      }
      return stripHtml(item.contentSnippet || item.summary || item.content || item['content:encoded']).slice(0, 300);
    })();
    // 泛科技源只放行 AI 相关条目，避免非 AI 科技新闻污染信息流
    if (feed.filterAI && !isAiRelated(title, summary)) continue;
    const category = classifyPost(title, summary || title);
    const content = (summary || title) + '\n\n原文：' + url;
    const r = stmt.run(title, normalizeTitle(title), feed.name, category, summary || title, content, feed.deep ? 1 : 0, toIsoDate(item), url, feed.home, extractFeedImage(item));
    inserted += Number(r.changes);
  }
  return inserted;
}

const insertFlashStmt = () => db.prepare(
  `INSERT OR IGNORE INTO flashes (content, tag, up, created_at, url, source)
   VALUES (?, ?, 0, ?, ?, ?)`
);

async function fetchFlashFeed(feed) {
  const parsed = await parser.parseURL(feed.url);
  const stmt = insertFlashStmt();
  let inserted = 0;
  for (const item of (parsed.items || []).slice(0, MAX_ITEMS_PER_FEED)) {
    const url = String(item.link || '').trim();
    const title = stripHtml(item.title).slice(0, 200);
    if (!url || !title) continue;
    const desc = stripHtml(item.contentSnippet || item.summary || item.content || item['content:encoded']);
    // 快讯 = 标题 + 一句摘要，总长控制在 160 字
    let content = title;
    if (desc && !desc.startsWith(title.slice(0, 30))) content = `${title} — ${desc}`.slice(0, 160);
    else if (desc) content = desc.slice(0, 160) || title;
    // 快讯同样只保留 AI 相关
    if (!isAiRelated(title, desc)) continue;
    const r = stmt.run(content, tagFlash(`${title} ${desc}`), toIsoDate(item), url, feed.name);
    inserted += Number(r.changes);
  }
  return inserted;
}

const insertProductStmt = () => db.prepare(
  `INSERT OR IGNORE INTO products (name, tagline, description, category, up, created_at, url, image_url)
   VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
);

async function fetchProductFeed(feed) {
  const parsed = await parser.parseURL(feed.url);
  const stmt = insertProductStmt();
  let inserted = 0;
  for (const item of (parsed.items || []).slice(0, 30)) {
    const url = String(item.link || '').trim();
    const rawTitle = stripHtml(item.title).replace(/\s*[—–-]\s*Product Hunt$/i, '');
    if (!url || !rawTitle) continue;
    // 部分条目标题自带 tagline：「Name — Tagline」
    const parts = rawTitle.split(/\s+[—–]\s+/);
    const name = parts[0].slice(0, 80);
    const titleTagline = parts.slice(1).join(' — ');
    // Atom 正文第一个 <p> 才是 tagline，其余是「Discussion | Link」等导航噪声
    const rawContent = String(item.content || item['content:encoded'] || '');
    const firstP = rawContent.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const contentTagline = stripHtml(firstP ? firstP[1] : '').slice(0, 120);
    const tagline = (titleTagline || contentTagline).slice(0, 80);
    const description = tagline || stripHtml(item.contentSnippet).replace(/Discussion\s*\|\s*Link/g, '').trim().slice(0, 240);
    const r = stmt.run(name, tagline, description, feed.name, toIsoDate(item), url, extractFeedImage(item));
    inserted += Number(r.changes);
  }
  return inserted;
}

async function refreshGroup(feeds, fetcher) {
  // 限流并发：serverless 单实例带宽有限，全量并发会互相拖垮导致集体超时
  const results = [];
  const POOL = 10;
  for (let i = 0; i < feeds.length; i += POOL) {
    const batch = feeds.slice(i, i + POOL);
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
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      okCount++;
      totalNew += r.value.inserted;
    } else {
      const msg = r.reason?.code || r.reason?.message || String(r.reason);
      recordStatus(feeds[i], 0, 0, msg);
      console.warn(`[听潮] 源抓取失败 ${feeds[i].name}: ${msg}`);
    }
  });
  return { totalNew, okCount };
}

async function refreshAll() {
  const [posts, flashes, products] = await Promise.all([
    refreshGroup(FEEDS, fetchFeed),
    refreshGroup(FLASH_FEEDS, fetchFlashFeed),
    refreshGroup(PRODUCT_FEEDS, fetchProductFeed),
  ]);
  const totalNew = posts.totalNew + flashes.totalNew + products.totalNew;
  const okCount = posts.okCount + flashes.okCount + products.okCount;
  const feedCount = FEEDS.length + FLASH_FEEDS.length + PRODUCT_FEEDS.length;
  lastRefreshAt = Date.now();
  console.log(
    `[听潮] 聚合完成：文章 +${posts.totalNew} / 快讯 +${flashes.totalNew} / 新品 +${products.totalNew}，${okCount}/${feedCount} 个源在线`
  );
  // 旧内容清理：文章留 30 天（深度长文留 90 天、有评论的保留）、快讯留 7 天、孤儿投票/反应一并清
  try {
    const postCut = new Date(Date.now() - 30 * 86400000).toISOString();
    const deepCut = new Date(Date.now() - 90 * 86400000).toISOString();
    const flashCut = new Date(Date.now() - 7 * 86400000).toISOString();
    const prunedPosts = db.prepare(
      `DELETE FROM posts WHERE id NOT IN (SELECT DISTINCT post_id FROM comments)
         AND ((is_deep = 0 AND created_at < ?) OR (is_deep = 1 AND created_at < ?))`
    ).run(postCut, deepCut).changes;
    const prunedFlashes = db.prepare('DELETE FROM flashes WHERE created_at < ?').run(flashCut).changes;
    db.prepare("DELETE FROM votes WHERE target_type = 'post' AND target_id NOT IN (SELECT id FROM posts)").run();
    db.prepare('DELETE FROM reactions WHERE post_id NOT IN (SELECT id FROM posts)').run();
    if (prunedPosts || prunedFlashes) console.log(`[听潮] 旧内容清理：文章 -${prunedPosts} / 快讯 -${prunedFlashes}`);
  } catch (e) {
    console.warn('[听潮] 清理异常:', e?.message || e);
  }
  // 缩略图回填：RSS 无图的条目抓原文 og:image。
  // serverless 每实例都是"首轮"，大批量回填会与源抓取抢带宽 → 线上恒为限量；
  // 存量大批量用 scripts/backfill-images.mjs 在本地/CI 完成
  // 线上每轮喂 37 个源已逼近 60s 函数上限，缩略图回填交给本地/CI（快照携带）
  const ogLimit = process.env.VERCEL ? 0 : 12;
  try {
    const postImgs = await backfillImages('posts', 'id', ogLimit);
    const prodImgs = await backfillImages('products', 'id', 4);
    if (postImgs || prodImgs) console.log(`[听潮] 缩略图回填：文章 +${postImgs} / 新品 +${prodImgs}`);
  } catch (e) {
    console.warn('[听潮] 缩略图回填异常:', e?.message || e);
  }
  return { totalNew, okCount };
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
