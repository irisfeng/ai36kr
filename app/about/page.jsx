import Breadcrumb from '@/components/Breadcrumb';
import { ABOUT_DESCRIPTION, ABOUT_TITLE, methodFacts } from '@/lib/method';
import { aboutPageJsonLd, jsonLdScript, pageMetadata } from '@/lib/seo';

const TITLE = ABOUT_TITLE;
const DESCRIPTION = ABOUT_DESCRIPTION;

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/about',
});

export default function AboutPage() {
  const facts = methodFacts();
  return (
    <div className="container narrow">
      <header className="page-head">
        <Breadcrumb items={[
          { name: '精选', href: '/' },
          { name: TITLE, href: '/about', current: true },
        ]} />
        <h1>{TITLE}</h1>
        <p>{DESCRIPTION}</p>
      </header>
      <article className="method">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(aboutPageJsonLd(DESCRIPTION)) }}
        />
        <section className="method-sec">
          <h2 className="sec-title">听潮是什么</h2>
          <p>
            听潮 TideWire 是中文 AI 资讯精选。每隔几小时抓一轮信源，把同一件事的多家报道并成一条，再按公开的标准决定进不进精选。每天北京时间 8 点出一份日报。
          </p>
          <p>
            页面上的中文标题和摘要依据 RSS 标题和摘要改写，不是原文全文。每条都保留来源名称和原文链接。时间显示的是听潮入库时间，统一为北京时间。
          </p>
        </section>

        <section className="method-sec">
          <h2 className="sec-title">信源</h2>
          <p>
            当前 {facts.sourceCount} 个信源，分三档。泛科技源只保留 AI 相关条目。名单如下，链接到各源自己的站点。
          </p>
          {facts.tiers.map((group) => (
            <div className="source-line" key={group.tier}>
              <h3>{group.label} · {group.sources.length}</h3>
              <p>
                {group.sources.map((source, index) => (
                  <span key={source.name}>
                    {index > 0 ? '、' : ''}
                    <a href={source.home} target="_blank" rel="noopener noreferrer">{source.name}</a>
                  </span>
                ))}
              </p>
            </div>
          ))}
        </section>

        <section className="method-sec">
          <h2 className="sec-title">先筛掉什么</h2>
          <p>机械规则只拦明显不是 AI 行业新闻的条目。被拦下的仍在「全部」里，不进精选、热点和日报：</p>
          <ul>
            <li>股市行情、个股涨跌和目标价</li>
            <li>大会门票、报名和活动推广</li>
            <li>早报、晚报、周报这类多事合集</li>
          </ul>
        </section>

        <section className="method-sec">
          <h2 className="sec-title">同一件事只出一次</h2>
          <p>
            不同信源的报道按标题重合归成一个事件，主要看 {facts.eventWindowHours} 小时内的条目。判同偏保守：把两件事并错会藏掉一条新闻，漏并只是多显示一条。
          </p>
          <p>
            每个事件由一篇代表稿出面。顺序是：不是噪声的优先，官方一手优先，有摘要的优先，评分高的优先，发得早的优先。其余报道留在原文链接里，标题仍链回各源。
          </p>
        </section>

        <section className="method-sec">
          <h2 className="sec-title">评分和入选</h2>
          <p>
            有模型密钥时，每条资料一次调用同时给出 0–100 的整数、中文标题和摘要。这个分数衡量的是这件事值不值得今天花注意力，不是稿子写得好不好，也不是事实核查。
          </p>
          <p>
            摘要里如果出现材料中找不到的两位以上数字，这条摘要不用，改回 RSS 原摘要。这条数字核对只对中文原文做，因为外文译成中文会换单位。
          </p>
          <p>
            入选看「评分 + 报道面加成」是否过线。官方一手 {facts.thresholds.T1} 分，专栏 {facts.thresholds.T1_5} 分，媒体 {facts.thresholds.T2} 分。每多一家独立信源加 {facts.coverageStep} 分，封顶 {facts.coverageCap} 分。
          </p>
          <p>
            没有模型密钥时不调用模型：标题走公开机翻，入选改为估分。官方一手基础分 {facts.fallbackBase.T1}，专栏 {facts.fallbackBase.T1_5}，媒体 {facts.fallbackBase.T2}，报道面的权重更高。综合分达到 {facts.fallbackBar} 才入选。
          </p>
        </section>

        <section className="method-sec">
          <h2 className="sec-title">热点和日报</h2>
          <p>
            热点按事件算，不按文章算。{facts.heatWindowHours} 小时内每个独立信源只计一次，{facts.heatHalfLifeHours} 小时权重减半。Hacker News 的讨论最多折成 {facts.discussionCap} 家信源当量。一家媒体发很多篇也只算一次。
          </p>
          <p>
            日报不另调模型。时间窗里按重要性取最多 {facts.mainMax} 条进正文，同一信源最多 {facts.perSource} 条；第 1 条是头条，其后 {facts.highlights} 条是看点，其余按分类，再往后最多 {facts.briefMax} 条一行简讯。
          </p>
          <p>
            邮件日报在北京时间 08:13 发送。若这次调度被推迟或失败，09:13 和 10:13 会再检查，同一天只发一封。网页上的「AI 日报」随时可看最近 24 小时；这段时间没有内容时放宽到 48 小时。按日归档在 /daily/年-月-日。
          </p>
        </section>
      </article>
    </div>
  );
}
