import { NextResponse } from 'next/server';
import { refresh } from '@/lib/rss';
import { authorizeRefresh } from '@/lib/refresh-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel Cron / 手动触发聚合：GET /api/refresh。
// 生产环境必须配置 CRON_SECRET；仅非生产 localhost 可无密钥调用。
export async function GET(request) {
  const authorization = authorizeRefresh(request);
  if (!authorization.ok) {
    if (authorization.code === 'MISSING_CRON_SECRET') {
      console.error('[听潮] /api/refresh 已拒绝：生产环境缺少 CRON_SECRET');
    }
    return NextResponse.json(
      { error: authorization.error },
      {
        status: authorization.status,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  }
  const result = await refresh();
  return NextResponse.json(
    { ok: true, ...(result || {}) },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
