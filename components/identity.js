'use client';

// 匿名投票工具：token 去重 + 本地记录自己的投票状态
export function getAnonToken() {
  let t = localStorage.getItem('aikr_token');
  if (!t) {
    t = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('aikr_token', t);
  }
  return t;
}

const VOTES_KEY = 'aikr_votes';

export function getMyVote(targetType, targetId) {
  try {
    const votes = JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
    return votes[`${targetType}:${targetId}`] || 0;
  } catch {
    return 0;
  }
}

export function setMyVote(targetType, targetId, value) {
  const votes = JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
  const key = `${targetType}:${targetId}`;
  if (value) votes[key] = value;
  else delete votes[key];
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
}

const NICK_KEY = 'aikr_nickname';

export function getNickname() {
  return localStorage.getItem(NICK_KEY) || '';
}

export function setNickname(name) {
  localStorage.setItem(NICK_KEY, name);
}

const REACT_KEY = 'aikr_reactions';

// 本地记录自己选过的表情：{ postId: ['🔥', ...] }
export function getMyReactions(postId) {
  try {
    const all = JSON.parse(localStorage.getItem(REACT_KEY) || '{}');
    return Array.isArray(all[postId]) ? all[postId] : [];
  } catch {
    return [];
  }
}

export function setMyReactions(postId, emojis) {
  const all = JSON.parse(localStorage.getItem(REACT_KEY) || '{}');
  if (emojis.length) all[postId] = emojis;
  else delete all[postId];
  localStorage.setItem(REACT_KEY, JSON.stringify(all));
}
