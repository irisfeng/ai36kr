// 保留期：没入选的条目，普通源留 30 天，长文源留 90 天。抓取和清理读同一份，
// 否则源里带着的旧文会每轮入库、每轮又被清掉（Lilian Weng 的 feed 一直带到 2018 年）
const DAY_MS = 86400000;
export const RETAIN_DAYS = 30;
export const RETAIN_DEEP_DAYS = 90;

export function retentionCutoff(deep, now = Date.now()) {
  return new Date(now - (deep ? RETAIN_DEEP_DAYS : RETAIN_DAYS) * DAY_MS).toISOString();
}

export function isExpired(createdAt, deep, now = Date.now()) {
  return createdAt < retentionCutoff(deep, now);
}

// 站内摘要的上限，和抓取时 RSS 摘要的截断一致。轻量行只留这么长。
export const SUMMARY_CAP = 300;

function sqlTime(iso) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(iso)) {
    throw new Error(`非法的保留期时间：${iso}`);
  }
  return iso;
}

// 到期以后：代表稿改成轻量行，长期留着（含没入选的）。非代表稿删掉，并记下跳到哪篇代表稿。
// 有评论的帖不删，避免把旧评论的外键悬空。返回删掉的行数；轻量化是原地更新，不计入这个数。
// 已经删掉的历史数据没有墓碑，无法补跳转。
export function pruneExpired(db, now = Date.now()) {
  const regular = sqlTime(retentionCutoff(false, now));
  const deep = sqlTime(retentionCutoff(true, now));
  // 先记下跳转，再删非代表稿。没有存活代表稿的（事件没聚成）只删除，调用方继续 404。
  db.exec(`
    INSERT INTO post_redirects (id, target_id)
    SELECT p.id, (
      SELECT r.id FROM posts r
      WHERE r.event_id = p.event_id AND r.rep = 1 AND r.id != p.id
      ORDER BY r.id LIMIT 1
    )
    FROM posts p
    WHERE p.is_external = 1 AND p.rep = 0
      AND p.id NOT IN (SELECT post_id FROM comments)
      AND ((p.is_deep = 0 AND p.created_at < '${regular}') OR (p.is_deep = 1 AND p.created_at < '${deep}'))
      AND (
        SELECT r.id FROM posts r
        WHERE r.event_id = p.event_id AND r.rep = 1 AND r.id != p.id
        ORDER BY r.id LIMIT 1
      ) IS NOT NULL
    ON CONFLICT(id) DO UPDATE SET target_id = excluded.target_id
  `);
  const deleted = db.prepare(
    `DELETE FROM posts WHERE is_external = 1 AND rep = 0
       AND id NOT IN (SELECT post_id FROM comments)
       AND ((is_deep = 0 AND created_at < ?) OR (is_deep = 1 AND created_at < ?))`
  ).run(regular, deep).changes;
  db.prepare(
    `UPDATE posts SET
       content = '',
       image_url = NULL,
       summary = CASE
         WHEN summary IS NULL THEN NULL
         WHEN length(summary) > ${SUMMARY_CAP} THEN substr(summary, 1, ${SUMMARY_CAP})
         ELSE summary END,
       summary_zh = CASE
         WHEN summary_zh IS NULL THEN NULL
         WHEN length(summary_zh) > ${SUMMARY_CAP} THEN substr(summary_zh, 1, ${SUMMARY_CAP})
         ELSE summary_zh END
     WHERE is_external = 1 AND rep = 1
       AND ((is_deep = 0 AND created_at < ?) OR (is_deep = 1 AND created_at < ?))
       AND (
         COALESCE(content, '') != ''
         OR image_url IS NOT NULL
         OR (summary IS NOT NULL AND length(summary) > ${SUMMARY_CAP})
         OR (summary_zh IS NOT NULL AND length(summary_zh) > ${SUMMARY_CAP})
       )`
  ).run(regular, deep);
  return deleted;
}
