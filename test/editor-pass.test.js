import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 编辑环节走一遍真实的库读写，模型用假的 fetch 顶替
test('editor pass stores score, Chinese title and summary; failures are retried a bounded number of times', async () => {
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidewire-editor-test-'));
  process.chdir(tempDir);
  process.env.ARK_API_KEY = 'test-key';

  let db;
  try {
    ({ default: db } = await import('../lib/db.js'));
    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO posts (id, title, title_norm, source, category, summary, content, created_at, url, is_external, noise)
       VALUES (?, ?, ?, ?, '大模型', ?, '', ?, ?, 1, ?)`,
    );
    insert.run(1, 'OpenAI ships GPT-6.1 Sol', 'a', 'OpenAI', 'Sol costs $2 per 1M tokens.', now, 'https://e.test/1', '');
    insert.run(2, '智谱发布 GLM-5.3', 'b', '36氪', '智谱今日发布 GLM-5.3，价格下调 30%。', now, 'https://e.test/2', '');
    insert.run(3, 'TechCrunch Disrupt tickets', 'c', 'TechCrunch', 'Buy now', now, 'https://e.test/3', '活动');
    insert.run(4, 'Broken item', 'd', 'X', 'text', now, 'https://e.test/4', '');

    const calls = [];
    globalThis.fetch = async (url, init) => {
      const items = JSON.parse(JSON.parse(init.body).messages[1].content);
      calls.push(items.map((it) => it.title));
      // 含 Broken item 的批次回答不合格式：应被拆小重试，最终只有它自己失败
      if (items.some((it) => it.title === 'Broken item')) {
        return new Response(JSON.stringify({ choices: [{ message: { content: '抱歉' } }] }));
      }
      const reply = items.map((it) => it.title.includes('GPT')
        ? { i: it.i, score: 88, title: 'OpenAI 发布 GPT-6.1 Sol', summary: 'OpenAI 发布 GPT-6.1 Sol，每百万 token 定价 2 美元。' }
        // 中文原题不应被改写；摘要里的 50% 在原文里找不到，应被丢弃
        : { i: it.i, score: 71, title: '智谱重磅发布', summary: '智谱发布 GLM-5.3，价格下调 50%。' });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    };

    const { editPosts } = await import('../lib/editor.js');
    // 时间预算用完：一批都不送，也不记失败，留给下一轮
    assert.deepEqual(await editPosts(db, 30, { budgetMs: 0 }), { edited: 0, failed: 0 });
    assert.equal(calls.length, 0);
    assert.equal(db.prepare('SELECT score_tries FROM posts WHERE id = 4').get().score_tries, 0);
    assert.deepEqual(await editPosts(db, 30), { edited: 2, failed: 1 });

    const row = (id) => db.prepare('SELECT score, title_zh, summary_zh, score_tries FROM posts WHERE id = ?').get(id);
    assert.deepEqual(
      [row(1).score, row(1).title_zh, row(1).summary_zh],
      [88, 'OpenAI 发布 GPT-6.1 Sol', 'OpenAI 发布 GPT-6.1 Sol，每百万 token 定价 2 美元。'],
    );
    assert.deepEqual([row(2).score, row(2).title_zh, row(2).summary_zh], [71, null, null]);
    // 噪声条目不送模型
    assert.equal(row(3).score, null);
    assert.equal(calls.flat().includes('TechCrunch Disrupt tickets'), false);
    assert.deepEqual([row(4).score, row(4).score_tries], [null, 1]);

    // 再跑两轮：坏条目到上限后不再重试，也不再调用模型
    await editPosts(db, 30);
    await editPosts(db, 30);
    const before = calls.length;
    assert.deepEqual(await editPosts(db, 30), { edited: 0, failed: 0 });
    assert.equal(calls.length, before);
    assert.equal(row(4).score_tries, 3);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ARK_API_KEY;
    db?.close?.();
    process.chdir(originalCwd);
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* Windows 句柄未释放，忽略 */ }
  }
});
