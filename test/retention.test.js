import test from 'node:test';
import assert from 'node:assert/strict';
import { isExpired, retentionCutoff } from '../lib/retention.js';

test('retention keeps regular items 30 days and long-form items 90 days', () => {
  const now = Date.parse('2026-10-06T00:00:00.000Z');
  assert.equal(retentionCutoff(false, now), '2026-09-06T00:00:00.000Z');
  assert.equal(retentionCutoff(true, now), '2026-07-08T00:00:00.000Z');
  // 同一篇 40 天前的文章：普通源已过期，长文源还留着
  const fortyDaysAgo = '2026-08-27T00:00:00.000Z';
  assert.equal(isExpired(fortyDaysAgo, false, now), true);
  assert.equal(isExpired(fortyDaysAgo, true, now), false);
  // Lilian Weng feed 里 2018 年的旧文：不该再入库
  assert.equal(isExpired('2018-04-08T00:00:00.000Z', true, now), true);
  assert.equal(isExpired('2026-10-05T12:00:00.000Z', false, now), false);
});
