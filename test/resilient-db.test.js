import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createResilientDatabase,
  isHranaStreamNotFound,
  isMutationSql,
} from '../lib/resilient-db.js';

const STREAM_ERROR = new Error(
  'Hrana(Api("status=404 Not Found, body={\\"error\\":\\"stream not found: abc:123\\"}"))',
);

function fakeConnection({ prepareError = null, statement }) {
  return {
    closed: false,
    prepare() {
      if (prepareError) throw prepareError;
      return statement;
    },
    exec() {},
    close() {
      this.closed = true;
    },
  };
}

test('recognizes only the observed Hrana stream expiry error', () => {
  assert.equal(isHranaStreamNotFound(STREAM_ERROR), true);
  assert.equal(isHranaStreamNotFound(new Error('SQLITE_BUSY')), false);
  assert.equal(isHranaStreamNotFound(new Error('stream not found')), false);
});

test('recognizes mutations even when they return rows', () => {
  assert.equal(isMutationSql('UPDATE posts SET score = 1 RETURNING id'), true);
  assert.equal(isMutationSql('WITH chosen AS (SELECT 1) DELETE FROM posts RETURNING id'), true);
  assert.equal(isMutationSql('SELECT * FROM posts'), false);
});

test('reconnects and retries a failed read once', () => {
  const connections = [
    fakeConnection({
      statement: {
        reader: true,
        get() { throw STREAM_ERROR; },
      },
    }),
    fakeConnection({
      statement: {
        reader: true,
        get() { return { value: 42 }; },
      },
    }),
  ];
  let reconnects = 0;
  const db = createResilientDatabase(
    () => connections.shift(),
    { onReconnect: () => { reconnects++; } },
  );

  assert.deepEqual(db.prepare('SELECT 42 AS value').get(), { value: 42 });
  assert.equal(reconnects, 1);
});

test('does not retry a write when its response is lost', () => {
  let connects = 0;
  const db = createResilientDatabase(() => {
    connects++;
    return fakeConnection({
      statement: {
        reader: false,
        run() { throw STREAM_ERROR; },
      },
    });
  });

  assert.throws(() => db.prepare('INSERT INTO events VALUES (?)').run('x'), STREAM_ERROR);
  assert.equal(connects, 1);
});

test('does not retry a mutation invoked through a reader method', () => {
  let connects = 0;
  const db = createResilientDatabase(() => {
    connects++;
    return fakeConnection({
      statement: {
        reader: true,
        get() { throw STREAM_ERROR; },
      },
    });
  });

  assert.throws(
    () => db.prepare('UPDATE events SET seen = 1 RETURNING id').get(),
    STREAM_ERROR,
  );
  assert.equal(connects, 1);
});

test('restores statement options and bindings before retrying a read', () => {
  const restored = [];
  const connections = [
    fakeConnection({
      statement: {
        reader: true,
        pluck() {},
        raw() {},
        bind() {},
        get() { throw STREAM_ERROR; },
      },
    }),
    fakeConnection({
      statement: {
        reader: true,
        pluck(enabled) { restored.push(['pluck', enabled]); },
        raw(enabled) { restored.push(['raw', enabled]); },
        bind(...params) { restored.push(['bind', ...params]); },
        get() {
          restored.push(['get']);
          return 42;
        },
      },
    }),
  ];
  const db = createResilientDatabase(() => connections.shift());

  const result = db
    .prepare('SELECT value FROM events WHERE id = ?')
    .pluck()
    .raw()
    .bind(7)
    .get();

  assert.equal(result, 42);
  assert.deepEqual(restored, [
    ['pluck', true],
    ['raw', true],
    ['bind', 7],
    ['get'],
  ]);
});

test('does not reconnect for unrelated read failures', () => {
  let connects = 0;
  const syntaxError = new Error('SQLITE_ERROR: no such column');
  const db = createResilientDatabase(() => {
    connects++;
    return fakeConnection({
      statement: {
        reader: true,
        all() { throw syntaxError; },
      },
    });
  });

  assert.throws(() => db.prepare('SELECT missing').all(), syntaxError);
  assert.equal(connects, 1);
});

test('safely retries prepare on a fresh connection', () => {
  const connections = [
    fakeConnection({ prepareError: STREAM_ERROR }),
    fakeConnection({
      statement: {
        reader: true,
        all() { return [{ ok: 1 }]; },
      },
    }),
  ];
  const db = createResilientDatabase(() => connections.shift());

  assert.deepEqual(db.prepare('SELECT 1 AS ok').all(), [{ ok: 1 }]);
});

test('never loops when the retried read also fails', () => {
  let connects = 0;
  const db = createResilientDatabase(() => {
    connects++;
    return fakeConnection({
      statement: {
        reader: true,
        get() { throw STREAM_ERROR; },
      },
    });
  });

  assert.throws(() => db.prepare('SELECT 1').get(), STREAM_ERROR);
  assert.equal(connects, 2);
});
