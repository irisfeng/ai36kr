# 听潮 TideWire

中文 AI 资讯精选站：Next.js 16（App Router）+ React 19 + libsql（本地 SQLite / 线上 Turso）+ 原生 CSS。产品说明和完整流程见 README.md。

## 命令

```bash
npm test                 # node --test，全部用例约 3 秒；每个用到库的用例自建临时目录
npm run build            # 改了 app/ 或 components/ 之后必须过
npm run dev              # http://localhost:3000，启动即抓第一轮
npm run smoke            # 需要先起服务；带内容断言，不只看 200
node scripts/score-report.mjs [天数]   # 评分分布与入选率，校准门槛用
```

本地库是 `data/tidewire.db`（不进 Git）。删掉它再启动，会从 `data/snapshot.json` 重新水合。

## 流程在哪

抓取 → 预筛 → 编辑（评分 + 写稿）→ 聚簇 → 入选 → 热度 / 日报

- `lib/sources.js` 信源与分级（T1 / T1_5 / T2）
- `lib/editorial.js` 噪声规则、入选门槛、热度、代表稿
- `lib/events.js` 事件聚簇
- `lib/edition.js` 日报编排
- `prompts/editor.js` 给模型的编辑标准；`lib/editor.js` 调用与落库
- `lib/rank.js` 把上面的规则应用到近 10 天的条目并写回
- `lib/rss.js` 抓取与每轮的步骤编排
- `lib/queries.js` 页面与接口的全部读路径

## 约定

- `editorial.js`、`events.js`、`edition.js` 保持纯函数：不 import `db`，不读时钟（`now` 作参数传入）。规则改动都要有对应测试。
- `rankPosts` 必须幂等：同样的输入重跑不写库。新增由它维护的列，记得同时加进它的 diff 比较、`lib/db.js` 的迁移、`HYDRATE_DEFAULTS` 和 `scripts/export-snapshot.mjs`。
- 线上库是远端 Turso，每条语句一次网络往返：读路径走 `cached()`，批量写拼成一次 `db.exec`，不要在循环里逐行 UPDATE。libsql 远程不绑定命名参数，只用 `?`。
- 加列只用 `addColumnIfMissing`，不删表不删列：旧版的 `comments` / `votes` / `reactions` / `flashes` / `products` 表保留数据、不再读写。
- 模型输出一律当作不可信数据：解析失败整批重试，写库前过 `parseEditorReply`。没有 `ARK_API_KEY` 时每个环节都要能跑（估分 + 机翻兜底）。
- 调聚簇阈值或噪声规则时，拿 `data/snapshot.json` 的真实标题逐对看，再把看过的例子写进 `test/events.test.js` / `test/editorial.test.js`。
- 界面是纯文字的报纸版式：一个强调色（`--red`）、全直角、hairline 分隔、无卡片阴影、列表不放图。新增样式先找 `app/globals.css` 里现成的类。
- 所有时间显示走 `lib/time.js`（固定 UTC+8）。
- 代码注释和面向读者的文案用中文。

## 不要动

- `main` 由两个定时 workflow 自动写入（`public/daily-card.html`、`data/snapshot.json`）。本地改动放分支，推送前先 `git pull --rebase`。
- `data/snapshot.json` 由 CI 生成，不要手改。
- `npm run wechat:menu:sync`、`scripts/send-daily.mjs`、`scripts/post-x.mjs` 会对外发布，只在明确要求时运行。

## Agent skills

### Issue tracker

Issue 放在 GitHub Issues（`irisfeng/ai36kr`），用 `gh` CLI 操作。See `docs/agents/issue-tracker.md`.

### Triage labels

沿用默认的五个标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。See `docs/agents/triage-labels.md`.

### Domain docs

single-context：根目录一份 `CONTEXT.md`，决策记录放 `docs/adr/`（都还没有，按需再建）。See `docs/agents/domain.md`.
