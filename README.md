# 听潮（TideWire）

「听 AI 之潮」—— AI 行业新闻聚合 + 社区互动网站。设计对标取长补短：36氪的快讯流与深度文章、Hacker News 的投票热度排序与楼中楼评论、Product Hunt 的每日新品榜。

## 启动

```bash
npm install
npm run dev        # 开发模式，访问 http://localhost:3000
# 或
npm run build && npm start
```

首次访问自动建库（`data/ai36kr.db`），启动后立即开始首轮 RSS 聚合，无需手动初始化。

## 技术栈

- Next.js 14（App Router）+ React 18 + 原生 CSS（CSS 变量 + 手写样式，无 Tailwind）
- 数据库：Node.js 内置 `node:sqlite`（`DatabaseSync`），零原生编译依赖，Node 22+ 直接可用
- 无登录系统：昵称存 localStorage（首次评论弹窗输入）；投票用 localStorage 匿名 token 去重（可取消/改票）
- 文章封面：CSS 墨色系双色调渐变 + 白色衬线分类字，分类间仅色相微差，无外部图片依赖

## 设计

「报纸刊头 × 电报终端」的编辑杂志语言，原生 CSS 变量实现（`app/globals.css`）：

- **色板**：新闻纸 `#F5F3ED` 暖底 + 暖墨 `#191813` 正文；朱砂报红 `#C23B22` 为全站唯一强调色（active 态、主按钮、栏目方印、深度标）；绿/金仅作聚合源状态的语义色；排名序列统一为 红/墨/灰
- **字阶**：刊头与标题用 Noto Serif SC 900，正文系统黑体 1.75-1.95 行高，数字/时间/英文元数据统一 IBM Plex Mono
- **网格**：1160px 容器，首页 1fr + 320px 侧栏；内容之间用 1px hairline 与「上 1px 墨线 + 下 4px 双细线」的报纸 double rule 分隔，不用卡片阴影
- **形状**：全直角（all-sharp），无圆角、无 pill
- **动效**：低强度纯 CSS——列表入场 stagger、hover 变色/亮度、投票数字 bump、脉搏点呼吸；仅 transform/opacity，`prefers-reduced-motion` 下全部降级为静态
- **印记语言**：导航为双层报纸刊头（大衬线刊名 + 朱红方印 + 栏目行），导航下方为墨底「AI 脉搏」电报纸带；栏目标题前统一红色小方块
- 单浅色主题（印刷编辑物定位，不做暗色模式）；移动端 900px 以下单列，刊头压缩、栏目行可横滑

## 功能

- **首页 `/`**：文章流（热度 / 最新 / 深度长读三个 tab）+ 侧栏（快讯 5 条、周热榜 Top5、新品榜 Top3、分类导航）。热度算法：`score = (up - down) / pow(age_hours + 2, 1.5)`
- **RSS 聚合**：每 10 分钟从 25 个真实信息源抓取（文章 22 源 + 快讯 2 源 + 新品 1 源），按 URL 去重入库，自动分类归一，详情页带「阅读原文」外链。**全站无任何内置种子/虚构数据**：文章、快讯、新品全部来自真实源，评论与投票完全由社区产生
- **今日一页 `/daily`**：一页看懂今天 AI 圈 —— 日期与条数统计、热词云、最受关注 Top3、按分类分组的条目流；24h 无数据时自动降级到 48h
- **AI 脉搏条**：导航下方细横条，展示今日新增条数、今日热词 Top8（可点击搜索）、各聚合源在线状态（绿/灰点）
- **表情反应**：每篇文章可点 🔥热 / 🤯炸 / 💡妙 / 🧐疑，低门槛互动，幂等切换（再点取消），与投票互不干扰
- **快讯 `/flashes`**：7×24 快讯时间线，按日期分组，竖线时间轴，可顶
- **文章详情 `/post/[id]`**：正文多段落、来源摘要、顶/踩、表情反应、楼中楼评论（一层嵌套，评论可顶）
- **新品榜 `/launch`**：今日 / 本周榜单，前三名金/银/铜徽章，可投票
- **投稿 `/submit`**：提交标题 / 链接 / 摘要 / 分类，直接进列表
- **搜索**：顶导航搜索框，标题 / 摘要 LIKE 查询

## 信息源聚合

通过 `rss-parser` 解析 RSS/Atom。信息源清单借鉴了 GitHub 热门开源聚合项目（[SuYxh/ai-news-aggregator](https://github.com/SuYxh/ai-news-aggregator) 的 OPML 精选、newsnow、aihot-site 等），全部经 curl 逐个实测可用（2026-07；机器之心反爬、rsshub.app 403、Anthropic/Meta/The Batch 无可用 RSS，均已剔除）。
其中 HN / Ars / MIT TR / 36氪 / 爱范儿 / InfoQ / SuperTechFans / 宝玉 / 阮一峰 / Simon Willison 为泛科技源，只放行命中 AI 专属词表的条目（`lib/classify.js` 的 `isAiRelated` 闸门；词表刻意排除「融资/收购」等通用财经词，避免非 AI 财经新闻混入）；长文源（量子位/MIT TR/BAIR/Import AI/Interconnects 等）自动进「深度长读」tab。

**文章源（22）**

| 类型 | 源 |
| --- | --- |
| 中文媒体 | 36氪、量子位、爱范儿、InfoQ、SuperTechFans、宝玉、阮一峰 |
| 英文媒体 | TechCrunch AI、The Verge AI、Ars Technica、MIT Technology Review、VentureBeat AI、Hacker News |
| 官方/研究 | OpenAI、Google DeepMind、Google Research、Hugging Face、Microsoft Research、BAIR（伯克利） |
| 深度专栏 | Import AI（Jack Clark）、Interconnects（Nathan Lambert）、Simon Willison |

**快讯源（2）**：Readhub、36氪快讯（经 RSSHub 公共实例 `rsshub.bestblogs.dev`），自动打标 发布/融资/政策/数据/人事，附原文链接

**新品源（1）**：Product Hunt（AI 分类 Atom feed），自动提取产品名与 tagline，附 Product Hunt 链接

**刷新机制**：`instrumentation.js` 的 `register()` 在 Node runtime 启动后立即抓一轮，之后 `setInterval` 每 10 分钟一轮；另外 `GET /api/posts` 时若距上次抓取超过 10 分钟会触发一次后台补抓（不阻塞响应）。单源失败不影响整体（`Promise.allSettled`），每源抓取时间/状态记录于 `source_status` 表，供脉搏条展示。

**入库规则**：按 `url` 部分唯一索引去重（`INSERT OR IGNORE`）；`pubDate` 转 ISO 存 `created_at`；摘要剥 HTML 截 300 字；`lib/classify.js` 按关键词把条目归一到现有分类；聚合条目 `is_external=1`，站内投稿为 0。

**缩略图**：入库时优先提取 RSS 内嵌图（enclosure / media:* / 正文首张 `<img>`）；无图条目由 `lib/ogimage.js` 抓原文页 `og:image` 回填（每轮限量、4 路并发、8s 超时、失败标记不再重试；站点 logo / 图标类图片视为无图）。前端 `components/CoverImage.jsx` 加载失败自动降级回分类渐变封面，`referrerPolicy="no-referrer"` 规避大部分防盗链。存量库可手动批量回填：`node --experimental-sqlite scripts/backfill-images.mjs [数量]`

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/posts?sort=hot\|new\|deep&cat=&q=&since=24h&token=` | 文章列表（`since=Nh` 限定时间窗；带 `token` 时返回每篇 `my_reactions`） |
| POST | `/api/posts` | 投稿 `{title, url?, category, summary}`，url 重复返回 409 |
| GET | `/api/posts/[id]?token=` | 文章详情（含正文段落、reaction 计数） |
| POST | `/api/vote` | 投票 `{targetType: post\|comment\|flash\|product, targetId, value: 1\|-1, token}`，幂等：同值再投=取消，异值=改票 |
| POST | `/api/reactions` | 表情反应 `{postId, emoji: 🔥\|🤯\|💡\|🧐, token}`，幂等切换：已选再点=取消 |
| GET | `/api/reactions?postId=&token=` | 单篇 reaction 计数 + 该 token 已选 |
| GET | `/api/pulse` | AI 脉搏：今日新增数、热词 Top8、各源在线状态 |
| GET | `/api/comments?postId=` | 评论树（一层嵌套） |
| POST | `/api/comments` | 发评论 `{postId, parentId?, nickname, content}` |
| GET | `/api/flashes` | 快讯列表 |
| GET | `/api/products?period=today\|week` | 新品榜 |

## 目录结构

```
app/
  layout.jsx          # 全局布局（导航 / 脉搏条 / 页脚 / 字体）
  globals.css         # 设计系统：新闻纸 + 暖墨 + 朱砂报红 #C23B22，全直角报纸语言
  page.jsx            # 首页
  daily/page.jsx      # 今日一页
  flashes/page.jsx    # 快讯页
  post/[id]/page.jsx  # 文章详情
  launch/page.jsx     # 新品榜
  submit/page.jsx     # 投稿
  api/                # posts / posts[id] / vote / reactions / pulse / comments / flashes / products
instrumentation.js    # Node runtime 启动 RSS 定时聚合
components/
  Nav.jsx  PulseBar.jsx  PostCard.jsx  VoteButtons.jsx  ReactionBar.jsx
  CommentSection.jsx  NicknameModal.jsx  SubmitForm.jsx  identity.js
lib/
  db.js               # node:sqlite 连接 + schema + 轻量迁移 + 空库播种
  rss.js              # RSS 源清单 + 抓取入库 + 刷新调度
  classify.js         # 聚合条目关键词分类归一
  keywords.js         # AI 领域热词词典 + 词频统计
  pulse.js            # 脉搏条数据组装
  queries.js          # 查询层（热度排序、reaction 注入等）
  categories.js       # 分类渐变配色
  time.js             # 相对时间格式化
data/ai36kr.db        # SQLite 数据库（首次访问自动生成）
```
