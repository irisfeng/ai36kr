# 听潮（TideWire）

「听 AI 之潮」—— AI 行业新闻聚合 + 社区互动网站。设计对标取长补短：36氪的快讯流与深度文章、Hacker News 的投票热度排序与楼中楼评论、Product Hunt 的每日新品榜。

## 启动

需要 Node.js 20.9 或更高版本。

```bash
npm install
npm run dev        # 开发模式，访问 http://localhost:3000
# 或
npm run build && npm start
```

首次访问自动建库（`data/tidewire.db`），启动后立即开始首轮 RSS 聚合，无需手动初始化。

## 技术栈

- Next.js 16（App Router）+ React 19 + 原生 CSS（CSS 变量 + 手写样式，无 Tailwind）
- 数据库：`libsql` 双模连接；本地使用 `data/tidewire.db`，生产可通过 Turso 使用远端持久化数据库
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
- **RSS 聚合**：每 10 分钟从 37 个真实信息源抓取（文章 33 源 + 快讯 3 源 + 新品 1 源），按 URL 去重入库，自动分类归一，详情页带「阅读原文」外链。**全站无任何内置种子/虚构数据**：文章、快讯、新品全部来自真实源，评论与投票完全由社区产生
- **今日一页 `/daily`**：一页看懂今天 AI 圈 —— 日期与条数统计、热词云、最受关注 Top3、按分类分组的条目流；24h 无数据时自动降级到 48h
- **AI 脉搏条**：导航下方细横条，展示今日新增条数、今日热词 Top8（可点击搜索）、各聚合源在线状态（绿/灰点）
- **表情反应**：每篇文章可点 🔥热 / 🤯炸 / 💡妙 / 🧐疑，低门槛互动，幂等切换（再点取消），与投票互不干扰
- **标题中文化**：英文标题自动译成中文（`title_zh` 永久缓存，每轮限译），卡片/详情/侧栏双语展示（中文大标题 + 原文小字）。翻译为双通道：首选**火山方舟 LLM**（`ARK_API_KEY`，doubao-seed-2-0-lite，15 条/批，按语境语义翻译——能正确处理 open-weight→开放权重、LLM→大模型、Agentic→智能体）；不可用时回退 gtx 公开端点（译前占位保护 24 个易误译术语 + 译后术语校正表）。摘要同样走 LLM 中文化（`summary_zh`，摘要专用 prompt，HN 中文热度摘要不重复译）。全量重译：`node scripts/retranslate.mjs [--remote]`。
**词表持久化与自动化**：译前保护词 / 译后校正词存于 `glossary` 表（首启自动播种），`node scripts/add-term.mjs <protect|fix> <词条|正则> [替换为] [--remote]` 热更新无需改代码；每轮聚合自动回扫近 30 天存量译文并应用最新校正，新词条下一轮即生效。CI（GitHub Actions）已配置 `ARK_API_KEY` secret，聚合与翻译全链路自动
- **日报归档 `/daily/[date]`**：日历日（北京时间）永久链接，前后日翻页，可引用可回看
- **热度外部信号**：HN 分数入库（`ext_score`），开平方后计入热度算法（500 分≈22 票），热度榜开箱即有区分度
- **快讯 `/flashes`**：7×24 快讯时间线，按日期分组，竖线时间轴，可顶
- **文章详情 `/post/[id]`**：正文多段落、来源摘要、顶/踩、表情反应、楼中楼评论（一层嵌套，评论可顶）
- **新品榜 `/launch`**：今日 / 本周榜单，前三名金/银/铜徽章，可投票
- **投稿 `/submit`**：提交标题 / 链接 / 摘要 / 分类，直接进列表
- **搜索**：顶导航搜索框，标题 / 摘要 LIKE 查询
- **日报邮件订阅**：页脚与 `/daily` 页表单订阅，确认邮件双选入（double opt-in），每日 08:13 起（北京时间）GitHub Actions 推送「今日 AI 一页」（热词 + Top3 + 分类收录），一键退订；发信走 Resend（`mail.shddai.net` 已验证域），密钥 `RESEND_API_KEY`。为对冲 GitHub 定时调度的延迟/丢弃，调度设北京 08:13 / 09:13 / 10:13 三个时点，首个实际运行的时点发送，`digest_log` 表按北京日历日幂等，备份时点自动跳过不重复打扰；48h 无内容或全部发送失败则以非零退出触发告警并留给下时点重试

## 信息源聚合

通过 `rss-parser` 解析 RSS/Atom。信息源清单借鉴了 GitHub 热门开源聚合项目（[SuYxh/ai-news-aggregator](https://github.com/SuYxh/ai-news-aggregator) 的 OPML 精选、newsnow、aihot-site 等），全部经 curl 逐个实测可用（2026-07；机器之心反爬、rsshub.app 403、Anthropic/Meta/The Batch 无可用 RSS，均已剔除）。
其中 HN / Ars / MIT TR / 36氪 / 爱范儿 / InfoQ / SuperTechFans / 宝玉 / 阮一峰 / Simon Willison 为泛科技源，只放行命中 AI 专属词表的条目（`lib/classify.js` 的 `isAiRelated` 闸门；词表刻意排除「融资/收购」等通用财经词，避免非 AI 财经新闻混入）；长文源（量子位/MIT TR/BAIR/Import AI/Interconnects 等）自动进「深度长读」tab。

**文章源（33）**

| 类型 | 源 |
| --- | --- |
| 中文媒体 | 36氪、量子位、爱范儿、InfoQ、SuperTechFans、宝玉、阮一峰 |
| 英文媒体 | TechCrunch AI、The Verge AI、Ars Technica、MIT Technology Review、VentureBeat AI、Hacker News |
| 官方/研究 | OpenAI、Google DeepMind、Google Research、Hugging Face、Microsoft Research、BAIR（伯克利） |
| 深度专栏 | Import AI（Jack Clark）、Interconnects（Nathan Lambert）、Simon Willison、AI News（smol.ai）、Last Week in AI、Ahead of AI（Raschka）、One Useful Thing（Mollick）、Latent Space、Lilian Weng、Chip Huyen、Eugene Yan、Hamel Husain、Meta Engineering |
| 中文补充 | 钛媒体 |

**快讯源（3）**：Readhub、36氪快讯、钛媒体快讯（经 RSSHub 公共实例 `rsshub.bestblogs.dev`），自动打标 发布/融资/政策/数据/人事，附原文链接

**新品源（1）**：Product Hunt（AI 分类 Atom feed），自动提取产品名与 tagline，附 Product Hunt 链接

**持续更新机制（三层）**：① GitHub Actions 每 30 分钟聚合全部源并提交内容快照（`data/snapshot.json`），快照提交触发 Vercel 自动部署，新实例冷启动从快照水合；快照同时携带 `source_status`（含连续失败计数），CI 端源健康巡检跨轮累计、连续 3 轮失败自动开 GitHub Issue 告警（`REPO_ALERT_TOKEN`）；② 运行实例每 10 分钟增量补抓（`refreshIfStale`，以 source_status 表的抓取时间为准，多实例不重复刷）；③ Vercel Cron 每日兜底。函数区域 `hkg1`（香港），兼顾中文源可达性与国内访问延迟。两个会写 main 的 workflow 共用 `main-writer` 并发组串行化，推送前 `pull --rebase` 重试，避免定时运行延迟释放时撞车；每轮聚合/日报结果写入 Actions Step Summary，无需下载日志即可巡检

**内容质量机制**：泛科技源 AI 关键词闸门（见上）；跨源去重——两层：① 标题归一化唯一索引（`title_norm`，精确同题只留先到者）；② 模糊去重（`lib/dedupe.js`，中文 bigram + 英文去停用词的词集 Jaccard ≥ 0.5 判同事件，近 7 天词集每轮共享，阈值经真重复 0.53-0.67 / 误伤 ≤0.15 标定）；旧内容自动清理（文章留 30 天（深度长文 90 天）、快讯留 7 天，有评论的保留，孤儿投票/反应一并清理）；缩略图双重获取（RSS 内嵌图 + og:image 回填，logo/品牌图视为无图）。

**刷新机制**：`instrumentation.js` 的 `register()` 在 Node runtime 启动后立即抓一轮，之后 `setInterval` 每 10 分钟一轮；另外 `GET /api/posts` 时若距上次抓取超过 10 分钟会触发一次后台补抓（不阻塞响应）。单源失败不影响整体（`Promise.allSettled`），每源抓取时间/状态记录于 `source_status` 表，供脉搏条展示。

**入库规则**：按 `url` 部分唯一索引去重（`INSERT OR IGNORE`）；`pubDate` 转 ISO 存 `created_at`；摘要剥 HTML 截 300 字；`lib/classify.js` 按关键词把条目归一到现有分类；聚合条目 `is_external=1`，站内投稿为 0。

**缩略图**：入库时优先提取 RSS 内嵌图（enclosure / media:* / 正文首张 `<img>`）；无图条目由 `lib/ogimage.js` 抓原文页 `og:image` 回填（每轮限量、4 路并发、8s 超时、失败标记不再重试；站点 logo / 图标类图片视为无图）。回填请求仅允许公网 HTTP(S) 地址，DNS 解析后固定目标 IP，不跟随重定向，并限制响应类型与大小，避免 SSRF。前端 `components/CoverImage.jsx` 加载失败自动降级回分类渐变封面，`referrerPolicy="no-referrer"` 规避大部分防盗链。存量库可手动批量回填：`node scripts/backfill-images.mjs [数量]`

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/posts?sort=hot\|new\|deep&cat=&q=&since=24h&token=&limit=50&offset=0` | 有界文章列表（默认 50、`limit` 最大 100、`offset` 最大 10000；`since=Nh` 限定时间窗；带 `token` 时返回每篇 `my_reactions`） |
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
  db.js               # libsql 本地/Turso 双模连接 + schema + 轻量迁移 + 快照水合
  rss.js              # RSS 源清单 + 抓取入库 + 刷新调度
  classify.js         # 聚合条目关键词分类归一
  keywords.js         # AI 领域热词词典 + 词频统计
  pulse.js            # 脉搏条数据组装
  queries.js          # 查询层（热度排序、reaction 注入等）
  categories.js       # 分类渐变配色
  time.js             # 相对时间格式化
data/tidewire.db      # 本地 SQLite 数据库（首次访问自动生成）
```

## 部署配置

生产环境建议使用 Turso 持久化；如果不配置，Vercel 仅会使用 `/tmp` 临时 SQLite，并在冷启动时从 `data/snapshot.json` 水合，社区投稿、评论、投票和反应不能保证跨实例持久保存。

| 环境变量 | 要求 | 用途 |
| --- | --- | --- |
| `CRON_SECRET` | 生产必需 | 保护 `/api/refresh`；Vercel Cron 会以 Bearer 令牌调用。请生成高熵随机值，例如运行 `openssl rand -hex 32` 后将结果分别配置到 Vercel 环境变量中，不要提交到仓库 |
| `TURSO_DATABASE_URL` | 生产持久化必需 | Turso/libSQL 数据库 URL |
| `TURSO_AUTH_TOKEN` | 与 Turso URL 配套必需 | Turso 访问令牌 |
| `NEXT_PUBLIC_SITE_URL` | 生产推荐 | 站点规范 origin，例如 `https://your-domain.example`；用于 serverless 实例触发受保护的刷新函数 |
| `ARK_API_KEY` | 可选 | 火山方舟标题翻译；缺失时回退到公开翻译端点 |

部署后还需在 GitHub Actions secrets 中按需配置 `ARK_API_KEY`，供定时快照聚合使用。生产环境若缺少 `CRON_SECRET`，刷新接口会以 503 明确拒绝；仅非生产环境且请求 URL 为 `localhost`、`127.0.0.1` 或 `::1` 时允许免密刷新。

### 写接口限流边界

`POST /api/posts`、`/api/comments`、`/api/vote`、`/api/reactions` 使用进程内固定窗口限流。Vercel 环境只信任平台重写的 `x-vercel-forwarded-for`，并在内存中仅保存其哈希；非 Vercel 环境不信任调用方可伪造的转发头，因此使用共享匿名桶。vote/reaction 还叠加匿名 token 桶。

这是无第三方依赖的安全降级，不是跨实例的全局配额：serverless 冷启动和不同实例各自维护计数。需要严格的生产级全局限流时，应接入 Vercel Firewall/WAF 或具有原子计数和 TTL 的共享存储。
