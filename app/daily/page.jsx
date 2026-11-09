import DailyView from '@/components/DailyView';
import { editionDays, loadLatestEdition } from '@/lib/queries';
import { alternates, dailyShareMeta } from '@/lib/seo';
import { beijingDateKey, dateGroup } from '@/lib/time';

// 本页不读 searchParams，revalidate 会让构建期用空库预渲染并服役空页 → 必须动态
export const dynamic = 'force-dynamic';

function dailyCopy(edition) {
  const today = dateGroup(new Date().toISOString());
  const title = `最近 ${edition.windowHours} 小时 AI 日报`;
  const description = `${today} · 最近 ${edition.windowHours} 小时 ${edition.total} 件事，选出 ${edition.main.length} 条。一件事一条。`;
  return { today, title, description };
}

export function generateMetadata() {
  const edition = loadLatestEdition();
  const { title, description } = dailyCopy(edition);
  // 预览图的地址带上当天日期：各平台按地址缓存图片，每天换一个地址才会换图
  const date = beijingDateKey(new Date().toISOString());
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
  const prev = editionDays().find((d) => d < beijingDateKey(now));
  const head = edition.headline ? (edition.headline.title_zh || edition.headline.title) : '';
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
