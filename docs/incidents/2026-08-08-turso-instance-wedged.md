# 事故复盘：Turso 实例流式通道卡死（2026-08-08）

## 现象

- 全站读库页面 500（/daily、/weekly、/api/posts、/post/*），首页因静态壳+ISR 幸存但客户端取数失败显示空占位
- GitHub Actions 聚合自 2026-08-07 21:42 UTC 起连续失败，报 `Hrana 502 Bad Gateway: upstream forward failed`

## 误诊弯路（值得记录）

最初判断为"Turso 实例整体不可达/可能被回收"，按等待自愈策略挂了 30 分钟盯梢。约 5.5 小时后用 turso CLI 直连才发现真相更微妙。

## 根因

tidewire 实例的**流式游标通道（libsql 客户端用的 WS/cursor 路径）卡死**，但**普通 HTTP 查询管道（/v2/pipeline）完全正常**：

| 通道 | 状态 |
|---|---|
| 网关鉴权（坏 token → 401/400） | 正常 |
| turso CLI shell（HTTP 管道） | 正常，能读出全部 1422 篇文章 |
| libsql 客户端 WS/cursor 路径 | **502 / unexpected EOF** |

关键对照实验：同账号新建 wsprobe 测试库，WS 路径完全正常 → 故障是该实例特有，非账号/区域/额度问题。

排除的嫌疑：额度超限（当月 Rows Read 38.6M / 免费上限 500M，且超限报 BLOCKED 而非 502）、token 失效（坏 token 会被 401 干脆拒绝，不会到 502）、代码变更（故障窗口无部署）、Vercel 配置（GitHub Actions 独立环境同错）。

## 修复（换库重建，~20 分钟）

1. `turso db shell tidewire .dump` 实时导出全量数据（10 表，含故障期间丢失的投票/评论之外的所有内容）
2. `turso db create tidewire2` + 灌入 dump，10 表行数逐一对齐
3. Vercel Production env + GitHub secrets 两处 TURSO_DATABASE_URL/TURSO_AUTH_TOKEN 换新库
4. `vercel redeploy` 最新生产部署（改 env 必须重部署才生效）→ 全站 smoke 9 页面 + 3 断言通过
5. 手动 dispatch 聚合 workflow → 成功（+297 新文章，35 源在线）

## 时间线

- 08-07 21:42 UTC 聚合首挂（实例流式通道死亡时刻）
- 08-08 ~02:30 用户反馈，确诊 Turso 侧 502，挂 cron 盯梢等待自愈
- 03:05 用户提供 Turso 登录态 → CLI 直连发现库活着但流式通道坏
- 03:15 dump → 03:19 tidewire2 灌好 + 密钥换完 → 03:21 重部署上线，全站恢复
- 03:26 手动聚合成功，数据链路满血

总宕机时长约 5.7 小时（其中前 5.5 小时在等自愈）。

## 教训与防复发

1. **"实例不可达"要细分通道**。最初的 502 被读成"库死了"，实际只是游标通道死了——HTTP 管道还活着这条逃生通道直接决定了我们能零备份损耗实时迁库。以后遇到 Turso 故障，第一时间用 `turso db shell <db> "select 1"`（HTTP 管道）和 libsql 客户端（WS 管道）分别探测，分清"实例死"还是"通道死"。
2. **等待自愈要设硬上限**。本次等 5.5 小时后靠人工介入才定位真相。规矩：此类故障 2 小时内无自愈迹象，直接走换库重建（全流程已验证 20 分钟可完成）。
3. **dump 即备份**。除每日 JSONL 备份外，确认了 `.dump` 实时导出随时可用，迁移前必先 dump 一份到 /tmp 再动手。
4. 旧库 tidewire 保留观察（暂不 destroy），确认 Turso 侧无恢复价值后可删。wsprobe 测试库已清理。
