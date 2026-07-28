import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmEmailHtml, dailyEmailHtml } from '../lib/email.js';

const PAYLOAD = '<img src="https://attacker.invalid/pixel">';

test('confirmation email escapes URL text and attribute contexts', () => {
  const html = confirmEmailHtml({
    confirmUrl: `https://example.test/confirm?token="><svg/onload=alert(1)>`,
  });

  assert.doesNotMatch(html, /<svg/i);
  assert.match(html, /&quot;&gt;&lt;svg\/onload=alert\(1\)&gt;/);
});

test('daily email escapes all externally sourced text', () => {
  const html = dailyEmailHtml({
    dateStr: PAYLOAD,
    words: [{ word: PAYLOAD, count: 1 }],
    top3: [{
      id: 1,
      title: PAYLOAD,
      source: PAYLOAD,
      up: 0,
      down: 0,
    }],
    groups: [[PAYLOAD, [{ id: 1, title: PAYLOAD }]]],
    total: 1,
    unsubUrl: 'https://example.test/unsubscribe?token=" onmouseover="alert(1)',
    dailyUrl: 'https://example.test/daily?x=" onmouseover="alert(1)',
  });

  assert.equal(html.includes(PAYLOAD), false);
  assert.doesNotMatch(html, /<img src="https:\/\/attacker\.invalid/);
  assert.doesNotMatch(html, /"\s+onmouseover="/);
  assert.match(html, /&lt;img src=&quot;https:\/\/attacker\.invalid\/pixel&quot;&gt;/);
});
