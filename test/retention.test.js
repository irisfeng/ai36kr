import test from 'node:test';
import assert from 'node:assert/strict';
import { isExpired, retentionCutoff, SUMMARY_CAP } from '../lib/retention.js';

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

test('pruning lightens expired representatives and redirects deleted non-reps', async () => {
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
    const longSummary = `摘${'要'.repeat(SUMMARY_CAP)}`;
    const insert = db.prepare(
      `INSERT INTO posts
         (id, title, title_zh, title_norm, source, category, summary, summary_zh, content, image_url,
          created_at, url, is_external, is_deep, event_id, rep, selected)
       VALUES (?, ?, ?, ?, 'test', '大模型', ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    );
    const add = (id, createdAt, { deep = 0, event = id, rep = 1, selected = 0 } = {}) =>
      insert.run(
        id, `post-${id}`, `中文-${id}`, `post${id}`,
        longSummary, longSummary, '正文很长不应该留下', `https://img.test/${id}.jpg`,
        createdAt, `https://e.test/${id}`, deep, event, rep, selected,
      );
    add(1, old, { selected: 1 });            // 入选的代表稿：留，但改成轻量行
    add(2, old, { event: 1, rep: 0 });       // 同一件事的另一篇：到期删掉，跳到 1
    add(3, old);                             // 没入选的代表稿：留成轻量行，不再删除
    add(4, old, { deep: 1 });                // 没入选的长文，还在 90 天内：原样留
    add(5, fresh);                           // 没入选但还新：原样留
    add(6, '2026-06-01T00:00:00.000Z', { deep: 1 });               // 过了 90 天的代表稿：轻量行
    add(7, '2025-01-01T00:00:00.000Z', { selected: 1, deep: 1 });  // 一年多以前入选的代表稿：轻量行
    add(8, old, { event: 1, rep: 0 });       // 有评论的非代表稿：不删
    db.prepare(
      `INSERT INTO comments (post_id, nickname, content, created_at) VALUES (8, '读者', '一条评论', ?)`,
    ).run(old);

    assert.equal(pruneExpired(db, now), 1);
    assert.deepEqual(db.prepare('SELECT id FROM posts ORDER BY id').all().map((r) => r.id), [1, 3, 4, 5, 6, 7, 8]);

    const light = db.prepare('SELECT content, image_url, summary, summary_zh, title, title_zh, url, source, selected FROM posts WHERE id = 1').get();
    assert.equal(light.content, '');
    assert.equal(light.image_url, null);
    assert.equal(light.summary.length, SUMMARY_CAP);
    assert.equal(light.summary_zh.length, SUMMARY_CAP);
    assert.equal(light.title, 'post-1');
    assert.equal(light.title_zh, '中文-1');
    assert.equal(light.url, 'https://e.test/1');
    assert.equal(light.source, 'test');
    assert.equal(light.selected, 1);
    // 还在保留期内的长文和新鲜稿不改
    const kept = db.prepare('SELECT content, image_url FROM posts WHERE id = 4').get();
    assert.equal(kept.content, '正文很长不应该留下');
    assert.equal(kept.image_url, 'https://img.test/4.jpg');
    const freshRow = db.prepare('SELECT content FROM posts WHERE id = 5').get();
    assert.equal(freshRow.content, '正文很长不应该留下');

    assert.equal(db.prepare('SELECT target_id FROM post_redirects WHERE id = 2').get().target_id, 1);
    const { representativeIdFor, getPost } = await import('../lib/queries.js');
    assert.equal(representativeIdFor(2), 1);
    assert.equal(representativeIdFor(999), null);
    const page = getPost(1);
    assert.equal(page.image_url, null);
    assert.ok(page.summary_zh.length <= SUMMARY_CAP);
    assert.equal(page.title_zh, '中文-1');
    assert.equal(page.source, 'test');
    assert.equal(page.url, 'https://e.test/1');
    assert.equal(page.created_at, old);

    // 可重复执行：不再删，也不再改已经轻量化的行
    assert.equal(pruneExpired(db, now), 0);
    assert.equal(db.prepare('SELECT content FROM posts WHERE id = 1').get().content, '');
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
