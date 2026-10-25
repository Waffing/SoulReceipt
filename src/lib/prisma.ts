import { PrismaClient } from "@prisma/client";

// 复用 globalThis 上的 Prisma 实例，避免 Next.js 热更新时反复 new 连接把 SQLite 连接数打爆
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
