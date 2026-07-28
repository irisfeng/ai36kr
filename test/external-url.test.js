import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeExternalHttpUrl } from '../lib/external-url.js';

test('external URLs are limited to credential-free HTTP(S)', () => {
  assert.equal(normalizeExternalHttpUrl('https://example.com/a#fragment'), 'https://example.com/a');
  assert.equal(normalizeExternalHttpUrl('http://example.com:8080/a'), 'http://example.com:8080/a');
  assert.equal(normalizeExternalHttpUrl('javascript:alert(1)'), null);
  assert.equal(normalizeExternalHttpUrl('data:text/html,hello'), null);
  assert.equal(normalizeExternalHttpUrl('https://user:pass@example.com/a'), null);
  assert.equal(normalizeExternalHttpUrl('not a URL'), null);
  assert.equal(normalizeExternalHttpUrl(''), '');
});

test('external URLs reject oversized input instead of truncating it', () => {
  assert.equal(
    normalizeExternalHttpUrl(`https://example.com/${'x'.repeat(300)}`, { maxLength: 100 }),
    null,
  );
});
