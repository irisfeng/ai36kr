// og:image 回填：对 RSS 未内嵌图片的条目，抓原文页解析 <meta property="og:image">
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT_MS = 8000;
const MAX_BYTES = 400 * 1024; // 只读前 400KB，og 标签都在 <head>

function absolutize(src, base) {
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

export async function fetchOgImage(pageUrl) {
  if (!/^https?:\/\//i.test(pageUrl || '')) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(pageUrl, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('html')) return null;

    // 流式读到上限即断，避免大页面拖慢
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      if (value.length) {
        const tail = Buffer.concat(chunks).toString('utf8');
        if (tail.includes('</head>')) break; // head 读完即可
      }
    }
    reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks).toString('utf8');

    const pick = (re) => {
      const m = html.match(re);
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    // 兼容 property/content 两种属性顺序
    const src =
      pick(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
      pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i) ||
      pick(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
      pick(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i);
    if (!src) return null;
    const abs = absolutize(src.replace(/&amp;/g, '&'), pageUrl);
    if (!abs || !/^https?:/i.test(abs)) return null;
    // 站点 logo/图标类 og 图没有信息量，当作无图处理
    if (/logo|icon-|avatar|placeholder|sprite/i.test(abs)) return null;
    // 36氪无图文章的默认 og 图（2019 年的品牌横幅），同样视为无图
    if (abs.includes('36krcdn.com/20191024/v2_1571894049839')) return null;
    return abs;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
