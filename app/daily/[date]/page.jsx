import { notFound } from 'next/navigation';
import DailyView from '@/components/DailyView';
import db from '@/lib/db';
import { attachReactions } from '@/lib/queries';
import { hotWords } from '@/lib/keywords';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayRange(date) {
  // 按北京时间取日历日
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 86400000);
  return [start.toISOString(), end.toISOString()];
}

function shiftDate(date, days) {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

function fmt(date) {
  const [y, m, d] = date.split('-');
  return `${Number(y)} 年 ${Number(m)} 月 ${Number(d)} 日`;
}

export async function generateMetadata({ params }) {
  const { date } = await params;
  return {
    title: `${fmt(date)} AI 日报`,
    description: `${fmt(date)} 的 AI 圈一页：当日热词、最受关注 Top3、按分类分组的收录。`,
  };
}

export default async function DailyArchivePage({ params }) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const [start, end] = dayRange(date);
  const rows = db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
       FROM posts p WHERE p.created_at >= ? AND p.created_at < ?
       ORDER BY p.created_at DESC, p.id DESC LIMIT 200`
    )
    .all(start, end);
  const posts = attachReactions(rows);
  const words = hotWords(posts, 12);
  const attention = (p) => (p.up - p.down) + Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
  const top3 = [...posts].sort((a, b) => attention(b) - attention(a)).slice(0, 3);

  const todayStr = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const prev = shiftDate(date, -1);
  const next = date < todayStr ? shiftDate(date, 1) : null;

  return (
    <DailyView
      posts={posts}
      words={words}
      top3={top3}
      headTitle={`${fmt(date)} 日报`}
      headDesc={`当日收录 ${posts.length} 条`}
      shareTitle={`${fmt(date)} AI 日报 · 听潮`}
      shareText={`${fmt(date)} AI 圈：${posts.length} 条收录，热词 ${words.slice(0, 3).map((w) => w.word).join(' / ')}`}
      sharePath={`/daily/${date}`}
      navPrev={`/daily/${prev}`}
      navNext={next ? `/daily/${next}` : null}
    />
  );
}
