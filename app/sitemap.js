// 搜索引擎站点地图
import db from '@/lib/db';

const SITE = 'https://aikr.shddai.net';

export default function sitemap() {
  const posts = db
    .prepare('SELECT id, created_at FROM posts ORDER BY created_at DESC LIMIT 500')
    .all();
  const staticPages = ['', '/daily', '/flashes', '/launch', '/submit'].map((p) => ({
    url: `${SITE}${p}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: p === '' ? 1 : 0.8,
  }));
  const postPages = posts.map((p) => ({
    url: `${SITE}/post/${p.id}`,
    lastModified: new Date(p.created_at),
    changeFrequency: 'daily',
    priority: 0.6,
  }));
  return [...staticPages, ...postPages];
}
