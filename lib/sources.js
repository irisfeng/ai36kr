// 信源清单。tier 决定入选门槛（见 lib/editorial.js）：
//   T1 官方一手（厂商 / 研究机构自己的博客）· T1_5 一线从业者专栏 · T2 媒体与社区
// 清单参考了 SuYxh/ai-news-aggregator 的 OPML、newsnow 等开源聚合项目，逐个实测可用。
// filterAI: 泛科技源只放行 AI 相关条目；deep: 长文源，进「深度长读」tab
export const FEEDS = [
  // -- 中文 --
  // 36氪裸域名 /feed 已返回反爬 HTML，www 子域正常（2026-08 实测）
  { name: '36氪', tier: 'T2', url: 'https://www.36kr.com/feed', home: 'https://36kr.com', filterAI: true },
  { name: '量子位', tier: 'T2', url: 'https://www.qbitai.com/feed', home: 'https://www.qbitai.com', deep: true },
  { name: '爱范儿', tier: 'T2', url: 'https://www.ifanr.com/feed', home: 'https://www.ifanr.com', filterAI: true, deep: true },
  { name: 'InfoQ', tier: 'T2', url: 'https://www.infoq.cn/feed', home: 'https://www.infoq.cn', filterAI: true },
  { name: 'SuperTechFans', tier: 'T2', url: 'https://www.supertechfans.com/cn/index.xml', home: 'https://www.supertechfans.com/cn/', filterAI: true },
  { name: '宝玉', tier: 'T1_5', url: 'https://baoyu.io/feed.xml', home: 'https://baoyu.io', filterAI: true, deep: true },
  { name: '阮一峰', tier: 'T1_5', url: 'http://feeds.feedburner.com/ruanyifeng', home: 'https://www.ruanyifeng.com/blog/', filterAI: true, deep: true },
  // -- 英文媒体 --
  { name: 'TechCrunch', tier: 'T2', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', home: 'https://techcrunch.com/category/artificial-intelligence/' },
  { name: 'The Verge', tier: 'T2', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', home: 'https://www.theverge.com/ai-artificial-intelligence' },
  { name: 'Ars Technica', tier: 'T2', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', home: 'https://arstechnica.com', filterAI: true, deep: true },
  { name: 'MIT TR', tier: 'T2', url: 'https://www.technologyreview.com/feed/', home: 'https://www.technologyreview.com', filterAI: true, deep: true },
  { name: 'VentureBeat', tier: 'T2', url: 'https://venturebeat.com/category/ai/feed/', home: 'https://venturebeat.com/category/ai/' },
  { name: 'Hacker News', tier: 'T2', url: 'https://hnrss.org/frontpage', home: 'https://news.ycombinator.com', filterAI: true },
  // -- 官方博客 / 研究机构 --
  { name: 'OpenAI', tier: 'T1', url: 'https://openai.com/news/rss.xml', home: 'https://openai.com/news',
    fallbacks: ['https://openai.com/blog/rss.xml'] },
  { name: 'Google DeepMind', tier: 'T1', url: 'https://deepmind.google/blog/rss.xml', home: 'https://deepmind.google/blog' },
  { name: 'Google Research', tier: 'T1', url: 'https://research.google/blog/rss', home: 'https://research.google/blog/' },
  { name: 'Hugging Face', tier: 'T1', url: 'https://huggingface.co/blog/feed.xml', home: 'https://huggingface.co/blog' },
  { name: 'Microsoft Research', tier: 'T1', url: 'https://www.microsoft.com/en-us/research/feed/', home: 'https://www.microsoft.com/en-us/research/' },
  { name: 'BAIR', tier: 'T1', url: 'https://bair.berkeley.edu/blog/feed.xml', home: 'https://bair.berkeley.edu/blog/', deep: true },
  // -- 深度专栏 --
  { name: 'Import AI', tier: 'T1_5', url: 'https://importai.substack.com/feed', home: 'https://importai.substack.com', deep: true },
  { name: 'Interconnects', tier: 'T1_5', url: 'https://www.interconnects.ai/feed', home: 'https://www.interconnects.ai', deep: true },
  { name: 'Simon Willison', tier: 'T1_5', url: 'https://simonwillison.net/atom/everything/', home: 'https://simonwillison.net', filterAI: true, deep: true },
  // -- 国际顶级专栏 / Newsletter（2026-07 实测）--
  { name: 'AI News', tier: 'T1_5', url: 'https://buttondown.email/ainews/rss', home: 'https://buttondown.email/ainews', deep: true },
  { name: 'Last Week in AI', tier: 'T1_5', url: 'https://lastweekin.ai/feed', home: 'https://lastweekin.ai', deep: true },
  { name: 'Ahead of AI', tier: 'T1_5', url: 'https://magazine.sebastianraschka.com/feed', home: 'https://magazine.sebastianraschka.com', deep: true },
  { name: 'One Useful Thing', tier: 'T1_5', url: 'https://www.oneusefulthing.org/feed', home: 'https://www.oneusefulthing.org', deep: true },
  { name: 'Latent Space', tier: 'T1_5', url: 'https://www.latent.space/feed', home: 'https://www.latent.space', deep: true },
  { name: 'Lilian Weng', tier: 'T1_5', url: 'https://lilianweng.github.io/index.xml', home: 'https://lilianweng.github.io', deep: true },
  { name: 'Chip Huyen', tier: 'T1_5', url: 'https://huyenchip.com/feed.xml', home: 'https://huyenchip.com', deep: true },
  { name: 'Eugene Yan', tier: 'T1_5', url: 'https://eugeneyan.com/rss/', home: 'https://eugeneyan.com', deep: true },
  { name: 'Hamel Husain', tier: 'T1_5', url: 'https://hamel.dev/index.xml', home: 'https://hamel.dev', deep: true },
  { name: 'Meta Engineering', tier: 'T1', url: 'https://engineering.fb.com/feed/', home: 'https://engineering.fb.com', filterAI: true, deep: true },
  // -- 中文补充 --
  { name: '钛媒体', tier: 'T2', url: 'https://www.tmtpost.com/rss.xml', home: 'https://www.tmtpost.com', filterAI: true },
];

const TIER_BY_SOURCE = new Map(FEEDS.map((f) => [f.name, f.tier]));
export function tierOfSource(name) {
  return TIER_BY_SOURCE.get(name) || 'T2';
}
