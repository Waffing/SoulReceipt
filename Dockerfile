# syntax=docker/dockerfile:1
# ============================================================
# SoulReceipt 生产镜像：多阶段构建（deps → builder → runner）
# 产物为 Next.js standalone 自包含服务，直接 node server.js 启动
# ============================================================

FROM node:20-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1

# ---- 阶段一：安装依赖并生成 Prisma Client ----
FROM base AS deps
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

# ---- 阶段二：构建产物（NEXT_PUBLIC_* 在此阶段内联进客户端包） ----
FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 阶段三：精简运行时 ----
FROM base AS runner
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
ENV NODE_ENV=production
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
