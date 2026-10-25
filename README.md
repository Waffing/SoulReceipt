# SoulReceipt · 精神状态小票机（赛博便利店确诊单）

> 输入你的精神状态，打出一张热敏纸风格的「确诊单」：内耗明细、精神税、毒舌烤评、确诊印章与撕票仪式感。支持双人冤种合单、短视频导演级录屏、高清海报导出与全网症状热力榜。

一款为社交媒体传播而生的互动 Web 应用——零静态音频依赖、无 LLM Key 也能 100% 完整体验、从开票到裂变分享的完整闭环。

## 功能全景

| 模块 | 能力 |
| --- | --- |
| 🧾 赛博收银台 | 4 大诊断模式 × 14 个情绪胶囊多选、随机昵称/随机选胶囊、拟物液晶屏、状态机吐纸动画 |
| 🔊 声效引擎 | Web Audio 实时合成 6 种收银机音效（咔哒/收银铃/打印滋滋/撕纸/盖章/扫码），零音频文件、零 404 |
| ✂️ 撕票仪式 | Pointer 手势横向撕票（裂痕进度条 + 摩擦音）+ 一键撕下兜底，撕开后身价揭晓 + 重锤印章 |
| 🎬 影院模式 | 8 秒导演级自动运镜（倒计时→打印运镜→激光撕票→印章揭晓），专为抖音/小红书录屏设计 |
| 🖼️ 海报导出 | html-to-image 高清 PNG（2x）下载 + 长按保存，4 套皮肤实时换肤并持久化 |
| 👯 冤种合单 | 好友在分享页挑 2~3 个症状与发起人拼成「卧龙凤雏联名认证」超长确诊单，附灵魂共振税 |
| 📊 症状热力榜 | 今日全网高发情绪胶囊 Top 8 实时聚合（凌晨自动回退最近 200 张） |
| 🛡️ 安全防爆 | 敏感词安检（暴力/自残/色情/涉政/违法），命中平滑改开《防爆保护单》而非报错 |

## 技术栈

- **框架**：Next.js 14（App Router）+ TypeScript + React 18
- **样式**：Tailwind CSS 3 + 新粗野主义（Neo-Brutalism）× 酸性热敏（Acid Thermal）设计系统
- **动效**：framer-motion（吐纸/运镜/印章/震动）
- **数据**：Prisma 5 + SQLite（零配置起步，可无缝切换 PostgreSQL/Supabase）
- **音效**：Web Audio API 纯合成（`src/lib/sound-engine.ts`）
- **导出/码**：html-to-image、qrcode.react、zod

## 快速开始

```bash
npm install            # 自动执行 postinstall: prisma generate
npx prisma db push     # 初始化 prisma/dev.db
npm run dev            # http://localhost:3000
```

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | 数据库连接串；本地默认 `file:./dev.db`（相对 `prisma/` 目录解析），生产可换 PostgreSQL/Supabase |
| `LLM_API_KEY` | ❌ | OpenAI 兼容接口的 Key（DeepSeek/通义/OpenAI 均可）；**留空则 100% 走内置本地模因引擎** |
| `LLM_BASE_URL` | ❌ | 默认 `https://api.deepseek.com/v1` |
| `LLM_MODEL` | ❌ | 默认 `deepseek-chat` |
| `NEXT_PUBLIC_SITE_URL` | ❌ | 站点公开域名，驱动小票二维码与裂变口令；缺省回退 `window.location.origin`。**注意 `NEXT_PUBLIC_*` 是构建期内联变量，部署时需在 build 阶段注入** |

## 目录结构

```
prisma/schema.prisma              # Receipt（确诊单）+ GlobalStat（全站计数）
src/types/receipt.ts              # 小票数据结构 + 状态机 + 合单/热力榜类型
src/lib/presets.ts                # 预设库：昵称池、4 模式情绪胶囊、4 套皮肤、合单常量
src/lib/receipt-engine.ts         # AI + 本地规则双模算账引擎 + 双人合单合成器
src/lib/safety.ts                 # 内容安全防爆盾（安检 + 防爆保护单）
src/lib/sound-engine.ts           # Web Audio 声效合成器单例
src/lib/rate-limit.ts             # 内存滑动窗口限流（scope 隔离）
src/lib/receipt-mapper.ts         # Prisma 行 → ReceiptData（防御性 JSON 解析）
src/lib/utils.ts                  # cn / 流水号 / EAN-13 条形码 / 金额工具
src/app/globals.css               # 设计系统：锯齿、硬阴影、热敏辉光、皮肤变量
src/app/page.tsx                  # 主控台：跑马灯 / 输入台 / 状态流转 / 热力榜 / 历史抽屉
src/app/r/[id]/page.tsx           # 分享围观页：盖章小票 / 点赞 / 冤种合单抽屉 / 回放
src/app/api/receipt/route.ts      # POST 开票（限流+安检+双模）/ GET 跑马灯+热力榜
src/app/api/receipt/[id]/route.ts      # GET 详情 / PATCH 点赞与换肤
src/app/api/receipt/[id]/merge/route.ts # POST 冤种合单
src/components/ReceiptPaper.tsx          # 可换肤小票本体（逐行吐纸/悬念遮罩/印章/条码）
src/components/TearOffZone.tsx           # 手势横向撕票
src/components/ThermalPrinterMachine.tsx # 赛博收银机舱
src/components/CinemaModeModal.tsx       # 🎬 8 秒导演级录屏模式
src/components/ShareExportModal.tsx      # 换肤 / 导出 / 裂变口令 / 合单入口
```

## API 文档

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/receipt` | 开票：IP 限流（15 次/分）→ zod 校验 → 安检 → 双模引擎 → 入库 + 计数 +1。命中安检返回防爆单与 `notice`；超限 429 |
| GET | `/api/receipt` | `{ totalReceipts, recent[5]（脱敏）, topTags[8]（今日高发胶囊） }` |
| GET | `/api/receipt/:id` | 单张小票详情（JSON 字段已解析），404 = 不存在 |
| PATCH | `/api/receipt/:id` | `{ "action": "like" }` 点赞自增 / `{ "action": "change_skin", "skinTheme": "y2k-pink" }` 换肤 |
| POST | `/api/receipt/:id/merge` | 冤种合单：`{ nickname(1~24), selectedTags(2~3 且须为当前模式胶囊) }` → 生成联名小票；联名票不可再合（400）；限流/安检同开票接口 |

所有接口的 JSON 解析均带 try-catch 防御，数据库异常返回语义化错误信息而非堆栈。

## 核心机制

**双模算账引擎**：配置 `LLM_API_KEY` 时调用 OpenAI 兼容 Chat Completions（5.5s `AbortSignal.timeout` 熔断，输出过 zod 严校验 + 安检复检）；未配置/超时/不合规时静默降级本地模因合成引擎——每个情绪胶囊转成一条明细（随机数量 × 正负单价），`customNote` 包装为 `¥-666.00` 工伤明细，估值按 SSR→TRASH 五档分级。

**双人合单**：甲方（发起人）症状清单 + 乙方（好友）症状清单 + 「双人灵魂内耗共振税」合成一张超长小票；共振率 = 150 + 重叠胶囊×100 + 双方胶囊总数×15（封顶 990%），税额 = -(520 + 重叠数×131.4)；分区头以 `【甲方病友：…】/【乙方病友：…】` 渲染为虚线分隔条，盖章固定「卧龙凤雏联名认证」，条形码彩蛋密语 `WOLONG-FENGCHU`。

**内容安全**：安检覆盖自残/暴力/色情/涉政/违法五类词库（归一化拦截空格绕过）；开票命中改开《防爆保护单》（含心理援助热线 12356），合单命中直接 400 温柔拒绝；LLM 输出二次过检。

**导出**：小票根节点带内联皮肤背景色，`toPng(node, { pixelRatio: 2, cacheBust: true })`；下载与长按保存双通道，老旧浏览器报错时引导截图兜底。

## 部署指南

### 方案 A：Vercel（推荐零运维）

1. 仓库导入 Vercel，框架自动识别 Next.js；
2. 环境变量配置 `DATABASE_URL`（SQLite 文件系统在 Serverless 不可持久，**建议替换为 [Supabase](https://supabase.com) / Neon 的 PostgreSQL 连接串**）、`LLM_API_KEY`（可选）、`NEXT_PUBLIC_SITE_URL`（设为最终域名）；
3. 首次部署前对生产库执行 `npx prisma db push`。

### 方案 B：Docker Compose（自托管，SQLite 数据落卷）

```bash
docker compose up -d --build
# 数据持久化在命名卷 soulreceipt-data（/app/data/dev.db）
```

> `NEXT_PUBLIC_SITE_URL` 通过 `build.args` 在构建期注入；更换域名后需重新 build。

### 方案 C：VPS + PM2

```bash
npm ci && npx prisma db push && npm run build
pm2 start npm --name soulreceipt -- start
```

Nginx 反代时请保留 `X-Forwarded-For` 头，限流才能按真实客户端 IP 生效。

### 数据库升级路径

`prisma/schema.prisma` 的 provider 由 `sqlite` 改为 `postgresql` 并更新 `DATABASE_URL` 后执行 `npx prisma db push` 即可完成迁移，业务代码零改动。

## 质量保障

- **SSR 水合**：全部客户端专属状态（localStorage/origin/随机值/时间）均在 useEffect 或事件回调内读取，无 Hydration 告警；
- **接口防御**：JSON 解析全 try-catch，数据库异常返回语义化错误；入库 + 计数为事务操作；
- **响应式**：明细表长名称 `break-words` 折行、数量/小计列 `shrink-0`，375×667 实测无溢出；
- **导出稳定**：内联背景色防透明 PNG，Loading 与降级提示完备；
- **限流**：开票与合单分别独立限流桶（scope 隔离），单实例精确生效。

## 阶段规划

- [x] **Phase 1** 工程基座：样式系统 / 数据模型 / 核心类型
- [x] **Phase 2** 打印引擎：情绪胶囊库、安全防爆盾、双模算账引擎、RESTful API
- [x] **Phase 3** 声效引擎：Web Audio 合成六大收银机音效（零音频文件）
- [x] **Phase 4** 核心组件：可换肤小票 / 手势撕票 / 收银机舱
- [x] **Phase 5** 全流程整合：主控台、影院模式、海报导出、分享回访页
- [x] **Phase 6** 质量加固：水合排查 / 导出稳定 / 小屏适配 / 接口限流
- [x] **Phase 7** 交付配置：.env.example / Docker / Compose / 交付文档
- [x] **Phase 8** 增长迭代：双人冤种合单、今日症状热力榜
- [ ] **Phase 9** 上线冲刺：OG 分享卡片、真实 LLM 接入联调、热榜排行与压测

---

本小票仅供娱乐 · 不构成任何医疗建议 · 如果你真的很难受，请拨打全国心理援助热线 **12356**（24 小时）
