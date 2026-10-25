"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CinemaModeModal } from "@/components/CinemaModeModal";
import { ReceiptPaper } from "@/components/ReceiptPaper";
import { MODE_CONFIGS, getRandomNickname } from "@/lib/presets";
import type { ReceiptData, ReceiptMode } from "@/types/receipt";

type LoadStatus = "loading" | "ready" | "missing" | "error";

function likedStorageKey(id: string): string {
  return `soul_receipt_liked_${id}`;
}

/** 独立分享围观页：/r/[id] */
export default function SharedReceiptPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [cinemaOpen, setCinemaOpen] = useState(false);

  // 合单抽屉状态
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeNickname, setMergeNickname] = useState("");
  const [mergeTags, setMergeTags] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/receipt/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          return { kind: "missing" as const };
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as { receipt: ReceiptData };
        return { kind: "ready" as const, receipt: data.receipt };
      })
      .then((result) => {
        if (cancelled) return;
        if (result.kind === "missing") {
          setStatus("missing");
          return;
        }
        setReceipt(result.receipt);
        setLikesCount(result.receipt.likesCount);
        try {
          setLiked(
            window.localStorage.getItem(likedStorageKey(id)) === "true"
          );
        } catch {
          // localStorage 不可用时允许重复点赞
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleLike = useCallback(() => {
    if (liked) return;
    setLiked(true);
    setLikesCount((count) => count + 1);
    try {
      window.localStorage.setItem(likedStorageKey(id), "true");
    } catch {
      // 忽略持久化失败
    }
    fetch(`/api/receipt/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "like" }),
    }).catch(() => undefined);
  }, [id, liked]);

  const toggleMergeTag = (tag: string) => {
    setMergeTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }
      if (current.length >= 3) {
        setMergeError("最多勾选 3 个情绪胶囊，冤种也要节制");
        return current;
      }
      setMergeError(null);
      return [...current, tag];
    });
  };

  const handleMerge = useCallback(async () => {
    if (merging || !receipt) return;
    if (mergeTags.length < 2) {
      setMergeError("至少勾选 2 个情绪胶囊才能和 TA 产生共鸣");
      return;
    }
    setMergeError(null);
    setMerging(true);
    try {
      const res = await fetch(`/api/receipt/${receipt.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: mergeNickname.trim() || getRandomNickname(),
          selectedTags: mergeTags,
        }),
      });
      const data = (await res.json()) as {
        receipt?: ReceiptData;
        error?: string;
      };
      if (!res.ok || !data.receipt) {
        setMergeError(data.error ?? "合单失败，请重试");
        return;
      }
      router.push(`/r/${data.receipt.id}`);
    } catch {
      setMergeError("网络开小差了，合单失败");
    } finally {
      setMerging(false);
    }
  }, [mergeNickname, mergeTags, merging, receipt, router]);

  const isMergedReceipt = receipt?.sourceEngine === "dual-merge";
  const modeTags = receipt ? (MODE_CONFIGS[receipt.mode as ReceiptMode]?.tags ?? []) : [];

  return (
    <main className="min-h-screen bg-acid px-4 pb-36 pt-8">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5">
        <header className="text-center">
          <h1 className="text-xl font-black leading-snug">
            🔍 精神鉴定报告 · 围观通道
          </h1>
          <p className="mt-1 text-xs font-medium text-black/60">
            好友的小票已盖章生效 · 点条形码有彩蛋
          </p>
        </header>

        {status === "loading" && (
          <p className="py-10 text-sm font-bold text-black/60">
            正在调取小票档案…
          </p>
        )}

        {status === "missing" && (
          <div className="neo-brutal-box w-full bg-white p-6 text-center">
            <p className="text-3xl">🕳️</p>
            <p className="mt-2 text-sm font-bold">
              小票不存在或已被撕走
            </p>
            <p className="mt-1 text-xs text-black/50">
              但你的精神状态同样值得被鉴定
            </p>
            <Link
              href="/"
              className="neo-brutal-box mt-4 inline-block bg-acid-amber px-4 py-2.5 text-xs font-black"
            >
              🧾 去打印我的精神小票
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="neo-brutal-box w-full bg-white p-6 text-center">
            <p className="text-3xl">⚠️</p>
            <p className="mt-2 text-sm font-bold">
              小票机线路故障，请稍后再来
            </p>
          </div>
        )}

        {status === "ready" && receipt && (
          <>
            <ReceiptPaper
              receipt={receipt}
              isRevealed
              idForExport="receipt-paper"
            />

            <button
              type="button"
              onClick={handleLike}
              disabled={liked}
              className="neo-brutal-box bg-acid-pink px-6 py-3 text-sm font-black disabled:opacity-75"
            >
              {liked
                ? `❤️ 已同病相怜 (${likesCount})`
                : `❤️ 同病相怜 (${likesCount})`}
            </button>

            {/* 冤种合单入口：联名小票不可再合 */}
            {!isMergedReceipt && (
              <button
                type="button"
                onClick={() => {
                  setMergeError(null);
                  setMergeTags([]);
                  setMergeOpen(true);
                }}
                className="neo-brutal-box w-full bg-gradient-to-r from-purple-600 to-amber-400 px-6 py-3.5 text-sm font-black tracking-wider text-white"
              >
                👯 和 {receipt.nickname} 合单结账
              </button>
            )}
          </>
        )}
      </div>

      {/* 冤种合单抽屉 */}
      {mergeOpen && receipt && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setMergeOpen(false)}
          role="presentation"
        >
          <div
            className="absolute inset-x-0 bottom-0 border-t-4 border-black bg-[#F7F4EA]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="冤种合单结账"
          >
            <div className="flex items-center justify-between border-b-2 border-black px-4 py-3">
              <p className="text-sm font-black">
                👯 和 {receipt.nickname} 合单结账
              </p>
              <button
                type="button"
                onClick={() => setMergeOpen(false)}
                className="text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[64vh] overflow-y-auto px-4 py-4">
              <p className="text-[11px] leading-relaxed text-black/60">
                你的症状将与 TA 合并成一张
                「卧龙凤雏联名认证」超长确诊单，内耗共振，工伤翻倍。
              </p>

              <div className="mt-3 flex gap-2">
                <input
                  value={mergeNickname}
                  onChange={(event) => setMergeNickname(event.target.value)}
                  maxLength={24}
                  placeholder="输入你的赛博代号（可留空随机）"
                  className="neo-brutal-box min-w-0 flex-1 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-black/35"
                />
                <button
                  type="button"
                  onClick={() => setMergeNickname(getRandomNickname())}
                  className="neo-brutal-box shrink-0 bg-white px-3 text-sm font-bold"
                >
                  🎲
                </button>
              </div>

              <p className="mt-4 text-xs font-black">
                勾选你的情绪胶囊（2~3 个）
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {modeTags.map((tag) => {
                  const selected = mergeTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleMergeTag(tag)}
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

              {mergeError && (
                <p className="mt-3 text-xs font-bold text-[#C81E1E]">
                  {mergeError}
                </p>
              )}

              <button
                type="button"
                onClick={handleMerge}
                disabled={merging}
                className="neo-brutal-box mt-4 w-full bg-gradient-to-r from-purple-600 to-amber-400 py-3.5 text-sm font-black tracking-wider text-white disabled:opacity-60"
              >
                {merging ? "🖨️ 合单打印中…" : "🧾 立即合单打印"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部悬浮双按钮 */}
      {status === "ready" && receipt && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-black bg-[#F7F4EA] p-3">
          <div className="mx-auto flex w-full max-w-md gap-2.5">
            <Link
              href="/"
              className="neo-brutal-box flex-1 bg-acid-amber py-3 text-center text-xs font-black"
            >
              🧾 不服！打印我的精神小票
            </Link>
            <button
              type="button"
              onClick={() => setCinemaOpen(true)}
              className="neo-brutal-box flex-1 bg-black py-3 text-xs font-black text-acid"
            >
              🎬 观看 TA 的吐纸回放
            </button>
          </div>
        </div>
      )}

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
