import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// targetType -> { table, hasDown }
const TARGETS = {
  post: { table: 'posts', hasDown: true },
  comment: { table: 'comments', hasDown: false },
  flash: { table: 'flashes', hasDown: false },
  product: { table: 'products', hasDown: false },
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const { targetType, value, token } = body;
  const targetId = Number(body.targetId);
  const target = TARGETS[targetType];

  if (!target || !Number.isInteger(targetId) || targetId <= 0) {
    return NextResponse.json({ error: '投票对象无效' }, { status: 400 });
  }
  if (value !== 1 && value !== -1) {
    return NextResponse.json({ error: 'value 只能是 1 或 -1' }, { status: 400 });
  }
  if (value === -1 && !target.hasDown) {
    return NextResponse.json({ error: '该对象不支持踩' }, { status: 400 });
  }
  if (typeof token !== 'string' || token.length < 8 || token.length > 64) {
    return NextResponse.json({ error: 'token 无效' }, { status: 400 });
  }

  const row = db.prepare(`SELECT id FROM ${target.table} WHERE id = ?`).get(targetId);
  if (!row) return NextResponse.json({ error: '对象不存在' }, { status: 404 });

  const existing = db.prepare(
    'SELECT * FROM votes WHERE token = ? AND target_type = ? AND target_id = ?'
  ).get(token, targetType, targetId);

  // 不用显式事务（远端 libSQL over HTTP 不支持交互式事务）：
  // UNIQUE(token, target_type, target_id) 约束天然防重复插入，
  // 计数更新为单条原子 UPDATE，并发最坏情况是约束冲突后重读，结果仍正确
  let currentVote = 0;
  if (existing && existing.value === value) {
    // 再点一次 = 取消投票（幂等）
    db.prepare('DELETE FROM votes WHERE id = ?').run(existing.id);
    applyVote(target, targetId, value === 1 ? -1 : 0, value === -1 ? -1 : 0);
    currentVote = 0;
  } else if (existing) {
    // 改票：顶 <-> 踩
    db.prepare('UPDATE votes SET value = ?, created_at = ? WHERE id = ?')
      .run(value, new Date().toISOString(), existing.id);
    applyVote(target, targetId, value === 1 ? 1 : -1, value === 1 ? -1 : 1);
    currentVote = value;
  } else {
    try {
      db.prepare(
        'INSERT INTO votes (token, target_type, target_id, value, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(token, targetType, targetId, value, new Date().toISOString());
      applyVote(target, targetId, value === 1 ? 1 : 0, value === -1 ? 1 : 0);
      currentVote = value;
    } catch (e) {
      // 同 token 并发重复提交：视为幂等成功，直接按已投返回
      if (!String(e?.message || e).includes('UNIQUE')) throw e;
      currentVote = value;
    }
  }

  const counts = db.prepare(`SELECT up${target.hasDown ? ', down' : ''} FROM ${target.table} WHERE id = ?`).get(targetId);
  return NextResponse.json({ up: counts.up, down: counts.down ?? 0, vote: currentVote });
}

function applyVote(target, id, upDelta, downDelta) {
  if (target.hasDown) {
    db.prepare('UPDATE posts SET up = MAX(up + ?, 0), down = MAX(down + ?, 0) WHERE id = ?')
      .run(upDelta, downDelta, id);
  } else {
    db.prepare(`UPDATE ${target.table} SET up = MAX(up + ?, 0) WHERE id = ?`).run(upDelta, id);
  }
}
