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

// 日报页的分享预览：页面级 openGraph / twitter 会整体覆盖根布局的同名字段，所以给全
export function dailyShareMeta({ date, title, description }) {
  const images = [`/api/og/daily/${date}`];
  return {
    openGraph: { type: 'article', siteName: '听潮 TideWire', locale: 'zh_CN', title, description, images },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}
