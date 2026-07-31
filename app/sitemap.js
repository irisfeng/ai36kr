// 搜索引擎站点地图
// 注意：metadata 路由默认在构建期预渲染，而构建期用空 scratch 库会得到空站点地图；
// 强制动态（1 小时重算），保证词条/文章页来自真实数据库
export const revalidate = 3600;

import db from '@/lib/db';
import { AI_KEYWORDS } from '@/lib/keywords';

const SITE = 'https://aikr.shddai.net';

export default function sitemap() {
  const posts = db
    .prepare('SELECT id, created_at FROM posts ORDER BY created_at DESC LIMIT 500')
    .all();
  const staticPages = ['', '/daily', '/weekly', '/flashes', '/launch', '/submit'].map((p) => ({
    url: `${SITE}${p}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: p === '' ? 1 : 0.8,
  }));
  // 热词落地页（programmatic SEO）：词表内近 7 天有收录的词才放出
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const wordPages = AI_KEYWORDS
    .filter((w) => {
      const { c } = db.prepare(
        'SELECT COUNT(*) AS c FROM posts WHERE (title LIKE ? OR summary LIKE ?) AND created_at >= ?'
      ).get(`%${w}%`, `%${w}%`, since7);
      return c > 0;
    })
    .map((w) => ({
      url: `${SITE}/word/${encodeURIComponent(w)}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    }));
  const postPages = posts.map((p) => ({
    url: `${SITE}/post/${p.id}`,
    lastModified: new Date(p.created_at),
    changeFrequency: 'daily',
    priority: 0.6,
  }));
  return [...staticPages, ...wordPages, ...postPages];
}
