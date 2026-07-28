import db from '@/lib/db';
import { tideCoverSvg } from '@/lib/tide-cover';

export const dynamic = 'force-dynamic';

// 生成式封面：/api/cover/[id].svg —— 同一 id 恒定同一张画，可长缓存
export async function GET(request, { params }) {
  const id = Number(String(params.id).replace(/\.svg$/i, ''));
  const post = Number.isInteger(id) && id > 0
    ? db.prepare('SELECT id, category FROM posts WHERE id = ?').get(id)
    : null;
  const svg = tideCoverSvg(post || { id: id || 1, category: '大模型' });
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
