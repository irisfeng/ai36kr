'use client';

import { useCallback, useEffect, useState } from 'react';
import VoteButtons from './VoteButtons';
import { useNicknameGate } from './NicknameModal';
import { getNickname } from './identity';
import { timeAgo } from '@/lib/time';
import { productGradient } from '@/lib/categories';

function Avatar({ nickname }) {
  return (
    <span className="comment-avatar" style={{ background: productGradient(nickname || 'A') }}>
      {(nickname || '匿')[0].toUpperCase()}
    </span>
  );
}

function CommentForm({ placeholder, onSubmit, submitLabel = '发布评论', autoFocus = false }) {
  const [content, setContent] = useState('');
  const [nickname, setNick] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { setNick(getNickname()); }, []);

  async function submit() {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    const ok = await onSubmit(text);
    setSending(false);
    if (ok) setContent('');
  }

  return (
    <div className="comment-form">
      <textarea
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={content}
        maxLength={1000}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="form-foot">
        <span className="form-user">以 <b>{nickname || '…'}</b> 的身份发言</span>
        <span style={{ marginLeft: 'auto' }} />
        <button className="btn-primary" onClick={submit} disabled={!content.trim() || sending}>
          {sending ? '发布中…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

export default function CommentSection({ postId }) {
  const [comments, setComments] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const { requireNickname, nicknameModal } = useNicknameGate();

  const load = useCallback(async () => {
    const res = await fetch(`/api/comments?postId=${postId}`);
    if (res.ok) setComments(await res.json());
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  function postComment(text, parentId = null) {
    return new Promise((resolve) => {
      requireNickname(async (nickname) => {
        const res = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, parentId, nickname, content: text }),
        });
        if (res.ok) {
          await load();
          setReplyTo(null);
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  return (
    <section className="comments" id="comments">
      {nicknameModal}
      <h2>评论区 <span className="c-count">{comments.length} 条讨论</span></h2>
      <CommentForm
        placeholder="写下你的观点，理性交锋…"
        onSubmit={(text) => postComment(text, null)}
      />
      {comments.map((c) => (
        <div className="comment-item" key={c.id}>
          <Avatar nickname={c.nickname} />
          <div className="comment-main">
            <div className="comment-head">
              <span className="comment-nick">{c.nickname}</span>
              <span className="comment-time" suppressHydrationWarning>{timeAgo(c.created_at)}</span>
            </div>
            <div className="comment-text">{c.content}</div>
            <div className="comment-ops">
              <VoteButtons targetType="comment" targetId={c.id} initialUp={c.up} showDown={false} />
              <button className="reply-btn" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                {replyTo === c.id ? '收起' : '回复'}
              </button>
            </div>
            {replyTo === c.id && (
              <div className="reply-form">
                <CommentForm
                  autoFocus
                  placeholder={`回复 @${c.nickname}…`}
                  submitLabel="发布回复"
                  onSubmit={(text) => postComment(text, c.id)}
                />
              </div>
            )}
            {c.replies && c.replies.length > 0 && (
              <div className="comment-replies">
                {c.replies.map((r) => (
                  <div className="comment-item" key={r.id}>
                    <Avatar nickname={r.nickname} />
                    <div className="comment-main">
                      <div className="comment-head">
                        <span className="comment-nick">{r.nickname}</span>
                        <span className="comment-time" suppressHydrationWarning>{timeAgo(r.created_at)}</span>
                      </div>
                      <div className="comment-text">{r.content}</div>
                      <div className="comment-ops">
                        <VoteButtons targetType="comment" targetId={r.id} initialUp={r.up} showDown={false} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {comments.length === 0 && <div className="empty">还没有评论，来抢沙发。</div>}
    </section>
  );
}
