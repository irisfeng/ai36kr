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
  return post?.title_zh || post?.title || '';
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
    const posts = data.posts || [];
    return {
      ...common,
      title: `今日听潮｜${posts.length} 条值得看的 AI 新闻`,
      description: compact(posts.slice(0, 2).map(titleOf), '筛掉重复与噪声，保留今天真正重要的变化。'),
      url: trackedUrl(site, '/daily', intent),
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
    title: '关于听潮AI｜听见变化，理解浪潮',
    description: '从 AI 信息聚合站中筛选重要变化，也记录模型实测、动手实践与 FDE 一线经验。',
    url: trackedUrl(site, '/', 'about'),
  };
}

export function loadWechatCard(intent, env = process.env) {
  const site = env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE;
  if (intent === 'daily') return createWechatCard(intent, { posts: loadLatestEdition().main }, site);
  if (intent === 'hot') return createWechatCard(intent, { posts: listPosts({ sort: 'hot', limit: 5 }) }, site);
  if (intent === 'picks') return createWechatCard(intent, { posts: listPicks(5) }, site);
  return createWechatCard('about', {}, site);
}
