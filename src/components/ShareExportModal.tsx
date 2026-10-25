"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

import { SKIN_THEMES } from "@/lib/presets";
import { soundEngine } from "@/lib/sound-engine";
import type { ReceiptData, SkinTheme } from "@/types/receipt";

interface ShareExportModalProps {
  receipt: ReceiptData;
  /** ReceiptPaper 根节点 id，html-to-image 导出锚点 */
  exportTargetId: string;
  /** 皮肤切换回调（父级更新 receipt 后小票实时变色） */
  onSkinChange: (theme: SkinTheme) => void;
  onOpenCinema: () => void;
  onReset: () => void;
}

/** 剪贴板写入：优先 Clipboard API，非安全上下文回退 execCommand */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 降级到 execCommand
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * REVEALED 状态下的操作面板：
 * 4 款皮肤实时换肤（PATCH 持久化）/ toPng 高清导出 / 裂变口令复制 / 录屏入口 / 再打一张
 */
export function ShareExportModal({
  receipt,
  exportTargetId,
  onSkinChange,
  onOpenCinema,
  onReset,
}: ShareExportModalProps) {
  const [toast, setToast] = useState<{ message: string; key: number } | null>(
    null
  );
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = (message: string) => {
    setToast({ message, key: Date.now() });
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  const handleSkinChange = (theme: SkinTheme) => {
    if (theme === receipt.skinTheme) return;
    soundEngine.playClick(0.8);
    onSkinChange(theme);
    // 皮肤偏好持久化：失败静默，不阻塞本地换肤体验
    fetch(`/api/receipt/${receipt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_skin", skinTheme: theme }),
    }).catch(() => undefined);
  };

  const handleExport = async () => {
    if (exporting) return;
    const node = document.getElementById(exportTargetId);
    if (!node) {
      showToast("找不到小票节点，请刷新后重试");
      return;
    }
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      setExportUrl(dataUrl);
      // 显式挂载后再触发下载，规避部分浏览器对游离 <a> 的静默忽略
      const link = document.createElement("a");
      link.download = `SoulReceipt-${receipt.serialNo}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast("高清小票已开始下载，长按下方图片也可保存");
    } catch {
      // 极端老旧浏览器上 toPng 可能因能力缺失抛错，引导用户走截图兜底
      showToast("浏览器太复古冲印失败啦，请直接截图保存这张小票");
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const shareUrl = `${siteUrl}/r/${receipt.id}`;
    const text = `🧾 刚在【人间凑数便利店】结清了今日精神账单！我的今日身价竟然是【${receipt.totalWorth}】，被确诊为「${receipt.stampText}」💀 速来打印你的精神工伤小票：${shareUrl}`;
    const ok = await copyText(text);
    showToast(
      ok ? "裂变口令已复制，快去粘贴发疯！" : "复制失败，请手动截屏分享"
    );
  };

  /** 冤种合单招募令：复制 /r/{id} 链接，好友点开即可拼一张联名确诊单 */
  const handleCopyMergeInvite = async () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const mergeUrl = `${siteUrl}/r/${receipt.id}`;
    const text = `🧾【冤种合单招募令】我在人间凑数便利店被确诊为「${receipt.stampText}」！点击 ${mergeUrl} 挑 2~3 个你的症状，和我拼一张卧龙凤雏联名确诊单💀`;
    const ok = await copyText(text);
    showToast(
      ok ? "合单招募令已复制，快抓一个冤种好友！" : "复制失败，请手动分享链接"
    );
  };

  return (
    <section className="neo-brutal-box w-full bg-white p-4">
      {/* 换肤器 */}
      <h4 className="text-xs font-black tracking-widest">🎨 小票纸实时换肤</h4>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {(Object.keys(SKIN_THEMES) as SkinTheme[]).map((themeId) => {
          const skin = SKIN_THEMES[themeId];
          const selected = receipt.skinTheme === themeId;
          return (
            <button
              key={themeId}
              type="button"
              onClick={() => handleSkinChange(themeId)}
              className={`flex flex-col items-center gap-1 border-2 border-black p-1.5 transition-all ${
                selected
                  ? "shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  : "opacity-70 active:translate-y-0.5"
              }`}
            >
              <span
                aria-hidden
                className="block h-7 w-full border border-black/40"
                style={{ backgroundColor: skin.bg }}
              />
              <span className="text-[9px] font-bold leading-none">
                {skin.previewName}
              </span>
            </button>
          );
        })}
      </div>

      {/* 导出与裂变 */}
      <h4 className="mt-4 text-xs font-black tracking-widest">
        📤 导出与裂变
      </h4>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="neo-brutal-box bg-acid px-2 py-2.5 text-xs font-black disabled:opacity-60"
        >
          {exporting ? "🖨️ 正在冲印高清小票..." : "📥 导出高清 PNG"}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="neo-brutal-box bg-acid-cyan px-2 py-2.5 text-xs font-black"
        >
          📋 复制裂变口令
        </button>
      </div>

      {exportUrl && (
        <div className="mt-3">
          <p className="text-[10px] font-bold text-black/60">
            高清预览（手机长按图片保存到相册）：
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={exportUrl}
            alt="SoulReceipt 高清小票预览"
            className="mt-1 w-full border-2 border-black"
          />
        </div>
      )}

      {/* 冤种合单裂变入口：联名小票不可再合单 */}
      {receipt.sourceEngine !== "dual-merge" && (
        <button
          type="button"
          onClick={handleCopyMergeInvite}
          className="neo-brutal-box mt-3 w-full bg-gradient-to-r from-purple-600 to-amber-400 px-2 py-3 text-xs font-black tracking-wider text-white"
        >
          👯 邀冤种好友合单拼票
        </button>
      )}

      {/* 录屏与再来 */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenCinema}
          className="neo-brutal-box bg-black px-2 py-2.5 text-xs font-black text-acid"
        >
          🎬 开启短视频录屏模式
        </button>
        <button
          type="button"
          onClick={onReset}
          className="neo-brutal-box bg-acid-amber px-2 py-2.5 text-xs font-black"
        >
          🔄 再打一张
        </button>
      </div>

      {/* Toast */}
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
    </section>
  );
}
