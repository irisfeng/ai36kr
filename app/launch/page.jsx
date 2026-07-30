import Link from 'next/link';
import VoteButtons from '@/components/VoteButtons';
import CoverImage from '@/components/CoverImage';
import { listProducts } from '@/lib/queries';
import { productGradient } from '@/lib/categories';
import { timeAgo } from '@/lib/time';

export const revalidate = 60;

export const metadata = { title: 'AI 新品榜 - 听潮' };

export default async function LaunchPage({ searchParams }) {
  // Next 15+：searchParams 是 Promise，必须 await
  const sp = await searchParams;
  const period = sp.period === 'week' ? 'week' : 'today';
  const products = listProducts(period);

  return (
    <div className="container">
      <div className="page-head">
        <h1>AI 新品榜</h1>
        <p>每天发现最值得关注的 AI 新产品，由社区投票定排名。</p>
      </div>
      <nav className="tabs" style={{ marginTop: 8 }}>
        <Link href="/launch" className={period === 'today' ? 'active' : ''}>今日</Link>
        <Link href="/launch?period=week" className={period === 'week' ? 'active' : ''}>本周</Link>
      </nav>
      <div className="launch-grid">
        {products.map((p, i) => (
          <div className="product-card" key={p.id}>
            {i < 3 && <span className={`rank-badge r${i + 1}`}>No.{i + 1}</span>}
            <div className="product-top">
              <span className="product-logo" style={{ background: productGradient(p.name) }}>
                {p.name[0].toUpperCase()}
                {p.image_url ? (
                  <CoverImage src={p.image_url} alt={p.name} className="product-logo-img" />
                ) : null}
              </span>
              <div>
                <div className="product-name">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="product-link">{p.name} ↗</a>
                  ) : (
                    p.name
                  )}
                </div>
                <div className="product-tagline">{p.tagline}</div>
              </div>
            </div>
            <p className="product-desc">{p.description}</p>
            <div className="product-foot">
              <span className="product-cat">{p.category}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }} suppressHydrationWarning>
                {timeAgo(p.created_at)}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <VoteButtons targetType="product" targetId={p.id} initialUp={p.up} showDown={false} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
