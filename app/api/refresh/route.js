import { NextResponse } from 'next/server';
import { refresh } from '@/lib/rss';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel Cron / 手动触发聚合：GET /api/refresh
// 配置 CRON_SECRET 后仅接受携带对应 Bearer 令牌的调用（Vercel Cron 自动携带）
export async function GET(request) {
  if (process.env.CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
  }
  const result = await refresh();
  return NextResponse.json({ ok: true, ...(result || {}) });
}
