// Next.js instrumentation：Node runtime 启动 RSS 定时聚合（构建阶段不运行）
// Vercel serverless 无常驻进程，定时聚合改由 /api/refresh + Cron 承担
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build' &&
    !process.env.VERCEL
  ) {
    const { startAggregation } = await import('./lib/rss.js');
    startAggregation();
  }
}
