function isUniqueConstraint(error) {
  return error?.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || /UNIQUE constraint failed/i.test(String(error?.message || error || ''));
}

export function backfillLocalTitleNorms(db, normalize) {
  const rows = db.prepare(
    'SELECT id, title FROM posts WHERE title_norm IS NULL ORDER BY id',
  ).all();
  if (!rows.length) return 0;

  const existing = db.prepare(
    "SELECT title_norm FROM posts WHERE title_norm IS NOT NULL AND title_norm != ''",
  ).all();
  const seen = new Set(existing.map((row) => row.title_norm));
  const update = db.prepare('UPDATE posts SET title_norm = ? WHERE id = ?');
  let updated = 0;

  for (const row of rows) {
    const normalized = normalize(row.title);
    if (!normalized || seen.has(normalized)) {
      update.run(null, row.id);
      continue;
    }
    try {
      update.run(normalized, row.id);
      seen.add(normalized);
      updated++;
    } catch (error) {
      // Next can evaluate separate route bundles concurrently against the same
      // local database. If another bundle claimed this normalized title first,
      // preserve the row with a null norm instead of crashing module loading.
      if (!isUniqueConstraint(error)) throw error;
      update.run(null, row.id);
      seen.add(normalized);
    }
  }
  return updated;
}
