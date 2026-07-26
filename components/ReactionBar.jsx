'use client';

import { useEffect, useState } from 'react';
import { getAnonToken, getMyReactions, setMyReactions } from './identity';

const EMOJIS = [
  { e: '🔥', label: '热' },
  { e: '🤯', label: '炸' },
  { e: '💡', label: '妙' },
  { e: '🧐', label: '疑' },
];

// 表情反应条：低门槛互动，点击即切换（再点取消），与投票互不干扰
export default function ReactionBar({ postId, initialCounts = {}, size = '' }) {
  const [counts, setCounts] = useState(initialCounts);
  const [mine, setMine] = useState([]);
  const [pending, setPending] = useState('');

  useEffect(() => {
    setMine(getMyReactions(postId));
  }, [postId]);

  async function toggle(emoji) {
    if (pending) return;
    setPending(emoji);
    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, emoji, token: getAnonToken() }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setCounts(data.counts);
      setMine(data.mine);
      setMyReactions(postId, data.mine);
    } finally {
      setPending('');
    }
  }

  return (
    <span className={`reaction-bar ${size}`} onClick={(e) => e.preventDefault()}>
      {EMOJIS.map(({ e, label }) => {
        const n = counts[e] || 0;
        const on = mine.includes(e);
        return (
          <button
            key={e}
            type="button"
            className={`reaction-btn ${on ? 'on' : ''}`}
            disabled={pending === e}
            onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); toggle(e); }}
            aria-label={`${label}（${n}）`}
            title={label}
          >
            <span className="reaction-emoji">{e}</span>
            <span className="reaction-label">{label}</span>
            {n > 0 && <span className="reaction-num">{n}</span>}
          </button>
        );
      })}
    </span>
  );
}
