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

// 清理过期条目，返回删掉的行数。入选过的事件整件留下（代表稿和同一件事的其他报道）：
// 文章页是分享卡片、X 推文和搜索结果指向的地方，日报归档也靠它们，删了链接就死了。
// 历史上有过评论的帖保留。
export function pruneExpired(db, now = Date.now()) {
  return db.prepare(
    `DELETE FROM posts WHERE is_external = 1
       AND id NOT IN (SELECT DISTINCT post_id FROM comments)
       AND COALESCE(event_id, id) NOT IN (SELECT event_id FROM posts WHERE selected = 1 AND event_id IS NOT NULL)
       AND ((is_deep = 0 AND created_at < ?) OR (is_deep = 1 AND created_at < ?))`
  ).run(retentionCutoff(false, now), retentionCutoff(true, now)).changes;
}
