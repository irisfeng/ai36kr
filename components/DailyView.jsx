import Link from 'next/link';
import Story, { StoryRow } from '@/components/Story';
import ShareButtons from '@/components/ShareButtons';
import SubscribeForm from '@/components/SubscribeForm';
import Breadcrumb from '@/components/Breadcrumb';
import { editionListItems, itemListJsonLd, jsonLdScript } from '@/lib/seo';

// 日报正文：头条 → 看点 → 分类 → 简讯（见 lib/edition.js）。
// 首页、/daily 和日历日归档共用，所以三条路径的头条是同一篇。
export function EditionBody({ edition }) {
  const { headline, highlights, sections, briefs } = edition;
  return (
    <>
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
    </>
  );
}

// 日报页壳：/daily 与 /daily/[date] 共用。首页把 EditionBody 放进自己的栏。
export default function DailyView({
  edition, headTitle, headDesc, shareTitle, shareText, sharePath = '/daily',
  navPrev = null, navNext = null, showPoster = false, crumbs = null,
}) {
  const { headline } = edition;
  const listed = editionListItems(edition);
  return (
    <div className="container narrow">
      {listed.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(itemListJsonLd({ name: headTitle, url: sharePath, items: listed })) }}
        />
      )}
      <div className="page-head">
        {crumbs ? <Breadcrumb items={crumbs} /> : null}
        <h1>{headTitle}</h1>
        <p suppressHydrationWarning>{headDesc}</p>
        {(navPrev || navNext) && (
          <nav className="pager">
            {navPrev ? <Link href={navPrev}>← 前一天</Link> : <span />}
            {navNext ? <Link href={navNext}>后一天 →</Link> : <span />}
          </nav>
        )}
      </div>

      <EditionBody edition={edition} />

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
