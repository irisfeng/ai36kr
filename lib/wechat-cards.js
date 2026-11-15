import { displayTitle } from './editorial.js';
import { listPicks, listPosts, loadLatestEdition } from './queries.js';

const DEFAULT_SITE = 'https://aikr.shddai.net';

function siteOrigin(value = '') {
  try {
    const url = new URL(value || DEFAULT_SITE);
    return url.origin;
  } catch {
    return DEFAULT_SITE;
  }
}

function titleOf(post) {
  return displayTitle(post);
}

function compact(items, fallback, max = 108) {
  const text = items.filter(Boolean).join('；') || fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function trackedUrl(site, path, intent) {
  const url = new URL(path, site);
  url.searchParams.set('utm_source', 'wechat');
  url.searchParams.set('utm_medium', 'official_account');
  url.searchParams.set('utm_campaign', `autoreply_${intent}`);
  return url.toString();
}

export function createWechatCard(intent, data, siteUrl = DEFAULT_SITE) {
  const site = siteOrigin(siteUrl);
  const common = { picUrl: `${site}/og-cover.png` };
  if (intent === 'daily') {
    const headline = data.headline || (data.posts || [])[0];
    return {
      ...common,
      // 标题用头条本身，不用「N 条值得看的」把薄材料再包装一遍
      title: headline ? `听潮日报｜${titleOf(headline)}` : '今日听潮｜当天还没有新内容',
      description: headline ? '一份筛过的 AI 日报。' : '当天还没有新内容。',
      url: trackedUrl(site, '/', intent),
    };
  }
  if (intent === 'hot') {
    const posts = data.posts || [];
    return {
      ...common,
      title: '当前热点｜大家都在说的事',
      description: compact(posts.slice(0, 2).map(titleOf), '按事件算热度：有几家独立信源在报，就有多热。'),
      url: trackedUrl(site, '/hot', intent),
    };
  }
  if (intent === 'picks') {
    const posts = data.posts || [];
    return {
      ...common,
      title: '最新精选｜值得看的 AI 新闻',
      description: compact(posts.slice(0, 2).map(titleOf), '同一件事只说一次，官方一手优先。'),
      url: trackedUrl(site, '/', intent),
    };
  }
  return {
    ...common,
    title: '关于听潮｜一份筛过的 AI 日报',
    description: '回复「日报」「热点」或「精选」。同一件事只说一次。',
    url: trackedUrl(site, '/', 'about'),
  };
}

export function loadWechatCard(intent, env = process.env) {
  const site = env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE;
  if (intent === 'daily') {
    const edition = loadLatestEdition();
    return createWechatCard(intent, { headline: edition.headline, posts: edition.main }, site);
  }
  if (intent === 'hot') return createWechatCard(intent, { posts: listPosts({ sort: 'hot', limit: 5 }) }, site);
  if (intent === 'picks') return createWechatCard(intent, { posts: listPicks(5) }, site);
  return createWechatCard('about', {}, site);
}
