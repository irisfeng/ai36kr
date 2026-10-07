import Link from 'next/link';
import Story, { titleOf } from '@/components/Story';
import SubscribeForm from '@/components/SubscribeForm';
import { listPicks, listPosts, sourceHealth } from '@/lib/queries';
import { alternates } from '@/lib/seo';
import { beijingDateKey, timeAgo } from '@/lib/time';

// 首页 = 精选：过了编辑门槛的事件，一件事一条，按天分组。
// 整页静态直出、边缘缓存 5 分钟，大多数请求不触发 Function / 数据库
export const revalidate = 300;

export const metadata = { alternates: alternates('/') };

function dayLabel(key, todayKey) {
  const [, m, d] = key.split('-').map(Number);
  const diff = Math.round((new Date(`${todayKey}T00:00:00Z`) - new Date(`${key}T00:00:00Z`)) / 86400000);
  const rel = diff === 0 ? '今天' : diff === 1 ? '昨天' : diff === 2 ? '前天' : '';
  return { rel, date: `${m} 月 ${d} 日` };
}

export default async function HomePage() {
  const posts = listPicks(60);
  const hot = listPosts({ sort: 'hot', limit: 8 });
  const health = sourceHealth();

  const days = [];
  for (const p of posts) {
    const key = beijingDateKey(p.created_at);
    if (!days.length || days[days.length - 1].key !== key) days.push({ key, items: [] });
    days[days.length - 1].items.push(p);
  }
  const todayKey = beijingDateKey(new Date().toISOString());

  return (
    <div className="container page-grid">
      <main className="main-col">
        {posts.length === 0 && <div className="empty">正在抓取第一批内容，稍后刷新。</div>}
        {days.map((day) => {
          const { rel, date } = dayLabel(day.key, todayKey);
          return (
            <section className="day" key={day.key}>
              <h2 className="day-head">
                <Link href={`/daily/${day.key}`}>{rel ? <b>{rel}</b> : null}{date}</Link>
                <span>{day.items.length} 条精选</span>
              </h2>
              {day.items.map((p) => <Story key={p.id} post={p} clock />)}
            </section>
          );
        })}
        {posts.length > 0 && (
          <p className="more-link"><Link href="/all">没入选的也想看？全部动态 →</Link></p>
        )}
      </main>

      <aside className="side-col">
        {hot.length > 0 && (
          <section className="side-card">
            <h3 className="side-title">当前热点 <Link className="side-more" href="/hot">全部 →</Link></h3>
            <ol className="hot-mini">
              {hot.map((p, i) => (
                <li key={p.id}>
                  <span className="hot-num">{i + 1}</span>
                  <Link href={`/post/${p.id}`}>{titleOf(p)}</Link>
                  {p.src_count > 1 ? <span className="hot-src">{p.src_count} 家</span> : null}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="side-card">
          <h3 className="side-title">每日 8 点，一封邮件</h3>
          <p className="side-note">头条、看点和当天值得知道的事。一件事只说一次。</p>
          <SubscribeForm />
        </section>

        <section className="side-card">
          <h3 className="side-title">怎么选的</h3>
          <p className="side-note">
            {health.total} 个信源，每隔几小时抓一轮。行情、活动推广、多事合集先筛掉；
            同一件事的多家报道并成一条；剩下的按公开的标准评分，官方一手门槛低、媒体门槛高。
          </p>
          <p className="side-status" suppressHydrationWarning>
            {health.online}/{health.total} 源在线{health.lastFetch ? ` · ${timeAgo(health.lastFetch)}更新` : ''}
          </p>
        </section>
      </aside>
    </div>
  );
}
