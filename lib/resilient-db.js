const HRANA_STREAM_NOT_FOUND = /Hrana[\s\S]*stream not found/i;
const SQL_MUTATION = /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i;

export function isHranaStreamNotFound(error) {
  return HRANA_STREAM_NOT_FOUND.test(String(error?.message || error || ''));
}

export function isMutationSql(sql) {
  return SQL_MUTATION.test(String(sql || ''));
}

class ResilientStatement {
  constructor(database, sql, statement) {
    this.database = database;
    this.sql = sql;
    this.statement = statement;
    this.pluckMode = null;
    this.rawMode = null;
    this.boundParams = null;
  }

  get reader() {
    return this.statement.reader;
  }

  pluck(enabled = true) {
    this.pluckMode = enabled;
    this.statement.pluck(enabled);
    return this;
  }

  raw(enabled = true) {
    this.rawMode = enabled;
    this.statement.raw(enabled);
    return this;
  }

  run(...params) {
    // Writes are deliberately never retried: the server may have committed a
    // mutation even if the client lost its Hrana stream before seeing a reply.
    return this.statement.run(...params);
  }

  get(...params) {
    return this.runRead('get', params);
  }

  all(...params) {
    return this.runRead('all', params);
  }

  iterate(...params) {
    // Retrying a partially-consumed iterator could duplicate rows.
    return this.statement.iterate(...params);
  }

  bind(...params) {
    this.boundParams = params;
    this.statement.bind(...params);
    return this;
  }

  columns() {
    return this.statement.columns();
  }

  runRead(method, params) {
    try {
      return this.statement[method](...params);
    } catch (error) {
      if (
        !this.statement.reader
        || isMutationSql(this.sql)
        || !this.database.isRetryable(error)
      ) throw error;
      this.statement = this.database.reconnectAndPrepare(this.sql);
      if (this.pluckMode !== null) this.statement.pluck(this.pluckMode);
      if (this.rawMode !== null) this.statement.raw(this.rawMode);
      if (this.boundParams !== null) this.statement.bind(...this.boundParams);
      return this.statement[method](...params);
    }
  }
}

export class ResilientDatabase {
  constructor(connect, {
    isRetryable = isHranaStreamNotFound,
    onReconnect = () => {},
  } = {}) {
    this.connect = connect;
    this.isRetryable = isRetryable;
    this.onReconnect = onReconnect;
    this.current = connect();
  }

  get inTransaction() {
    return this.current.inTransaction;
  }

  prepare(sql) {
    let statement;
    try {
      statement = this.current.prepare(sql);
    } catch (error) {
      // Preparing has no SQL side effect, so reconnecting here is safe even
      // when the prepared statement will later be used for a write.
      if (!this.isRetryable(error)) throw error;
      statement = this.reconnectAndPrepare(sql);
    }
    return new ResilientStatement(this, sql, statement);
  }

  exec(sql) {
    // exec may contain writes or multiple statements and is never retried.
    return this.current.exec(sql);
  }

  close() {
    return this.current.close();
  }

  reconnectAndPrepare(sql) {
    const previous = this.current;
    this.current = this.connect();
    try {
      previous.close();
    } catch {
      // An expired Hrana connection may also reject close; the replacement is
      // already active, so there is nothing useful to recover here.
    }
    this.onReconnect();
    return this.current.prepare(sql);
  }
}

export function createResilientDatabase(connect, options) {
  return new ResilientDatabase(connect, options);
}
