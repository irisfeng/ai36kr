// og:image 回填：对 RSS 未内嵌图片的条目，抓原文页解析 <meta property="og:image">
import { lookup as dnsLookup } from 'node:dns/promises';
import {
  ImageProxyError,
  openPinnedRequest,
  resolvePublicImageTarget,
} from './safe-image.js';

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

export async function fetchOgImage(pageUrl, {
  lookup = dnsLookup,
  timeoutMs = TIMEOUT_MS,
  maxBytes = MAX_BYTES,
} = {}) {
  if (!/^https?:\/\//i.test(pageUrl || '')) return null;
  let resolveTimer;
  let totalTimer;
  let request;
  let response;
  try {
    const target = await Promise.race([
      resolvePublicImageTarget(pageUrl, { lookup }),
      new Promise((_, reject) => {
        resolveTimer = setTimeout(() => reject(new ImageProxyError('目标主机解析超时', {
          status: 504,
          code: 'DNS_TIMEOUT',
        })), timeoutMs);
      }),
    ]).finally(() => clearTimeout(resolveTimer));

    ({ request, response } = await openPinnedRequest(target, timeoutMs, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    }));
    totalTimer = setTimeout(() => {
      response.destroy();
      request.destroy();
    }, timeoutMs);

    const status = response.statusCode || 502;
    if (status < 200 || status >= 300) {
      response.resume();
      request.destroy();
      return null;
    }
    const type = String(response.headers['content-type'] || '').toLowerCase();
    if (!type.includes('html')) {
      response.resume();
      request.destroy();
      return null;
    }
    const declaredLength = Number(response.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      response.resume();
      request.destroy();
      return null;
    }

    // 流式读到上限即断，避免大页面拖慢
    const chunks = [];
    let size = 0;
    for await (const chunk of response) {
      size += chunk.length;
      if (size > maxBytes) {
        response.destroy();
        request.destroy();
        return null;
      }
      chunks.push(chunk);
      if (chunk.length) {
        const tail = Buffer.concat(chunks).toString('utf8');
        if (tail.includes('</head>')) break; // head 读完即可
      }
    }
    response.destroy();
    request.destroy();
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
    // 钛媒体默认 og 图（2023/tkrss 目录是品牌下载横幅，非文章配图）
    if (abs.includes('images.tmtpost.com/uploads/images/2023/tkrss/')) return null;
    // GitHub 仓库 og 图是签名 URL，数小时后过期（返回 618 非图片），存了必坏
    if (abs.includes('repository-images.githubusercontent.com')) return null;
    return abs;
  } catch {
    return null;
  } finally {
    clearTimeout(resolveTimer);
    clearTimeout(totalTimer);
    response?.destroy();
    request?.destroy();
  }
}
