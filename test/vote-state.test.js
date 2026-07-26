import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'libsql';

import { recordVote } from '../lib/vote-state.js';

function testDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      up INTEGER NOT NULL DEFAULT 0,
      down INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      value INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(token, target_type, target_id)
    );
    INSERT INTO posts (id, up, down) VALUES (1, 0, 0);
  `);
  return db;
}

test('vote state supports add, cancel, downvote, and change-vote transitions', () => {
  const db = testDb();
  const input = { targetType: 'post', targetId: 1, token: 'actor-token' };

  assert.deepEqual(recordVote(db, { ...input, value: 1 }), { up: 1, down: 0, vote: 1 });
  assert.deepEqual(recordVote(db, { ...input, value: 1 }), { up: 0, down: 0, vote: 0 });
  assert.deepEqual(recordVote(db, { ...input, value: -1 }), { up: 0, down: 1, vote: -1 });
  assert.deepEqual(recordVote(db, { ...input, value: 1 }), { up: 1, down: 0, vote: 1 });
});

test('vote state reports a missing target without creating a vote', () => {
  const db = testDb();
  const result = recordVote(db, {
    targetType: 'post',
    targetId: 999,
    value: 1,
    token: 'actor-token',
  });

  assert.equal(result, null);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM votes').get().c, 0);
});
