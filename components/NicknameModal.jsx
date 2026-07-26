'use client';

import { useState } from 'react';
import { getNickname, setNickname } from './identity';

// 首次评论/互动时的昵称弹窗
export default function NicknameModal({ onDone, onCancel }) {
  const [name, setName] = useState('');

  function confirm() {
    const n = name.trim().slice(0, 20);
    if (!n) return;
    setNickname(n);
    onDone(n);
  }

  return (
    <div className="modal-mask" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>取个昵称吧</h3>
        <p>听潮无需注册，昵称会保存在你的浏览器里。</p>
        <input
          autoFocus
          placeholder="例如：炼丹师小夏"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && confirm()}
        />
        <div className="modal-ops">
          <button className="btn-ghost" onClick={onCancel}>取消</button>
          <button className="btn-primary" onClick={confirm} disabled={!name.trim()}>确定</button>
        </div>
      </div>
    </div>
  );
}

// 保证有昵称：有则直接回调，无则弹窗
export function useNicknameGate() {
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  function requireNickname(action) {
    const n = getNickname();
    if (n) {
      action(n);
    } else {
      setPendingAction(() => action);
      setShowModal(true);
    }
  }

  const modal = showModal ? (
    <NicknameModal
      onDone={(n) => {
        setShowModal(false);
        if (pendingAction) pendingAction(n);
        setPendingAction(null);
      }}
      onCancel={() => { setShowModal(false); setPendingAction(null); }}
    />
  ) : null;

  return { requireNickname, nicknameModal: modal };
}
