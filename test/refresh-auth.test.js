import test from 'node:test';
import assert from 'node:assert/strict';

import { authorizeRefresh } from '../lib/refresh-auth.js';

function request(url, authorization) {
  return new Request(url, {
    headers: authorization ? { authorization } : {},
  });
}

test('production refresh fails closed when CRON_SECRET is missing', () => {
  const result = authorizeRefresh(
    request('https://tidewire.example/api/refresh'),
    { NODE_ENV: 'production' },
  );
  assert.deepEqual(result, {
    ok: false,
    status: 503,
    error: 'CRON_SECRET 未配置',
    code: 'MISSING_CRON_SECRET',
  });
});

test('secretless refresh is allowed only for a local development URL', () => {
  assert.equal(
    authorizeRefresh(
      request('http://localhost:3000/api/refresh'),
      { NODE_ENV: 'development' },
    ).ok,
    true,
  );
  assert.equal(
    authorizeRefresh(
      request('https://preview.example/api/refresh'),
      { NODE_ENV: 'development' },
    ).ok,
    false,
  );
});

test('refresh requires an exact bearer secret', () => {
  const env = { NODE_ENV: 'production', CRON_SECRET: 'correct-horse-battery-staple' };
  assert.equal(
    authorizeRefresh(request('https://tidewire.example/api/refresh', 'Bearer wrong'), env).status,
    401,
  );
  assert.equal(
    authorizeRefresh(
      request('https://tidewire.example/api/refresh', 'Bearer correct-horse-battery-staple'),
      env,
    ).ok,
    true,
  );
});
