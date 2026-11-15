import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 增长方案里的「三个今天」：滚动 24 小时会把前一天上午的 DeepSeek 留在头条，
// 日历日只收当天的稿。DeepSeek 分更高，用来证明不是按分把昨天捞回来。
const NOW = Date.parse('2026-11-15T01:00:00.000Z'); // 北京时间 11 月 15 日 09:00
const DEEPSEEK_AT = '2026-11-14T02:00:00.000Z'; // 北京时间 11 月 14 日 10:00，仍在 24 小时内
const TODAY_AT = '2026-11-15T00:00:00.000Z'; // 北京时间 11 月 15 日 08:00

test('latest edition is the Beijing calendar day, and rolls back only when that day is empty', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidewire-edition-test-'));
  process.chdir(tempDir);

  let db;
  try {
    ({ default: db } = await import('../lib/db.js'));
    const insert = db.prepare(
      `INSERT INTO posts
        (id, title, title_norm, title_zh, source, category, summary, content, up, down, created_at,
         ext_score, score, event_score, tier, event_id, rep, selected, noise, src_count)
       VALUES (?, ?, ?, ?, '量子位', '大模型', '摘要说明谁做了什么。', '', 0, 0, ?, 0, ?, ?, 'T2', ?, 1, 1, '', 1)`,
    );
    // 前一天的高分稿，滚动窗会把它当头条
    insert.run(403894, '突发！DeepSeek开放全家桶API', 'deepseek-api', '突发！DeepSeek开放全家桶API', DEEPSEEK_AT, 83, 83, 403894);
    // 当天分数更低，日历日仍应选它
    insert.run(402390, '黄仁勋时代落幕，英伟达宣布其卸任', 'huang-step-down', '黄仁勋时代落幕，英伟达宣布其卸任', TODAY_AT, 70, 70, 402390);

    const { bustCache } = await import('../lib/cache.js');
    const { loadLatestEdition, loadEdition } = await import('../lib/queries.js');
    const { beijingDayRange } = await import('../lib/time.js');
    bustCache();

    const latest = loadLatestEdition(NOW);
    const archived = loadEdition(beijingDayRange('2026-11-15'));
    assert.equal(latest.calendar, true);
    assert.equal(latest.dateKey, '2026-11-15');
    assert.equal(latest.windowHours, null);
    assert.equal(latest.headline.id, 402390);
    assert.equal(archived.headline.id, latest.headline.id);
    assert.equal(latest.main.some((p) => p.id === 403894), false);

    // 当天还没有稿：退回滚动 24 小时，头条才是昨天那条
    db.prepare('DELETE FROM posts WHERE id = ?').run(402390);
    bustCache();
    const emptyMorning = loadLatestEdition(NOW);
    assert.equal(emptyMorning.calendar, false);
    assert.equal(emptyMorning.dateKey, '2026-11-15');
    assert.equal(emptyMorning.windowHours, 24);
    assert.equal(emptyMorning.headline.id, 403894);
    assert.equal(loadEdition(beijingDayRange('2026-11-15')).total, 0);

    // 24 小时也是空的，才放宽到 48 小时
    db.prepare('UPDATE posts SET created_at = ? WHERE id = ?').run('2026-11-13T20:00:00.000Z', 403894);
    bustCache();
    const wider = loadLatestEdition(NOW);
    assert.equal(wider.calendar, false);
    assert.equal(wider.windowHours, 48);
    assert.equal(wider.headline.id, 403894);
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
