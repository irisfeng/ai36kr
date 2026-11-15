import Link from 'next/link';
import { EditionBody } from '@/components/DailyView';
import { titleOf } from '@/components/Story';
import SubscribeForm from '@/components/SubscribeForm';
import { DAILY_PROMISE } from '@/lib/email';
import { describeEdition } from '@/lib/edition';
import { editionDays, listPosts, loadEdition, loadLatestEdition, sourceHealth } from '@/lib/queries';
import { SITE_DESCRIPTION, SITE_NAME, alternates, editionListItems, itemListJsonLd, jsonLdScript, socialMeta } from '@/lib/seo';
import { beijingDayRange, timeAgo } from '@/lib/time';

// 「今天」不能冻在构建期。带 ?day= 展开前几天时也要按请求渲染。
export const dynamic = 'force-dynamic';

const HOME_TITLE = `${SITE_NAME} - 值得看的 AI 新闻，一件事只说一次`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// 前几天只列最近这些；更早的从归档页往前翻
const EARLIER_SHOWN = 7;

export const metadata = {
  title: { absolute: HOME_TITLE },
  description: SITE_DESCRIPTION,
  alternates: alternates('/'),
  ...socialMeta({ title: HOME_TITLE, description: SITE_DESCRIPTION, path: '/' }),
};

function monthDay(key) {
  const [, m, d] = key.split('-').map(Number);
  return `${m} 月 ${d} 日`;
}

function dayLabel(key, todayKey) {
  const diff = Math.round((new Date(`${todayKey}T00:00:00Z`) - new Date(`${key}T00:00:00Z`)) / 86400000);
  const rel = diff === 0 ? '今天' : diff === 1 ? '昨天' : diff === 2 ? '前天' : '';
  return { rel, date: monthDay(key) };
}

function HomePromise() {
  return (
    <section className="home-promise" aria-label="订阅日报">
      <p>{DAILY_PROMISE}</p>
      <SubscribeForm />
    </section>
  );
}

function openDayFrom(sp, todayKey, days) {
  const raw = Array.isArray(sp?.day) ? sp.day[0] : sp?.day;
  if (typeof raw !== 'string' || !DATE_RE.test(raw) || raw >= todayKey) return null;
  return days.includes(raw) ? raw : null;
}

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const edition = loadLatestEdition();
  const todayKey = edition.dateKey;
  const hot = listPosts({ sort: 'hot', limit: 8 });
  const health = sourceHealth();
  const earlier = editionDays().filter((d) => d < todayKey);
  const openDay = openDayFrom(sp, todayKey, earlier);
  let shown = earlier.slice(0, EARLIER_SHOWN);
  if (openDay && !shown.includes(openDay)) shown = [openDay, ...shown];
  const openEdition = openDay ? loadEdition(beijingDayRange(openDay)) : null;
  const listed = editionListItems(edition);

  return (
    <div className="container page-grid">
      <main className="main-col">
        {listed.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdScript(itemListJsonLd({ name: '今日日报', url: '/', items: listed })) }}
          />
        )}
        <header className="page-head home-head">
          <h1>值得看的 AI 新闻，一件事只说一次</h1>
          <p>今天的头条、看点和简讯。点日期看归档，更早的日子一次展开一天。 <Link href="/about">编辑方法</Link></p>
        </header>

        {edition.calendar ? (
          <h2 className="day-head">
            <Link href={`/daily/${todayKey}`}><b>今天</b>{monthDay(todayKey)}</Link>
            <span>选出 {edition.main.length} 条</span>
          </h2>
        ) : (
          <h2 className="day-head">
            <Link href="/daily">今天还没有新内容</Link>
            <span>最近 {edition.windowHours} 小时</span>
          </h2>
        )}
        <p className="edition-note">{describeEdition(edition)}</p>
        {edition.headline
          ? <EditionBody edition={edition} afterHeadline={<HomePromise />} />
          : (
            <>
              <div className="empty">正在抓取第一批内容，稍后刷新。</div>
              <HomePromise />
            </>
          )}

        {shown.length > 0 && (
          <section className="earlier">
            <h2 className="sec-title">前几天</h2>
            {shown.map((key) => {
              const { rel, date } = dayLabel(key, todayKey);
              const open = key === openDay;
              return (
                <div className="earlier-day" key={key}>
                  <h3 className="day-head">
                    <Link href={`/daily/${key}`}>{rel ? <b>{rel}</b> : null}{date}</Link>
                    {open
                      ? <Link className="day-toggle" href="/">收起</Link>
                      : <Link className="day-toggle" href={`/?day=${key}`}>展开这一天</Link>}
                  </h3>
                  {open && openEdition ? <EditionBody edition={openEdition} /> : null}
                </div>
              );
            })}
            {earlier.length > shown.length && (
              <p className="more-link"><Link href={`/daily/${shown[shown.length - 1]}`}>更早的日报在归档里 →</Link></p>
            )}
          </section>
        )}

        {edition.headline && (
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
          <h3 className="side-title">订阅日报</h3>
          <p className="side-note">{DAILY_PROMISE}</p>
          <SubscribeForm />
        </section>

        <section className="side-card">
          <h3 className="side-title">怎么选的</h3>
          <p className="side-note">
            {health.total} 个信源，每隔几小时抓一轮。行情、活动推广、多事合集先筛掉；
            同一件事的多家报道并成一条；剩下的按公开的标准评分，官方一手门槛低、媒体门槛高。
            {' '}<Link href="/about">规则写在编辑方法里。</Link>
          </p>
          <p className="side-status" suppressHydrationWarning>
            {health.online}/{health.total} 源在线{health.lastFetch ? ` · ${timeAgo(health.lastFetch)}更新` : ''}
          </p>
        </section>
      </aside>
    </div>
  );
}
