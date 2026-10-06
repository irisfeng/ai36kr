// 保留期：普通条目留 30 天，长文源留 90 天。抓取和清理读同一份，
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
