import { NextResponse } from "next/server";
import { z } from "zod";

import { mapReceiptRowToData } from "@/lib/receipt-mapper";
import { RECEIPT_SKIN_THEMES } from "@/lib/presets";
import { prisma } from "@/lib/prisma";

const patchReceiptSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("like") }),
  z.object({
    action: z.literal("change_skin"),
    skinTheme: z.enum(RECEIPT_SKIN_THEMES),
  }),
]);

/** GET /api/receipt/:id：单张小票详情（JSON 字段已防御性解析） */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const row = await prisma.receipt.findUnique({ where: { id: params.id } });
    if (!row) {
      return NextResponse.json(
        { error: "小票不存在或已被撕走" },
        { status: 404 }
      );
    }
    return NextResponse.json({ receipt: mapReceiptRowToData(row) });
  } catch (error) {
    console.error("[GET /api/receipt/:id]", error);
    return NextResponse.json(
      { error: "小票机读卡失败，请稍后再试" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/receipt/:id
 * - { action: "like" }：likesCount 原子自增 1
 * - { action: "change_skin", skinTheme }：更新小票皮肤
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "请求体不是合法 JSON" },
        { status: 400 }
      );
    }

    const parsed = patchReceiptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "action 不合法，仅支持 like / change_skin" },
        { status: 400 }
      );
    }

    const existing = await prisma.receipt.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "小票不存在或已被撕走" },
        { status: 404 }
      );
    }

    const data =
      parsed.data.action === "like"
        ? { likesCount: { increment: 1 } }
        : { skinTheme: parsed.data.skinTheme };

    const row = await prisma.receipt.update({ where: { id: params.id }, data });
    return NextResponse.json({ receipt: mapReceiptRowToData(row) });
  } catch (error) {
    console.error("[PATCH /api/receipt/:id]", error);
    return NextResponse.json(
      { error: "小票机盖章失败，请稍后再试" },
      { status: 500 }
    );
  }
}
