import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_URL_LENGTH = 2048;
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = 'TideWire-Image-Proxy/1.0';

const blockedIpv4 = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]) {
  blockedIpv4.addSubnet(network, prefix, 'ipv4');
}
const blockedIpv6 = new BlockList();
for (const [network, prefix] of [
  ['::', 96],
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
]) {
  blockedIpv6.addSubnet(network, prefix, 'ipv6');
}

export class ImageProxyError extends Error {
  constructor(message, { status = 400, code = 'INVALID_TARGET' } = {}) {
    super(message);
    this.name = 'ImageProxyError';
    this.status = status;
    this.code = code;
  }
}

export function isPublicAddress(address) {
  const family = isIP(address);
  if (!family) return false;
  return family === 4
    ? !blockedIpv4.check(address, 'ipv4')
    : !blockedIpv6.check(address, 'ipv6');
}

function normalizeHostname(hostname) {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function isLocalHostname(hostname) {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal');
}

export async function resolvePublicImageTarget(rawUrl, { lookup = dnsLookup } = {}) {
  if (typeof rawUrl !== 'string' || !rawUrl || rawUrl.length > MAX_URL_LENGTH) {
    throw new ImageProxyError('url 无效');
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ImageProxyError('url 无效');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ImageProxyError('仅支持 http/https');
  }
  if (url.username || url.password) {
    throw new ImageProxyError('url 不得包含凭据');
  }
  if (url.port) {
    throw new ImageProxyError('不允许非标准端口');
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname || hostname.includes('%') || isLocalHostname(hostname)) {
    throw new ImageProxyError('目标主机不允许');
  }

  let answers;
  const literalFamily = isIP(hostname);
  if (literalFamily) {
    answers = [{ address: hostname, family: literalFamily }];
  } else {
    try {
      answers = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new ImageProxyError('目标主机解析失败', { status: 502, code: 'DNS_FAILED' });
    }
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new ImageProxyError('目标主机解析失败', { status: 502, code: 'DNS_FAILED' });
  }
  if (answers.some(({ address }) => !isPublicAddress(address))) {
    throw new ImageProxyError('目标解析到非公网地址', { status: 403, code: 'PRIVATE_ADDRESS' });
  }

  const selected = answers[0];
  url.hash = '';
  return {
    url,
    hostname,
    address: selected.address,
    family: selected.family || isIP(selected.address),
  };
}

function pinnedLookup(target) {
  return (_hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (options?.all) {
      callback(null, [{ address: target.address, family: target.family }]);
    } else {
      callback(null, target.address, target.family);
    }
  };
}

export function openPinnedRequest(target, timeoutMs, { headers } = {}) {
  return new Promise((resolve, reject) => {
    const client = target.url.protocol === 'https:' ? https : http;
    const request = client.request(target.url, {
      method: 'GET',
      headers: headers || {
        Accept: 'image/*',
        'User-Agent': USER_AGENT,
        Referer: target.url.origin,
      },
      lookup: pinnedLookup(target),
      servername: isIP(target.hostname) ? '' : target.hostname,
    }, (response) => resolve({ request, response }));
    request.setTimeout(timeoutMs, () => {
      request.destroy(new ImageProxyError('上游请求超时', {
        status: 504,
        code: 'UPSTREAM_TIMEOUT',
      }));
    });
    request.once('error', reject);
    request.end();
  });
}

export async function fetchPublicImage(rawUrl, {
  lookup = dnsLookup,
  maxBytes = MAX_IMAGE_BYTES,
  timeoutMs = REQUEST_TIMEOUT_MS,
  maxRedirects = 3,
} = {}) {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let resolveTimer;
    const target = await Promise.race([
      resolvePublicImageTarget(currentUrl, { lookup }),
      new Promise((_, reject) => {
        resolveTimer = setTimeout(() => reject(new ImageProxyError('目标主机解析超时', {
          status: 504,
          code: 'DNS_TIMEOUT',
        })), timeoutMs);
      }),
    ]).finally(() => clearTimeout(resolveTimer));
    const { request, response } = await openPinnedRequest(target, timeoutMs);
    const status = response.statusCode || 502;

    // 有限跟随重定向：每一跳重新解析并钉住公网地址（SSRF 防护不降级）
    if (status >= 300 && status < 400) {
      const location = String(response.headers.location || '');
      response.resume();
      request.destroy();
      if (!location) {
        throw new ImageProxyError('上游重定向缺少目标', { status: 502, code: 'REDIRECT_NO_LOCATION' });
      }
      let next;
      try {
        next = new URL(location, target.url).href;
      } catch {
        throw new ImageProxyError('上游重定向目标非法', { status: 502, code: 'REDIRECT_BAD_LOCATION' });
      }
      currentUrl = next;
      continue;
    }

    const totalTimer = setTimeout(() => {
      const error = new ImageProxyError('上游请求超时', {
        status: 504,
        code: 'UPSTREAM_TIMEOUT',
      });
      response.destroy(error);
      request.destroy(error);
    }, timeoutMs);
    try {
      return await readImageResponse(response, request, maxBytes);
    } finally {
      clearTimeout(totalTimer);
    }
  }
  throw new ImageProxyError('重定向次数过多', { status: 502, code: 'TOO_MANY_REDIRECTS' });
}

export async function readImageResponse(response, request, maxBytes = MAX_IMAGE_BYTES) {
  const status = response.statusCode || 502;

  if (status >= 300 && status < 400) {
    response.resume();
    request.destroy();
    throw new ImageProxyError('不跟随上游重定向', { status: 502, code: 'REDIRECT_BLOCKED' });
  }
  if (status < 200 || status >= 300) {
    response.resume();
    throw new ImageProxyError('上游图片不可用', { status: 404, code: 'UPSTREAM_STATUS' });
  }

  const contentType = String(response.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) {
    response.resume();
    request.destroy();
    throw new ImageProxyError('上游内容不是图片', { status: 415, code: 'INVALID_CONTENT_TYPE' });
  }

  const declaredLength = Number(response.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    response.resume();
    request.destroy();
    throw new ImageProxyError('图片超过大小限制', { status: 413, code: 'TOO_LARGE' });
  }

  const chunks = [];
  let totalBytes = 0;
  try {
    for await (const chunk of response) {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        response.destroy();
        request.destroy();
        throw new ImageProxyError('图片超过大小限制', { status: 413, code: 'TOO_LARGE' });
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof ImageProxyError) throw error;
    throw new ImageProxyError('读取上游图片失败', { status: 502, code: 'UPSTREAM_READ_FAILED' });
  }

  return {
    body: Buffer.concat(chunks, totalBytes),
    contentType,
  };
}
