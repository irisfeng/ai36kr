import VoteButtons from '@/components/VoteButtons';
import { listFlashes } from '@/lib/queries';
import { dateGroup, timeHM } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const metadata = { title: '7×24 快讯 - 听潮' };

export default function FlashesPage() {
  const flashes = listFlashes();
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
        <p>AI 行业脉搏，全天候滚动更新。</p>
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
      </div>
    </div>
  );
}
