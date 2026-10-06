import { NextResponse } from 'next/server';
import { listPosts, normalizeSort } from '@/lib/queries';
import { refreshIfStale } from '@/lib/rss';
import { PaginationError, parsePostPagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

// 公开只读接口：GET /api/posts?sort=pick|hot|all&cat=&q=&since=24h&limit=50&offset=0
// pick 精选（一件事一条）· hot 按事件热度 · all 全部动态
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // 距上次抓取超过 10 分钟则后台补抓一轮（不阻塞响应）
  refreshIfStale();

  const since = /^\d{1,4}h$/.test(searchParams.get('since') || '')
    ? parseInt(searchParams.get('since'), 10)
    : 0;
  let pagination;
  try {
    pagination = parsePostPagination(searchParams);
  } catch (error) {
    if (error instanceof PaginationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: HEADERS });
    }
    throw error;
  }
  const posts = listPosts({
    sort: normalizeSort(searchParams.get('sort') || 'pick'),
    cat: (searchParams.get('cat') || '').slice(0, 20),
    q: (searchParams.get('q') || '').trim().slice(0, 100),
    sinceHours: since,
    ...pagination,
  });
  return NextResponse.json(posts, {
    headers: {
      ...HEADERS,
      'X-Pagination-Limit': String(pagination.limit),
      'X-Pagination-Offset': String(pagination.offset),
      'X-Pagination-Has-More': String(posts.length === pagination.limit),
    },
  });
}
