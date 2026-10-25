"use client";

import { useEffect, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";

import { ReceiptPaper } from "@/components/ReceiptPaper";
import { soundEngine } from "@/lib/sound-engine";
import type { ReceiptData } from "@/types/receipt";

interface CinemaModeModalProps {
  receipt: ReceiptData;
  open: boolean;
  onClose: () => void;
}

type CinemaPhase = "countdown" | "printing" | "tearing" | "reveal" | "done";

const PRINT_STEP_MS = 500;

/**
 * 🎬 导演级自动录屏模式（Cinema Mode）
 * 8 秒无人干预运镜时间轴，专为抖音/小红书录屏传播打造：
 * 0.0~1.0s  赛博倒计时 3-2-1 + 「正在鉴定 @昵称 的精神状态...」
 * 1.0~4.5s  镜头放大 1.12 聚焦出纸口，密集热敏音效 + 小票高速吐出
 * 4.5~5.5s  霓虹激光切割线扫过，自动撕票，小票平滑展开回 scale 1.0
 * 5.5~8.0s  巨响印章砸落 + 屏幕震动 + 模糊散去 + 身价高光揭晓 + 引导语
 */
export function CinemaModeModal({ receipt, open, onClose }: CinemaModeModalProps) {
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<CinemaPhase>("countdown");
  const [countNum, setCountNum] = useState(3);
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const shakeControls = useAnimationControls();

  // 主时间轴：runKey 变化即整体重播
  useEffect(() => {
    if (!open) return;
    setPhase("countdown");
    setVisibleLineCount(0);
    const timers = [
      window.setTimeout(() => {
        setPhase("printing");
        soundEngine.playCashRegisterDing();
      }, 1050),
      window.setTimeout(() => {
        setPhase("tearing");
        soundEngine.playPaperTear();
      }, 4650),
      window.setTimeout(() => {
        setPhase("reveal");
        soundEngine.playHeavyStamp();
        void shakeControls.start({
          x: [0, -9, 9, -6, 6, -3, 0],
          y: [0, 5, -5, 3, -3, 0, 0],
          transition: { duration: 0.5 },
        });
      }, 5650),
      window.setTimeout(() => setPhase("done"), 8200),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [open, runKey, shakeControls]);

  // 倒计时数字 3 → 2 → 1
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountNum(3);
    const timer = window.setInterval(
      () => setCountNum((current) => (current > 1 ? current - 1 : current)),
      340
    );
    return () => window.clearInterval(timer);
  }, [phase, runKey]);

  // 高速密集吐纸
  useEffect(() => {
    if (phase !== "printing" || !receipt) return;
    let line = 0;
    const timer = window.setInterval(() => {
      line += 1;
      setVisibleLineCount(line);
      soundEngine.playThermalPrintStep(line * 2);
      if (line >= receipt.items.length) {
        window.clearInterval(timer);
      }
    }, PRINT_STEP_MS);
    return () => window.clearInterval(timer);
  }, [phase, receipt]);

  // 全屏期间锁定 body 滚动
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const isRevealed = phase === "reveal" || phase === "done";
  const zoomed = phase === "printing";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden"
      style={{
        backgroundColor: "#0A0A0F",
        backgroundImage:
          "radial-gradient(circle, rgba(184,255,41,0.14) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
      }}
    >
      {/* 顶部 REC 栏 */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs font-bold text-[#FF3B3B]">
          <motion.span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full bg-[#FF3B3B]"
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
          REC
        </span>
        <span className="text-[10px] text-white/60">
          建议开启手机屏幕录制
        </span>
        <button
          type="button"
          onClick={onClose}
          className="border border-white/30 px-2.5 py-1 text-[11px] text-white/70"
        >
          退出 ✕
        </button>
      </div>

      {/* 运镜舞台 */}
      <motion.div
        animate={shakeControls}
        className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto py-4"
      >
        {phase === "countdown" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0A0A0F]/85">
            <motion.p
              key={countNum}
              initial={{ scale: 2.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono text-8xl font-black text-acid"
            >
              {countNum}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-6 px-6 text-center text-sm font-bold text-white/90"
            >
              正在鉴定 @{receipt.nickname} 的精神状态...
            </motion.p>
          </div>
        )}

        {/* 出纸口 + 小票（运镜缩放聚焦） */}
        <motion.div
          animate={{ scale: zoomed ? 1.12 : 1 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          style={{ transformOrigin: "top center" }}
          className="w-[min(340px,88vw)]"
        >
          {phase !== "countdown" && (
            <>
              <div className="relative mx-auto h-3.5 w-[86%] rounded-b-md border-x-2 border-b-2 border-black bg-black">
                {phase === "printing" && (
                  <motion.div
                    aria-hidden
                    className="absolute inset-x-8 -bottom-0.5 h-1.5 rounded-full bg-[#FF5A1F]"
                    animate={{ opacity: [0.95, 0.4, 0.95] }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                  />
                )}
              </div>
              <div className="relative">
                {phase === "tearing" && (
                  <motion.div
                    aria-hidden
                    className="absolute inset-x-0 top-0 z-30 h-[3px]"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, #29E6FF 30%, #FF48B0 70%, transparent)",
                      boxShadow: "0 0 14px rgba(41, 230, 255, 0.9)",
                    }}
                    initial={{ x: "-105%", opacity: 0 }}
                    animate={{ x: ["-105%", "105%"], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 0.55, ease: "easeInOut" }}
                  />
                )}
                <motion.div
                  animate={
                    phase === "reveal"
                      ? { filter: ["brightness(2.2)", "brightness(1)"] }
                      : { filter: "brightness(1)" }
                  }
                  transition={{ duration: 0.55 }}
                >
                  <ReceiptPaper
                    receipt={receipt}
                    isRevealed={isRevealed}
                    visibleLineCount={
                      phase === "printing" ? visibleLineCount : undefined
                    }
                  />
                </motion.div>
              </div>
            </>
          )}
        </motion.div>

        {isRevealed && (
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6 px-6 text-center text-sm font-bold tracking-wide text-white"
          >
            搜索【精神状态小票机】测测你今天值几毛钱
          </motion.p>
        )}
      </motion.div>

      {/* 底部操作：运镜中隐藏，结束后浮现 */}
      <div className="flex min-h-[72px] items-center justify-center gap-3 p-5">
        {phase === "done" ? (
          <>
            <button
              type="button"
              onClick={() => setRunKey((key) => key + 1)}
              className="neo-brutal-box bg-acid px-4 py-2.5 text-xs font-black text-black"
            >
              🔄 重新播放运镜
            </button>
            <button
              type="button"
              onClick={onClose}
              className="neo-brutal-box bg-white px-4 py-2.5 text-xs font-black text-black"
            >
              退出录屏模式
            </button>
          </>
        ) : (
          <span className="text-[10px] tracking-[0.3em] text-white/40">
            CINEMA MODE · 8S AUTO DIRECTOR
          </span>
        )}
      </div>
    </motion.div>
  );
}
