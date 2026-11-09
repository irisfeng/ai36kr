import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import CoverImage from '@/components/CoverImage';
import ShareButtons from '@/components/ShareButtons';
import ShareCard from '@/components/ShareCard';
import BackLink from '@/components/BackLink';
import Breadcrumb from '@/components/Breadcrumb';
import { titleOf, summaryOf } from '@/components/Story';
import { editionDays, getPost, representativeIdFor, sameDayPicks } from '@/lib/queries';
import { TIER_LABEL } from '@/lib/editorial';
import { CATEGORIES } from '@/lib/categories';
import { normalizeExternalHttpUrl } from '@/lib/external-url';
import { jsonLdScript, metaDescription, newsArticleJsonLd, pageMetadata } from '@/lib/seo';
import { beijingDateKey, dateGroup, timeHM } from '@/lib/time';

export const revalidate = 60;

function loadPost(rawId) {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? getPost(id) : null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const post = loadPost(id);
  if (!post) return { title: '文章不存在' };
  const title = titleOf(post);
  const summary = summaryOf(post);
  const description = metaDescription(summary, title);
  const image = normalizeExternalHttpUrl(post.image_url);
  return pageMetadata({
    title,
    description,
    path: `/post/${post.id}`,
    images: image ? [image] : ['/og-cover.png'],
    type: 'article',
    openGraph: { publishedTime: post.created_at, section: post.category },
  });
}

export default async function PostPage({ params }) {
  const { id } = await params;
  const post = loadPost(id);
  if (!post) {
    const numeric = Number(id);
    const target = Number.isSafeInteger(numeric) && numeric > 0 ? representativeIdFor(numeric) : null;
    if (target) permanentRedirect(`/post/${target}`);
    notFound();
  }
  const title = titleOf(post);
  const summary = summaryOf(post);
  const day = beijingDateKey(post.created_at);
  const hasDaily = editionDays().includes(day);
  const representative = post.rep ? null : post.coverage.find((item) => item.rep);
  const others = sameDayPicks(post.created_at, post.id);
  const crumbs = [{ name: '精选', href: '/' }];
  if (CATEGORIES.includes(post.category)) {
    crumbs.push({ name: post.category, href: `/all?cat=${encodeURIComponent(post.category)}` });
  }
  crumbs.push({ name: title, href: `/post/${post.id}`, current: true });

  const jsonLd = newsArticleJsonLd({
    id: post.id,
    title,
    summary,
    createdAt: post.created_at,
    source: post.source,
    sourceUrl: post.url,
    originalTitle: post.title_zh ? post.title : '',
    image: post.image_url,
    category: post.category,
  });

  return (
    <div className="container">
      <article className="article">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
        <div className="article-kicker">
          <BackLink />
          <span className="kicker-sep" aria-hidden="true">/</span>
          <Breadcrumb items={crumbs} />
        </div>
        <div className="story-meta">
          <span className={`story-source tier-${post.tier || 'T2'}`}>{post.source}</span>
          {post.tier === 'T1' ? <span className="story-tier">{TIER_LABEL.T1}</span> : null}
          <span>{post.category}</span>
          <time dateTime={post.created_at} suppressHydrationWarning>
            {dateGroup(post.created_at)} {timeHM(post.created_at)}
          </time>
          {Number.isFinite(post.score) ? <span className="story-score" title="编辑评分">{post.score}</span> : null}
        </div>
        <h1>{title}</h1>
        {post.title_zh ? <p className="article-title-orig">{post.title}</p> : null}
        {summary ? <p className="article-summary">{summary}</p> : null}
        <p className="article-note">
          听潮摘要，依据 {post.source} 的 RSS 改写，不是原文全文。时间为入库时间（北京时间）。
          {Number.isFinite(post.score) ? '编辑评分衡量的是这件事值不值得今天看，不是事实核查。' : ''}
          {' '}
          <Link href="/about">编辑方法</Link>
          {hasDaily ? <> · <Link href={`/daily/${day}`}>当天日报</Link></> : null}
          {representative ? <> · <Link href={`/post/${representative.id}`}>这件事的代表稿</Link></> : null}
        </p>
        {post.image_url ? (
          <div className="article-cover">
            <CoverImage src={post.image_url} alt="" className="cover-img" />
          </div>
        ) : null}
        {post.url ? (
          <a className="ext-link-btn" href={post.url} target="_blank" rel="noopener noreferrer">
            阅读原文 · {post.source} →
          </a>
        ) : null}

        {others.length > 0 && (
          <section className="article-coverage">
            <h2 className="sec-title">这一天的其他精选</h2>
            {others.map((item) => (
              <Link key={item.id} className="row" href={`/post/${item.id}`}>
                <time className="row-time" dateTime={item.created_at} suppressHydrationWarning>{timeHM(item.created_at)}</time>
                <span className="row-title">{item.title_zh || item.title}</span>
                <span className="row-source">{item.source}</span>
              </Link>
            ))}
          </section>
        )}

        {post.coverage.length > 0 && (
          <section className="article-coverage">
            <h2 className="sec-title">同一件事的其他报道</h2>
            {post.coverage.map((c) => (
              <a key={c.id} className="row" href={c.url} target="_blank" rel="noopener noreferrer">
                <time className="row-time" dateTime={c.created_at} suppressHydrationWarning>{timeHM(c.created_at)}</time>
                <span className="row-title">{c.title_zh || c.title}</span>
                <span className="row-source">{c.source} ↗</span>
              </a>
            ))}
          </section>
        )}

        <div className="article-actions">
          <ShareButtons title={title} text={summary} path={`/post/${post.id}`} />
          <ShareCard post={post} />
        </div>
      </article>
    </div>
  );
}
