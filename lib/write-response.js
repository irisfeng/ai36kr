import { NextResponse } from 'next/server';
import { rateLimitHeaders } from './rate-limit.js';

export function writeJson(body, {
  status = 200,
  rateLimit,
  headers = {},
} = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(rateLimit ? rateLimitHeaders(rateLimit) : {}),
      ...headers,
    },
  });
}

export function rateLimitExceeded(rateLimit) {
  return writeJson(
    { error: '请求过于频繁，请稍后重试' },
    { status: 429, rateLimit },
  );
}
