"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

import { soundEngine } from "@/lib/sound-engine";

interface TearOffZoneProps {
  onTearSuccess: () => void;
  disabled?: boolean;
}

/** 触发撕裂的拉动进度阈值（容器宽度的 55%） */
const TEAR_THRESHOLD = 0.55;
/** 每拉动 15% 播放一次摩擦音 */
const FRICTION_STEP = 0.15;

/**
 * 手势横向撕纸区：
 * Pointer Events 统一处理鼠标拖拽与移动端触摸（touch-action:none 防滚动干扰），
 * 拉动距离达到容器宽度 55% 即撕裂，未达标松手自动回弹；
 * 右侧常驻一键撕下按钮兜底，保证 100% 零卡点。
 */
export function TearOffZone({ onTearSuccess, disabled = false }: TearOffZoneProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef(0);
  const lastFrictionRef = useRef(0);
  const tornRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const finishTear = () => {
    if (tornRef.current) return;
    tornRef.current = true;
    soundEngine.playPaperTear();
    onTearSuccess();
    // 父组件通常会立刻切换状态卸载本组件；超时重置仅为复用场景兜底
    window.setTimeout(() => {
      tornRef.current = false;
      setProgress(0);
    }, 600);
  };

  const updateProgress = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const threshold = track.getBoundingClientRect().width * TEAR_THRESHOLD;
    const next = Math.min(
      Math.max((clientX - startXRef.current) / threshold, 0),
      1
    );
    if (next - lastFrictionRef.current > FRICTION_STEP && next < 1) {
      lastFrictionRef.current = next;
      soundEngine.playThermalPrintStep(Math.floor(next * 12));
    }
    setProgress(next);
    if (next >= 1) {
      setDragging(false);
      finishTear();
    }
  };

  const resetDrag = () => {
    setDragging(false);
    setProgress(0);
  };

  return (
    <div className="w-full">
      {/* 荧光虚线刀口：流动动画 */}
      <motion.div
        aria-hidden
        className="h-[3px] w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #B8FF29 0 10px, transparent 10px 18px)",
          boxShadow: "0 0 8px rgba(184, 255, 41, 0.8)",
        }}
        animate={{ backgroundPositionX: [0, 18] }}
        transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
      />

      <div className="mt-2 flex items-center gap-2.5">
        {/* 拖拽轨道 */}
        <div
          ref={trackRef}
          role="slider"
          aria-label="按住向右划动撕下小票"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="relative h-11 flex-1 cursor-grab select-none active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={(event) => {
            if (disabled || tornRef.current) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            startXRef.current = event.clientX;
            lastFrictionRef.current = 0;
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (disabled || !dragging) return;
            updateProgress(event.clientX);
          }}
          onPointerUp={() => {
            if (!dragging) return;
            resetDrag();
          }}
          onPointerCancel={resetDrag}
        >
          {/* 发光红色裂痕进度条 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 rounded-sm"
            style={{
              width: `${progress * 100}%`,
              background:
                "linear-gradient(90deg, rgba(255,46,46,0.22), rgba(255,46,46,0.85))",
              boxShadow:
                progress > 0 ? "0 0 10px rgba(255,46,46,0.75)" : "none",
              transition: dragging ? "none" : "width 0.25s ease-out",
            }}
          />
          {/* 拖拽圆柄 */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border-2 border-black bg-[#B8FF29] text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            style={{
              left: `calc(${progress * 100}% - ${progress * 36}px)`,
              transition: dragging ? "none" : "left 0.25s ease-out",
            }}
          >
            ✂️
          </div>
          {/* 动态引导文案 */}
          <p
            className={`pointer-events-none pl-12 pr-2 text-[10px] font-bold leading-tight transition-opacity ${
              progress > 0 ? "opacity-30" : "opacity-100"
            }`}
          >
            <motion.span
              aria-hidden
              className="mr-1 inline-block"
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
            >
              ➜
            </motion.span>
            按住圆柄向右划动撕下小票
            <span className="font-medium">(或点击一键撕票)</span>
          </p>
        </div>

        {/* 快捷一键撕下 */}
        <button
          type="button"
          onClick={() => {
            if (!disabled) finishTear();
          }}
          disabled={disabled}
          className="neo-brutal-box shrink-0 bg-[#FF2E2E] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          【✂️ 直接撕下】
        </button>
      </div>
    </div>
  );
}
