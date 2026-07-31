import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import db from '@/lib/db';
import { sendEmail, confirmEmailHtml } from '@/lib/email';
import { consumeRequestRateLimit } from '@/lib/rate-limit';
import { rateLimitExceeded } from '@/lib/write-response';

export const dynamic = 'force-dynamic';

const SITE = 'https://aikr.shddai.net';
const SUB_LIMIT = { scope: 'subscribe', limit: 5, windowMs: 10 * 60 * 1000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request) {
  const requestLimit = consumeRequestRateLimit(request, SUB_LIMIT);
  if (!requestLimit.allowed) return rateLimitExceeded(requestLimit);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
  }

  const existing = db.prepare('SELECT * FROM subscribers WHERE email = ?').get(email);
  if (existing?.confirmed) {
    return NextResponse.json({ ok: true, already: true });
  }

  // 重发冷却：未确认订阅 10 分钟内重复提交不再发信（防邮件轰炸/发信配额消耗），
  // 响应与正常发信一致，不暴露订阅状态
  const RESEND_COOLDOWN_MS = 10 * 60 * 1000;
  if (existing && Date.now() - new Date(existing.created_at).getTime() < RESEND_COOLDOWN_MS) {
    return NextResponse.json({ ok: true });
  }

  const token = existing?.token || randomBytes(24).toString('hex');
  if (existing) {
    db.prepare('UPDATE subscribers SET token = ?, created_at = ? WHERE email = ?')
      .run(token, new Date().toISOString(), email);
  } else {
    db.prepare('INSERT INTO subscribers (email, token, confirmed, created_at) VALUES (?, ?, 0, ?)')
      .run(email, token, new Date().toISOString());
  }

  try {
    await sendEmail({
      to: email,
      subject: '确认订阅：听潮 · 今日 AI 一页',
      html: confirmEmailHtml({ confirmUrl: `${SITE}/api/subscribe/confirm?token=${token}` }),
    });
  } catch (e) {
    return NextResponse.json({ error: '确认邮件发送失败，请稍后重试' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

// GET /api/subscribe/confirm?token= — 确认订阅并跳回首页
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const path = new URL(request.url).pathname;

  if (path.endsWith('/confirm')) {
    const token = searchParams.get('token') || '';
    const r = db.prepare(
      "UPDATE subscribers SET confirmed = 1, confirmed_at = ? WHERE token = ?"
    ).run(new Date().toISOString(), token);
    const dest = r.changes ? '/?subscribed=1' : '/?subscribed=0';
    return NextResponse.redirect(new URL(dest, SITE));
  }

  if (path.endsWith('/unsubscribe')) {
    const token = searchParams.get('token') || '';
    const r = db.prepare('DELETE FROM subscribers WHERE token = ?').run(token);
    return NextResponse.redirect(new URL(r.changes ? '/?unsubscribed=1' : '/', SITE));
  }

  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
