import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import db from '@/lib/db';
import { sendEmail, welcomeEmailHtml } from '@/lib/email';
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

  // 蜜罐：正常用户看不到 website 字段，填了即机器人——假装成功，不写库不发信
  if (String(body.website || '').trim()) {
    return NextResponse.json({ ok: true });
  }

  const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
  }

  const existing = db.prepare('SELECT * FROM subscribers WHERE email = ?').get(email);
  if (existing?.confirmed) {
    return NextResponse.json({ ok: true, already: true });
  }

  // 单击订阅（single opt-in）：确认环节流失率高，改为填邮箱即生效。
  // 滥用出口：IP 限流 + 蜜罐 + 欢迎信/每封日报内一键退订 + 发送失败自动退订
  const token = randomBytes(24).toString('hex');
  const now = new Date().toISOString();
  if (existing) {
    db.prepare('UPDATE subscribers SET token = ?, confirmed = 1, confirmed_at = ? WHERE email = ?')
      .run(token, now, email);
  } else {
    db.prepare('INSERT INTO subscribers (email, token, confirmed, created_at, confirmed_at) VALUES (?, ?, 1, ?, ?)')
      .run(email, token, now, now);
  }

  // 欢迎信发失败不阻塞订阅（已生效，日报照发），仅记日志
  try {
    await sendEmail({
      to: email,
      subject: '订阅成功：听潮 · 今日 AI 一页',
      html: welcomeEmailHtml({ unsubUrl: `${SITE}/api/subscribe/unsubscribe?token=${token}` }),
    });
  } catch (e) {
    console.error('[订阅] 欢迎信发送失败（订阅已生效）:', e.message);
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
