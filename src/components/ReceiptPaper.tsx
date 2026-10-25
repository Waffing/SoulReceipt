"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

import { MODE_CONFIGS, SECTION_HEADER_PREFIXES, SKIN_THEMES } from "@/lib/presets";
import { soundEngine } from "@/lib/sound-engine";
import { formatMoney } from "@/lib/utils";
import type { ReceiptData, ReceiptItem } from "@/types/receipt";

interface ReceiptPaperProps {
  receipt: ReceiptData;
  /** 是否已撕开小票（控制身价模糊遮罩与确诊印章） */
  isRevealed: boolean;
  /** 逐行吐纸窗口：传入时只渲染前 N 行，最新一行带热敏显影动画 */
  visibleLineCount?: number;
  /** 条形码被点击后的额外回调（音效与彩蛋气泡组件内部已处理） */
  onBarcodeClick?: () => void;
  /** 根节点 id，供 html-to-image 导出图片时定位 */
  idForExport?: string;
}

/** 由条形码数字串确定性生成粗细交替竖条（同一票号渲染结果恒定） */
function buildBarcodeBars(code: string) {
  const BAR_WIDTHS = [1.2, 1.2, 2.6, 1.2, 3.4, 1.8, 2, 1.2, 2.8, 1.8];
  const bars: Array<{ x: number; width: number }> = [];
  let cursor = 0;
  for (let i = 0; i < code.length; i += 1) {
    const digit = Number(code[i]) || 0;
    const width = BAR_WIDTHS[digit];
    bars.push({ x: cursor, width });
    cursor += width + (digit % 3) + 1.2;
  }
  return { bars, totalWidth: cursor };
}

/** 双人合单小票的甲方/乙方病友分区头 */
function isSectionHeader(item: ReceiptItem): boolean {
  return SECTION_HEADER_PREFIXES.some((prefix) =>
    item.name.startsWith(prefix)
  );
}

export function ReceiptPaper({
  receipt,
  isRevealed,
  visibleLineCount,
  onBarcodeClick,
  idForExport,
}: ReceiptPaperProps) {
  const skin = SKIN_THEMES[receipt.skinTheme];
  const modeConfig = MODE_CONFIGS[receipt.mode];
  const [printedAt, setPrintedAt] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [secretVisible, setSecretVisible] = useState(false);

  // 打印时间在客户端格式化，避免 SSR/客户端时区差异导致 hydration 告警
  useEffect(() => {
    const date = new Date(receipt.createdAt);
    const pad = (value: number) => String(value).padStart(2, "0");
    setPrintedAt(
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }, [receipt.createdAt]);

  // 分享链接只能在浏览器端兜底 origin；优先使用构建期注入的公开域名
  useEffect(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    setShareUrl(`${siteUrl || window.location.origin}/?receipt=${receipt.id}`);
  }, [receipt.id]);

  // 条形码彩蛋气泡 2.5 秒后自动收起
  useEffect(() => {
    if (!secretVisible) return;
    const timer = window.setTimeout(() => setSecretVisible(false), 2500);
    return () => window.clearTimeout(timer);
  }, [secretVisible]);

  const hasLineWindow = typeof visibleLineCount === "number";
  const shownItems = hasLineWindow
    ? receipt.items.slice(0, visibleLineCount)
    : receipt.items;
  const allLinesShown =
    !hasLineWindow || (visibleLineCount ?? 0) >= receipt.items.length;

  const barcode = useMemo(
    () => buildBarcodeBars(receipt.barcodeCode),
    [receipt.barcodeCode]
  );

  const handleBarcodeClick = () => {
    soundEngine.playBarcodeBeep();
    setSecretVisible(true);
    onBarcodeClick?.();
  };

  return (
    <div
      id={idForExport}
      className={`receipt-sawtooth-top receipt-sawtooth-bottom theme-${receipt.skinTheme} relative w-full`}
      style={{ backgroundColor: skin.bg }}
    >
      <div className="bg-[color:var(--receipt-paper)] px-5 pb-9 pt-6 text-[color:var(--receipt-ink)]">
        {/* 店招抬头 */}
        <header className="text-center">
          <h3 className="text-lg font-bold leading-snug">
            🧾 人间凑数便利店 · 精神鉴定局
          </h3>
          <p className="mt-1 text-[10px] tracking-[0.28em] text-[color:var(--receipt-dim)]">
            SOUL RECEIPT CYBER CONVENIENCE STORE
          </p>
          <div className="mt-3 flex items-center justify-between text-[10px]">
            <span className="tabular-nums">NO. {receipt.serialNo}</span>
            <span className="tabular-nums">{printedAt || "---- --:--"}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px]">
            <span className="truncate">顾客代号：{receipt.nickname}</span>
            <span
              className="ml-2 shrink-0 border-2 border-black px-1.5 py-0.5 text-[10px] font-bold text-black"
              style={{ backgroundColor: modeConfig.badgeColor }}
            >
              {modeConfig.title}
            </span>
          </div>
        </header>

        <div
          className="my-3 border-t-2 border-dashed border-black/50"
          aria-hidden
        />

        {/* 情绪计价明细表（支持逐行吐纸） */}
        <div className="text-xs">
          <div className="flex font-bold">
            <span className="flex-1">情绪单品 / 症状</span>
            <span className="w-12 text-right">数量</span>
            <span className="w-20 text-right">小计</span>
          </div>
          <ul className="mt-2 space-y-2">
            {shownItems.map((item, index) => {
              const isFreshLine =
                hasLineWindow && index === (visibleLineCount ?? 0) - 1;
              if (isSectionHeader(item)) {
                return (
                  <li
                    key={`${item.name}-${index}`}
                    className={isFreshLine ? "thermal-glow" : undefined}
                  >
                    <p className="border-y-2 border-dashed border-black/60 py-1.5 text-center text-[11px] font-black tracking-[0.2em]">
                      {item.name}
                      <span className="block text-[9px] font-medium italic tracking-normal text-[color:var(--receipt-dim)]">
                        {item.remark}
                      </span>
                    </p>
                  </li>
                );
              }
              return (
                <li
                  key={`${item.name}-${index}`}
                  className={isFreshLine ? "thermal-glow" : undefined}
                >
                  <div className="flex items-baseline gap-2">
                    {/* 名称列 min-w-0 + break-words：小屏长名折行而不挤压右侧固定列 */}
                    <span className="min-w-0 flex-1 break-words">{item.name}</span>
                    <span className="w-12 shrink-0 text-right tabular-nums">
                      {item.qty}
                    </span>
                    <span className="w-20 shrink-0 text-right tabular-nums">
                      {item.total}
                    </span>
                  </div>
                  {item.remark && (
                    <p className="break-words pl-3 text-[10px] italic leading-snug text-[color:var(--receipt-dim)]">
                      └ 备注：{item.remark}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {allLinesShown && (
          <>
            <div
              className="my-3 border-t-2 border-dashed border-black/50"
              aria-hidden
            />

            {/* 结算区 */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>情绪小计</span>
                <span className="tabular-nums">
                  {formatMoney(receipt.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>精神折旧税率 ({receipt.mentalTaxRate})</span>
                <span>已计提</span>
              </div>
            </div>

            {/* 最终估值：未撕票时高斯模糊悬念遮罩 */}
            <div className="mt-3 flex items-end justify-between border-t-2 border-dashed border-black/50 pt-3">
              <span className="pb-1 text-xs font-bold">今日最终精神估值</span>
              <div
                className={`text-right ${isRevealed ? "" : "blur-md select-none"}`}
              >
                {isRevealed ? (
                  <motion.span
                    initial={{ scale: 0.7 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 14 }}
                    className="inline-block text-3xl font-black tabular-nums"
                  >
                    {receipt.totalWorth}
                    <span className="ml-2 text-base font-black">
                      {receipt.worthLevel}
                    </span>
                  </motion.span>
                ) : (
                  <span className="text-2xl font-bold tabular-nums">
                    {receipt.totalWorth}
                    <span className="ml-2 text-sm font-bold">
                      {receipt.worthLevel}
                    </span>
                  </span>
                )}
              </div>
            </div>
            {!isRevealed && (
              <p className="mt-1 animate-pulse text-right text-[10px] font-bold text-[color:var(--receipt-dim)]">
                [撕下小票揭晓身价]
              </p>
            )}

            {/* 店长毒舌批注 */}
            <div className="mt-4 border-2 border-dashed border-black/60 p-3 text-xs leading-relaxed">
              <span className="font-bold">【店长锐评】</span>
              {receipt.roastComment}
            </div>

            {/* 赛博处方签 */}
            <div className="mt-3 bg-black px-3 py-2 text-[11px] leading-relaxed text-white">
              <span className="font-bold">℞ 赛博处方</span>
              <br />
              {receipt.prescription}
            </div>

            {/* 条形码 + 二维码 */}
            <div className="mt-5 flex items-end gap-4">
              <div className="relative flex-1">
                {secretVisible && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute -top-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap border-2 border-black bg-black px-2 py-1 text-[10px] font-bold text-white"
                  >
                    🔓 彩蛋密语：{receipt.barcodeSecret}
                  </motion.div>
                )}
                <button
                  type="button"
                  onClick={handleBarcodeClick}
                  aria-label="扫描条形码查看隐藏彩蛋"
                  className="block w-full cursor-pointer text-left active:translate-y-px"
                >
                  <svg
                    viewBox={`0 0 ${barcode.totalWidth} 44`}
                    preserveAspectRatio="none"
                    className="block h-11 w-full"
                    aria-hidden
                  >
                    {barcode.bars.map((bar, index) => (
                      <rect
                        key={index}
                        x={bar.x}
                        y={0}
                        width={bar.width}
                        height={44}
                        fill="currentColor"
                      />
                    ))}
                  </svg>
                  <p className="mt-1 text-center text-[10px] tracking-[0.3em] tabular-nums">
                    {receipt.barcodeCode}
                  </p>
                </button>
              </div>
              <div className="w-20 shrink-0 text-center">
                {shareUrl ? (
                  <QRCodeSVG
                    value={shareUrl}
                    size={64}
                    bgColor={skin.bg}
                    fgColor={skin.ink}
                    level="M"
                  />
                ) : (
                  <div
                    className="h-16 w-16 border-2 border-dashed border-black/40"
                    aria-hidden
                  />
                )}
                <p className="mt-1 text-[9px] leading-tight">
                  扫码测测你值几毛钱
                </p>
              </div>
            </div>

            <p className="mt-4 text-center text-[9px] leading-relaxed text-[color:var(--receipt-dim)]">
              本小票仅供娱乐 · 不构成任何医疗建议 · SOULRECEIPT © 2026
            </p>
          </>
        )}
      </div>

      {/* 红色确诊印章：撕票后重锤砸落 */}
      {isRevealed && (
        <motion.div
          aria-hidden
          initial={{ scale: 3, opacity: 0, rotate: -14 }}
          animate={{ scale: [3, 0.9, 1], opacity: [0, 1], rotate: -14 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="pointer-events-none absolute bottom-44 right-3 z-10"
        >
          <div
            className="border-4 p-1.5"
            style={{ borderColor: skin.stamp, color: skin.stamp }}
          >
            <div
              className="border-2 px-4 py-2"
              style={{ borderColor: skin.stamp }}
            >
              <p className="text-xl font-black leading-tight tracking-widest">
                {receipt.stampText}
              </p>
              <p className="mt-0.5 text-[8px] font-bold tracking-[0.35em]">
                SOULRECEIPT CERTIFIED
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
