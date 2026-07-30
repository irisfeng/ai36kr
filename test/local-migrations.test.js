import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'libsql';
import { backfillLocalTitleNorms } from '../lib/local-migrations.js';

const normalize = (title) => String(title).toLowerCase().replace(/\s+/g, '');

test('title norm backfill preserves duplicates without violating the unique index', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      title_norm TEXT
    );
    CREATE UNIQUE INDEX idx_posts_title_norm
      ON posts(title_norm) WHERE title_norm IS NOT NULL AND title_norm != '';
    INSERT INTO posts (id, title, title_norm) VALUES
      (1, 'Kimi K3', 'kimik3'),
      (2, 'Kimi  K3', NULL),
      (3, 'Claude 5', NULL);
  `);

  assert.equal(backfillLocalTitleNorms(db, normalize), 1);
  assert.deepEqual(
    db.prepare('SELECT id, title_norm FROM posts ORDER BY id').all(),
    [
      { id: 1, title_norm: 'kimik3' },
      { id: 2, title_norm: null },
      { id: 3, title_norm: 'claude5' },
    ],
  );
});

test('title norm backfill tolerates a concurrent winner', () => {
  const calls = [];
  const db = {
    prepare(sql) {
      if (sql.startsWith('SELECT id')) {
        return { all: () => [{ id: 2, title: 'Kimi K3' }] };
      }
      if (sql.startsWith('SELECT title_norm')) {
        return { all: () => [] };
      }
      return {
        run(value, id) {
          calls.push([value, id]);
          if (value !== null) {
            const error = new Error('UNIQUE constraint failed: posts.title_norm');
            error.code = 'SQLITE_CONSTRAINT_UNIQUE';
            throw error;
          }
        },
      };
    },
  };

  assert.equal(backfillLocalTitleNorms(db, normalize), 0);
  assert.deepEqual(calls, [['kimik3', 2], [null, 2]]);
});
