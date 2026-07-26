import Link from 'next/link';
import { getPulse } from '@/lib/pulse';
import { timeAgo } from '@/lib/time';

// 「AI 脉搏」细横条：今日新增 + 热词（可点击搜索）+ 各源在线状态
export default function PulseBar() {
  const pulse = getPulse();

  return (
    <div className="pulse-bar">
      <div className="container pulse-inner">
        <span className="pulse-dot" aria-hidden="true" />
        <span className="pulse-label">AI 脉搏</span>
        <span className="pulse-count">今日 +{pulse.todayCount}</span>
        <div className="pulse-words">
          {pulse.hotWords.length === 0 && <span className="pulse-empty">热词统计中…</span>}
          {pulse.hotWords.map((w) => (
            <Link key={w.word} href={`/?q=${encodeURIComponent(w.word)}`} className="pulse-word">
              {w.word}<i>{w.count}</i>
            </Link>
          ))}
        </div>
        <div className="pulse-sources" title={pulse.sources.map((s) => `${s.ok === null ? '○' : s.ok ? '●' : '×'} ${s.name}`).join('  ')}>
          {pulse.sources.map((s) => (
            <a
              key={s.name}
              href={s.home || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="pulse-src"
              title={`${s.name} · ${s.ok === null ? '待首次抓取' : s.ok ? '正常' : `异常：${s.error || '抓取失败'}`}${s.lastFetch ? ` · 上次抓取 ${timeAgo(s.lastFetch)}` : ''}`}
            >
              <i className={`src-dot ${s.ok === null ? 'wait' : s.ok ? 'on' : 'off'}`} />
            </a>
          ))}
          <span className="pulse-src-count">
            {pulse.sources.filter((s) => s.ok).length}/{pulse.sources.length} 源在线
          </span>
        </div>
      </div>
    </div>
  );
}
