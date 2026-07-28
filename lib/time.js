// 全站时钟/日历显示统一 UTC+8（北京时间），不随服务器或浏览器时区漂移。
// 手法：把时间戳平移 +8h 后读 UTC 访问器，即为北京墙钟时间。
const BEIJING_OFFSET_MS = 8 * 3600000;

export function beijingNow() {
  return new Date(Date.now() + BEIJING_OFFSET_MS);
}

function toBeijing(iso) {
  return new Date(new Date(iso).getTime() + BEIJING_OFFSET_MS);
}

// 北京日历日（YYYY-MM-DD），常用于分组键与「今日」边界
export function beijingDateKey(iso) {
  return toBeijing(iso).toISOString().slice(0, 10);
}

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m} 个月前`;
  return `${Math.floor(m / 12)} 年前`;
}

export function dateGroup(iso) {
  const d = toBeijing(iso);
  return `${d.getUTCFullYear()} 年 ${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`;
}

export function timeHM(iso) {
  const d = toBeijing(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
