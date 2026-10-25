import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并 Tailwind 类名：clsx 处理条件拼接，tailwind-merge 解决类冲突覆盖 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 生成小票流水号，格式：SR-YYYYMMDD-XXXXXX（随机段为 6 位 Base36 大写）
 * 示例：SR-20261024-K3F9QZ
 */
export function generateSerialNo(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0");
  return `SR-${year}${month}${day}-${rand}`;
}

/** 条形码密语字符集：去掉易混淆的 I/O/0/1 */
const SECRET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function pickChars(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SECRET_ALPHABET[Math.floor(Math.random() * SECRET_ALPHABET.length)];
  }
  return out;
}

/**
 * 生成 13 位条形码数字串：12 位随机 + 按 EAN-13 规范计算的最后一位校验位，
 * 可直接交给条形码字体或生成器渲染，扫码也能得到合法结果。
 */
export function generateBarcodeCode(): string {
  let base = "";
  for (let i = 0; i < 12; i += 1) {
    base += String(Math.floor(Math.random() * 10));
  }
  const checksum = base.split("").reduce((sum, ch, index) => {
    const digit = Number(ch);
    return sum + (index % 2 === 0 ? digit : digit * 3);
  }, 0);
  const checkDigit = (10 - (checksum % 10)) % 10;
  return `${base}${checkDigit}`;
}

/** 生成条形码背后的「确诊密语」，示例：K7Q2-9XZF */
export function generateBarcodeSecret(): string {
  return `${pickChars(4)}-${pickChars(4)}`;
}

/** 金额格式化：formatMoney(66.6) => "¥66.60"，formatMoney(-666) => "¥-666.00" */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `¥${sign}${Math.abs(amount).toFixed(2)}`;
}

/** 宽松解析金额字符串："¥-666.00" / "-666" / "¥ 8.80" => number，解析失败返回 0 */
export function parseMoney(raw: string): number {
  const parsed = Number(raw.replace(/[¥￥\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
