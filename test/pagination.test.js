import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PaginationError,
  normalizePostPagination,
  parsePostPagination,
} from '../lib/pagination.js';

test('posts API pagination has a bounded compatible default', () => {
  const params = new URLSearchParams();
  assert.deepEqual(parsePostPagination(params), { limit: 50, offset: 0 });
  assert.deepEqual(
    parsePostPagination(new URLSearchParams('limit=100&offset=250')),
    { limit: 100, offset: 250 },
  );
});

test('posts API rejects malformed and excessive pagination values', () => {
  for (const query of [
    'limit=0',
    'limit=101',
    'limit=2.5',
    'limit=abc',
    'offset=-1',
    'offset=10001',
    'offset=1.5',
  ]) {
    assert.throws(
      () => parsePostPagination(new URLSearchParams(query)),
      PaginationError,
      query,
    );
  }
});

test('internal post queries remain bounded', () => {
  assert.deepEqual(normalizePostPagination({ limit: 200, offset: 0 }), {
    limit: 200,
    offset: 0,
  });
  assert.throws(() => normalizePostPagination({ limit: 201, offset: 0 }), PaginationError);
});
