"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

import { CinemaModeModal } from "@/components/CinemaModeModal";
import { ShareExportModal } from "@/components/ShareExportModal";
import { ThermalPrinterMachine } from "@/components/ThermalPrinterMachine";
import { MODE_CONFIGS, getRandomNickname } from "@/lib/presets";
import { soundEngine } from "@/lib/sound-engine";
import type {
  CreateReceiptInput,
  MachineStage,
  RecentReceiptSummary,
  ReceiptData,
  ReceiptMode,
  SkinTheme,
  SymptomStat,
} from "@/types/receipt";

const HISTORY_KEY = "soul_receipt_history";
const HISTORY_LIMIT = 10;
const NOTE_LIMIT = 60;

const MODE_OFFSETS: Record<ReceiptMode, number> = {
  work: 0,
  love: 33.3,
  midnight: 66.6,
  roast: 99.9,
};

const FALLBACK_TICKER = [
  "今日精神汇率：1 次内耗 ≈ 0.5 根头发",
  "冰美式期货持续走高，请酌情续杯",
  "温馨提示：摸鱼不算工伤，但很保命",
  "本店汇率实时波动，emo 请趁早",
];

function pick<T>(list: readonly T[]): T[] {
  return [...list].sort(() => Math.random() - 0.5);
}

/** 顶部实时精神汇率跑马灯（内容重复两份实现无缝循环） */
function TickerBar({
  totalReceipts,
  recent,
}: {
  totalReceipts: number | null;
  recent: RecentReceiptSummary[];
}) {
  const headline = `🔥 全网已累计开出 ${totalReceipts ?? 12840} 张精神小票`;
  const reports = recent.map(
    (item) =>
      `${item.nickname} 刚被打出 · 等级 ${item.worthLevel} · 估值 ${item.totalWorth}`
  );
  const body =
    reports.length > 0
      ? reports.join(" ✦ ")
      : FALLBACK_TICKER.join(" ✦ ");
  const content = `${headline} ✦ ${body} ✦ `;
  return (
    <div className="overflow-hidden border-b-2 border-black bg-black py-1.5">
      <motion.div
        className="whitespace-nowrap font-mono text-[11px] text-acid"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
      >
        <span>{content}</span>
        <span>{content}</span>
      </motion.div>
    </div>
  );
}

/** 今日全网高发症状热力榜（Top 8 胶囊，热度条按占比缩放） */
function SymptomHeatmap({ stats }: { stats: SymptomStat[] }) {
  if (stats.length === 0) return null;
  const max = Math.max(...stats.map((stat) => stat.count));
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <section className="neo-brutal-box w-full bg-white p-4">
      <h3 className="text-xs font-black tracking-widest">
        📊 今日全网高发症状热力榜
      </h3>
      <ol className="mt-3 space-y-2.5">
        {stats.map((stat, index) => (
          <li key={stat.tag}>
            <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0">
                  {index < 3 ? medals[index] : `${index + 1}.`}
                </span>
                <span className="truncate">{stat.tag}</span>
              </span>
              <span className="shrink-0 tabular-nums text-black/60">
                {stat.count} 人中招
              </span>
            </div>
            <div
              className="mt-1 h-2 w-full border border-black/60 bg-black/5"
              aria-hidden
            >
              <div
                className="h-full bg-gradient-to-r from-acid to-acid-pink"
                style={{
                  width: `${Math.max((stat.count / max) * 100, 6)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[10px] leading-relaxed text-black/50">
        * 优先统计今日开出的精神小票，凌晨时段自动回退为全网最近 200 张
      </p>
    </section>
  );
}

export default function HomePage() {
  const [stage, setStage] = useState<MachineStage>("IDLE");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // 输入台状态
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState<ReceiptMode>("work");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 跑马灯 / 音效 / 历史 / 影院
  const [totalReceipts, setTotalReceipts] = useState<number | null>(null);
  const [recent, setRecent] = useState<RecentReceiptSummary[]>([]);
  const [topTags, setTopTags] = useState<SymptomStat[]>([]);
  const [muted, setMuted] = useState(false);
  const [history, setHistory] = useState<ReceiptData[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; key: number } | null>(
    null
  );

  useEffect(() => {
    setMuted(soundEngine.isMuted);
  }, []);

  useEffect(() => {
    fetch("/api/receipt")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            totalReceipts?: number;
            recent?: RecentReceiptSummary[];
            topTags?: SymptomStat[];
          } | null
        ) => {
          if (!data) return;
          setTotalReceipts(data.totalReceipts ?? null);
          setRecent(data.recent ?? []);
          setTopTags(data.topTags ?? []);
        }
      )
      .catch(() => undefined);
  }, []);

  // 本地历史小票抽屉：本机最近 10 张
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHistory(parsed as ReceiptData[]);
        }
      }
    } catch {
      // localStorage 不可用时静默跳过
    }
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ message, key: Date.now() });
    window.setTimeout(() => {
      setToast((current) =>
        current && current.message === message ? null : current
      );
    }, 2400);
  }, []);

  const toggleTag = (tag: string) => {
    soundEngine.playClick(1 + selectedTags.length * 0.08);
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }
      if (current.length >= 5) {
        showToast("最多选择 5 个情绪胶囊，贪多嚼不烂");
        return current;
      }
      return [...current, tag];
    });
  };

  const randomPick3 = () => {
    soundEngine.playClick(1.4);
    setSelectedTags(pick(MODE_CONFIGS[mode].tags).slice(0, 3));
  };

  const pushHistory = useCallback((item: ReceiptData) => {
    setHistory((prev) => {
      const next = [item, ...prev.filter((row) => row.id !== item.id)].slice(
        0,
        HISTORY_LIMIT
      );
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // 忽略持久化失败
      }
      return next;
    });
  }, []);

  const handleCheckout = useCallback(async () => {
    if (issuing) return;
    setError(null);
    setIssuing(true);
    try {
      const tags =
        selectedTags.length > 0
          ? selectedTags
          : pick(MODE_CONFIGS[mode].tags).slice(0, 3);
      const input: CreateReceiptInput = {
        nickname: nickname.trim() || getRandomNickname(),
        mode,
        selectedTags: tags,
        customNote: customNote.trim() || undefined,
        skinTheme: "acid-green",
      };
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as {
        receipt?: ReceiptData;
        totalReceipts?: number;
        notice?: string;
        error?: string;
      };
      if (!res.ok || !data.receipt) {
        setError(data.error ?? "开票失败，请重试");
        return;
      }
      if (data.notice) {
        showToast(data.notice);
      }
      setReceipt(data.receipt);
      setStage("PRINTING");
      if (typeof data.totalReceipts === "number") {
        setTotalReceipts(data.totalReceipts);
      }
      pushHistory(data.receipt);
    } catch {
      setError("网络开小差了，请重试");
    } finally {
      setIssuing(false);
    }
  }, [
    customNote,
    issuing,
    mode,
    nickname,
    pushHistory,
    selectedTags,
    showToast,
  ]);

  const handlePrintingDone = useCallback(() => setStage("READY_TO_TEAR"), []);
  const handleTearSuccess = useCallback(() => setStage("REVEALED"), []);

  const handleSkinChange = useCallback((theme: SkinTheme) => {
    setReceipt((current) => {
      if (!current) return current;
      const next = { ...current, skinTheme: theme };
      setHistory((prev) => {
        const updated = prev.map((row) =>
          row.id === next.id ? next : row
        );
        try {
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        } catch {
          // 忽略持久化失败
        }
        return updated;
      });
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setReceipt(null);
    setStage("IDLE");
    setCustomNote("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const replayFromHistory = useCallback((item: ReceiptData) => {
    setReceipt(item);
    setStage("REVEALED");
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const toggleMute = () => {
    setMuted(soundEngine.toggleMuted());
  };

  const modeConfig = MODE_CONFIGS[mode];
  const estimatedLoss = (
    66.6 +
    selectedTags.length * 88.8 +
    MODE_OFFSETS[mode]
  ).toFixed(2);

  return (
    <main className="min-h-screen bg-acid pb-28">
      <TickerBar totalReceipts={totalReceipts} recent={recent} />

      {/* 音效开关 */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "开启音效" : "关闭音效"}
        className="fixed right-2 top-1.5 z-[60] border-2 border-acid bg-black px-2 py-0.5 text-xs"
      >
        {muted ? "🔇" : "🔊"}
      </button>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5">
        <header className="text-center">
          <h1 className="text-2xl font-black leading-snug">
            🧾 精神状态小票机
          </h1>
          <p className="mt-1 text-xs font-medium text-black/70">
            人间凑数便利店 · 赛博收银台
          </p>
        </header>

        {/* IDLE 输入台 */}
        {stage === "IDLE" && (
          <section className="flex flex-col gap-4">
            {/* 拟物液晶屏 */}
            <div className="border-2 border-black bg-black p-3 font-mono text-[11px] leading-relaxed text-acid">
              <p>MODE ▸ {modeConfig.title}</p>
              <p>
                CAPSULES ▸ {selectedTags.length}/5 · 预估精神损耗 ¥
                {estimatedLoss}
              </p>
              <p>
                STATUS ▸ WAITING_INPUT
                <motion.span
                  aria-hidden
                  className="ml-0.5 inline-block"
                  animate={{ opacity: [1, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.7,
                    repeatType: "mirror",
                  }}
                >
                  _
                </motion.span>
              </p>
            </div>

            {/* 昵称 */}
            <div className="flex gap-2">
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={24}
                placeholder="输入你的赛博代号（可留空随机）"
                className="neo-brutal-box flex-1 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-black/35"
              />
              <button
                type="button"
                onClick={() => {
                  setNickname(getRandomNickname());
                  soundEngine.playClick(1.3);
                }}
                className="neo-brutal-box shrink-0 bg-white px-3 text-sm font-bold"
              >
                🎲 随机代号
              </button>
            </div>

            {/* 模式切换 */}
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(MODE_CONFIGS) as ReceiptMode[]).map(
                (modeId, index) => {
                  const active = mode === modeId;
                  return (
                    <button
                      key={modeId}
                      type="button"
                      onClick={() => {
                        setMode(modeId);
                        setSelectedTags([]);
                        soundEngine.playClick(1 + index * 0.12);
                      }}
                      className={`border-2 border-black px-1 py-2 text-[10px] font-bold leading-tight ${
                        active ? "shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" : "bg-white/60"
                      }`}
                      style={
                        active
                          ? { backgroundColor: MODE_CONFIGS[modeId].badgeColor }
                          : undefined
                      }
                    >
                      {MODE_CONFIGS[modeId].title}
                    </button>
                  );
                }
              )}
            </div>

            {/* 情绪胶囊池 */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-black">
                  选择情绪胶囊（{modeConfig.title}）
                </p>
                <button
                  type="button"
                  onClick={randomPick3}
                  className="text-[11px] font-bold underline underline-offset-2"
                >
                  🎲 帮我随机选3个
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {modeConfig.tags.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`border-2 border-black px-2 py-1 text-[11px] transition-all ${
                        selected
                          ? "bg-black text-acid shadow-[2px_2px_0px_0px_rgba(184,255,41,0.9)]"
                          : "bg-white active:translate-y-0.5"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 补充吐槽 */}
            <div>
              <input
                value={customNote}
                onChange={(event) => setCustomNote(event.target.value)}
                maxLength={NOTE_LIMIT}
                placeholder="一句话补充吐槽（可选）"
                className="neo-brutal-box w-full bg-white px-3 py-2.5 text-sm outline-none placeholder:text-black/35"
              />
              <p className="mt-1 text-right text-[10px] text-black/60">
                {customNote.length}/{NOTE_LIMIT}
              </p>
            </div>

            {/* 结账按钮 */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={issuing}
              className="neo-brutal-box bg-acid-amber py-4 text-lg font-black tracking-[0.2em] disabled:opacity-60"
            >
              {issuing ? "🧾 正在出票…" : "🧾 立即结账出票"}
            </button>
            {error && (
              <p className="text-center text-xs font-bold text-[#C81E1E]">
                {error}
              </p>
            )}
          </section>
        )}

        {/* 打印机 + 小票 */}
        {receipt && stage !== "IDLE" && (
          <ThermalPrinterMachine
            receipt={receipt}
            stage={stage}
            onPrintingDone={handlePrintingDone}
            onTearSuccess={handleTearSuccess}
            idForExport="receipt-paper"
          />
        )}

        {/* 揭晓后的操作面板 */}
        {stage === "REVEALED" && receipt && (
          <ShareExportModal
            receipt={receipt}
            exportTargetId="receipt-paper"
            onSkinChange={handleSkinChange}
            onOpenCinema={() => setCinemaOpen(true)}
            onReset={handleReset}
          />
        )}

        {/* 今日全网高发症状热力榜 */}
        <SymptomHeatmap stats={topTags} />
      </div>

      {/* 本地历史抽屉入口 */}
      <button
        type="button"
        onClick={() => setDrawerOpen((value) => !value)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 border-2 border-black bg-black px-5 py-2.5 text-xs font-black text-acid shadow-[4px_4px_0px_0px_rgba(0,0,0,0.35)]"
      >
        📖 我的小票夹 ({history.length})
      </button>

      {/* 历史抽屉 */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setDrawerOpen(false)}
          role="presentation"
        >
          <div
            className="absolute inset-x-0 bottom-0 max-h-[62vh] overflow-y-auto border-t-4 border-black bg-[#F7F4EA]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="本地历史小票"
          >
            <div className="sticky top-0 flex items-center justify-between border-b-2 border-black bg-[#F7F4EA] px-4 py-3">
              <p className="text-sm font-black">
                📖 我的小票夹（本机最近 {HISTORY_LIMIT} 张）
              </p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-sm font-bold"
              >
                ✕
              </button>
            </div>
            {history.length === 0 ? (
              <p className="p-6 text-center text-xs text-black/50">
                还没有本机小票，快去打一张！
              </p>
            ) : (
              <ul>
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => replayFromHistory(item)}
                      className="flex w-full items-center justify-between gap-3 border-b border-black/10 px-4 py-3 text-left hover:bg-black/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">
                          {MODE_CONFIGS[item.mode].title} · {item.worthLevel}
                        </p>
                        <p className="mt-0.5 text-[10px] text-black/50">
                          {item.serialNo}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-bold tabular-nums">
                        {item.totalWorth}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 全局 Toast */}
      {toast && (
        <motion.div
          key={toast.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 whitespace-nowrap border-2 border-black bg-black px-4 py-2 text-xs font-bold text-acid"
        >
          {toast.message}
        </motion.div>
      )}

      {/* 导演级录屏模式 */}
      {cinemaOpen && receipt && (
        <CinemaModeModal
          receipt={receipt}
          open
          onClose={() => setCinemaOpen(false)}
        />
      )}
    </main>
  );
}
