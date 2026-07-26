export const VOTE_TARGETS = {
  post: { table: 'posts', hasDown: true },
  comment: { table: 'comments', hasDown: false },
  flash: { table: 'flashes', hasDown: false },
  product: { table: 'products', hasDown: false },
};

function applyVote(db, target, id, upDelta, downDelta) {
  if (target.hasDown) {
    db.prepare('UPDATE posts SET up = MAX(up + ?, 0), down = MAX(down + ?, 0) WHERE id = ?')
      .run(upDelta, downDelta, id);
  } else {
    db.prepare(`UPDATE ${target.table} SET up = MAX(up + ?, 0) WHERE id = ?`).run(upDelta, id);
  }
}

// Uses single-statement mutations because remote libSQL over HTTP does not
// support an interactive transaction. The unique vote key prevents duplicates.
export function recordVote(db, {
  targetType,
  targetId,
  value,
  token,
  createdAt = new Date().toISOString(),
}) {
  const target = VOTE_TARGETS[targetType];
  if (!target) throw new TypeError('投票对象无效');

  const row = db.prepare(`SELECT id FROM ${target.table} WHERE id = ?`).get(targetId);
  if (!row) return null;

  const existing = db.prepare(
    'SELECT * FROM votes WHERE token = ? AND target_type = ? AND target_id = ?',
  ).get(token, targetType, targetId);

  let currentVote = 0;
  if (existing && existing.value === value) {
    db.prepare('DELETE FROM votes WHERE id = ?').run(existing.id);
    applyVote(db, target, targetId, value === 1 ? -1 : 0, value === -1 ? -1 : 0);
  } else if (existing) {
    db.prepare('UPDATE votes SET value = ?, created_at = ? WHERE id = ?')
      .run(value, createdAt, existing.id);
    applyVote(db, target, targetId, value === 1 ? 1 : -1, value === 1 ? -1 : 1);
    currentVote = value;
  } else {
    try {
      db.prepare(
        'INSERT INTO votes (token, target_type, target_id, value, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(token, targetType, targetId, value, createdAt);
      applyVote(db, target, targetId, value === 1 ? 1 : 0, value === -1 ? 1 : 0);
      currentVote = value;
    } catch (error) {
      if (!String(error?.message || error).includes('UNIQUE')) throw error;
      const concurrent = db.prepare(
        'SELECT value FROM votes WHERE token = ? AND target_type = ? AND target_id = ?',
      ).get(token, targetType, targetId);
      currentVote = concurrent?.value || 0;
    }
  }

  const counts = db.prepare(
    `SELECT up${target.hasDown ? ', down' : ''} FROM ${target.table} WHERE id = ?`,
  ).get(targetId);
  return { up: counts.up, down: counts.down ?? 0, vote: currentVote };
}
