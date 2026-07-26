import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { consumeActorRateLimit, consumeRequestRateLimit } from '@/lib/rate-limit';
import { rateLimitExceeded, writeJson } from '@/lib/write-response';

export const dynamic = 'force-dynamic';
const REACTION_CLIENT_LIMIT = { scope: 'reactions', limit: 60, windowMs: 60 * 1000 };
const REACTION_ACTOR_LIMIT = { scope: 'reactions', limit: 40, windowMs: 60 * 1000 };

// 4 个固定表情：🔥 热 / 🤯 炸 / 💡 妙 / 🧐 疑
export const REACTION_EMOJIS = ['🔥', '🤯', '💡', '🧐'];

function countsOf(postId) {
  const rows = db.prepare(
    'SELECT emoji, COUNT(*) AS c FROM reactions WHERE post_id = ? GROUP BY emoji'
  ).all(postId);
  const counts = Object.fromEntries(REACTION_EMOJIS.map((e) => [e, 0]));
  for (const r of rows) counts[r.emoji] = r.c;
  return counts;
}

function mineOf(postId, token) {
  return db.prepare('SELECT emoji FROM reactions WHERE post_id = ? AND token = ?')
    .all(postId, token)
    .map((r) => r.emoji);
}

function validate(body) {
  const postId = Number(body.postId);
  const emoji = String(body.emoji || '');
  const token = String(body.token || '');
  if (!Number.isInteger(postId) || postId <= 0) return { error: 'postId 无效' };
  if (!REACTION_EMOJIS.includes(emoji)) return { error: 'emoji 不在允许范围' };
  if (token.length < 8 || token.length > 64) return { error: 'token 无效' };
  return { postId, emoji, token };
}

// 幂等切换：已选再点 = 取消；未选 = 添加。与投票互不影响（独立 reactions 表）
export async function POST(request) {
  const requestLimit = consumeRequestRateLimit(request, REACTION_CLIENT_LIMIT);
  if (!requestLimit.allowed) return rateLimitExceeded(requestLimit);

  let body;
  try {
    body = await request.json();
  } catch {
    return writeJson({ error: '请求格式错误' }, { status: 400, rateLimit: requestLimit });
  }
  const v = validate(body);
  if (v.error) return writeJson({ error: v.error }, { status: 400, rateLimit: requestLimit });
  const { postId, emoji, token } = v;
  const actorLimit = consumeActorRateLimit(token, REACTION_ACTOR_LIMIT);
  if (!actorLimit.allowed) return rateLimitExceeded(actorLimit);

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) return writeJson({ error: '文章不存在' }, { status: 404, rateLimit: actorLimit });

  const existing = db.prepare(
    'SELECT id FROM reactions WHERE post_id = ? AND emoji = ? AND token = ?'
  ).get(postId, emoji, token);

  let active;
  if (existing) {
    db.prepare('DELETE FROM reactions WHERE id = ?').run(existing.id);
    active = false;
  } else {
    db.prepare(
      'INSERT OR IGNORE INTO reactions (post_id, emoji, token, created_at) VALUES (?, ?, ?, ?)'
    ).run(postId, emoji, token, new Date().toISOString());
    active = true;
  }

  return writeJson(
    { counts: countsOf(postId), mine: mineOf(postId, token), emoji, active },
    { rateLimit: actorLimit },
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const postId = Number(searchParams.get('postId'));
  const token = (searchParams.get('token') || '').trim();
  if (!Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json({ error: 'postId 无效' }, { status: 400 });
  }
  return NextResponse.json({
    counts: countsOf(postId),
    mine: token.length >= 8 && token.length <= 64 ? mineOf(postId, token) : [],
  });
}
