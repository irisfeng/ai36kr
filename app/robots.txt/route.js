import { renderRobotsTxt } from '@/lib/seo';

export function GET() {
  return new Response(renderRobotsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
