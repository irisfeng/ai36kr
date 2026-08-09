import { createHash, timingSafeEqual } from 'node:crypto';

const KEYWORD_INTENTS = new Map([
  ['日报', 'daily'],
  ['今日日报', 'daily'],
  ['今日听潮', 'daily'],
  ['周榜', 'weekly'],
  ['精选', 'weekly'],
  ['本周精选', 'weekly'],
  ['快讯', 'flashes'],
  ['ai快讯', 'flashes'],
  ['7×24', 'flashes'],
  ['7x24', 'flashes'],
  ['关于', 'about'],
  ['听潮', 'about'],
  ['听潮ai', 'about'],
]);

const EVENT_INTENTS = new Map([
  ['DAILY', 'daily'],
  ['WEEKLY', 'weekly'],
  ['FLASHES', 'flashes'],
  ['ABOUT', 'about'],
]);

function safeEqualHex(left, right) {
  if (!/^[a-f\d]{40}$/i.test(left || '') || !/^[a-f\d]{40}$/i.test(right || '')) return false;
  const a = Buffer.from(left.toLowerCase(), 'hex');
  const b = Buffer.from(right.toLowerCase(), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyWechatSignature({ token, timestamp, nonce, signature }) {
  if (!token || !timestamp || !nonce || !signature) return false;
  const digest = createHash('sha1')
    .update([token, timestamp, nonce].sort().join(''))
    .digest('hex');
  return safeEqualHex(digest, signature);
}

function decodeXml(value = '') {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function readTag(xml, tag) {
  const match = String(xml).match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, 'i'));
  return decodeXml((match?.[1] ?? match?.[2] ?? '').trim());
}

export function parseWechatMessage(xml) {
  if (!/^\s*<xml[>\s]/i.test(String(xml))) throw new Error('INVALID_WECHAT_XML');
  const message = {
    toUserName: readTag(xml, 'ToUserName'),
    fromUserName: readTag(xml, 'FromUserName'),
    createTime: Number(readTag(xml, 'CreateTime')) || 0,
    msgType: readTag(xml, 'MsgType').toLowerCase(),
    content: readTag(xml, 'Content'),
    event: readTag(xml, 'Event').toLowerCase(),
    eventKey: readTag(xml, 'EventKey'),
  };
  if (!message.toUserName || !message.fromUserName || !message.msgType) {
    throw new Error('INCOMPLETE_WECHAT_MESSAGE');
  }
  return message;
}

function normalizeKeyword(value = '') {
  return String(value).trim().replace(/\s+/g, '').toLowerCase();
}

export function resolveWechatIntent(message) {
  if (message.msgType === 'text') {
    return KEYWORD_INTENTS.get(normalizeKeyword(message.content)) || null;
  }
  if (message.msgType === 'event' && message.event === 'click') {
    return EVENT_INTENTS.get(String(message.eventKey || '').trim().toUpperCase()) || null;
  }
  return null;
}

export function classifyWechatMessage(message) {
  const intent = resolveWechatIntent(message);
  if (intent) return { type: 'card', intent };
  if (message.msgType === 'event' && message.event === 'subscribe') {
    return { type: 'text', text: welcomeText() };
  }
  if (message.msgType === 'event') return { type: 'empty' };
  return { type: 'text', text: helpText() };
}

export function welcomeText() {
  return [
    '你来了，正好赶上潮水。',
    '这里是「听潮AI」：筛选重要 AI 变化，也记录模型实测、动手实践与 FDE 一线经验。',
    '',
    '回复「日报」查看今日 AI 信号',
    '回复「周榜」查看本周热点',
    '回复「快讯」查看 7×24 动态',
    '',
    '听见变化，理解浪潮。',
  ].join('\n');
}

export function helpText() {
  return '收到。查询内容请回复「日报」「周榜」「快讯」或「关于」。';
}

function cdata(value = '') {
  return `<![CDATA[${String(value).replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

function envelope(message, body, nowSeconds) {
  return `<xml>
<ToUserName>${cdata(message.fromUserName)}</ToUserName>
<FromUserName>${cdata(message.toUserName)}</FromUserName>
<CreateTime>${nowSeconds}</CreateTime>
${body}
</xml>`;
}

export function renderWechatTextReply(message, text, nowSeconds = Math.floor(Date.now() / 1000)) {
  return envelope(message, `<MsgType>${cdata('text')}</MsgType>\n<Content>${cdata(text)}</Content>`, nowSeconds);
}

export function renderWechatNewsReply(message, card, nowSeconds = Math.floor(Date.now() / 1000)) {
  const body = `<MsgType>${cdata('news')}</MsgType>
<ArticleCount>1</ArticleCount>
<Articles>
<item>
<Title>${cdata(card.title)}</Title>
<Description>${cdata(card.description)}</Description>
<PicUrl>${cdata(card.picUrl)}</PicUrl>
<Url>${cdata(card.url)}</Url>
</item>
</Articles>`;
  return envelope(message, body, nowSeconds);
}
