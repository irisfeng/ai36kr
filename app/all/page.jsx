import Link from 'next/link';
import { StoryRow } from '@/components/Story';
import { listPosts } from '@/lib/queries';
import { CATEGORIES } from '@/lib/categories';
import { alternates } from '@/lib/seo';
import { beijingDateKey } from '@/lib/time';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

export async function generateMetadata({ searchParams }) {
  const { q = '' } = await searchParams;
  const kw = String(q).trim().slice(0, 100);
  return kw
    ? { title: `「${kw}」的搜索结果`, robots: { index: false } }
    : { title: '全部动态', description: '听潮抓到的每一条 AI 资讯，不筛不并，按时间排列。', alternates: alternates('/all') };
}

export default async function AllPage({ searchParams }) {
  const sp = await searchParams;
  const q = String(sp.q || '').trim().slice(0, 100);
  const cat = CATEGORIES.includes(sp.cat) ? sp.cat : '';
  const requested = Number(sp.page);
  const page = Number.isInteger(requested) && requested > 0 && requested <= 100 ? requested : 1;
  const posts = listPosts({ sort: 'all', q, cat, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  const href = (next) => {
    const p = new URLSearchParams();
    const merged = { q, cat, page, ...next };
    if (merged.q) p.set('q', merged.q);
    if (merged.cat) p.set('cat', merged.cat);
    if (merged.page > 1) p.set('page', String(merged.page));
    const s = p.toString();
    return s ? `/all?${s}` : '/all';
  };

  const days = [];
  for (const p of posts) {
    const key = beijingDateKey(p.created_at);
    if (!days.length || days[days.length - 1].key !== key) days.push({ key, items: [] });
    days[days.length - 1].items.push(p);
  }

  return (
    <div className="container narrow">
      <div className="page-head">
        <h1>{q ? `「${q}」` : '全部动态'}</h1>
        <p>
          {q
            ? <>搜索标题与摘要 · <Link href="/all">清除</Link></>
            : <>抓到的每一条，不筛不并。<i className="row-pick" /> 是进了精选的。</>}
        </p>
      </div>
      <nav className="chips" aria-label="分类">
        <Link href={href({ cat: '', page: 1 })} className={cat ? '' : 'active'}>全部</Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={href({ cat: c, page: 1 })} className={cat === c ? 'active' : ''}>{c}</Link>
        ))}
      </nav>
      {posts.length === 0 && <div className="empty">没有找到相关内容，换个关键词试试。</div>}
      {days.map((day) => (
        <section className="rows" key={day.key}>
          <h2 className="rows-head">{day.key}</h2>
          {day.items.map((p) => <StoryRow key={p.id} post={p} />)}
        </section>
      ))}
      {(page > 1 || posts.length === PAGE_SIZE) && (
        <nav className="pager" aria-label="翻页">
          {page > 1 ? <Link href={href({ page: page - 1 })}>← 更新的</Link> : <span />}
          {posts.length === PAGE_SIZE ? <Link href={href({ page: page + 1 })}>更早的 →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
