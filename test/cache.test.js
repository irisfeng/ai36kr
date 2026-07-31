import test from 'node:test';
import assert from 'node:assert/strict';
import { cached, bustCache } from '../lib/cache.js';

test('cached：TTL 内复用同一值，不重复计算', () => {
  let calls = 0;
  const fn = () => ++calls;
  const t0 = 1_000_000;
  assert.equal(cached('k1', 1000, fn, t0), 1);
  assert.equal(cached('k1', 1000, fn, t0 + 500), 1); // 未过期，复用
  assert.equal(calls, 1);
});

test('cached：过期后重新计算', () => {
  let calls = 0;
  const fn = () => ++calls;
  const t0 = 1_000_000;
  cached('k2', 1000, fn, t0);
  assert.equal(cached('k2', 1000, fn, t0 + 1001), 2); // 已过期
  assert.equal(calls, 2);
});

test('cached：不同 key 互不影响', () => {
  let calls = 0;
  const fn = () => ++calls;
  const t0 = 1_000_000;
  cached('a', 1000, fn, t0);
  cached('b', 1000, fn, t0);
  assert.equal(calls, 2);
});

test('bustCache：按前缀失效，全清', () => {
  const t0 = 1_000_000;
  let n = 0;
  const fn = () => ++n;
  cached('lp:1', 60_000, fn, t0);
  cached('gp:1', 60_000, fn, t0);
  bustCache('lp:');
  assert.equal(cached('lp:1', 60_000, fn, t0), 3); // lp 被清，重算
  assert.equal(cached('gp:1', 60_000, fn, t0), 2); // gp 命中缓存（旧值 2，未重算）
  bustCache();
  assert.equal(cached('gp:1', 60_000, fn, t0), 4); // 全清后重算
});
