import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAX_BYTES = 6 * 1024 * 1024;

// 图片代理：分享卡片渲染跨域缩略图用（仅放行 image/*，限 6MB）
export async function GET(request) {
  const u = new URL(request.url).searchParams.get('u') || '';
  if (!/^https?:\/\//i.test(u)) {
    return NextResponse.json({ error: 'url 无效' }, { status: 400 });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(u, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Referer: new URL(u).origin },
    });
    if (!res.ok) return new NextResponse(null, { status: 404 });
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return new NextResponse(null, { status: 415 });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return new NextResponse(null, { status: 413 });
    return new NextResponse(buf, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
