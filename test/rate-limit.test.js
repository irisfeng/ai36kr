import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MemoryRateLimiter,
  clientIdentifier,
  consumeActorRateLimit,
} from '../lib/rate-limit.js';

function request(headers = {}) {
  return new Request('https://example.com/api/vote', { headers });
}

test('rate limiter permits a bounded window then returns a retry time', () => {
  const limiter = new MemoryRateLimiter();
  const config = { limit: 2, windowMs: 1_000 };

  assert.deepEqual(limiter.consume('client', config, 10_000), {
    allowed: true,
    limit: 2,
    remaining: 1,
    resetAt: 11_000,
  });
  assert.equal(limiter.consume('client', config, 10_100).allowed, true);
  const denied = limiter.consume('client', config, 10_200);
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.equal(denied.resetAt, 11_000);
  assert.equal(limiter.consume('client', config, 11_000).allowed, true);
});

test('client identity trusts platform IP only on Vercel', () => {
  const spoofed = request({
    'x-forwarded-for': '203.0.113.10',
    'x-vercel-forwarded-for': '8.8.8.8',
  });

  assert.equal(clientIdentifier(spoofed, {}), 'shared-anonymous');
  assert.match(clientIdentifier(spoofed, { VERCEL: '1' }), /^ip:[a-f0-9]{24}$/);
  assert.notEqual(
    clientIdentifier(spoofed, { VERCEL: '1' }),
    clientIdentifier(request({ 'x-vercel-forwarded-for': '1.1.1.1' }), { VERCEL: '1' }),
  );
});

test('invalid forwarded addresses use the safe shared fallback', () => {
  assert.equal(
    clientIdentifier(request({ 'x-vercel-forwarded-for': 'not-an-ip' }), { VERCEL: '1' }),
    'shared-anonymous',
  );
});

test('actor limits hash tokens and keep different actors independent', () => {
  const limiter = new MemoryRateLimiter();
  const config = { scope: 'vote', limit: 1, windowMs: 1_000 };

  assert.equal(consumeActorRateLimit('abcdefgh', config, { limiter, now: 100 }).allowed, true);
  assert.equal(consumeActorRateLimit('abcdefgh', config, { limiter, now: 200 }).allowed, false);
  assert.equal(consumeActorRateLimit('ijklmnop', config, { limiter, now: 200 }).allowed, true);
});
