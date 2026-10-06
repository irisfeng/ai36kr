// 校准用：看评分分布和各级信源的入选率，决定门槛（lib/editorial.js 的 THRESHOLDS）要不要动。
// 用法：node scripts/score-report.mjs [天数=3]        （读本地库；带 TURSO_* 环境变量则读线上库）
// 改了 prompts/editor.js 之后跑一遍：入选率突然翻倍或腰斩，说明门槛该跟着调了。
import db from '../lib/db.js';
import { THRESHOLDS } from '../lib/editorial.js';

const days = Number(process.argv[2]) || 3;
const since = new Date(Date.now() - days * 86400000).toISOString();
const rows = db.prepare(
  `SELECT COALESCE(tier, 'T2') AS tier, score, COALESCE(noise, '') AS noise, rep, selected,
          src_count, source, COALESCE(title_zh, title) AS title
   FROM posts WHERE created_at >= ? ORDER BY score DESC`
).all(since);

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
const scored = rows.filter((r) => Number.isFinite(r.score));
console.log(`近 ${days} 天：${rows.length} 条，已评分 ${scored.length}（${pct(scored.length, rows.length)}），噪声 ${rows.filter((r) => r.noise).length}`);
const events = rows.filter((r) => r.rep);
console.log(`事件 ${events.length} 个，精选 ${events.filter((r) => r.selected).length}（${pct(events.filter((r) => r.selected).length, events.length)}），多信源事件 ${events.filter((r) => r.src_count > 1).length}\n`);

console.log('分数分布（每格 10 分）');
for (let lo = 90; lo >= 0; lo -= 10) {
  const n = scored.filter((r) => r.score >= lo && r.score < lo + 10 + (lo === 90 ? 1 : 0)).length;
  console.log(`  ${String(lo).padStart(2)}–${lo === 90 ? 100 : lo + 9}  ${'█'.repeat(Math.round((n / Math.max(1, scored.length)) * 60))} ${n}`);
}

console.log('\n各级信源（门槛 → 过线比例，不含报道面加成）');
for (const tier of Object.keys(THRESHOLDS)) {
  const t = scored.filter((r) => r.tier === tier && !r.noise);
  console.log(`  ${tier.padEnd(5)} 门槛 ${THRESHOLDS[tier]}  ${t.filter((r) => r.score >= THRESHOLDS[tier]).length}/${t.length}（${pct(t.filter((r) => r.score >= THRESHOLDS[tier]).length, t.length)}）`);
}

// 贴着门槛的条目最值得人工看：它们决定门槛该往哪边挪
console.log('\n门槛上下 5 分以内的条目');
for (const r of scored.filter((x) => !x.noise && Math.abs(x.score - THRESHOLDS[x.tier]) <= 5).slice(0, 30)) {
  console.log(`  ${r.score} ${r.score >= THRESHOLDS[r.tier] ? '✓' : '·'} [${r.source}] ${r.title}`);
}
