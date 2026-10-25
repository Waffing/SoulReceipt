import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// 临时路由：部署后访问一次即可探测 Supabase 项目所在大区，随后删除
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REGIONS = [
  "ap-northeast-1",
  "ap-southeast-1",
  "ap-northeast-2",
  "ap-southeast-2",
  "ap-south-1",
  "us-east-1",
  "us-west-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "sa-east-1",
];

const PROJECT_REF = "efanmcwffycnvksaagjv";

export async function GET() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "missing SUPABASE_DB_PASSWORD env" },
      { status: 400 }
    );
  }

  const attempts = await Promise.allSettled(
    REGIONS.map(async (region) => {
      const url = `postgresql://postgres.${PROJECT_REF}:${password}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
      const client = new PrismaClient({
        datasources: { db: { url } },
      });
      const started = Date.now();
      try {
        await Promise.race([
          client.$queryRaw`SELECT 1`,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT")), 6000)
          ),
        ]);
        return { region, ok: true, ms: Date.now() - started };
      } catch (error) {
        return {
          region,
          ok: false,
          ms: Date.now() - started,
          error: String(error).slice(0, 100),
        };
      } finally {
        try {
          await client.$disconnect();
        } catch {
          // 清理失败不影响探测结果
        }
      }
    })
  );

  const all = attempts.map((attempt) =>
    attempt.status === "fulfilled"
      ? attempt.value
      : { region: "unknown", ok: false, error: String(attempt.reason).slice(0, 100) }
  );
  const found = all.filter((item) => item.ok);

  return NextResponse.json({ found, all });
}
