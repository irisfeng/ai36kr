// 本站 RSS 输出：默认是精选（一件事一条）；/rss.xml?feed=all 是全部动态
import { listPicks, listPosts } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const SITE = 'https://aikr.shddai.net';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET(request) {
  const all = new URL(request.url).searchParams.get('feed') === 'all';
  const posts = all ? listPosts({ sort: 'all', limit: 50 }) : listPicks(50);
  const items = posts
    .map((p) => {
      const link = `${SITE}/post/${p.id}`;
      return `  <item>
    <title>${esc(p.title_zh || p.title)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${new Date(p.created_at).toUTCString()}</pubDate>
    <source url="${esc(p.source_home || '')}">${esc(p.source)}</source>
    <category>${esc(p.category)}</category>
    <description>${esc(p.summary_zh || p.summary)}</description>
  </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>听潮 TideWire - ${all ? '全部动态' : '精选'}</title>
  <link>${SITE}</link>
  <description>值得看的 AI 新闻，一件事只说一次。</description>
  <language>zh-CN</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
}
