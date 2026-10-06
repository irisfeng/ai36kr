import Link from 'next/link';
import Story, { StoryRow } from '@/components/Story';
import ShareButtons from '@/components/ShareButtons';
import SubscribeForm from '@/components/SubscribeForm';

// 日报视图：/daily（最近 24 小时）与 /daily/[date]（日历日归档）共用。
// 版式即编排规则：头条 → 看点 → 分类 → 简讯（见 lib/edition.js）
export default function DailyView({
  edition, headTitle, headDesc, shareTitle, shareText, sharePath = '/daily',
  navPrev = null, navNext = null, showPoster = false,
}) {
  const { headline, highlights, sections, briefs } = edition;
  return (
    <div className="container narrow">
      <div className="page-head">
        <h1>{headTitle}</h1>
        <p suppressHydrationWarning>{headDesc}</p>
        {(navPrev || navNext) && (
          <nav className="pager">
            {navPrev ? <Link href={navPrev}>← 前一天</Link> : <span />}
            {navNext ? <Link href={navNext}>后一天 →</Link> : <span />}
          </nav>
        )}
      </div>

      {!headline && <div className="empty">这一天还没有收录任何内容。</div>}

      {headline && (
        <section className="edition-sec">
          <h2 className="sec-title">头条</h2>
          <Story post={headline} lead />
        </section>
      )}

      {highlights.length > 0 && (
        <section className="edition-sec">
          <h2 className="sec-title">看点</h2>
          {highlights.map((p) => <Story key={p.id} post={p} />)}
        </section>
      )}

      {sections.map(([cat, items]) => (
        <section className="edition-sec" key={cat}>
          <h2 className="sec-title">{cat}</h2>
          {items.map((p) => <Story key={p.id} post={p} />)}
        </section>
      ))}

      {briefs.length > 0 && (
        <section className="edition-sec rows">
          <h2 className="sec-title">简讯</h2>
          {briefs.map((p) => <StoryRow key={p.id} post={p} />)}
        </section>
      )}

      {headline && (
        <div className="edition-foot">
          <SubscribeForm compact />
          <span className="edition-share">
            <ShareButtons title={shareTitle} text={shareText} path={sharePath} />
            {showPoster ? (
              <a className="share-btn" href="/daily-card.html" target="_blank" rel="noopener noreferrer">头条海报 ↗</a>
            ) : null}
          </span>
        </div>
      )}
    </div>
  );
}
