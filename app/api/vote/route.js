import db from '@/lib/db';
import { consumeActorRateLimit, consumeRequestRateLimit } from '@/lib/rate-limit';
import { rateLimitExceeded, writeJson } from '@/lib/write-response';
import { recordVote, VOTE_TARGETS } from '@/lib/vote-state';

export const dynamic = 'force-dynamic';
const VOTE_CLIENT_LIMIT = { scope: 'vote', limit: 60, windowMs: 60 * 1000 };
const VOTE_ACTOR_LIMIT = { scope: 'vote', limit: 40, windowMs: 60 * 1000 };

export async function POST(request) {
  const requestLimit = consumeRequestRateLimit(request, VOTE_CLIENT_LIMIT);
  if (!requestLimit.allowed) return rateLimitExceeded(requestLimit);

  let body;
  try {
    body = await request.json();
  } catch {
    return writeJson({ error: '请求格式错误' }, { status: 400, rateLimit: requestLimit });
  }

  const { targetType, value, token } = body;
  const targetId = Number(body.targetId);
  const target = VOTE_TARGETS[targetType];

  if (!target || !Number.isInteger(targetId) || targetId <= 0) {
    return writeJson({ error: '投票对象无效' }, { status: 400, rateLimit: requestLimit });
  }
  if (value !== 1 && value !== -1) {
    return writeJson({ error: 'value 只能是 1 或 -1' }, { status: 400, rateLimit: requestLimit });
  }
  if (value === -1 && !target.hasDown) {
    return writeJson({ error: '该对象不支持踩' }, { status: 400, rateLimit: requestLimit });
  }
  if (typeof token !== 'string' || token.length < 8 || token.length > 64) {
    return writeJson({ error: 'token 无效' }, { status: 400, rateLimit: requestLimit });
  }
  const actorLimit = consumeActorRateLimit(token, VOTE_ACTOR_LIMIT);
  if (!actorLimit.allowed) return rateLimitExceeded(actorLimit);

  const result = recordVote(db, { targetType, targetId, value, token });
  if (!result) {
    return writeJson({ error: '对象不存在' }, { status: 404, rateLimit: actorLimit });
  }
  return writeJson(result, { rateLimit: actorLimit });
}
