import { createHash, timingSafeEqual } from 'node:crypto';

function constantTimeEqual(left, right) {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function isLocalDevelopmentRequest(request, env) {
  if (env.NODE_ENV === 'production') return false;
  let hostname;
  try {
    hostname = new URL(request.url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return false;
  }
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function authorizeRefresh(request, env = process.env) {
  const secret = env.CRON_SECRET || '';
  if (!secret) {
    if (isLocalDevelopmentRequest(request, env)) return { ok: true };
    return {
      ok: false,
      status: 503,
      error: 'CRON_SECRET 未配置',
      code: 'MISSING_CRON_SECRET',
    };
  }

  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/);
  if (!match || !constantTimeEqual(match[1], secret)) {
    return {
      ok: false,
      status: 401,
      error: '未授权',
      code: 'UNAUTHORIZED',
    };
  }
  return { ok: true };
}
