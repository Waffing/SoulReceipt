/**
 * SoulReceipt 核心类型定义
 * 小票数据结构 + 前端状态机
 */

/** 诊断模式：打工 / 恋爱 / 深夜 / 纯吐槽 */
export type ReceiptMode = "work" | "love" | "midnight" | "roast";

/** 小票皮肤主题 */
export type SkinTheme =
  | "classic-white"
  | "acid-green"
  | "y2k-pink"
  | "dark-glitch";

/** 精神状态估值等级 */
export type WorthLevel = "SSR" | "SR" | "R" | "N" | "TRASH";

/** 小票上的一条「消费明细」 */
export interface ReceiptItem {
  name: string;
  qty: string;
  unitPrice: string;
  total: string;
  remark: string;
}

/**
 * 前端使用的完整小票对象：
 * 数据库 Receipt 行中的 selectedTags / itemsJson 已在此层解析为结构化数组，
 * createdAt 为 ISO 字符串（来自 API JSON）。
 */
export interface ReceiptData {
  id: string;
  serialNo: string;
  nickname: string;
  mode: ReceiptMode;
  selectedTags: string[];
  customNote: string | null;
  items: ReceiptItem[];
  subtotal: number;
  mentalTaxRate: string;
  totalWorth: string;
  worthLevel: WorthLevel;
  roastComment: string;
  stampText: string;
  prescription: string;
  barcodeCode: string;
  barcodeSecret: string;
  skinTheme: SkinTheme;
  sourceEngine: string;
  likesCount: number;
  createdAt: string;
}

/** 用户在小票机上提交的表单输入（账单明细等由打印引擎生成） */
export interface CreateReceiptInput {
  nickname: string;
  mode: ReceiptMode;
  selectedTags: string[];
  customNote?: string;
  skinTheme?: SkinTheme;
}

/** 小票机状态机：待机 → 打印中 → 待撕票 → 已揭晓 → 影院模式 */
export type MachineStage =
  | "IDLE"
  | "PRINTING"
  | "READY_TO_TEAR"
  | "REVEALED"
  | "CINEMA_MODE";

/**
 * 算账引擎产出的完整小票载荷（入库前的中间结构）：
 * items / selectedTags 仍为数组，入库时序列化为 itemsJson / selectedTags 字符串。
 */
export interface GeneratedReceiptPayload {
  serialNo: string;
  nickname: string;
  mode: ReceiptMode;
  selectedTags: string[];
  customNote: string | null;
  items: ReceiptItem[];
  subtotal: number;
  mentalTaxRate: string;
  totalWorth: string;
  worthLevel: WorthLevel;
  roastComment: string;
  stampText: string;
  prescription: string;
  barcodeCode: string;
  barcodeSecret: string;
  skinTheme: SkinTheme;
  sourceEngine: string;
}

/** 首页跑马灯的脱敏小票摘要（不含明细与吐槽等隐私内容） */
export interface RecentReceiptSummary {
  id: string;
  serialNo: string;
  nickname: string;
  mode: ReceiptMode;
  worthLevel: WorthLevel;
  totalWorth: string;
  skinTheme: SkinTheme;
  likesCount: number;
  createdAt: string;
}

/** GET /api/receipt 返回的跑马灯数据 */
export interface ReceiptFeedData {
  totalReceipts: number;
  recent: RecentReceiptSummary[];
}

/** POST /api/receipt 返回的开票结果 */
export interface ReceiptCreatedData {
  receipt: ReceiptData;
  totalReceipts: number;
  /** 触发安检兜底时的人性化提示（正常开票时缺省） */
  notice?: string;
}

/** 热力榜单项：某条情绪胶囊在统计窗口内被勾选的次数 */
export interface SymptomStat {
  tag: string;
  count: number;
}

/** 双人合单：乙方（好友）的输入 */
export interface MergeParticipantInput {
  nickname: string;
  selectedTags: string[];
}
