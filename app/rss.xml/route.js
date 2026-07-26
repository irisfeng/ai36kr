// 本站 RSS 输出：让 Feedly/Inoreader/Folo 等订阅器反过来订阅听潮
import { listPosts } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const SITE = 'https://aikr.shddai.net';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET() {
  const posts = listPosts({ sort: 'new' }).slice(0, 50);
  const items = posts
    .map((p) => {
      const link = `${SITE}/post/${p.id}`;
      return `  <item>
    <title>${esc(p.title)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${new Date(p.created_at).toUTCString()}</pubDate>
    <source url="${esc(p.source_home || '')}">${esc(p.source)}</source>
    <category>${esc(p.category)}</category>
    <description>${esc(p.summary)}</description>
  </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>听潮 TideWire - AI 行业新闻聚合与社区</title>
  <link>${SITE}</link>
  <description>聚合 25 个权威信息源，每 30 分钟更新。AI 新闻、快讯、新品、深度长读。</description>
  <language>zh-CN</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
}
