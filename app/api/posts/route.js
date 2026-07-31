import { NextResponse } from 'next/server';
import { listPosts } from '@/lib/queries';
import { refreshIfStale } from '@/lib/rss';
import { normalizeTitle } from '@/lib/classify';
import db from '@/lib/db';
import { consumeRequestRateLimit } from '@/lib/rate-limit';
import { rateLimitExceeded, writeJson } from '@/lib/write-response';
import { PaginationError, parsePostPagination } from '@/lib/pagination';
import { moderateContent } from '@/lib/moderate';
import { normalizeExternalHttpUrl } from '@/lib/external-url';
import { bustCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';
const POST_LIMIT = { scope: 'posts', limit: 5, windowMs: 10 * 60 * 1000 };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // 距上次抓取超过 10 分钟则后台补抓一轮（不阻塞响应）
  refreshIfStale();

  const since = /^\d{1,4}h$/.test(searchParams.get('since') || '')
    ? parseInt(searchParams.get('since'), 10)
    : 0;
  const token = (searchParams.get('token') || '').trim();
  let pagination;
  try {
    pagination = parsePostPagination(searchParams);
  } catch (error) {
    if (error instanceof PaginationError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        },
      );
    }
    throw error;
  }
  const posts = listPosts({
    sort: searchParams.get('sort') || 'hot',
    cat: searchParams.get('cat') || '',
    q: (searchParams.get('q') || '').trim().slice(0, 100),
    sinceHours: since,
    token: token.length >= 8 && token.length <= 64 ? token : '',
    ...pagination,
  });
  return NextResponse.json(posts, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Pagination-Limit': String(pagination.limit),
      'X-Pagination-Offset': String(pagination.offset),
      'X-Pagination-Has-More': String(posts.length === pagination.limit),
    },
  });
}

export async function POST(request) {
  const requestLimit = consumeRequestRateLimit(request, POST_LIMIT);
  if (!requestLimit.allowed) return rateLimitExceeded(requestLimit);

  let body;
  try {
    body = await request.json();
  } catch {
    return writeJson({ error: '请求格式错误' }, { status: 400, rateLimit: requestLimit });
  }
  const title = String(body.title || '').trim().slice(0, 120);
  const summary = String(body.summary || '').trim().slice(0, 500);
  const category = String(body.category || '大模型').slice(0, 20);
  const url = normalizeExternalHttpUrl(body.url, { maxLength: 300 });

  if (!title || !summary) {
    return writeJson({ error: '标题和摘要不能为空' }, { status: 400, rateLimit: requestLimit });
  }
  if (url === null) {
    return writeJson({ error: '链接必须是有效的 http/https 地址' }, { status: 400, rateLimit: requestLimit });
  }

  // 内容审核：本地敏感词 → Ark LLM 快审
  const verdict = await moderateContent(`${title}\n${summary}`);
  if (!verdict.ok) {
    return writeJson({ error: `未通过审核：${verdict.reason}` }, { status: 422, rateLimit: requestLimit });
  }

  let source = '社区投稿';
  if (url) {
    try { source = new URL(url).hostname.replace(/^www\./, ''); } catch { /* 保留默认 */ }
  }

  try {
    const r = db.prepare(
      `INSERT INTO posts (title, title_norm, source, category, summary, content, is_deep, up, down, created_at, url)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`
    ).run(title, normalizeTitle(title), source, category, summary, summary, new Date().toISOString(), url || null);
    bustCache('lp:'); // 投稿即时可见：清掉本实例的列表缓存（跨实例由 30s TTL 收敛）
    return writeJson({ id: Number(r.lastInsertRowid) }, { status: 201, rateLimit: requestLimit });
  } catch (e) {
    if (String(e?.message || '').includes('UNIQUE')) {
      return writeJson({ error: '该链接已被收录过' }, { status: 409, rateLimit: requestLimit });
    }
    throw e;
  }
}
