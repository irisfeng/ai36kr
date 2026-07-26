'use client';

import { useEffect, useState } from 'react';
import { getAnonToken, getMyVote, setMyVote } from './identity';

// 顶/踩按钮组：value 1 顶 / -1 踩；再次点同一按钮取消
export default function VoteButtons({ targetType, targetId, initialUp = 0, initialDown = 0, showDown = true }) {
  const [up, setUp] = useState(initialUp);
  const [down, setDown] = useState(initialDown);
  const [myVote, setMyVoteState] = useState(0);
  const [bumpKey, setBumpKey] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setMyVoteState(getMyVote(targetType, targetId));
  }, [targetType, targetId]);

  async function vote(value) {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, value, token: getAnonToken() }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setUp(data.up);
      setDown(data.down ?? 0);
      setMyVoteState(data.vote);
      setMyVote(targetType, targetId, data.vote);
      setBumpKey((k) => k + 1);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="vote-group" onClick={(e) => e.preventDefault()}>
      <button
        type="button"
        className={`vote-btn ${myVote === 1 ? 'on-up' : ''}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); vote(1); }}
        aria-label="顶"
      >
        ▲ <span key={`u${bumpKey}`} className="vote-num bump">{up}</span>
      </button>
      {showDown && (
        <button
          type="button"
          className={`vote-btn ${myVote === -1 ? 'on-down' : ''}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); vote(-1); }}
          aria-label="踩"
        >
          ▼ <span key={`d${bumpKey}`} className="vote-num bump">{down}</span>
        </button>
      )}
    </span>
  );
}
