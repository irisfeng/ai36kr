import test from 'node:test';
import assert from 'node:assert/strict';
import { isExpired, retentionCutoff } from '../lib/retention.js';

test('retention keeps regular items 30 days and long-form items 90 days', () => {
  const now = Date.parse('2026-10-06T00:00:00.000Z');
  assert.equal(retentionCutoff(false, now), '2026-09-06T00:00:00.000Z');
  assert.equal(retentionCutoff(true, now), '2026-07-08T00:00:00.000Z');
  // 同一篇 40 天前的文章：普通源已过期，长文源还留着
  const fortyDaysAgo = '2026-08-27T00:00:00.000Z';
  assert.equal(isExpired(fortyDaysAgo, false, now), true);
  assert.equal(isExpired(fortyDaysAgo, true, now), false);
  // Lilian Weng feed 里 2018 年的旧文：不该再入库
  assert.equal(isExpired('2018-04-08T00:00:00.000Z', true, now), true);
  assert.equal(isExpired('2026-10-05T12:00:00.000Z', false, now), false);
});

test('pruning keeps selected events whole and drops the rest once expired', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidewire-retention-test-'));
  process.chdir(tempDir);

  let db;
  try {
    ({ default: db } = await import('../lib/db.js'));
    const { pruneExpired } = await import('../lib/retention.js');
    const now = Date.parse('2026-10-06T00:00:00.000Z');
    const old = '2026-08-01T00:00:00.000Z';   // 66 天前：普通源已过期，长文源还没有
    const fresh = '2026-10-01T00:00:00.000Z';
    const insert = db.prepare(
      `INSERT INTO posts (id, title, title_norm, source, category, summary, content, created_at, url, is_external, is_deep, event_id, rep, selected)
       VALUES (?, ?, ?, 'test', '大模型', '', '', ?, ?, 1, ?, ?, ?, ?)`,
    );
    const add = (id, createdAt, { deep = 0, event = id, rep = 1, selected = 0 } = {}) =>
      insert.run(id, `post-${id}`, `post${id}`, createdAt, `https://e.test/${id}`, deep, event, rep, selected);
    add(1, old, { selected: 1 });            // 入选的代表稿：留
    add(2, old, { event: 1, rep: 0 });       // 同一件事的另一篇报道：跟着留
    add(3, old);                             // 没入选：删
    add(4, old, { deep: 1 });                // 没入选的长文，还在 90 天内：留
    add(5, fresh);                           // 没入选但还新：留
    add(6, '2026-06-01T00:00:00.000Z', { deep: 1 });               // 没入选的长文，过了 90 天：删
    add(7, '2025-01-01T00:00:00.000Z', { selected: 1, deep: 1 });  // 一年多以前入选的：留

    assert.equal(pruneExpired(db, now), 2);
    assert.deepEqual(db.prepare('SELECT id FROM posts ORDER BY id').all().map((r) => r.id), [1, 2, 4, 5, 7]);
    // 可重复执行
    assert.equal(pruneExpired(db, now), 0);
  } finally {
    db?.close?.();
    process.chdir(originalCwd);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`临时目录清理失败（忽略）: ${e?.code || e}`);
    }
  }
});
