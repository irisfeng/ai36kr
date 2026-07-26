// 源健康告警：连续失败达到阈值时自动开 GitHub Issue
// 需要 REPO_ALERT_TOKEN（或 GITHUB_TOKEN），scope 含 repo/issues:write
const REPO = 'irisfeng/ai36kr';
const ALERT_STREAK = 3;

export async function checkSourceAlerts(db) {
  const token = process.env.REPO_ALERT_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) return 0;
  // 恰好达到阈值才告警：已在告警中的（streak > 阈值）不重复开 issue
  const rows = db
    .prepare('SELECT name, home, url, error, fail_streak FROM source_status WHERE fail_streak = ?')
    .all(ALERT_STREAK);
  let opened = 0;
  for (const s of rows) {
    // 先认领再创建：UPDATE 抢占（streak=3→4），多实例并发只有一个能抢到
    const claimed = db
      .prepare('UPDATE source_status SET fail_streak = ? WHERE name = ? AND fail_streak = ?')
      .run(ALERT_STREAK + 1, s.name, ALERT_STREAK).changes;
    if (!claimed) continue;
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'TideWire-Alert/1.0',
        },
        body: JSON.stringify({
          title: `[源告警] ${s.name} 连续 ${ALERT_STREAK} 轮抓取失败`,
          body: [
            `信息源 **${s.name}** 已连续 ${ALERT_STREAK} 轮聚合失败，请检查。`,
            '',
            `- Feed：\`${s.url}\``,
            `- 主页：${s.home || '-'}`,
            `- 最近错误：\`${(s.error || '未知').slice(0, 300)}\``,
            '',
            '_由听潮源健康巡检自动创建；源恢复后请手动关闭。_',
          ].join('\n'),
          labels: ['source-alert'],
        }),
      });
      if (res.ok) {
        opened++;
        console.warn(`[听潮] 源告警已建 issue：${s.name}`);
      } else {
        // 创建失败退回计数，下轮重试
        db.prepare('UPDATE source_status SET fail_streak = ? WHERE name = ?').run(ALERT_STREAK, s.name);
        console.warn(`[听潮] 建 issue 失败 ${s.name}: HTTP ${res.status}`);
      }
    } catch (e) {
      console.warn(`[听潮] 源告警异常 ${s.name}:`, e?.message || e);
    }
  }
  return opened;
}
