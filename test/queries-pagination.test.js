import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('post queries apply stable SQL ordering before limit and offset', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidewire-query-test-'));
  process.chdir(tempDir);

  let db;
  try {
    ({ default: db } = await import('../lib/db.js'));
    const createdAt = '2026-07-26T00:00:00.000Z';
    const insert = db.prepare(
      `INSERT INTO posts
        (id, title, title_norm, source, category, summary, content, up, down, created_at, ext_score)
       VALUES (?, ?, ?, 'test', '大模型', '', '', 0, 0, ?, 0)`,
    );
    for (const id of [1, 2, 3]) insert.run(id, `post-${id}`, `post${id}`, createdAt);

    const { listPosts } = await import('../lib/queries.js');
    assert.deepEqual(
      listPosts({ sort: 'new', limit: 2, offset: 0 }).map(({ id }) => id),
      [3, 2],
    );
    assert.deepEqual(
      listPosts({ sort: 'new', limit: 2, offset: 2 }).map(({ id }) => id),
      [1],
    );
    assert.deepEqual(
      listPosts({ sort: 'hot', limit: 2, offset: 0 }).map(({ id }) => id),
      [3, 2],
    );
  } finally {
    db?.close?.();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
