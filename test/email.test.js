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

test('daily email follows the calendar day, and names the rolling window only when today is empty', () => {
  const base = {
    dateStr: '2026 年 11 月 15 日',
    unsubUrl: 'https://example.test/u',
    dailyUrl: 'https://aikr.shddai.net/daily?utm_source=email&utm_medium=daily',
  };
  const post = { id: 402390, title: '黄仁勋时代落幕', source: '钛媒体', src_count: 1 };
  const calendar = dailyEmailHtml({
    ...base,
    edition: { headline: post, highlights: [], sections: [], briefs: [], total: 12, calendar: true, dateKey: '2026-11-15' },
  });
  assert.match(calendar, /当天 12 件事，一件事只说一次/);
  assert.doesNotMatch(calendar, /过去 24 小时/);
  assert.match(calendar, /https:\/\/aikr\.shddai\.net\/daily\?utm_source=email/);

  const rolling = dailyEmailHtml({
    ...base,
    edition: { headline: post, highlights: [], sections: [], briefs: [], total: 7, calendar: false, windowHours: 24 },
  });
  assert.match(rolling, /过去 24 小时 7 件事，一件事只说一次/);
});
