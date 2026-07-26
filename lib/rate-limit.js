import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const DEFAULT_MAX_ENTRIES = 10_000;

function hashIdentifier(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

export class MemoryRateLimiter {
  constructor({ maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
    this.entries = new Map();
    this.maxEntries = maxEntries;
  }

  consume(key, { limit, windowMs }, now = Date.now()) {
    let entry = this.entries.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
    }

    const allowed = entry.count < limit;
    if (allowed) entry.count += 1;
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.prune(now);

    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
    };
  }

  prune(now) {
    if (this.entries.size <= this.maxEntries) return;
    for (const [key, entry] of this.entries) {
      if (now >= entry.resetAt) this.entries.delete(key);
    }
    while (this.entries.size > Math.floor(this.maxEntries * 0.9)) {
      this.entries.delete(this.entries.keys().next().value);
    }
  }
}

const limiter = new MemoryRateLimiter();

function firstValidIp(value) {
  if (!value) return '';
  const candidate = value.split(',', 1)[0].trim();
  return isIP(candidate) ? candidate : '';
}

// Vercel overwrites x-vercel-forwarded-for. Outside Vercel we deliberately do
// not trust caller-controlled forwarding headers and use a shared safe bucket.
export function clientIdentifier(request, env = process.env) {
  const ip = env.VERCEL
    ? firstValidIp(request.headers.get('x-vercel-forwarded-for'))
    : '';
  return ip ? `ip:${hashIdentifier(ip)}` : 'shared-anonymous';
}

export function consumeRequestRateLimit(request, config, {
  env = process.env,
  store = limiter,
  now = Date.now(),
} = {}) {
  const identity = clientIdentifier(request, env);
  return store.consume(`${config.scope}:client:${identity}`, config, now);
}

export function consumeActorRateLimit(actor, config, {
  limiter: store = limiter,
  now = Date.now(),
} = {}) {
  const identity = hashIdentifier(String(actor));
  return store.consume(`${config.scope}:actor:${identity}`, config, now);
}

export function rateLimitHeaders(result) {
  const headers = {
    'Cache-Control': 'no-store',
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'X-Content-Type-Options': 'nosniff',
  };
  if (!result.allowed) {
    headers['Retry-After'] = String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));
  }
  return headers;
}
