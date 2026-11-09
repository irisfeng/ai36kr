import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { FEEDS } from '../lib/sources.js';
import { ABOUT_DESCRIPTION, methodFacts } from '../lib/method.js';
import {
  SITE_DESCRIPTION,
  SITE_ORIGIN,
  TRAINING_AGENTS,
  aboutPageJsonLd,
  alternates,
  breadcrumbJsonLd,
  buildSitemapEntries,
  jsonLdScript,
  metaDescription,
  newsArticleJsonLd,
  pageMetadata,
  renderRobotsTxt,
  searchResultMetadata,
  siteGraph,
} from '../lib/seo.js';

function robotGroups(text) {
  return text.trim().split(/\n\n+/).map((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    return {
      agents: lines.filter((line) => line.startsWith('User-Agent:')).map((line) => line.slice('User-Agent:'.length).trim()),
      allow: lines.filter((line) => line.startsWith('Allow:')).map((line) => line.slice('Allow:'.length).trim()),
      disallow: lines.filter((line) => line.startsWith('Disallow:')).map((line) => line.slice('Disallow:'.length).trim()),
      sitemap: lines.find((line) => line.startsWith('Sitemap:'))?.slice('Sitemap:'.length).trim(),
    };
  });
}

test('site description uses the real source count and does not describe a chat product', () => {
  assert.equal(FEEDS.length, 33);
  assert.match(SITE_DESCRIPTION, new RegExp(`${FEEDS.length} 个信源`));
  assert.match(SITE_DESCRIPTION, /日报/);
  assert.doesNotMatch(SITE_DESCRIPTION, /聊天|客服机器人|套壳/);
});

test('canonical stays on the clean path and keeps the RSS alternate', () => {
  assert.deepEqual(alternates('/hot'), {
    canonical: '/hot',
    types: { 'application/rss+xml': '/rss.xml' },
  });
});

test('page metadata keeps title, description, canonical and share tags on the same page', () => {
  const meta = pageMetadata({
    title: '近 48 小时 AI 热点',
    description: '按事件计算的 AI 热点。',
    path: '/hot',
  });
  assert.equal(meta.title, '近 48 小时 AI 热点');
  assert.equal(meta.description, meta.openGraph.description);
  assert.equal(meta.openGraph.title, meta.title);
  assert.equal(meta.twitter.title, meta.title);
  assert.equal(meta.twitter.description, meta.description);
  assert.equal(meta.alternates.canonical, '/hot');
  assert.equal(meta.openGraph.url, '/hot');
  assert.equal(meta.openGraph.siteName, '听潮 TideWire');
  assert.deepEqual(meta.openGraph.images, ['/og-cover.png']);
});

test('search results stay noindex and canonicalize back to the full list', () => {
  const meta = searchResultMetadata('openai');
  assert.equal(meta.robots.index, false);
  assert.equal(meta.robots.follow, true);
  assert.equal(meta.alternates.canonical, '/all');
  assert.equal(meta.title, '「openai」的搜索结果');
});

test('robots keeps training crawlers off /api and only lets search crawlers fetch OG images', () => {
  assert.deepEqual(TRAINING_AGENTS, [
    'GPTBot',
    'ClaudeBot',
    'Bytespider',
    'Google-Extended',
    'Amazonbot',
    'Meta-ExternalAgent',
  ]);
  const groups = robotGroups(renderRobotsTxt());
  const training = groups.find((group) => group.agents.includes('GPTBot'));
  const perplexity = groups.find((group) => group.agents.includes('PerplexityBot'));
  const everyone = groups.find((group) => group.agents.includes('*'));
  assert.deepEqual(training.allow, ['/']);
  assert.deepEqual(training.disallow, ['/api/']);
  assert.equal(training.allow.includes('/api/og/'), false);
  assert.deepEqual(perplexity.allow, ['/api/og/', '/']);
  assert.deepEqual(perplexity.disallow, ['/api/']);
  assert.deepEqual(everyone.allow, ['/api/og/', '/']);
  assert.deepEqual(everyone.disallow, ['/api/']);
  assert.equal(groups.at(-1).sitemap, `${SITE_ORIGIN}/sitemap.xml`);
  assert.ok(groups.indexOf(training) < groups.indexOf(everyone));
  assert.equal(fs.existsSync('app/robots.js'), false);
});

test('sitemap lastmod uses real timestamps and drops future or missing ones', () => {
  const now = Date.parse('2026-11-09T00:00:00.000Z');
  const entries = buildSitemapEntries({
    now,
    posts: [
      { id: 7, created_at: '2026-11-08T12:00:00.000Z', selected: 1 },
      { id: 8, created_at: '2026-11-09T03:00:00.000Z', selected: 0 },
    ],
    days: ['2026-11-08', '2026-11-07'],
    lastmod: {
      home: '2026-11-08T12:00:00.000Z',
      hot: '2026-11-08T10:00:00.000Z',
      daily: '2026-11-08T12:00:00.000Z',
      all: '2026-11-08T18:00:00.000Z',
      byDay: {
        '2026-11-08': '2026-11-08T15:30:00.000Z',
        '2026-11-07': '2026-11-09T23:59:59.000Z',
      },
    },
  });
  const byUrl = new Map(entries.map((entry) => [entry.url, entry]));
  assert.equal(byUrl.get(SITE_ORIGIN).lastModified, '2026-11-08T12:00:00.000Z');
  assert.equal(byUrl.get(`${SITE_ORIGIN}/hot`).lastModified, '2026-11-08T10:00:00.000Z');
  assert.equal(byUrl.get(`${SITE_ORIGIN}/about`).lastModified, undefined);
  assert.equal(byUrl.get(`${SITE_ORIGIN}/daily/2026-11-08`).lastModified, '2026-11-08T15:30:00.000Z');
  assert.equal(byUrl.get(`${SITE_ORIGIN}/daily/2026-11-07`).lastModified, undefined);
  assert.equal(byUrl.get(`${SITE_ORIGIN}/post/7`).lastModified, '2026-11-08T12:00:00.000Z');
  assert.equal(byUrl.get(`${SITE_ORIGIN}/post/7`).priority, 0.7);
  assert.equal(byUrl.get(`${SITE_ORIGIN}/post/8`).lastModified, undefined);
  assert.equal(byUrl.get(`${SITE_ORIGIN}/post/8`).priority, 0.5);
  assert.equal(entries.filter((entry) => String(entry.lastModified || '').includes('23:59:59')).length, 0);
  assert.equal(new Set(entries.map((entry) => entry.url)).size, entries.length);
  const source = fs.readFileSync('app/sitemap.js', 'utf8');
  assert.doesNotMatch(source, /new Date\(\)/);
  assert.doesNotMatch(source, /T23:59:59/);
});

test('structured data matches visible facts and stays valid JSON', () => {
  const graph = siteGraph();
  assert.equal(graph['@context'], 'https://schema.org');
  assert.equal(graph['@graph'].find((node) => node['@type'] === 'Organization').name, '听潮 TideWire');
  assert.equal(graph['@graph'].find((node) => node['@type'] === 'WebSite').potentialAction.target.urlTemplate, `${SITE_ORIGIN}/all?q={search_term_string}`);

  const article = newsArticleJsonLd({
    id: 9,
    title: '中文标题',
    summary: '谁做了什么。',
    createdAt: '2026-11-08T00:00:00.000Z',
    source: 'OpenAI',
    sourceUrl: 'https://openai.com/news/example',
    originalTitle: 'English title',
    image: 'javascript:alert(1)',
    category: '大模型',
  });
  assert.equal(article.headline, '中文标题');
  assert.equal(article.description, '谁做了什么。');
  assert.equal(article.author.name, '听潮 TideWire');
  assert.equal(article.citation.publisher.name, 'OpenAI');
  assert.equal(article.isBasedOn, 'https://openai.com/news/example');
  assert.equal(article.articleSection, '大模型');
  assert.deepEqual(article.image, [`${SITE_ORIGIN}/og-cover.png`]);
  assert.equal(article.aggregateRating, undefined);
  assert.equal(JSON.parse(jsonLdScript(article)).headline, '中文标题');
  assert.doesNotMatch(jsonLdScript({ text: '</script><script>' }), /<\/script>/);

  const crumbs = breadcrumbJsonLd([
    { name: '精选', href: '/' },
    { name: 'AI 日报', href: '/daily' },
    { name: '2026 年 11 月 8 日', href: '/daily/2026-11-08' },
  ]);
  assert.deepEqual(crumbs.itemListElement.map((item) => [item.position, item.name, item.item]), [
    [1, '精选', SITE_ORIGIN],
    [2, 'AI 日报', `${SITE_ORIGIN}/daily`],
    [3, '2026 年 11 月 8 日', `${SITE_ORIGIN}/daily/2026-11-08`],
  ]);

  const about = aboutPageJsonLd(ABOUT_DESCRIPTION);
  assert.equal(about['@type'], 'AboutPage');
  assert.equal(about.description, ABOUT_DESCRIPTION);
  assert.equal(about.url, `${SITE_ORIGIN}/about`);
});

test('editorial method page publishes the thresholds the code actually uses', () => {
  const facts = methodFacts();
  assert.equal(facts.sourceCount, FEEDS.length);
  assert.deepEqual(facts.thresholds, { T1: 60, T1_5: 65, T2: 75 });
  assert.equal(facts.coverageStep, 4);
  assert.equal(facts.coverageCap, 12);
  assert.equal(facts.heatWindowHours, 48);
  assert.equal(facts.heatHalfLifeHours, 24);
  assert.equal(facts.discussionCap, 1.5);
  assert.equal(facts.mainMax, 12);
  assert.equal(facts.perSource, 2);
  assert.ok(facts.tiers.find((tier) => tier.tier === 'T1').sources.some((source) => source.name === 'OpenAI'));
  assert.match(ABOUT_DESCRIPTION, /不是原文全文/);
});

test('llms.txt matches the site and does not promise ranking or citation', () => {
  const text = fs.readFileSync('public/llms.txt', 'utf8');
  assert.match(text, new RegExp(`${FEEDS.length} 个`));
  assert.match(text, /https:\/\/aikr\.shddai\.net\/about/);
  assert.match(text, /不是原文全文/);
  assert.match(text, /不表示搜索排名或被引用的结果/);
  assert.doesNotMatch(text, /保证收录|一定被引用|排名第一/);
});

test('meta descriptions stay a prefix of the visible summary', () => {
  assert.equal(metaDescription('短摘要', '标题'), '短摘要');
  assert.equal(metaDescription('', '标题'), '标题');
  const long = '甲'.repeat(180);
  const cut = metaDescription(long, '标题', 20);
  assert.equal(cut.length, 20);
  assert.ok(long.startsWith(cut.slice(0, -1)));
});
