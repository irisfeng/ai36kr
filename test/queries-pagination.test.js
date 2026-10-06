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

    // 2 号是 1 号所在事件的另一篇报道（非代表稿）；3 号入选且更热
    db.exec(`
      UPDATE posts SET event_id = id, rep = 1, noise = '';
      UPDATE posts SET event_id = 1, rep = 0, source = 'other' WHERE id = 2;
      UPDATE posts SET src_count = 2, hot_score = 1.5, selected = 1 WHERE id = 1;
      UPDATE posts SET hot_score = 2.5, selected = 1 WHERE id = 3;
    `);

    const { listPosts, getPost, editionDays } = await import('../lib/queries.js');
    // 全部：每一条都在，稳定排序后再分页（旧取值 new 仍可用）
    assert.deepEqual(listPosts({ sort: 'all', limit: 2, offset: 0 }).map(({ id }) => id), [3, 2]);
    assert.deepEqual(listPosts({ sort: 'new', limit: 2, offset: 2 }).map(({ id }) => id), [1]);
    // 精选：一件事一条，只出代表稿，并带上同事件的其他报道
    const picks = listPosts({ sort: 'pick', limit: 10 });
    assert.deepEqual(picks.map(({ id }) => id), [3, 1]);
    assert.deepEqual(picks[1].coverage.map(({ id, source }) => [id, source]), [[2, 'other']]);
    // 热点：按事件热度
    assert.deepEqual(listPosts({ sort: 'hot', limit: 10 }).map(({ id }) => id), [3, 1]);
    // 搜索不受「是否入选」限制
    assert.deepEqual(listPosts({ sort: 'pick', q: 'post-2' }).map(({ id }) => id), [2]);
    // 详情页：非代表稿也能看到同事件的代表稿
    assert.deepEqual(getPost(2).coverage.map(({ id }) => id), [1]);
    assert.equal(getPost(999), null);

    // 有日报的日子按北京日历日算：UTC 17:00 已经是北京的第二天；整天只有噪声的不算
    insert.run(4, 'post-4', 'post4', '2026-07-24T17:00:00.000Z');
    insert.run(5, 'post-5', 'post5', '2026-07-20T03:00:00.000Z');
    db.exec(`
      UPDATE posts SET event_id = id, rep = 1, noise = '' WHERE id = 4;
      UPDATE posts SET event_id = id, rep = 1, noise = '行情' WHERE id = 5;
    `);
    assert.deepEqual(editionDays(1), ['2026-07-26', '2026-07-25']);
    // 只有零星一两件事、又没有精选的日子不算一期日报；有精选的日子不看件数
    assert.deepEqual(editionDays(2), ['2026-07-26']);
    assert.deepEqual(editionDays(), ['2026-07-26']);

    // 按时间筛的查询要走 created_at 索引，不能整表扫（Turso 按扫过的行数计费）
    const plan = (sql) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' ; ');
    assert.match(plan("SELECT id, title FROM posts WHERE created_at >= '2026-07-20' ORDER BY created_at"), /SEARCH posts USING INDEX idx_posts_created/);
    assert.match(plan('SELECT id, title FROM posts ORDER BY created_at DESC, id DESC LIMIT 100'), /USING INDEX idx_posts_created/);
    assert.doesNotMatch(plan('SELECT id, title FROM posts ORDER BY created_at DESC, id DESC LIMIT 100'), /TEMP B-TREE/);
  } finally {
    db?.close?.();
    process.chdir(originalCwd);
    // Windows 上 libsql 原生句柄要到进程退出才释放，删临时目录必现 EBUSY；
    // 清理失败不应判负测试断言（临时目录由 OS 回收），Linux CI 行为不变
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`临时目录清理失败（忽略）: ${e?.code || e}`);
    }
  }
});
