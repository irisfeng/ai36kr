import assert from 'node:assert/strict';
import test from 'node:test';
import { welcomeEmailHtml, dailyEmailHtml } from '../lib/email.js';

const PAYLOAD = '<img src="https://attacker.invalid/pixel">';

test('welcome email escapes URL text and attribute contexts', () => {
  const html = welcomeEmailHtml({
    unsubUrl: `https://example.test/unsubscribe?token="><svg/onload=alert(1)>`,
  });

  assert.doesNotMatch(html, /<svg/i);
  assert.match(html, /&quot;&gt;&lt;svg\/onload=alert\(1\)&gt;/);
});

test('daily email escapes all externally sourced text', () => {
  const item = { id: 1, title: PAYLOAD, summary: `${PAYLOAD} summary`, source: PAYLOAD, src_count: 2 };
  const html = dailyEmailHtml({
    dateStr: PAYLOAD,
    edition: {
      headline: item,
      highlights: [item],
      sections: [[PAYLOAD, [item]]],
      briefs: [item],
      total: 1,
    },
    unsubUrl: 'https://example.test/unsubscribe?token=" onmouseover="alert(1)',
    dailyUrl: 'https://example.test/daily?x=" onmouseover="alert(1)',
  });

  assert.equal(html.includes(PAYLOAD), false);
  assert.doesNotMatch(html, /<img src="https:\/\/attacker\.invalid/);
  assert.doesNotMatch(html, /"\s+onmouseover="/);
  assert.match(html, /&lt;img src=&quot;https:\/\/attacker\.invalid\/pixel&quot;&gt;/);
});
