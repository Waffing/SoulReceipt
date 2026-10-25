"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { ReceiptPaper } from "@/components/ReceiptPaper";
import { TearOffZone } from "@/components/TearOffZone";
import { soundEngine } from "@/lib/sound-engine";
import type { MachineStage, ReceiptData } from "@/types/receipt";

interface ThermalPrinterMachineProps {
  /** 待打印/展示的小票；null 时机身待机 */
  receipt: ReceiptData | null;
  /** 由父级持有的小票机状态机 */
  stage: MachineStage;
  /** PRINTING 阶段全部行吐完后回调（父级应将 stage 切到 READY_TO_TEAR） */
  onPrintingDone?: () => void;
  /** 撕票成功回调（父级应将 stage 切到 REVEALED） */
  onTearSuccess?: () => void;
  /** 透传给小票的条形码点击回调 */
  onBarcodeClick?: () => void;
  /** 透传给小票的导出锚点 id */
  idForExport?: string;
}

const PRINT_STEP_INTERVAL_MS = 380;

const STAGE_LABELS: Record<MachineStage, string> = {
  IDLE: "待机 STANDBY",
  PRINTING: "打印中 PRINTING",
  READY_TO_TEAR: "待撕票 READY",
  REVEALED: "已揭晓 REVEALED",
  CINEMA_MODE: "影院模式 CINEMA",
};

const SCREEN_TEXTS: Record<MachineStage, string> = {
  IDLE: "READY. 投币后将出具精神鉴定报告",
  PRINTING: "PRINTING. 热敏头加热中，请勿触摸出纸口",
  READY_TO_TEAR: "DONE. 请撕下小票揭晓身价",
  REVEALED: "OK. 小票已交付，欢迎再次光临",
  CINEMA_MODE: "CINEMA. 沉浸回放模式",
};

/**
 * 拟物赛博热敏收银机舱：
 * PRINTING 时响收银铃并按 380ms/行驱动吐纸（同步播放步进音效），
 * 机身微抖 + 出纸口红色加热呼吸灯；全部行吐完后回调 onPrintingDone，
 * READY_TO_TEAR 时在出纸口下方挂 TearOffZone 等待撕票。
 */
export function ThermalPrinterMachine({
  receipt,
  stage,
  onPrintingDone,
  onTearSuccess,
  onBarcodeClick,
  idForExport,
}: ThermalPrinterMachineProps) {
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const onPrintingDoneRef = useRef(onPrintingDone);

  useEffect(() => {
    onPrintingDoneRef.current = onPrintingDone;
  });

  // 吐纸状态机：收银铃 → 逐行出纸 → 通知父级
  useEffect(() => {
    if (stage !== "PRINTING" || !receipt || receipt.items.length === 0) {
      return;
    }
    soundEngine.playCashRegisterDing();
    setVisibleLineCount(0);
    let line = 0;
    const timer = window.setInterval(() => {
      line += 1;
      setVisibleLineCount(line);
      soundEngine.playThermalPrintStep(line);
      if (line >= receipt.items.length) {
        window.clearInterval(timer);
        onPrintingDoneRef.current?.();
      }
    }, PRINT_STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [stage, receipt]);

  // 直接进入展示阶段（如历史小票回放）时保证整票可见
  useEffect(() => {
    if (!receipt || stage === "PRINTING") return;
    setVisibleLineCount((current) =>
      Math.max(current, receipt.items.length)
    );
  }, [stage, receipt]);

  const isPrinting = stage === "PRINTING";
  const isTearable = stage === "READY_TO_TEAR";
  const isRevealed = stage === "REVEALED" || stage === "CINEMA_MODE";
  const showPaper = receipt !== null && stage !== "IDLE";

  return (
    <div className="flex w-full flex-col items-center">
      {/* 机舱 */}
      <motion.div
        animate={
          isPrinting
            ? { x: [0, -1, 1, 0], y: [0, 1, -1, 0] }
            : { x: 0, y: 0 }
        }
        transition={
          isPrinting
            ? { repeat: Infinity, duration: 0.18, ease: "linear" }
            : { duration: 0.2 }
        }
        className="neo-brutal-box w-full bg-acid p-4"
      >
        {/* 铭牌与状态灯 */}
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <span className="text-xs font-black tracking-[0.3em]">
            SOUL-PRINTER MK.II
          </span>
          <div className="flex items-center gap-1.5">
            <motion.span
              aria-hidden
              className="block h-3 w-3 rounded-full border border-black"
              style={{ backgroundColor: isPrinting ? "#FF2E2E" : "#17150F" }}
              animate={
                isPrinting
                  ? { opacity: [1, 0.3, 1], scale: [1, 1.25, 1] }
                  : { opacity: 1, scale: 1 }
              }
              transition={
                isPrinting
                  ? { repeat: Infinity, duration: 0.9 }
                  : { duration: 0.2 }
              }
            />
            <span className="text-[10px] font-bold">
              {STAGE_LABELS[stage]}
            </span>
          </div>
        </div>

        {/* 荧光小屏幕 */}
        <div className="mt-3 flex items-center border-2 border-black bg-black px-3 py-2">
          <p className="flex-1 font-mono text-[10px] tracking-widest text-acid">
            {SCREEN_TEXTS[stage]}
          </p>
          <motion.span
            aria-hidden
            className="ml-2 inline-block h-3 w-1.5 bg-acid"
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.7, repeatType: "mirror" }}
          />
        </div>

        {/* 出纸口 + 红色加热呼吸灯 */}
        <div className="relative mt-3">
          <div className="h-4 rounded-b-md border-x-2 border-b-2 border-black bg-black" />
          {isPrinting && (
            <motion.div
              aria-hidden
              className="absolute inset-x-8 -bottom-1 h-2 rounded-full"
              style={{ backgroundColor: "#FF5A1F" }}
              animate={{
                opacity: [0.95, 0.35, 0.95],
                boxShadow: [
                  "0 0 12px rgba(255,90,31,0.9)",
                  "0 0 4px rgba(255,90,31,0.4)",
                  "0 0 12px rgba(255,90,31,0.9)",
                ],
              }}
              transition={{ repeat: Infinity, duration: 0.9 }}
            />
          )}
        </div>
      </motion.div>

      {/* 撕票刀口：位于出纸口与小票连接处 */}
      {isTearable && (
        <div className="w-full px-1 py-3">
          <TearOffZone onTearSuccess={() => onTearSuccess?.()} />
        </div>
      )}

      {/* 小票本体：从出纸口垂下 */}
      {showPaper && receipt && (
        <div className="w-full">
          <ReceiptPaper
            receipt={receipt}
            isRevealed={isRevealed}
            visibleLineCount={isPrinting ? visibleLineCount : undefined}
            onBarcodeClick={onBarcodeClick}
            idForExport={idForExport}
          />
        </div>
      )}
    </div>
  );
}
