import { notFound } from 'next/navigation';
import CoverImage from '@/components/CoverImage';
import ShareButtons from '@/components/ShareButtons';
import ShareCard from '@/components/ShareCard';
import { titleOf, summaryOf } from '@/components/Story';
import { getPost } from '@/lib/queries';
import { TIER_LABEL } from '@/lib/editorial';
import { alternates } from '@/lib/seo';
import { dateGroup, timeHM } from '@/lib/time';

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
  const description = (summaryOf(post) || title).slice(0, 120);
  const images = post.image_url ? [post.image_url] : ['/og-cover.png'];
  return {
    title,
    description,
    alternates: alternates(`/post/${post.id}`),
    openGraph: {
      type: 'article', title, description, images,
      publishedTime: post.created_at, section: post.category,
    },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

export default async function PostPage({ params }) {
  const { id } = await params;
  const post = loadPost(id);
  if (!post) notFound();
  const title = titleOf(post);
  const summary = summaryOf(post);

  // SEO/GEO：NewsArticle 结构化数据（来源、发布时间、原文出处）
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    ...(post.title_zh ? { alternativeHeadline: post.title } : {}),
    ...(summary ? { description: summary } : {}),
    datePublished: post.created_at,
    inLanguage: 'zh-CN',
    author: { '@type': 'Organization', name: post.source },
    publisher: { '@type': 'Organization', name: '听潮 TideWire' },
    image: post.image_url ? [post.image_url] : ['https://aikr.shddai.net/og-cover.png'],
    mainEntityOfPage: `https://aikr.shddai.net/post/${post.id}`,
    ...(post.url ? { isBasedOn: post.url } : {}),
  };

  return (
    <div className="container">
      <article className="article">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
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
