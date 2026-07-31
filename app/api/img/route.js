import { NextResponse } from 'next/server';
import { fetchPublicImage, ImageProxyError } from '@/lib/safe-image';
import { consumeRequestRateLimit } from '@/lib/rate-limit';
import { rateLimitExceeded } from '@/lib/write-response';

export const dynamic = 'force-dynamic';

const ERROR_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

// 限流：开放图片代理按 IP 120 次/分钟（正常浏览远低于此，防刷带宽/函数时长）
const IMG_LIMIT = { scope: 'img', limit: 120, windowMs: 60 * 1000 };

// 分享卡片跨域缩略图代理：仅请求已解析并固定到公网地址的图片，不跟随重定向。
export async function GET(request) {
  const requestLimit = consumeRequestRateLimit(request, IMG_LIMIT);
  if (!requestLimit.allowed) return rateLimitExceeded(requestLimit);
  const rawUrl = new URL(request.url).searchParams.get('u') || '';
  try {
    const image = await fetchPublicImage(rawUrl);
    return new NextResponse(image.body, {
      headers: {
        'Content-Type': image.contentType,
        'Content-Length': String(image.body.length),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const status = error instanceof ImageProxyError ? error.status : 502;
    const message = error instanceof ImageProxyError ? error.message : '图片代理失败';
    return NextResponse.json({ error: message }, { status, headers: ERROR_HEADERS });
  }
}
