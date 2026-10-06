import DailyView from '@/components/DailyView';
import { editionDays, loadLatestEdition } from '@/lib/queries';
import { alternates } from '@/lib/seo';
import { beijingDateKey, dateGroup } from '@/lib/time';

// 本页不读 searchParams，revalidate 会让构建期用空库预渲染并服役空页 → 必须动态
export const dynamic = 'force-dynamic';

export const metadata = {
  title: '日报',
  description: '今天 AI 圈值得知道的事：一条头条、三条看点，其余按分类排好。一件事只说一次。',
  alternates: alternates('/daily'),
};

export default function DailyPage() {
  const edition = loadLatestEdition();
  const now = new Date().toISOString();
  const today = dateGroup(now);
  const prev = editionDays().find((d) => d < beijingDateKey(now));
  const head = edition.headline ? (edition.headline.title_zh || edition.headline.title) : '';
  return (
    <DailyView
      edition={edition}
      headTitle="日报"
      headDesc={`${today} · 最近 ${edition.windowHours} 小时 ${edition.total} 件事，选出 ${edition.main.length} 条`}
      shareTitle={`听潮日报 · ${today}`}
      shareText={head ? `今日头条：${head}` : '今天 AI 圈值得知道的事'}
      sharePath="/daily"
      navPrev={prev ? `/daily/${prev}` : null}
      showPoster
    />
  );
}
