import DailyView from '@/components/DailyView';
import { listPosts } from '@/lib/queries';
import { hotWords } from '@/lib/keywords';
import { dateGroup } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '今日一页',
  description: '一页看懂今天的 AI 圈：今日热词、最受关注 Top3、按分类分组的 24 小时收录。',
};

// 综合关注度 = 净投票 + 表情反应总数
function attention(p) {
  const reactions = Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
  return (p.up - p.down) + reactions;
}

export default function DailyPage() {
  // 优雅降级：24h 无数据时展示最近 48h
  let windowH = 24;
  let posts = listPosts({ sort: 'new', sinceHours: 24 });
  if (posts.length === 0) {
    windowH = 48;
    posts = listPosts({ sort: 'new', sinceHours: 48 });
  }

  const words = hotWords(posts, 12);
  const top3 = [...posts].sort((a, b) => attention(b) - attention(a)).slice(0, 3);
  const today = dateGroup(new Date().toISOString());

  return (
    <DailyView
      posts={posts}
      words={words}
      top3={top3}
      headDesc={`${today} · 最近 ${windowH} 小时收录 ${posts.length} 条${windowH === 48 ? '（24 小时内暂无更新，已扩展至 48 小时）' : ''}`}
      shareTitle={`今日 AI 一页 · ${today}`}
      shareText={`今天 AI 圈：${posts.length} 条收录，热词 ${words.slice(0, 3).map((w) => w.word).join(' / ')}`}
      sharePath="/daily"
    />
  );
}
