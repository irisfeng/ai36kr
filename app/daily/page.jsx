import DailyView from '@/components/DailyView';
import { displayTitle } from '@/lib/editorial';
import { describeEdition } from '@/lib/edition';
import { editionDays, loadLatestEdition } from '@/lib/queries';
import { alternates, dailyShareMeta } from '@/lib/seo';
import { beijingDateKey } from '@/lib/time';

// 本页不读 searchParams，revalidate 会让构建期用空库预渲染并服役空页 → 必须动态
export const dynamic = 'force-dynamic';

function dayTitle(dateKey) {
  const [y, m, d] = dateKey.split('-');
  return `${Number(y)} 年 ${Number(m)} 月 ${Number(d)} 日 AI 日报`;
}

function dailyCopy(edition) {
  if (edition.calendar) {
    return { title: dayTitle(edition.dateKey), description: describeEdition(edition) };
  }
  const title = `最近 ${edition.windowHours} 小时 AI 日报`;
  return { title, description: describeEdition(edition) };
}

export function generateMetadata() {
  const edition = loadLatestEdition();
  const { title, description } = dailyCopy(edition);
  // 预览图的地址带上当天日期：各平台按地址缓存图片，每天换一个地址才会换图
  const date = edition.dateKey || beijingDateKey(new Date().toISOString());
  return {
    title,
    description,
    alternates: alternates('/daily'),
    ...dailyShareMeta({ date, title, description, path: '/daily' }),
  };
}

export default function DailyPage() {
  const edition = loadLatestEdition();
  const now = new Date().toISOString();
  const { title, description } = dailyCopy(edition);
  const todayKey = edition.dateKey || beijingDateKey(now);
  const prev = editionDays().find((d) => d < todayKey);
  const head = edition.headline ? displayTitle(edition.headline) : '';
  return (
    <DailyView
      edition={edition}
      headTitle={title}
      headDesc={description}
      crumbs={[
        { name: '精选', href: '/' },
        { name: 'AI 日报', href: '/daily', current: true },
      ]}
      shareTitle={title}
      shareText={head ? `今日头条：${head}` : description}
      sharePath="/daily"
      navPrev={prev ? `/daily/${prev}` : null}
      showPoster
    />
  );
}
