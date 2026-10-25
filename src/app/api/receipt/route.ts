import { NextResponse } from "next/server";
import { z } from "zod";

import { mapReceiptRowToData, maskNickname } from "@/lib/receipt-mapper";
import { generateReceiptPayload } from "@/lib/receipt-engine";
import { RECEIPT_MODES, RECEIPT_SKIN_THEMES } from "@/lib/presets";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { buildSafeFallbackReceipt, checkInputSafety } from "@/lib/safety";
import { prisma } from "@/lib/prisma";
import type { RecentReceiptSummary, SymptomStat } from "@/types/receipt";

// 跑马灯需要实时数据，禁止静态化
export const dynamic = "force-dynamic";

/** 开票接口：同一 IP 每分钟最多 15 次 */
const CREATE_RATE_LIMIT = { scope: "create", maxRequests: 15 } as const;

const createReceiptSchema = z.object({
  nickname: z.string().trim().min(1, "昵称不能为空").max(24, "昵称最长 24 字"),
  mode: z.enum(RECEIPT_MODES),
  selectedTags: z
    .array(z.string().trim().min(1, "情绪胶囊不能为空").max(60))
    .min(1, "至少选择 1 个情绪胶囊")
    .max(5, "最多选择 5 个情绪胶囊"),
  customNote: z.string().trim().max(80, "自定义吐槽最长 80 字").optional(),
  skinTheme: z.enum(RECEIPT_SKIN_THEMES).optional(),
});

/** POST /api/receipt：限流 → 安检 → 双模算账 → 入库 + 全站计数 → 返回完整小票 */
export async function POST(request: Request) {
  try {
    if (isRateLimited(getClientIp(request), CREATE_RATE_LIMIT)) {
      return NextResponse.json(
        { error: "收银机打印头过热冒烟啦，请休息10秒再试" },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "请求体不是合法 JSON" },
        { status: 400 }
      );
    }

    const parsedInput = createReceiptSchema.safeParse(body);
    if (!parsedInput.success) {
      return NextResponse.json(
        {
          error: "入参不合法",
          detail: parsedInput.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const input = parsedInput.data;

    // 安检门：昵称 + 标签 + 吐槽一起过检，命中即改开《防爆保护单》而不是报错
    const safety = checkInputSafety(
      [input.nickname, ...input.selectedTags, input.customNote ?? ""].join("\n")
    );

    let notice: string | undefined;
    const payload = safety.safe
      ? await generateReceiptPayload(input)
      : buildSafeFallbackReceipt(input);
    if (!safety.safe) {
      notice = `${safety.reason}，赛博保安已温柔拦截，特为您改开一张《赛博便利店防爆保护单》`;
    }

    const { items, selectedTags, ...rest } = payload;
    const [row, stat] = await prisma.$transaction([
      prisma.receipt.create({
        data: {
          ...rest,
          selectedTags: JSON.stringify(selectedTags),
          itemsJson: JSON.stringify(items),
        },
      }),
      // 空库首次调用时 create 分支把本次 +1 也算进去（12840 + 1）
      prisma.globalStat.upsert({
        where: { id: "global" },
        update: { totalReceipts: { increment: 1 } },
        create: { totalReceipts: 12841 },
      }),
    ]);

    return NextResponse.json(
      {
        receipt: mapReceiptRowToData(row),
        totalReceipts: stat.totalReceipts,
        notice,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/receipt]", error);
    return NextResponse.json(
      { error: "小票机卡纸了，请稍后再试" },
      { status: 500 }
    );
  }
}

/** GET /api/receipt：全站开票总数 + 最近 5 条脱敏摘要（跑马灯）+ 今日高发症状热力榜 */
export async function GET() {
  try {
    const [stat, recentRows, tagRows] = await Promise.all([
      prisma.globalStat.findUnique({ where: { id: "global" } }),
      prisma.receipt.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          serialNo: true,
          nickname: true,
          mode: true,
          worthLevel: true,
          totalWorth: true,
          skinTheme: true,
          likesCount: true,
          createdAt: true,
        },
      }),
      // 热力榜语料：最近 200 张的胶囊标签
      prisma.receipt.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { selectedTags: true, createdAt: true },
      }),
    ]);

    // 优先统计「今日」开出的小票；凌晨时段样本不足时回退到最近 200 张
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRows = tagRows.filter((row) => row.createdAt >= todayStart);
    const sourceRows = todayRows.length >= 5 ? todayRows : tagRows;

    const tagCounts = new Map<string, number>();
    for (const row of sourceRows) {
      try {
        const tags: unknown = JSON.parse(row.selectedTags);
        if (!Array.isArray(tags)) continue;
        for (const tag of tags) {
          if (typeof tag === "string" && tag.length > 0) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
          }
        }
      } catch {
        // 单条脏数据不影响整体聚合
        continue;
      }
    }
    const topTags: SymptomStat[] = [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const recent: RecentReceiptSummary[] = recentRows.map((row) => ({
      id: row.id,
      serialNo: row.serialNo,
      nickname: maskNickname(row.nickname),
      mode: row.mode as RecentReceiptSummary["mode"],
      worthLevel: row.worthLevel as RecentReceiptSummary["worthLevel"],
      totalWorth: row.totalWorth,
      skinTheme: row.skinTheme as RecentReceiptSummary["skinTheme"],
      likesCount: row.likesCount,
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({
      totalReceipts: stat?.totalReceipts ?? 12840,
      recent,
      topTags,
    });
  } catch (error) {
    // 跑马灯不许开天窗：查询异常时降级返回默认数据，而不是让首页报错
    console.error("[GET /api/receipt]", error);
    return NextResponse.json({
      totalReceipts: 12840,
      recent: [],
      topTags: [],
    });
  }
}
