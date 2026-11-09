// 搜索引擎站点地图
// 注意：metadata 路由默认在构建期预渲染，而构建期用空库会得到空站点地图；
// 强制逐请求动态生成，保证文章页来自真实数据库。
// lastmod 只用库里的 created_at，不用请求时间，也不把日历日写成当天 23:59。
export const dynamic = 'force-dynamic';

import { sitemapFacts } from '@/lib/queries';
import { buildSitemapEntries } from '@/lib/seo';

export default function sitemap() {
  const { posts, days, lastmod } = sitemapFacts();
  return buildSitemapEntries({ posts, days, lastmod, now: Date.now() });
}
