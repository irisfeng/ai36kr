import Link from 'next/link';
import VoteButtons from '@/components/VoteButtons';
import { listFlashes } from '@/lib/queries';
import { dateGroup, timeHM } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const metadata = { title: '7×24 快讯 - 听潮' };

const PAGE_SIZE = 100;

export default async function FlashesPage({ searchParams }) {
  // Next 15+：searchParams 是 Promise，必须 await
  const sp = await searchParams;
  const before = typeof sp.before === 'string' && !Number.isNaN(Date.parse(sp.before))
    ? sp.before
    : '';
  const flashes = listFlashes({ before, limit: PAGE_SIZE });
  const oldest = flashes[flashes.length - 1];
  const groups = [];
  for (const f of flashes) {
    const d = dateGroup(f.created_at);
    const g = groups[groups.length - 1];
    if (g && g.date === d) g.items.push(f);
    else groups.push({ date: d, items: [f] });
  }

  return (
    <div className="container" style={{ maxWidth: 780 }}>
      <div className="page-head">
        <h1>7×24 快讯</h1>
        <p>AI 行业脉搏，全天候滚动更新。{before ? '（更早的快讯）' : ''}</p>
      </div>
      <div style={{ padding: '16px 0 64px' }}>
        {groups.map((g) => (
          <section className="flash-day" key={g.date}>
            <h2 className="flash-day-title">{g.date}</h2>
            <div className="flash-timeline">
              {g.items.map((f) => (
                <div className="flash-item" key={f.id}>
                  <div className="flash-row">
                    <div>
                      <span className={`flash-tag tag-${f.tag}`}>{f.tag}</span>
                      <span className="flash-time">{timeHM(f.created_at)}</span>
                      {f.source && <span className="flash-source">{f.source}</span>}
                    </div>
                    <p className="flash-content">
                      {f.url ? (
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="flash-link">
                          {f.content}
                        </a>
                      ) : (
                        f.content
                      )}
                    </p>
                    <div className="flash-foot">
                      <VoteButtons targetType="flash" targetId={f.id} initialUp={f.up} showDown={false} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        {flashes.length === 0 && <div className="empty">没有更早的快讯了。</div>}
        <nav className="flash-pager">
          {before ? <Link href="/flashes">← 回到最新</Link> : <span />}
          {flashes.length === PAGE_SIZE && oldest ? (
            <Link href={`/flashes?before=${encodeURIComponent(oldest.created_at)}`}>
              加载更早 ↓
            </Link>
          ) : <span />}
        </nav>
      </div>
    </div>
  );
}
