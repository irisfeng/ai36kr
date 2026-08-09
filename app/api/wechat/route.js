import {
  classifyWechatMessage,
  parseWechatMessage,
  renderWechatNewsReply,
  renderWechatTextReply,
  verifyWechatSignature,
} from '@/lib/wechat';
import { loadWechatCard } from '@/lib/wechat-cards';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

function tokenUnavailable() {
  return new Response('WECHAT_TOKEN 未配置', { status: 503 });
}

function signatureParams(request) {
  const url = new URL(request.url);
  return {
    token: process.env.WECHAT_TOKEN,
    timestamp: url.searchParams.get('timestamp'),
    nonce: url.searchParams.get('nonce'),
    signature: url.searchParams.get('signature'),
  };
}

function verified(request) {
  return verifyWechatSignature(signatureParams(request));
}

export function GET(request) {
  if (!process.env.WECHAT_TOKEN) return tokenUnavailable();
  if (!verified(request)) return new Response('invalid signature', { status: 403 });
  const echo = new URL(request.url).searchParams.get('echostr') || '';
  return new Response(echo, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function POST(request) {
  if (!process.env.WECHAT_TOKEN) return tokenUnavailable();
  if (!verified(request)) return new Response('invalid signature', { status: 403 });

  const declaredLength = Number(request.headers.get('content-length')) || 0;
  if (declaredLength > MAX_BODY_BYTES) return new Response('payload too large', { status: 413 });

  const xml = await request.text();
  if (Buffer.byteLength(xml, 'utf8') > MAX_BODY_BYTES) {
    return new Response('payload too large', { status: 413 });
  }

  let message;
  try {
    message = parseWechatMessage(xml);
  } catch {
    return new Response('invalid xml', { status: 400 });
  }

  const action = classifyWechatMessage(message);
  if (action.type === 'empty') return new Response('success');

  const reply = action.type === 'card'
    ? renderWechatNewsReply(message, loadWechatCard(action.intent))
    : renderWechatTextReply(message, action.text);

  return new Response(reply, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
