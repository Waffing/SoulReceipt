import type { Receipt } from "@prisma/client";

import type {
  ReceiptData,
  ReceiptItem,
  ReceiptMode,
  SkinTheme,
  WorthLevel,
} from "@/types/receipt";

/**
 * Receipt 表行 → 前端 ReceiptData：
 * selectedTags / itemsJson 两个 JSON 字符串字段在此层防御性解析。
 */
export function mapReceiptRowToData(row: Receipt): ReceiptData {
  let selectedTags: string[] = [];
  let items: ReceiptItem[] = [];

  try {
    const parsedTags: unknown = JSON.parse(row.selectedTags);
    if (Array.isArray(parsedTags)) {
      selectedTags = parsedTags.filter(
        (tag): tag is string => typeof tag === "string"
      );
    }
  } catch {
    selectedTags = [];
  }

  try {
    const parsedItems: unknown = JSON.parse(row.itemsJson);
    if (Array.isArray(parsedItems)) {
      items = parsedItems.filter(
        (item): item is ReceiptItem =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as ReceiptItem).name === "string"
      );
    }
  } catch {
    items = [];
  }

  return {
    id: row.id,
    serialNo: row.serialNo,
    nickname: row.nickname,
    mode: row.mode as ReceiptMode,
    selectedTags,
    customNote: row.customNote,
    items,
    subtotal: row.subtotal,
    mentalTaxRate: row.mentalTaxRate,
    totalWorth: row.totalWorth,
    worthLevel: row.worthLevel as WorthLevel,
    roastComment: row.roastComment,
    stampText: row.stampText,
    prescription: row.prescription,
    barcodeCode: row.barcodeCode,
    barcodeSecret: row.barcodeSecret,
    skinTheme: row.skinTheme as SkinTheme,
    sourceEngine: row.sourceEngine,
    likesCount: row.likesCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 跑马灯昵称脱敏：保留首尾，中间打码 */
export function maskNickname(nickname: string): string {
  if (nickname.length <= 1) return "*";
  if (nickname.length === 2) return `${nickname[0]}*`;
  return `${nickname[0]}***${nickname[nickname.length - 1]}`;
}
