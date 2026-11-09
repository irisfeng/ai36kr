// 站点规范地址、分享元数据、robots 与站点地图条目。
// 纯函数：不读库、不读时钟（now 由调用方传入）。
import { FEEDS } from './sources.js';
import { normalizeExternalHttpUrl } from './external-url.js';

export const SITE_ORIGIN = 'https://aikr.shddai.net';
export const SITE_NAME = '听潮 TideWire';
export const SOURCE_COUNT = FEEDS.length;
export const SITE_DESCRIPTION = `听潮 TideWire：每天从 ${SOURCE_COUNT} 个信源里挑出值得看的 AI 新闻。同一件事只说一次，官方一手优先，英文内容译成中文，每日北京时间 8 点出日报。`;

const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

// 页面级 alternates 会整体覆盖根布局的同名字段：规范地址和 RSS 声明放一起给
export function alternates(path) {
  return { canonical: path, types: { 'application/rss+xml': '/rss.xml' } };
}

// 给发到站外的链接标上来源（邮件、X、二维码、RSS）：统计里才分得清读者从哪来。
// 各页都有 canonical，带参数的地址不会被当成另一个页面收录
export function tracked(url, source, medium = '') {
  const u = new URL(url);
  u.searchParams.set('utm_source', source);
  if (medium) u.searchParams.set('utm_medium', medium);
  return u.toString();
}

export function absoluteUrl(path = '/') {
  if (!path || path === '/') return SITE_ORIGIN;
  return new URL(path, SITE_ORIGIN).toString();
}

export function metaDescription(text, fallback = '', max = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

// 页面级 openGraph / twitter 会整体覆盖根布局的同名字段，所以给全
export function socialMeta({ title, description, path, images, type = 'website' }) {
  const imageList = images?.length ? images : ['/og-cover.png'];
  return {
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: 'zh_CN',
      url: path,
      title,
      description,
      images: imageList,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageList,
    },
  };
}

export function pageMetadata({
  title, description, path, images, type = 'website', openGraph = {}, robots,
}) {
  const social = socialMeta({ title, description, path, images, type });
  return {
    title,
    description,
    alternates: alternates(path),
    ...social,
    openGraph: { ...social.openGraph, ...openGraph },
    ...(robots ? { robots } : {}),
  };
}

// 日报页的分享预览：图片按日期分地址，平台才不会一直用昨天的缓存
export function dailyShareMeta({ date, title, description, path }) {
  return socialMeta({
    title,
    description,
    path,
    type: 'article',
    images: [`/api/og/daily/${date}`],
  });
}

// 搜索结果不收录。canonical 回到 /all，避免查询词页面被当成独立文档
export function searchResultMetadata(keyword) {
  const title = `「${keyword}」的搜索结果`;
  const description = `听潮站内与「${keyword}」相关的条目。`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: alternates('/all'),
    ...socialMeta({ title, description, path: '/all' }),
  };
}

export function jsonLdScript(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function siteGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: SITE_NAME,
        url: SITE_ORIGIN,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_ORIGIN}/apple-touch-icon.png`,
          width: 180,
          height: 180,
        },
        description: SITE_DESCRIPTION,
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: SITE_NAME,
        alternateName: '听潮',
        url: SITE_ORIGIN,
        inLanguage: 'zh-CN',
        description: SITE_DESCRIPTION,
        publisher: { '@id': ORGANIZATION_ID },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_ORIGIN}/all?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

// items: [{ name, href }]。href 省略时不写 item（当前页也可以传入本页地址）
export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

// 文章页的结构化数据只写页面上能对上的事实：听潮写的是摘要，原文另作 citation
export function newsArticleJsonLd({
  id, title, summary, createdAt, source, sourceUrl, originalTitle, image, category,
}) {
  const pageUrl = absoluteUrl(`/post/${id}`);
  const safeSource = normalizeExternalHttpUrl(sourceUrl);
  const safeImage = normalizeExternalHttpUrl(image);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    ...(originalTitle && originalTitle !== title ? { alternativeHeadline: originalTitle } : {}),
    ...(summary ? { description: summary } : {}),
    datePublished: createdAt,
    inLanguage: 'zh-CN',
    ...(category ? { articleSection: category } : {}),
    author: { '@type': 'Organization', '@id': ORGANIZATION_ID, name: SITE_NAME, url: SITE_ORIGIN },
    publisher: { '@id': ORGANIZATION_ID },
    image: [safeImage || `${SITE_ORIGIN}/og-cover.png`],
    mainEntityOfPage: pageUrl,
    url: pageUrl,
    isPartOf: { '@id': WEBSITE_ID },
  };
  if (safeSource) {
    data.isBasedOn = safeSource;
    data.citation = {
      '@type': 'CreativeWork',
      url: safeSource,
      ...(source ? { publisher: { '@type': 'Organization', name: source } } : {}),
      ...(originalTitle ? { headline: originalTitle } : {}),
    };
  }
  return data;
}

export function aboutPageJsonLd(description) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: '编辑方法',
    url: absoluteUrl('/about'),
    description,
    inLanguage: 'zh-CN',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORGANIZATION_ID },
  };
}

// 训练向爬虫维持原先的许可：公开页可以抓，/api/ 不可以。不把 /api/og/ 加进去。
export const TRAINING_AGENTS = [
  'GPTBot',
  'ClaudeBot',
  'Bytespider',
  'Google-Extended',
  'Amazonbot',
  'Meta-ExternalAgent',
];

// 搜索、问答和社交预览需要抓分享图。PerplexityBot 原先写在训练组里，规则与全站相同；
// 现在按搜索爬虫处理，只多放行 /api/og/，其余 /api/ 仍然拒绝。
const SEARCH_ALLOW = ['/api/og/', '/'];
const SEARCH_DISALLOW = ['/api/'];

function robotBlock(agents, allow, disallow) {
  const lines = agents.map((agent) => `User-Agent: ${agent}`);
  for (const rule of allow) lines.push(`Allow: ${rule}`);
  for (const rule of disallow) lines.push(`Disallow: ${rule}`);
  return lines.join('\n');
}

export function renderRobotsTxt() {
  const training = robotBlock(TRAINING_AGENTS, ['/'], ['/api/']);
  const perplexity = robotBlock(['PerplexityBot'], SEARCH_ALLOW, SEARCH_DISALLOW);
  const everyone = robotBlock(['*'], SEARCH_ALLOW, SEARCH_DISALLOW);
  return `${training}\n\n${perplexity}\n\n${everyone}\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\nSitemap: ${SITE_ORIGIN}/news-sitemap.xml\n`;
}

// 列表页的结构化数据只收录页面上真正渲染出来的条目，顺序与版面一致
export function itemListJsonLd({ name, url, items = [] }) {
  const list = items.filter((item) => item?.name && item?.href);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    ...(url ? { url: absoluteUrl(url) } : {}),
    numberOfItems: list.length,
    itemListElement: list.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.href),
    })),
  };
}

export function storyListItems(posts = []) {
  return posts.filter(Boolean).flatMap((post) => {
    const name = String(post.title_zh || post.title || '').replace(/\s+/g, ' ').trim();
    if (!name || !post.id) return [];
    return [{ name, href: `/post/${post.id}` }];
  });
}

export function editionListItems(edition) {
  if (!edition) return [];
  return storyListItems([
    edition.headline,
    ...(edition.highlights || []),
    ...(edition.sections || []).flatMap(([, items]) => items || []),
    ...(edition.briefs || []),
  ]);
}

const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 新闻站点地图只收近 48 小时的代表稿。更早的仍在 sitemap.xml，不从这里重复堆。
export function buildNewsSitemapXml({ posts = [], now = Date.now(), site = SITE_ORIGIN, name = SITE_NAME } = {}) {
  const cutoff = now - NEWS_WINDOW_MS;
  const urls = [];
  for (const post of posts) {
    const time = new Date(post.created_at).getTime();
    const title = String(post.title_zh || post.title || '').replace(/\s+/g, ' ').trim();
    if (!post.id || !title || !Number.isFinite(time) || time > now || time < cutoff) continue;
    urls.push(`  <url>
    <loc>${xmlEscape(`${site}/post/${post.id}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEscape(name)}</news:name>
        <news:language>zh</news:language>
      </news:publication>
      <news:publication_date>${xmlEscape(new Date(time).toISOString())}</news:publication_date>
      <news:title>${xmlEscape(title)}</news:title>
    </news:news>
  </url>`);
    if (urls.length >= 1000) break;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join('\n')}
</urlset>
`;
}

const STATIC_PAGES = [
  { path: '/', key: 'home', changeFrequency: 'hourly', priority: 1 },
  { path: '/hot', key: 'hot', changeFrequency: 'hourly', priority: 0.8 },
  { path: '/daily', key: 'daily', changeFrequency: 'hourly', priority: 0.8 },
  { path: '/all', key: 'all', changeFrequency: 'hourly', priority: 0.8 },
  { path: '/about', key: 'about', changeFrequency: 'monthly', priority: 0.4 },
];

// lastmod 只接受调用方给出的真实时间。晚于 now 的值（例如把日历日写成 23:59）丢掉。
function stamp(value, now) {
  if (value == null || value === '') return undefined;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time) || time > now) return undefined;
  return new Date(time).toISOString();
}

export function buildSitemapEntries({
  posts = [], days = [], lastmod = {}, now = Date.now(), site = SITE_ORIGIN,
} = {}) {
  const byDay = lastmod.byDay || {};
  const entries = STATIC_PAGES.map((page) => {
    const modified = stamp(lastmod[page.key], now);
    return {
      url: page.path === '/' ? site : `${site}${page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      ...(modified ? { lastModified: modified } : {}),
    };
  });
  for (const day of days) {
    const modified = stamp(byDay[day], now);
    entries.push({
      url: `${site}/daily/${day}`,
      changeFrequency: 'weekly',
      priority: 0.6,
      ...(modified ? { lastModified: modified } : {}),
    });
  }
  for (const post of posts) {
    const modified = stamp(post.created_at, now);
    entries.push({
      url: `${site}/post/${post.id}`,
      changeFrequency: 'daily',
      priority: post.selected ? 0.7 : 0.5,
      ...(modified ? { lastModified: modified } : {}),
    });
  }
  return entries;
}
