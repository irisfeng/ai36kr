// 日报的编排规则（纯函数，不调模型）：一件事一条，按重要性排，头条 + 看点 + 分类 + 简讯。
// 输入是时间窗内各事件的代表稿（rep = 1），规则参考 AIHOT 的日报：
//   正文最多 12 条，同一信源最多 2 条；再往后最多 10 条一行简讯
import { effectiveScore, materialTooThin } from './editorial.js';
import { CATEGORIES } from './categories.js';

export const MAIN_MAX = 12;
export const MAIN_PER_SOURCE = 2;
export const BRIEF_MAX = 10;
export const BRIEF_PER_SOURCE = 3;
export const HIGHLIGHTS = 3;
export const MIN_MAIN = 5;

// 重要性 = 综合分（评分或估分 + 报道面）；官方一手稿微加，同分时让原文排前面
export function importance(post) {
  return effectiveScore({
    // 和入选、页面展示用同一个数；旧数据还没有 event_score 时退回这篇自己的分
    score: Number.isFinite(post.event_score) ? post.event_score : post.score,
    tier: post.tier,
    sourceCount: post.src_count,
    extScore: post.ext_score,
  }) + (post.tier === 'T1' ? 2 : 0);
}

function takeWithCap(sorted, max, perSource, counts = new Map()) {
  const taken = [];
  const rest = [];
  for (const p of sorted) {
    const n = counts.get(p.source) || 0;
    if (taken.length < max && n < perSource) {
      taken.push(p);
      counts.set(p.source, n + 1);
    } else {
      rest.push(p);
    }
  }
  return [taken, rest];
}

// RSS 摘要确认不了对象和动作的，可以留在简讯，不能进正文，更不能当头条
export function eligibleForMain(post) {
  return !materialTooThin(post?.summary);
}

export function buildEdition(posts) {
  const clean = posts.filter((p) => p.rep !== 0 && !p.noise);
  const leadable = clean.filter(eligibleForMain);
  const sidelined = clean.filter((p) => !eligibleForMain(p));
  const byImportance = (a, b) =>
    importance(b) - importance(a) || new Date(b.created_at) - new Date(a.created_at) || b.id - a.id;
  const picked = leadable.filter((p) => p.selected).sort(byImportance);
  const others = leadable.filter((p) => !p.selected).sort(byImportance);
  // 清淡的日子精选不足 5 条：用未入选里最好的补到 5 条，日报不开天窗。薄材料不拿来补。
  const pool = picked.length >= MIN_MAIN ? picked : [...picked, ...others.splice(0, MIN_MAIN - picked.length)];

  const [main, overflow] = takeWithCap(pool, MAIN_MAX, MAIN_PER_SOURCE);
  const [briefs] = takeWithCap([...overflow, ...others, ...sidelined], BRIEF_MAX, BRIEF_PER_SOURCE);

  const headline = main[0] || null;
  const highlights = main.slice(1, 1 + HIGHLIGHTS);
  const body = main.slice(1 + HIGHLIGHTS);
  const byCat = new Map();
  for (const p of body) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category).push(p);
  }
  const sections = [
    ...CATEGORIES.filter((c) => byCat.has(c)).map((c) => [c, byCat.get(c)]),
    ...[...byCat].filter(([c]) => !CATEGORIES.includes(c)),
  ];
  return {
    headline,
    highlights,
    sections,
    briefs,
    // 邮件、公众号卡片等只需要一个有序列表的地方用
    main,
    total: clean.length,
  };
}

// 首页和 /daily 共用这一句，避免一个写「当天」、一个写「最近 24 小时」
export function describeEdition(edition) {
  const total = Number(edition?.total) || 0;
  const chosen = edition?.main?.length || 0;
  if (edition?.calendar) return `当天 ${total} 件事，选出 ${chosen} 条。一件事一条。`;
  const hours = Number(edition?.windowHours) || 24;
  return `今天还没有新内容。最近 ${hours} 小时 ${total} 件事，选出 ${chosen} 条。一件事一条。`;
}
