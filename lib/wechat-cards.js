import { latestFlashes, listPosts, weeklyTopPosts } from './queries.js';

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
      title: `今日听潮｜${posts.length} 条 AI 信号已更新`,
      description: compact(posts.slice(0, 2).map(titleOf), '筛掉重复与噪声，保留今天真正重要的变化。'),
      url: trackedUrl(site, '/daily', intent),
    };
  }
  if (intent === 'weekly') {
    const posts = data.posts || [];
    return {
      ...common,
      title: '本周 AI 热点｜趋势与变化已整理',
      description: compact(posts.slice(0, 2).map(titleOf), '查看本周热词、讨论度和值得持续关注的变化。'),
      url: trackedUrl(site, '/weekly', intent),
    };
  }
  if (intent === 'flashes') {
    const flashes = data.flashes || [];
    return {
      ...common,
      title: '7×24 AI 快讯｜持续滚动更新',
      description: compact(flashes.slice(0, 2).map((item) => item.content), '模型发布、AI 产品、融资和行业动态。'),
      url: trackedUrl(site, '/flashes', intent),
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
  if (intent === 'daily') {
    let posts = listPosts({ sort: 'new', sinceHours: 24, limit: 200 });
    if (!posts.length) posts = listPosts({ sort: 'new', sinceHours: 48, limit: 200 });
    return createWechatCard(intent, { posts }, site);
  }
  if (intent === 'weekly') {
    return createWechatCard(intent, { posts: weeklyTopPosts(5) }, site);
  }
  if (intent === 'flashes') {
    return createWechatCard(intent, { flashes: latestFlashes(5) }, site);
  }
  return createWechatCard('about', {}, site);
}
