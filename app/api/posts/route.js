import { NextResponse } from 'next/server';
import { listPosts } from '@/lib/queries';
import { refreshIfStale } from '@/lib/rss';
import { normalizeTitle } from '@/lib/classify';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // 距上次抓取超过 10 分钟则后台补抓一轮（不阻塞响应）
  refreshIfStale();

  const since = /^\d{1,4}h$/.test(searchParams.get('since') || '')
    ? parseInt(searchParams.get('since'), 10)
    : 0;
  const token = (searchParams.get('token') || '').trim();
  const posts = listPosts({
    sort: searchParams.get('sort') || 'hot',
    cat: searchParams.get('cat') || '',
    q: (searchParams.get('q') || '').trim(),
    sinceHours: since,
    token: token.length >= 8 && token.length <= 64 ? token : '',
  });
  return NextResponse.json(posts);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
  const title = String(body.title || '').trim().slice(0, 120);
  const summary = String(body.summary || '').trim().slice(0, 500);
  const category = String(body.category || '大模型').slice(0, 20);
  const url = String(body.url || '').trim().slice(0, 300);

  if (!title || !summary) {
    return NextResponse.json({ error: '标题和摘要不能为空' }, { status: 400 });
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
    return NextResponse.json({ id: Number(r.lastInsertRowid) }, { status: 201 });
  } catch (e) {
    if (String(e?.message || '').includes('UNIQUE')) {
      return NextResponse.json({ error: '该链接已被收录过' }, { status: 409 });
    }
    throw e;
  }
}
