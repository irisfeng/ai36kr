// 编辑方法页要引用的数字。全部从正在生效的规则里读，避免文案和代码各写一份。
import { FEEDS } from './sources.js';
import {
  DISCUSSION_CAP,
  FALLBACK_BAR,
  FALLBACK_BASE,
  HEAT_HALF_LIFE_H,
  HEAT_WINDOW_H,
  THRESHOLDS,
  coverageBoost,
} from './editorial.js';
import { BRIEF_MAX, HIGHLIGHTS, MAIN_MAX, MAIN_PER_SOURCE } from './edition.js';
import { EVENT_WINDOW_MS } from './events.js';

const TIER_HEAD = {
  T1: '官方一手',
  T1_5: '从业者专栏',
  T2: '媒体与社区',
};

export const ABOUT_TITLE = '编辑方法';
export const ABOUT_DESCRIPTION = '听潮如何从信源抓取、去掉噪声、合并同一件事并决定入选。摘要依据 RSS 改写，不是原文全文。';

export function methodFacts() {
  return {
    sourceCount: FEEDS.length,
    tiers: ['T1', 'T1_5', 'T2'].map((tier) => ({
      tier,
      label: TIER_HEAD[tier],
      sources: FEEDS.filter((feed) => feed.tier === tier).map((feed) => ({
        name: feed.name,
        home: feed.home,
      })),
    })),
    thresholds: THRESHOLDS,
    fallbackBase: FALLBACK_BASE,
    fallbackBar: FALLBACK_BAR,
    coverageStep: coverageBoost(2),
    coverageCap: coverageBoost(99),
    heatWindowHours: HEAT_WINDOW_H,
    heatHalfLifeHours: HEAT_HALF_LIFE_H,
    discussionCap: DISCUSSION_CAP,
    eventWindowHours: EVENT_WINDOW_MS / 3600000,
    mainMax: MAIN_MAX,
    perSource: MAIN_PER_SOURCE,
    briefMax: BRIEF_MAX,
    highlights: HIGHLIGHTS,
  };
}
