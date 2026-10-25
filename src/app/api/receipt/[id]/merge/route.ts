import { NextResponse } from "next/server";
import { z } from "zod";

import { generateDualMergeReceipt } from "@/lib/receipt-engine";
import { MODE_CONFIGS } from "@/lib/presets";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { mapReceiptRowToData } from "@/lib/receipt-mapper";
import { checkInputSafety } from "@/lib/safety";
import { prisma } from "@/lib/prisma";
import type { ReceiptItem, ReceiptMode, SkinTheme } from "@/types/receipt";

// 合单结果页需要实时数据
export const dynamic = "force-dynamic";

/** 合单接口：同一 IP 每分钟最多 15 次（与开票接口分开计桶） */
const MERGE_RATE_LIMIT = { scope: "merge", maxRequests: 15 } as const;

const mergeReceiptSchema = z.object({
  nickname: z.string().trim().min(1, "昵称不能为空").max(24, "昵称最长 24 字"),
  selectedTags: z
    .array(z.string().trim().min(1).max(60))
    .min(2, "至少选择 2 个情绪胶囊才能与你共鸣")
    .max(3, "最多选择 3 个情绪胶囊，冤种也要节制"),
});

/** POST /api/receipt/[id]/merge：好友与发起人合单，生成一张联名确诊单 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (isRateLimited(getClientIp(request), MERGE_RATE_LIMIT)) {
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

    const parsed = mergeReceiptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入参不合法", detail: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const friend = parsed.data;

    const parent = await prisma.receipt.findUnique({ where: { id: params.id } });
    if (!parent) {
      return NextResponse.json(
        { error: "发起人的小票不存在或已被撕走，合单失败" },
        { status: 404 }
      );
    }
    if (parent.sourceEngine === "dual-merge") {
      return NextResponse.json(
        { error: "这是一张卧龙凤雏联名小票，冤种名额已满，请另起炉灶" },
        { status: 400 }
      );
    }

    // 乙方胶囊必须来自当前模式的货架，防止来路不明的数据混入
    const mode = parent.mode as ReceiptMode;
    const shelf = MODE_CONFIGS[mode]?.tags ?? [];
    const invalidTags = friend.selectedTags.filter(
      (tag) => !shelf.includes(tag)
    );
    if (invalidTags.length > 0) {
      return NextResponse.json(
        { error: "检测到来路不明的情绪胶囊，请从本店货架重新挑选" },
        { status: 400 }
      );
    }

    // 安检门：昵称与胶囊一起过检
    const safety = checkInputSafety(
      [friend.nickname, ...friend.selectedTags].join("\n")
    );
    if (!safety.safe) {
      return NextResponse.json(
        { error: `${safety.reason}，安检门建议先温柔一下再来合单` },
        { status: 400 }
      );
    }

    // 还原甲方快照（防御性解析 JSON 字段）
    let parentTags: string[] = [];
    let parentItems: ReceiptItem[] = [];
    try {
      const parsedTags: unknown = JSON.parse(parent.selectedTags);
      if (Array.isArray(parsedTags)) {
        parentTags = parsedTags.filter(
          (tag): tag is string => typeof tag === "string"
        );
      }
    } catch {
      parentTags = [];
    }
    try {
      const parsedItems: unknown = JSON.parse(parent.itemsJson);
      if (Array.isArray(parsedItems)) {
        parentItems = parsedItems.filter(
          (item): item is ReceiptItem =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as ReceiptItem).name === "string"
        );
      }
    } catch {
      parentItems = [];
    }

    const payload = generateDualMergeReceipt(
      {
        nickname: parent.nickname,
        mode,
        selectedTags: parentTags,
        items: parentItems,
        skinTheme: parent.skinTheme as SkinTheme,
      },
      { nickname: friend.nickname, selectedTags: friend.selectedTags }
    );

    const { items, selectedTags, ...rest } = payload;
    const [row, stat] = await prisma.$transaction([
      prisma.receipt.create({
        data: {
          ...rest,
          selectedTags: JSON.stringify(selectedTags),
          itemsJson: JSON.stringify(items),
        },
      }),
      prisma.globalStat.upsert({
        where: { id: "global" },
        update: { totalReceipts: { increment: 1 } },
        create: { totalReceipts: 12841 },
      }),
    ]);

    return NextResponse.json(
      { receipt: mapReceiptRowToData(row), totalReceipts: stat.totalReceipts },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/receipt/:id/merge]", error);
    return NextResponse.json(
      { error: "合单打印机冒烟了，请稍后再试" },
      { status: 500 }
    );
  }
}
