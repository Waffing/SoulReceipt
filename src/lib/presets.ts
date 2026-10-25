import type { ReceiptMode, SkinTheme } from "@/types/receipt";

/**
 * SoulReceipt 预设素材库
 * 随机昵称 / 四大模式情绪胶囊 / 小票皮肤
 */

/** 四大诊断模式 id（与 ReceiptMode 严格对齐，供 zod 校验复用） */
export const RECEIPT_MODES = ["work", "love", "midnight", "roast"] as const;

/** 四套皮肤 id（与 SkinTheme 严格对齐，供 zod 校验复用） */
export const RECEIPT_SKIN_THEMES = [
  "classic-white",
  "acid-green",
  "y2k-pink",
  "dark-glitch",
] as const;

/** 高浓度网感随机昵称池（昵称被安检拦截或用户懒得填时随机发放） */
export const RANDOM_NICKNAMES: string[] = [
  "卡皮巴拉驻工位代表",
  "一级退堂鼓表演艺术家",
  "冰美式静脉注射患者",
  "熬夜锦标赛卫冕冠军",
  "在逃脆皮大学生",
  "工位垂耳兔分兔",
  "赛博功德充值用户",
  "精神状态遥遥领先",
  "咖啡因驱动型人形自走炮",
  "装睡大师终身成就奖",
  "电子榨菜品鉴官",
  "摆烂奥运会种子选手",
  "已读乱回复读机",
  "深夜emo气氛组组长",
  "周一版本最大受害者",
  "发疯文学十级学者",
  "工资月光守护神",
  "精神离职形象大使",
  "带薪养生弄潮儿",
  "大饼品控质检员",
  "会议纪要搬运工",
  "领导画饼首席试吃官",
  "五分钟热度快乐星人",
  "恋爱脑重症监护室常驻嘉宾",
  "双标现场目击证人",
  "内耗型选手陪跑员",
  "情绪稳定假面舞王",
  "赛博算命指定锦鲤",
  "干饭界永远的神",
  "摸鱼哲学客座教授",
  "早八亡魂收容所所长",
  "脆皮打工人的嘴替",
  "精神状态待重评人士",
  "退网退一半的浅网用户",
  "原地螺旋升天预备役",
];

/** 双人合单小票的病友分区头前缀（ReceiptPaper 依此渲染为分隔条，引擎依此生成区块） */
export const SECTION_HEADER_PREFIXES = [
  "【甲方病友",
  "【乙方病友",
] as const;

/** 双人合单专属印章文字（引擎与前端展示保持单一来源） */
export const MERGE_STAMP_TEXT = "【鉴定为：卧龙凤雏联名认证】";

/** 模式配置（前端渲染入口卡片用） */
export interface ModeConfig {
  id: ReceiptMode;
  title: string;
  subtitle: string;
  badgeColor: string;
  /** lucide-react 图标名（前端通过图标映射表渲染） */
  iconName: string;
  /** 高共鸣情绪胶囊标签 */
  tags: string[];
}

export const MODE_CONFIGS: Record<ReceiptMode, ModeConfig> = {
  work: {
    id: "work",
    title: "职场摸鱼台",
    subtitle: "WORKPLACE SLACKING TERMINAL",
    badgeColor: "#B8FF29",
    iconName: "Briefcase",
    tags: [
      "☕ 血管里流淌着冰美式",
      "🎭 表面收到内心妈卖批",
      "📈 被大饼撑出胃下垂",
      "🔋 电量仅够支撑到下班",
      "🚽 带薪拉屎金牌得主",
      "📊 周报文学八级学者",
      "🐟 工位潜水世界冠军",
      "💬 已读乱回复读机",
      "🧊 工资冻龄物价起飞",
      "🐴 领导画的饼噎住了",
      "⏰ 早八亡魂每日打卡",
      "🧯 帮同事背锅专业户",
      "📵 下班工作群消音咒",
      "🏖️ 精神已在三亚度假",
    ],
  },
  love: {
    id: "love",
    title: "恋爱脑急诊室",
    subtitle: "LOVE-BRAIN EMERGENCY ROOM",
    badgeColor: "#FF48B0",
    iconName: "HeartCrack",
    tags: [
      "💘 对方正在输入一辈子",
      "📱 五分钟刷一次聊天框",
      "🌧️ 已读不回天塌了",
      "🍑 暧昧期卡在最后一公里",
      "🧠 恋爱脑占据大脑 99%",
      "🔮 塔罗大师也算不出的关系",
      "🎣 鱼塘编外饲养员",
      "💔 备胎保养手册活体版",
      "🚑 深夜网抑云急诊挂号",
      "🧊 冷战气象台台长",
      "🎁 节日焦虑重度患者",
      "💸 为爱氪金不计回报",
      "🐶 舔狗日记连载中",
      "🌈 上头三天下头仨月",
    ],
  },
  midnight: {
    id: "midnight",
    title: "午夜破防局",
    subtitle: "MIDNIGHT BREAKDOWN BUREAU",
    badgeColor: "#29E6FF",
    iconName: "MoonStar",
    tags: [
      "🌙 凌晨三点精神焕发",
      "📱 赛博功德夜间充值",
      "🛏️ 躺下瞬间灵感爆棚",
      "🎧 网抑云十级学者",
      "🍜 泡面配情绪套餐",
      "😭 眼泪只在被窝营业",
      "🔁 反刍白天说错的话",
      "🧊 被窝外是另一个世界",
      "⏰ 明早八点必然后悔",
      "🎮 一把之后又是一把",
      "🔥 焦虑刻进 DNA 里",
      "🌌 人生意义灵魂拷问",
      "🛒 深夜购物车清空疗法",
      "💤 白天困成狗晚上嗨",
    ],
  },
  roast: {
    id: "roast",
    title: "狂暴毒舌处刑台",
    subtitle: "RABID ROAST EXECUTION STAGE",
    badgeColor: "#FFD23F",
    iconName: "Flame",
    tags: [
      "🔥 火力全开见谁喷谁",
      "🗡️ 嘴替界的天降猛男",
      "💢 火气比火山先喷发",
      "🎯 精准打击不带脏字",
      "🧨 一点就着易燃易爆",
      "🍵 吃瓜吃到自己头上",
      "🪦 已拉黑名单堆成山",
      "😤 气到原地螺旋升天",
      "🦂 毒舌值拉满不认人",
      "📢 阴阳怪气十段持证",
      "🧊 冷嘲热讽冰火两重天",
      "🎪 人间清醒看戏模式",
      "💣 破防发射器随时待命",
      "🙃 无语子文学缔造者",
    ],
  },
};

/** 皮肤配置（渲染小票纸用；颜色与 globals.css 的 .theme-* 变量保持一致） */
export interface SkinThemeConfig {
  id: SkinTheme;
  previewName: string;
  bg: string;
  ink: string;
  border: string;
  stamp: string;
}

export const SKIN_THEMES: Record<SkinTheme, SkinThemeConfig> = {
  "classic-white": {
    id: "classic-white",
    previewName: "经典热敏白",
    bg: "#F7F4EA",
    ink: "#17150F",
    border: "#17150F",
    stamp: "#D6453D",
  },
  "acid-green": {
    id: "acid-green",
    previewName: "酸性荧光绿",
    bg: "#E9FFA6",
    ink: "#101A00",
    border: "#101A00",
    stamp: "#3F7A00",
  },
  "y2k-pink": {
    id: "y2k-pink",
    previewName: "Y2K 千禧粉",
    bg: "#FFE3F4",
    ink: "#2B0716",
    border: "#2B0716",
    stamp: "#FF2E9A",
  },
  "dark-glitch": {
    id: "dark-glitch",
    previewName: "暗夜故障风",
    bg: "#101014",
    ink: "#D6FF3D",
    border: "#D6FF3D",
    stamp: "#FF5A1F",
  },
};

/** 从昵称池随机取一个（可排除当前昵称，避免原地重复） */
export function getRandomNickname(exclude?: string): string {
  const pool = RANDOM_NICKNAMES.filter((name) => name !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
