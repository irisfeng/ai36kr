import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  classifyWechatMessage,
  parseWechatMessage,
  renderWechatNewsReply,
  resolveWechatIntent,
  verifyWechatSignature,
} from '../lib/wechat.js';
import { createWechatCard } from '../lib/wechat-cards.js';

function signature(token, timestamp, nonce) {
  return createHash('sha1').update([token, timestamp, nonce].sort().join('')).digest('hex');
}

const textXml = `<xml>
<ToUserName><![CDATA[gh_account]]></ToUserName>
<FromUserName><![CDATA[openid_123]]></FromUserName>
<CreateTime>1786200000</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[ 7×24 ]]></Content>
</xml>`;

test('verifies the WeChat SHA-1 callback signature', () => {
  const token = 'listen-to-the-tide';
  const timestamp = '1786200000';
  const nonce = '42';
  assert.equal(verifyWechatSignature({
    token,
    timestamp,
    nonce,
    signature: signature(token, timestamp, nonce),
  }), true);
  assert.equal(verifyWechatSignature({ token, timestamp, nonce, signature: '0'.repeat(40) }), false);
});

test('parses flat WeChat XML without evaluating arbitrary XML entities', () => {
  assert.deepEqual(parseWechatMessage(textXml), {
    toUserName: 'gh_account',
    fromUserName: 'openid_123',
    createTime: 1786200000,
    msgType: 'text',
    content: '7×24',
    event: '',
    eventKey: '',
  });
});

test('routes exact keywords and CLICK event keys to content intents', () => {
  assert.equal(resolveWechatIntent(parseWechatMessage(textXml)), 'flashes');
  assert.equal(resolveWechatIntent({ msgType: 'text', content: '今日听潮' }), 'daily');
  assert.equal(resolveWechatIntent({ msgType: 'text', content: 'AI 快讯' }), 'flashes');
  assert.equal(resolveWechatIntent({ msgType: 'event', event: 'click', eventKey: 'WEEKLY' }), 'weekly');
  assert.equal(resolveWechatIntent({ msgType: 'text', content: '日报怎么做' }), null);
});

test('subscribe gets the welcome reply and unknown text gets help', () => {
  assert.match(classifyWechatMessage({ msgType: 'event', event: 'subscribe' }).text, /回复「日报」/);
  assert.match(classifyWechatMessage({ msgType: 'text', content: '你好' }).text, /「日报」「周榜」「快讯」/);
});

test('builds a dynamic daily card with tracked direct link', () => {
  const card = createWechatCard('daily', {
    posts: [
      { title_zh: '第一个重要变化', title: 'First change' },
      { title: '第二个重要变化' },
    ],
  }, 'https://aikr.shddai.net/path-is-ignored');
  assert.equal(card.title, '今日听潮｜2 条 AI 信号已更新');
  assert.match(card.description, /第一个重要变化；第二个重要变化/);
  assert.equal(new URL(card.url).pathname, '/daily');
  assert.equal(new URL(card.url).searchParams.get('utm_source'), 'wechat');
  assert.equal(card.picUrl, 'https://aikr.shddai.net/og-cover.png');
});

test('renders one tappable news article and safely splits CDATA terminators', () => {
  const message = parseWechatMessage(textXml);
  const reply = renderWechatNewsReply(message, {
    title: '今日]]>听潮',
    description: '两条变化',
    picUrl: 'https://aikr.shddai.net/og-cover.png',
    url: 'https://aikr.shddai.net/daily',
  }, 1786200001);
  assert.match(reply, /<ToUserName><!\[CDATA\[openid_123\]\]><\/ToUserName>/);
  assert.match(reply, /<ArticleCount>1<\/ArticleCount>/);
  assert.match(reply, /<Url><!\[CDATA\[https:\/\/aikr\.shddai\.net\/daily\]\]><\/Url>/);
  assert.match(reply, /今日\]\]\]\]><!\[CDATA\[>听潮/);
});
