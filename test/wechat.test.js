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
import { WECHAT_MENU } from '../lib/wechat-menu.js';
import { planWechatPush, sendWechatMassText, wechatDailyMessage } from '../lib/wechat-push.js';

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
  assert.equal(resolveWechatIntent(parseWechatMessage(textXml)), 'picks');
  assert.equal(resolveWechatIntent({ msgType: 'text', content: '今日听潮' }), 'daily');
  assert.equal(resolveWechatIntent({ msgType: 'text', content: 'AI 快讯' }), 'picks');
  assert.equal(resolveWechatIntent({ msgType: 'text', content: '热点' }), 'hot');
  // 旧菜单的 key 在菜单重新同步前继续可用
  assert.equal(resolveWechatIntent({ msgType: 'event', event: 'click', eventKey: 'WEEKLY' }), 'hot');
  assert.equal(resolveWechatIntent({ msgType: 'event', event: 'click', eventKey: 'FLASHES' }), 'picks');
  assert.equal(resolveWechatIntent({ msgType: 'text', content: '日报怎么做' }), null);
});

test('publishes three direct menu actions using the supported CLICK event keys', () => {
  assert.deepEqual(WECHAT_MENU, {
    button: [
      { type: 'click', name: '今日日报', key: 'DAILY' },
      { type: 'click', name: '当前热点', key: 'HOT' },
      { type: 'click', name: '最新精选', key: 'PICKS' },
    ],
  });
  for (const button of WECHAT_MENU.button) {
    assert.ok(resolveWechatIntent({ msgType: 'event', event: 'click', eventKey: button.key }));
  }
});

test('subscribe gets the welcome reply and unknown text gets help', () => {
  const welcome = classifyWechatMessage({ msgType: 'event', event: 'subscribe' }).text;
  assert.match(welcome, /回复「日报」/);
  assert.match(welcome, /「热点」/);
  assert.match(welcome, /「精选」/);
  assert.doesNotMatch(welcome, /实测|实践|FDE/);
  assert.match(classifyWechatMessage({ msgType: 'text', content: '你好' }).text, /「日报」「热点」「精选」/);
});

test('builds a dynamic daily card with tracked direct link', () => {
  const card = createWechatCard('daily', {
    posts: [
      { title_zh: '第一个重要变化', title: 'First change' },
      { title: '第二个重要变化' },
    ],
  }, 'https://aikr.shddai.net/path-is-ignored');
  assert.equal(card.title, '听潮日报｜第一个重要变化');
  assert.doesNotMatch(card.title, /条值得看的/);
  assert.equal(new URL(card.url).pathname, '/');
  assert.equal(new URL(card.url).searchParams.get('utm_source'), 'wechat');
  assert.equal(card.picUrl, 'https://aikr.shddai.net/og-cover.png');
  const about = createWechatCard('about', {});
  assert.doesNotMatch(`${about.title}${about.description}`, /实测|实践|FDE/);
  assert.match(about.description, /「日报」「热点」或「精选」/);
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

test('the daily push uses the email subject and the homepage, and skips without a key', async () => {
  const edition = {
    dateKey: '2026-11-15',
    headline: { title: '突发！DeepSeek开放全家桶API', title_zh: null },
  };
  const message = wechatDailyMessage(edition);
  assert.equal(message.title, '听潮日报｜DeepSeek开放全家桶API');
  assert.equal(new URL(message.url).origin + new URL(message.url).pathname, 'https://aikr.shddai.net/');
  assert.equal(new URL(message.url).searchParams.get('utm_source'), 'wechat');
  assert.match(message.text, /听潮日报｜DeepSeek开放全家桶API/);
  assert.equal(planWechatPush({ edition }).action, 'skip');
  assert.equal(planWechatPush({ appId: 'wx', appSecret: 'secret', edition, alreadySent: true }).reason, '今日已推送');
  assert.equal(planWechatPush({ appId: 'wx', appSecret: 'secret', edition: { headline: null } }).reason, '当天没有头条');

  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: options?.body || '' });
    if (String(url).includes('/cgi-bin/token')) {
      return { json: async () => ({ access_token: 'token-value' }) };
    }
    return { json: async () => ({ errcode: 0, msg_id: 42 }) };
  };
  const sent = await sendWechatMassText({
    appId: 'wx-app',
    appSecret: 'super-secret',
    text: message.text,
    clientMsgId: 'tidewire-2026-11-15',
    fetchImpl,
  });
  assert.equal(sent.msgId, 42);
  const payload = JSON.parse(calls[1].body);
  assert.equal(payload.msgtype, 'text');
  assert.equal(payload.clientmsgid, 'tidewire-2026-11-15');
  assert.match(payload.text.content, /https:\/\/aikr\.shddai\.net\/\?/);
  assert.equal(calls[1].url.includes('super-secret'), false);
  assert.equal(calls[1].body.includes('super-secret'), false);

  const failing = async () => ({ json: async () => ({ errcode: 40164, errmsg: 'invalid ip super-secret' }) });
  await assert.rejects(
    () => sendWechatMassText({
      appId: 'wx-app', appSecret: 'super-secret', text: 'x', clientMsgId: 'tidewire-2026-11-15', fetchImpl: failing,
    }),
    (error) => error.message === '获取 access_token 失败：40164' && !error.message.includes('super-secret'),
  );
});
