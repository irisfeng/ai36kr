# 听潮（TideWire）

值得看的 AI 新闻，一件事只说一次。

每隔几小时从 33 个信源抓一轮，筛掉行情、活动推广和多事合集，把不同信源报道的同一件事并成一个事件，按一份公开的标准评分，过线的进精选。每天 8 点出一份日报。

## 启动

需要 Node.js 20.9 或更高版本。

```bash
npm install
npm run dev        # 开发模式，访问 http://localhost:3000
# 或
npm run build && npm start
```

首次访问自动建库（`data/tidewire.db`），启动后立即开始首轮聚合，无需手动初始化。不配任何密钥也能跑：见下面「没有模型密钥时」。

## 一条资料怎么变成精选

```
抓取 → 预筛 → 编辑（评分 + 写稿）→ 聚簇 → 入选 → 热度 / 日报
```

1. **抓取**（`lib/rss.js`、`lib/sources.js`）：按 URL 和归一化标题去重入库。泛科技源（36氪、HN、Ars 等）先过 AI 关键词闸门。同一件事的多家报道**全部保留**，不再「相似就丢」——有几家在报，本身就是信号。
2. **预筛**（`lib/editorial.js` 的 `detectNoise`）：机械规则，只拦明显不是 AI 行业新闻的——股市行情与个股公告、大会门票与活动推广、早报周报这类多事合集。被拦的条目仍在「全部」里，但不进精选、热点和日报，也不花模型的钱。
3. **编辑**（`lib/editor.js`，标准在 [`prompts/editor.js`](prompts/editor.js)）：一次模型调用同时给出 0–100 的评分、中文标题和摘要。摘要第一句直接回答「谁做了什么」；标题必须点出主体；不许出现原文里没有的产品名和数字（中文原文的数字会被机械核对，对不上的摘要直接弃用）。
4. **聚簇**（`lib/events.js`）：在中文标题上取二元组、英文词和数字，按 IDF 加权算重合度——「正式发布」这种词不值钱，「Akamai」「116」值钱。判同偏保守：错并会藏掉一条新闻，漏并只是多显示一条。一长一短的两个标题（长标题的修饰语会把重合度稀释掉）另看实体：一方的实体全部出现在另一方、其中至少两个够具体，且来自不同信源，也算同一件事。每个事件由一篇**代表稿**出面：官方一手优先，其次是有摘要的、评分高的、发得早的。
5. **入选**（`lib/editorial.js`）：`评分 + 报道面加成 ≥ 门槛`。门槛按信源分级：官方一手（T1）60，从业者专栏（T1_5）65，媒体与社区（T2）75——同一件事，官方原文更值得先看。每多一家独立信源 +4，封顶 +12。
6. **热度**：按事件算，不按文章算。48 小时内每个独立信源只计一次，24 小时减半；HN 的讨论折成最多 1.5 家的「信源当量」。一家媒体发十篇也只算一次。
7. **日报**（`lib/edition.js`）：纯规则编排，不调模型。一件事一条，按重要性取前 12 条进正文，同一信源最多 2 条；第 1 条是头条，第 2–4 条是看点，其余按分类；再往后最多 10 条一行简讯。邮件、公众号卡片、头条海报和 X 推文都读这同一份编排。

第 2、4–7 步是纯函数，`lib/rank.js` 每轮把近 10 天的条目重算一遍，只把变化写回库；可以重复执行。

### 改标准

- **什么值得看**：改 `prompts/editor.js`。评分刻度、哪些必须压住、标题和摘要怎么写，都在这一个文件里。
- **多少分算入选**：改 `lib/editorial.js` 的 `THRESHOLDS`。
- **什么是噪声**：改 `lib/editorial.js` 的 `NOISE_RULES`，改完下一轮聚合对近 10 天的存量自动生效。

当前门槛沿用 AIHOT 的偏严口径，**没有在听潮自己的数据上校准过**。上线后跑 `node scripts/score-report.mjs`（带 `TURSO_*` 环境变量读线上库）看分数分布、各级信源的过线比例和贴着门槛的条目，再决定往哪边挪。先改标准，再动门槛：门槛只能整体移动，解决不了「哪一类判错了」。

### 没有模型密钥时

不配 `ARK_API_KEY`，编辑环节整个跳过：标题走公开机翻端点，入选退回估分——官方一手和专栏默认入选，媒体稿要有第二家独立信源在报，或 HN 讨论足够热，才入选。站点能跑，但选得粗。

## 页面

| 路径 | 内容 |
| --- | --- |
| `/` | **精选**：入选的事件，一件事一条，按天分组；侧栏是当前热点 |
| `/hot` | **热点**：按事件热度排的近 48 小时 |
| `/daily`、`/daily/[date]` | **日报**：头条 / 看点 / 分类 / 简讯；按北京日历日归档 |
| `/all` | **全部动态**：抓到的每一条，不筛不并；搜索（`?q=`）和分类（`?cat=`）也在这里 |
| `/post/[id]` | 单条：摘要、原文链接、同一件事的其他报道、分享卡片 |

列表是纯文字的：没有缩略图，没有投票、评论和表情。旧版的 `/weekly`、`/flashes`、`/launch`、`/submit`、`/word/*` 已下线，均 308 跳到对应的新页面。

## API 与订阅

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/posts?sort=pick\|hot\|all&cat=&q=&since=24h&limit=50&offset=0` | 列表（默认 50、`limit` 最大 100、`offset` 最大 10000）。每条带 `tier`、`score`、`src_count`、`coverage`（同事件的其他报道）。旧取值 `sort=new` 等同 `all` |
| GET | `/api/posts/[id]` | 单条详情 |
| GET | `/rss.xml`、`/rss.xml?feed=all` | RSS：精选 / 全部 |
| POST | `/api/subscribe` | 邮件日报订阅（Resend，一键退订） |
| GET | `/llms.txt` | 给 Agent 的站点说明 |

## 信源（33）

`tier` 写在 `lib/sources.js` 里，决定入选门槛。

| 级别 | 源 |
| --- | --- |
| T1 官方一手 | OpenAI、Google DeepMind、Google Research、Hugging Face、Microsoft Research、BAIR、Meta Engineering |
| T1_5 从业者专栏 | Simon Willison、Import AI、Interconnects、AI News（smol.ai）、Last Week in AI、Ahead of AI、One Useful Thing、Latent Space、Lilian Weng、Chip Huyen、Eugene Yan、Hamel Husain、宝玉、阮一峰 |
| T2 媒体与社区 | TechCrunch、The Verge、Ars Technica、MIT Technology Review、VentureBeat、Hacker News、36氪、量子位、爱范儿、InfoQ、SuperTechFans、钛媒体 |

Anthropic、Meta AI、The Batch 没有可用的 RSS，暂缺；机器之心反爬。HN 的分数入库为 `ext_score`，计入热度和估分。

**持续更新（三层）**：① GitHub Actions 定时聚合全部源（排的是每 30 分钟一轮，但 GitHub 的定时任务常被延后或跳过，2026 年 10 月上旬实测 3–9 小时才跑一轮），直写 Turso 远端库，并把内容快照提交到 `snapshot` 分支；② 运行实例每 10 分钟增量补抓（`refreshIfStale`，以 `source_status` 表的抓取时间为准，多实例不重复刷）；③ Vercel Cron 每日兜底。失败源指数退避，连续 3 轮失败自动开 GitHub Issue（`REPO_ALERT_TOKEN`）。没入选的条目留 30 天（长文源 90 天）；入选过的事件连同它的其他报道一直保留，文章页和日报归档的链接不会失效。

**翻译词表**：译前保护词 / 译后校正词存于 `glossary` 表，`node scripts/add-term.mjs <protect|fix> <词条|正则> [替换为] [--remote]` 热更新；每轮聚合自动回扫近 30 天译文。

## 设计

「报纸刊头」的编辑语言，原生 CSS 变量实现（`app/globals.css`，约 400 行）：

- **色板**：新闻纸 `#F5F3ED` 暖底 + 暖墨 `#191813`；朱砂报红 `#C23B22` 是全站唯一强调色，只用在四处：当前栏目、官方信源、「N 家在报」、主按钮
- **字阶**：刊头与标题用衬线（系统宋体栈，零下载），正文系统黑体，时间与数字用等宽
- **版式**：一栏正文 + 一栏窄侧栏；条目之间只有 1px hairline，不用卡片、阴影、圆角和缩略图
- 单浅色主题；900px 以下单列

## 目录结构

```
prompts/editor.js     # 编辑标准：评分、标题、摘要怎么写（改标准只改这里）
lib/
  sources.js          # 信源清单与分级
  rss.js              # 抓取入库 + 每轮流程编排 + 刷新调度
  editorial.js        # 噪声规则、入选门槛、热度、代表稿（纯函数）
  events.js           # 事件聚簇（纯函数）
  editor.js           # 模型编辑环节：评分 + 中文标题 + 摘要
  rank.js             # 把上面的规则应用到近 10 天的条目并写回库
  edition.js          # 日报编排（纯函数）
  queries.js          # 查询层：精选 / 热点 / 全部 / 日报 / 信源状态
  translate.js        # 兜底翻译（无密钥或编辑环节未覆盖时）
  db.js               # libsql 本地 / Turso 双模连接 + schema + 迁移 + 快照水合
app/
  page.jsx  hot/  daily/  all/  post/[id]/     # 五个页面
  api/                # posts / refresh / subscribe / sharecard / img / wechat
components/
  Story.jsx           # 一条新闻（列表项与单行项）
  DailyView.jsx  Nav.jsx  SubscribeForm.jsx  ShareButtons.jsx  ShareCard.jsx
scripts/
  aggregate.mjs       # CI 聚合入口
  score-report.mjs    # 评分分布与入选率（校准门槛用）
  send-daily.mjs  daily-card.mjs  post-x.mjs   # 日报邮件 / 头条海报 / X 推文
```

数据库里旧版的 `comments`、`votes`、`reactions`、`flashes`、`products` 表原样保留，只是不再读写。

## 致谢

精选流程的思路来自 [AIHOT](https://github.com/KKKKhazix/AIHOT)（MIT）：信源分级的入选门槛、按事件而不是按文章算热度、答案先行的摘要与防编造规则、规则编排的日报。听潮按「一个 Next.js 应用 + SQLite + 一次模型调用」的预算重新实现了一遍，没有复用它的代码。信源清单参考了 [SuYxh/ai-news-aggregator](https://github.com/SuYxh/ai-news-aggregator) 的 OPML。

## 部署配置

生产环境建议使用 Turso 持久化；如果不配置，Vercel 仅会使用 `/tmp` 临时 SQLite，并在冷启动时从 `data/snapshot.json` 水合，邮件订阅者不能跨实例持久保存。

| 环境变量 | 要求 | 用途 |
| --- | --- | --- |
| `CRON_SECRET` | 生产必需 | 保护 `/api/refresh`；Vercel Cron 会以 Bearer 令牌调用。请生成高熵随机值，例如运行 `openssl rand -hex 32` 后将结果分别配置到 Vercel 环境变量中，不要提交到仓库 |
| `TURSO_DATABASE_URL` | 生产持久化必需 | Turso/libSQL 数据库 URL |
| `TURSO_AUTH_TOKEN` | 与 Turso URL 配套必需 | Turso 访问令牌 |
| `NEXT_PUBLIC_SITE_URL` | 生产推荐 | 站点规范 origin，例如 `https://your-domain.example`；用于 serverless 实例触发受保护的刷新函数 |
| `ARK_API_KEY` | 强烈建议 | 火山方舟：编辑评分 + 写中文标题和摘要。缺失时入选退回「信源级别 + 报道面」估分，标题走公开机翻端点，站点能跑但选得粗 |
| `ARK_EDITOR_MODEL` | 可选 | 编辑环节用的模型，默认与翻译同一个（`doubao-seed-2-0-lite`） |
| `WECHAT_TOKEN` | 公众号接入时必需 | 微信公众平台「服务器配置」中自定义的高熵 Token；用于 `/api/wechat` 回调验签，不是 AppSecret |
| `WECHAT_APP_ID` | 本地同步自定义菜单时必需 | 公众号 AppID；仅供 `npm run wechat:menu:sync` 获取接口凭证 |
| `WECHAT_APP_SECRET` | 同步自定义菜单时必需 | 公众号 AppSecret；仅在执行命令时通过本机受保护环境变量提供，不得提交或输出到日志 |

### 微信公众号动态图文回复

部署并配置 `WECHAT_TOKEN` 后，在微信公众平台「设置与开发 → 基本配置 → 服务器配置」填写：

- URL：`https://你的生产域名/api/wechat`
- Token：与 `WECHAT_TOKEN` 完全一致
- 消息加解密方式：先选「明文模式」完成最小闭环

接口支持平台 GET 验证与 POST 被动回复。用户回复「日报 / 今日听潮」「热点 / 热榜」「精选 / 最新」「关于 / 听潮AI」（旧关键词「周榜」「快讯」仍然可用，分别指向热点和精选），会收到可直接点击的单图文卡片；卡片标题与摘要读取当前 Turso 内容。

运行 `npm run wechat:menu:sync` 会发布三个直接触发动态卡片的底部菜单：`今日日报`、`当前热点`、`最新精选`（菜单 key 为 `DAILY` / `HOT` / `PICKS`；旧菜单的 `WEEKLY` / `FLASHES` 在重新同步前继续可用）。执行前须在微信开发者平台将执行机的固定公网 IPv4 加入 API IP 白名单；不使用出口 IP 会变化的 GitHub 托管 Runner 发布。站点运行时仍只需要 `WECHAT_TOKEN`，不会读取 AppSecret。

部署后还需在 GitHub Actions secrets 中配置：`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`（aggregate 直写远端库、daily-digest 读取同源数据，必需）、`RESEND_API_KEY`（日报发信，必需）、`ARK_API_KEY`（编辑评分与写稿，强烈建议）、`REPO_ALERT_TOKEN`（源失败自动开 Issue，可选）、`BAIDU_PUSH_TOKEN`（百度主动推送，可选；IndexNow 无需 secret，密钥即 `public/` 下的 32 位 hex txt）、`X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_SECRET`（X 每日一推，可选）。推广类步骤（SEO 推送、X 发帖）缺 secret 一律静默跳过且 `continue-on-error`，绝不影响日报主流程。生产环境若缺少 `CRON_SECRET`，刷新接口会以 503 明确拒绝；仅非生产环境且请求 URL 为 `localhost`、`127.0.0.1` 或 `::1` 时允许免密刷新。

### 写接口限流边界

对外只剩一个写接口：邮件订阅（`/api/subscribe`），加上会触发外部抓取的 `/api/img`、`/api/sharecard`。它们使用进程内固定窗口限流：Vercel 环境只信任平台重写的 `x-vercel-forwarded-for`，并在内存中仅保存其哈希；非 Vercel 环境不信任调用方可伪造的转发头，因此使用共享匿名桶。

这是无第三方依赖的安全降级，不是跨实例的全局配额：serverless 冷启动和不同实例各自维护计数。需要严格的生产级全局限流时，应接入 Vercel Firewall/WAF 或具有原子计数和 TTL 的共享存储。
