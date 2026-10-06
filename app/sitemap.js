// 搜索引擎站点地图
// 注意：metadata 路由默认在构建期预渲染，而构建期用空库会得到空站点地图；
// 强制逐请求动态生成，保证文章页来自真实数据库
export const dynamic = 'force-dynamic';

import db from '@/lib/db';
import { editionDays } from '@/lib/queries';

const SITE = 'https://aikr.shddai.net';

export default function sitemap() {
  // 只收代表稿、不收噪声：同一事件的其他报道与行情 / 推广条目不值得单独被索引
  const posts = db
    .prepare("SELECT id, created_at, selected FROM posts WHERE rep = 1 AND COALESCE(noise, '') = '' ORDER BY created_at DESC LIMIT 500")
    .all();
  const staticPages = ['', '/hot', '/daily', '/all'].map((p) => ({
    url: `${SITE}${p}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: p === '' ? 1 : 0.8,
  }));
  const postPages = posts.map((p) => ({
    url: `${SITE}/post/${p.id}`,
    lastModified: new Date(p.created_at),
    changeFrequency: 'daily',
    priority: p.selected ? 0.7 : 0.5,
  }));
  // 日报归档是全站最稳定的落地页（「某月某日 AI 日报」），只收有内容的日子
  const dailyPages = editionDays().map((day) => ({
    url: `${SITE}/daily/${day}`,
    lastModified: new Date(`${day}T23:59:59+08:00`),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));
  return [...staticPages, ...dailyPages, ...postPages];
}
