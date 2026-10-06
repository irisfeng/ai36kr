// 日报的编排规则（纯函数，不调模型）：一件事一条，按重要性排，头条 + 看点 + 分类 + 简讯。
// 输入是时间窗内各事件的代表稿（rep = 1），规则参考 AIHOT 的日报：
//   正文最多 12 条，同一信源最多 2 条；再往后最多 10 条一行简讯
import { effectiveScore } from './editorial.js';
import { CATEGORIES } from './categories.js';

const MAIN_MAX = 12;
const MAIN_PER_SOURCE = 2;
const BRIEF_MAX = 10;
const BRIEF_PER_SOURCE = 3;
const HIGHLIGHTS = 3;
const MIN_MAIN = 5;

// 重要性 = 综合分（评分或估分 + 报道面）；官方一手稿微加，同分时让原文排前面
export function importance(post) {
  return effectiveScore({
    score: post.score,
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

export function buildEdition(posts) {
  const clean = posts.filter((p) => p.rep !== 0 && !p.noise);
  const byImportance = (a, b) =>
    importance(b) - importance(a) || new Date(b.created_at) - new Date(a.created_at) || b.id - a.id;
  const picked = clean.filter((p) => p.selected).sort(byImportance);
  const others = clean.filter((p) => !p.selected).sort(byImportance);
  // 清淡的日子精选不足 5 条：用未入选里最好的补到 5 条，日报不开天窗
  const pool = picked.length >= MIN_MAIN ? picked : [...picked, ...others.splice(0, MIN_MAIN - picked.length)];

  const [main, overflow] = takeWithCap(pool, MAIN_MAX, MAIN_PER_SOURCE);
  const [briefs] = takeWithCap([...overflow, ...others], BRIEF_MAX, BRIEF_PER_SOURCE);

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
