import { notFound } from 'next/navigation';
import DailyView from '@/components/DailyView';
import { editionDays, loadEdition } from '@/lib/queries';
import { alternates, dailyShareMeta } from '@/lib/seo';
import { beijingDateKey, beijingDayRange } from '@/lib/time';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fmt(date) {
  const [y, m, d] = date.split('-');
  return `${Number(y)} 年 ${Number(m)} 月 ${Number(d)} 日`;
}

function isValidDate(date) {
  return DATE_RE.test(date) && !Number.isNaN(new Date(`${date}T00:00:00Z`).getTime());
}

export async function generateMetadata({ params }) {
  const { date } = await params;
  if (!isValidDate(date)) return { title: '日报' };
  const title = `${fmt(date)} AI 日报`;
  const description = `${fmt(date)} AI 圈值得知道的事：头条、看点与分类要闻。`;
  return { title, description, alternates: alternates(`/daily/${date}`), ...dailyShareMeta({ date, title, description }) };
}

export default async function DailyArchivePage({ params }) {
  const { date } = await params;
  if (!isValidDate(date)) notFound();

  // 没有内容的日子（已过保留期、还没到、或当天什么都没抓到）给 404，不留空页给搜索引擎；
  // 今天例外：早上还没内容时页面照常打开
  const days = editionDays();
  if (!days.includes(date) && date !== beijingDateKey(new Date().toISOString())) notFound();

  const edition = loadEdition(beijingDayRange(date));
  // days 是新到旧：前一天取第一个更早的，后一天取最后一个更晚的
  const prev = days.find((d) => d < date);
  const next = days.findLast((d) => d > date);
  const head = edition.headline ? (edition.headline.title_zh || edition.headline.title) : '';

  return (
    <DailyView
      edition={edition}
      headTitle={`${fmt(date)}`}
      headDesc={`当日 ${edition.total} 件事，选出 ${edition.main.length} 条`}
      shareTitle={`${fmt(date)} AI 日报 · 听潮`}
      shareText={head ? `头条：${head}` : `${fmt(date)} AI 日报`}
      sharePath={`/daily/${date}`}
      navPrev={prev ? `/daily/${prev}` : null}
      navNext={next ? `/daily/${next}` : null}
    />
  );
}
