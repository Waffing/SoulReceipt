import type {
  CreateReceiptInput,
  GeneratedReceiptPayload,
  ReceiptItem,
} from "@/types/receipt";
import { getRandomNickname } from "@/lib/presets";
import {
  formatMoney,
  generateBarcodeCode,
  generateBarcodeSecret,
  generateSerialNo,
} from "@/lib/utils";

/**
 * 内容安全防爆盾
 * 敏感词安检 + 《赛博便利店防爆保护单》兜底：
 * 检测到高危内容时不抛异常、不返回 500，而是平滑改开一张温暖的保护单。
 */

interface SensitiveRule {
  /** 内部分类标识 */
  category: string;
  /** 用户可见的拦截原因 */
  message: string;
  words: string[];
}

const SENSITIVE_RULES: SensitiveRule[] = [
  {
    category: "self_harm",
    message: "检测到疑似自残轻生相关内容",
    words: [
      "自杀",
      "轻生",
      "割腕",
      "跳楼",
      "跳桥",
      "上吊",
      "自残",
      "自虐",
      "不想活",
      "想死",
      "活不下去",
      "结束生命",
      "结束自己",
      "烧炭",
      "安眠药过量",
    ],
  },
  {
    category: "violence",
    message: "检测到疑似暴力威胁相关内容",
    words: [
      "杀人",
      "砍死",
      "砍人",
      "弄死",
      "打死你",
      "捅死",
      "爆炸袭击",
      "炸弹",
      "枪击",
      "血腥虐杀",
      "灭门",
      "同归于尽",
    ],
  },
  {
    category: "porn",
    message: "检测到疑似色情低俗相关内容",
    words: [
      "约炮",
      "援交",
      "裸聊",
      "卖淫",
      "嫖娼",
      "强奸",
      "性交易",
      "一夜情",
      "做爱",
      "招妓",
    ],
  },
  {
    category: "politics",
    message: "检测到疑似涉政敏感内容",
    words: [
      "颠覆国家",
      "分裂国家",
      "恐怖组织",
      "邪教组织",
      "反动宣传",
      "政治谣言",
    ],
  },
  {
    category: "illegal",
    message: "检测到疑似违法违规内容",
    words: [
      "赌博",
      "博彩",
      "下注",
      "冰毒",
      "大麻",
      "摇头丸",
      "贩毒",
      "洗钱",
      "枪支买卖",
    ],
  },
];

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
}

/**
 * 安检门：检测昵称/吐槽是否命中高危敏感词。
 * 先做归一化（转小写 + 去空白），可拦截「自 杀」这类空格绕过写法。
 */
export function checkInputSafety(text: string): SafetyCheckResult {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  if (!normalized) {
    return { safe: true };
  }
  for (const rule of SENSITIVE_RULES) {
    if (rule.words.some((word) => normalized.includes(word))) {
      return { safe: false, reason: rule.message };
    }
  }
  return { safe: true };
}

/** 组装一条小票明细（数量标签如 x3，总金额 = 数量 × 单价） */
function composeItem(
  name: string,
  qtyLabel: string,
  unitPrice: number,
  remark: string
): ReceiptItem {
  const qtyNum = Number(qtyLabel.replace(/^x/i, "")) || 1;
  return {
    name,
    qty: qtyLabel,
    unitPrice: formatMoney(unitPrice),
    total: formatMoney(unitPrice * qtyNum),
    remark,
  };
}

/**
 * 《赛博便利店防爆保护单》：
 * 不复述任何被拦截的原文，改发温暖道具，并附上心理援助热线。
 */
export function buildSafeFallbackReceipt(
  input: CreateReceiptInput
): GeneratedReceiptPayload {
  const nicknameIsSafe = checkInputSafety(input.nickname).safe;
  const nickname = nicknameIsSafe ? input.nickname : getRandomNickname();

  const items: ReceiptItem[] = [
    composeItem("防爆情绪灭火器", "x1", 45, "高压温柔，一键扑灭所有破防现场"),
    composeItem("赛博抱抱体验券", "x99", 0.01, "电子温暖扫码即领，今日全部赠完"),
    composeItem("加急心灵创可贴", "x3", 6.6, "防水防崩防破防，三天内无效退款"),
    composeItem("危险发言粉碎机", "x1", 0, "那句不合适的话已当场粉碎，永不留档"),
  ];

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.total.replace(/[¥￥\s,]/g, "")) || 0),
    0
  );

  return {
    serialNo: generateSerialNo(),
    nickname,
    mode: input.mode,
    selectedTags: input.selectedTags,
    customNote: null,
    items,
    subtotal,
    mentalTaxRate: "0%",
    totalWorth: formatMoney(subtotal),
    worthLevel: "SSR",
    roastComment:
      "安检门显示您的输入里混入了危险发言，保安已温柔拦下并替您保管。这张保护单不含税也不含泪，含九十九张赛博抱抱券与一台情绪灭火器。敢于把情绪说出来的人都值得 SSR，世界偶尔失礼，但本便利店永远亮灯。",
    stampText: "【特批：请世界温柔待你】",
    prescription:
      "遵医嘱：今晚热水澡安排，明早豆浆加蛋；难过时拨打 12356，全国心理援助热线 24 小时在线。",
    barcodeCode: generateBarcodeCode(),
    barcodeSecret: generateBarcodeSecret(),
    skinTheme: input.skinTheme ?? "acid-green",
    sourceEngine: "safe-fallback",
  };
}
