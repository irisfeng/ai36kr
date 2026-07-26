import { NextResponse } from 'next/server';
import { listComments } from '@/lib/queries';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const postId = Number(searchParams.get('postId'));
  if (!Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json({ error: 'postId 无效' }, { status: 400 });
  }
  return NextResponse.json(listComments(postId));
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const postId = Number(body.postId);
  const parentId = body.parentId ? Number(body.parentId) : null;
  const nickname = String(body.nickname || '').trim().slice(0, 20);
  const content = String(body.content || '').trim().slice(0, 1000);

  if (!Number.isInteger(postId) || postId <= 0 || !nickname || !content) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) return NextResponse.json({ error: '文章不存在' }, { status: 404 });

  if (parentId) {
    const parent = db.prepare('SELECT id, parent_id FROM comments WHERE id = ? AND post_id = ?').get(parentId, postId);
    if (!parent) return NextResponse.json({ error: '回复的评论不存在' }, { status: 404 });
    // 只支持一层嵌套：回复一律挂到顶层评论下
    if (parent.parent_id) {
      return NextResponse.json({ error: '只支持一层回复' }, { status: 400 });
    }
  }

  const r = db.prepare(
    'INSERT INTO comments (post_id, parent_id, nickname, content, up, created_at) VALUES (?, ?, ?, ?, 0, ?)'
  ).run(postId, parentId, nickname, content, new Date().toISOString());

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(Number(r.lastInsertRowid));
  return NextResponse.json(comment, { status: 201 });
}
