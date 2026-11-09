import { recentNewsPosts } from '@/lib/queries';
import { buildNewsSitemapXml } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export function GET() {
  const now = Date.now();
  return new Response(buildNewsSitemapXml({ posts: recentNewsPosts(), now }), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
}
