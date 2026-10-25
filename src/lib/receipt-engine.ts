import { z } from "zod";

import {
  MERGE_STAMP_TEXT,
  MODE_CONFIGS,
  SECTION_HEADER_PREFIXES,
} from "@/lib/presets";
import { checkInputSafety } from "@/lib/safety";
import {
  formatMoney,
  generateBarcodeCode,
  generateBarcodeSecret,
  generateSerialNo,
  parseMoney,
} from "@/lib/utils";
import type {
  CreateReceiptInput,
  GeneratedReceiptPayload,
  MergeParticipantInput,
  ReceiptItem,
  ReceiptMode,
  SkinTheme,
  WorthLevel,
} from "@/types/receipt";

/**
 * AI + 本地规则双模算账引擎（Local Meme Receipt Composer）
 * - 配置 LLM_API_KEY 时走 OpenAI 兼容 Chat Completions，5.5s 超时熔断；
 * - 未配置 / 超时 / 返回不合规 / 输出未过安检时，无缝降级到本地模因合成引擎；
 * - 任何分支都保证产出幽默度拉满的完整小票载荷，绝不抛错崩溃。
 */

/* ==================== 随机工具 ==================== */

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle<T>(list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickMany<T>(list: readonly T[], count: number): T[] {
  return shuffle(list).slice(0, count);
}

/* ==================== 本地模因素材库 ==================== */

interface LocalModeKit {
  quantities: string[];
  positivePrices: number[];
  negativePrices: number[];
  /** 情绪胶囊转商品明细时的犀利备注池 */
  tagRemarks: string[];
  /** 兜底补位商品（凑满 4 条明细用） */
  fillerItems: Array<{ name: string; remark: string }>;
  /** 烤评 = 随机 opener + 随机 closer，两池组合出大量不重复金句 */
  roastOpeners: string[];
  roastClosers: string[];
  stamps: string[];
  prescriptions: string[];
  taxRates: string[];
}

const LOCAL_KITS: Record<ReceiptMode, LocalModeKit> = {
  work: {
    quantities: ["x1", "x2", "x3", "x3.5", "x6", "x8", "x99"],
    positivePrices: [3.5, 8.8, 12, 19.9, 28, 45, 66, 88],
    negativePrices: [-6.6, -13, -33, -52, -88, -131.4, -250],
    tagRemarks: [
      "含泪计价，概不还价",
      "本商品由资本亲手锻造",
      "售后热线永远忙线",
      "成分：95% 班味，5% 强撑",
      "已列入年度工伤名录",
      "保质期：到发工资为止",
      "检测报告：健康值持续走低",
      "建议搭配离职幻想服用",
      "库存告急，补货遥遥无期",
      "经鉴定：纯纯的精神损耗",
    ],
    fillerItems: [
      { name: "工位氧气续费包月卡", remark: "不带这口仙气早就崩了" },
      { name: "会议生命折旧费", remark: "灵魂已提前离场" },
      { name: "老板大饼试吃装", remark: "饼很大，就是咽不下去" },
      { name: "下班倒计时订阅服务", remark: "每分钟推送一次希望" },
      { name: "表情包战斗力维护费", remark: "工位社交硬通货" },
      { name: "精神离职体验券", remark: "人在工位，心已毕业" },
    ],
    roastOpeners: [
      "经检测，您的班味浓度已突破人类嗅觉安全阈值，工位与灵魂的粘连度高达百分之九十九，工资条与工作量常年呈反方向高速运动，",
      "诊断报告显示，您的精神账户长期赤字，白天的每一声『收到』都在透支夜里的电量，简历文件夹里的辞职信已经写到第九版，",
      "影像学检查发现，您的脊椎里长出了一整间会议室，脑内循环播放的周报文学比摩尔斯电码还难破解，摸鱼时间被压缩到以秒计算，",
      "病历显示，您每天靠冰美式强行超频神经中枢，把『再来一杯』当续命咒语，把周五下午四点当作全周的精神珠穆朗玛，",
    ],
    roastClosers: [
      "但请记住：公司离了谁都照样转，您的快乐缺席一天都是重大事故。",
      "建议把『关你屁事』和『关我屁事』设为年度座右铭，疗效显著。",
      "处方结论：先摸为敬，带薪修复，天塌下来有个高的顶着。",
      "本台鉴定：能笑着按下打卡机的你，已经是无冕的生活家。",
    ],
    stamps: [
      "已确诊：班味入骨",
      "已确诊：职场电量耗尽",
      "特批：准许带薪发呆",
      "已确诊：大饼不耐受",
    ],
    prescriptions: [
      "遵医嘱：每日带薪如厕两次，工位潜水三刻，工资到账前禁止打开招聘软件。",
      "用法用量：下班后立即静音工作群，周末禁止回复『在吗』，违者罚喝冰美式。",
      "处方：周一到周五摸鱼续命，周六周日彻底失联，重症患者加服一顿火锅。",
    ],
    taxRates: ["13%", "17%", "21%"],
  },
  love: {
    quantities: ["x1", "x2.5", "x3", "x5", "x13", "x14", "x520"],
    positivePrices: [5.2, 13.14, 33.44, 52, 66, 88, 131.4],
    negativePrices: [-5.2, -13.14, -52, -66.6, -88, -99, -520],
    tagRemarks: [
      "心动计价，秒表收费",
      "本商品含大量糖分与幻觉",
      "售后服务：对方在线时生效",
      "保质期：对方下一句晚安之前",
      "已开出发光的心碎证明",
      "风险提示：上头快，下头慢",
      "含温柔毒素，戒断反应剧烈",
      "经鉴定：纯度 99% 的自我感动",
      "建议搭配朋友劝退语音食用",
      "本单不可退换，眼泪不补",
    ],
    fillerItems: [
      { name: "自我人设紧急维护费", remark: "在喜欢的人面前体面很贵" },
      { name: "聊天框心率监测服务", remark: "对方一上线就报警" },
      { name: "心碎修补材料包", remark: "502 胶水都追不上裂缝" },
      { name: "暧昧期天气预报", remark: "常年多云，偶尔炸雷" },
      { name: "网抑云深夜会员", remark: "评论区的故事比歌好听" },
      { name: "闺蜜劝退热线包月", remark: "她说得对但你不想听" },
    ],
    roastOpeners: [
      "诊断结果：您的恋爱脑已占据大脑可用内存的百分之九十八，对方一条『在吗』就能让您的多巴胺工厂连夜三班倒，",
      "脑部扫描显示，您的理智区域已被暗恋对象全面接管，聊天框的『对方正在输入』比心电图更能左右您的心率，",
      "临床观察：您的情绪 KPI 已与一个高度不确定的人深度绑定，对方已读不回半小时，您就在心里把分手复合演完了三个回合，",
      "检查发现，您的手机相册里全是聊天截图，备忘录里全是删了又写的小作文，连塔罗牌都被您问得当场宕机，",
    ],
    roastClosers: [
      "处方结论：先爱自己，才是终身浪漫的开始，别把心跳全部外包。",
      "本台鉴定：你值得一个秒回你、也敢官宣的人，而非一个人的独角戏。",
      "医嘱：把追人的力气匀一半给搞钱，钱包鼓了，心动也会跟着硬气。",
      "结论：上头可以，但别过量，真正的浪漫从不让人卑微。",
    ],
    stamps: [
      "已确诊：恋爱脑晚期",
      "已确诊：心动过速",
      "特批：准许心动一次",
      "已确诊：上头过量",
    ],
    prescriptions: [
      "遵医嘱：消息发出去就放下手机，秒回是运气，不回是天意，睡前禁止考古聊天记录。",
      "用法用量：每天夸自己三句，把『他为什么不回我』替换成『我今天真好看』。",
      "处方：心动留给值得的人，眼泪留给好看的剧，其余时间专注搞钱搞学习。",
    ],
    taxRates: ["25%", "33%", "52%"],
  },
  midnight: {
    quantities: ["x1", "x2", "x3", "x3.5", "x7", "x12", "x24"],
    positivePrices: [2.5, 6.6, 9.9, 18, 33, 52, 88],
    negativePrices: [-8.8, -16.8, -33, -52, -88, -168, -300],
    tagRemarks: [
      "按秒计费，越夜越贵",
      "本商品仅在深夜限量发售",
      "白天绝无可能上架",
      "成分：80% 后悔，20% 上头",
      "附赠明日后悔药预定资格",
      "已在凌晨完成暴击结算",
      "保质期：睁眼即失效",
      "经鉴定：深夜限定精神损耗",
      "建议搭配白天狠狠补觉",
      "本单已由月亮签字盖章",
    ],
    fillerItems: [
      { name: "凌晨三点清醒税", remark: "全世界都睡了就你嗨" },
      { name: "明天后悔药预定金", remark: "已为您锁定明早的懊恼" },
      { name: "被窝外冷空气伤害险", remark: "伸手出被窝就算出险" },
      { name: "回忆循环放映厅", remark: "白天的社死反复上映" },
      { name: "赛博功德补充包", remark: "转发一条锦鲤抵扣一点焦虑" },
      { name: "枕头下的焦虑收纳袋", remark: "暂时寄存，天亮取回" },
    ],
    roastOpeners: [
      "诊断显示：您的昼夜节律已被彻底玩坏，凌晨三点灵感爆棚热泪盈眶，早晨八点起不来床并对天发誓今晚一定早睡，",
      "监测报告：您白天情绪稳定人狠话少，一到深夜就自动切换成哲学家兼诗人，把白天说错的每句话逐帧回放，",
      "检查发现：您的焦虑白天潜伏、下班出没，专挑熄灯后上分，购物车、外卖软件和网抑云构成您的深夜铁三角，",
      "病历显示：您在深夜重建过八百次人生规划，立志、破防、治愈三件套一气呵成，天一亮又把规划折叠塞回枕头底下，",
    ],
    roastClosers: [
      "处方结论：把眼泪调成静音，把早餐调成加蛋，先把觉睡够再说大事。",
      "本台鉴定：深夜的你值得被温柔理解，但明早的闹钟不会心软。",
      "医嘱：破防可以，别刷手机过夜，你缺的不是答案，是八小时睡眠。",
      "结论：月亮已经下班了，你也撤吧，明天的问题交给明天的你。",
    ],
    stamps: [
      "已确诊：夜间破防",
      "已确诊：熬夜成瘾",
      "特批：准许崩溃五分钟",
      "已确诊：晨昏颠倒",
    ],
    prescriptions: [
      "遵医嘱：凌晨一点后禁止回忆白天细节，禁止查看前任动态，禁止下单超过 50 元的商品。",
      "用法用量：把『我睡不着』换成『我赚到了清醒时间』，然后把手机扔出被窝半径一米。",
      "处方：今晚允许 emo 一小时，超时自动断电，明早奖励自己一顿豪华早餐。",
    ],
    taxRates: ["42%", "50%", "66%"],
  },
  roast: {
    quantities: ["x1", "x2", "x3", "x6", "x8", "x10", "x66"],
    positivePrices: [6.6, 13, 23, 45, 66.6, 88, 123],
    negativePrices: [-13, -45, -66.6, -88, -123, -233, -666],
    tagRemarks: [
      "火力计价，出口成章",
      "本商品出口 120 分贝",
      "杀伤力巨大，建议佩戴护耳",
      "售后条款：喷完不负责",
      "已通过阴阳怪气十段认证",
      "成本：一颗无所谓的心",
      "保质期：下一波火气来临前",
      "经鉴定：嘴替界硬通货",
      "建议对空气发泄，慎对真人",
      "本商品含梗量超标",
    ],
    fillerItems: [
      { name: "阴阳怪气手续费", remark: "句句不带脏字，字字见血" },
      { name: "火力全开燃气费", remark: "本月怒气值足额供应" },
      { name: "拉黑名单年费会员", remark: "黑名单比通讯录还热闹" },
      { name: "翻白眼耗能补偿", remark: "眼肌劳损，工人不易" },
      { name: "人间清醒围观票", remark: "前排吃瓜，附赠震惊表情" },
      { name: "破防发射器保养费", remark: "随喷随发，永不卡壳" },
    ],
    roastOpeners: [
      "检测结果：您的毒舌火力已突破本店服务器承载上限，阴阳怪气十段证书在墙上排成一排，被您处刑过的人至今没走出阴影，",
      "成分分析：您体内怒气原浆纯度高达百分之九十，遇事一点就着，喷人快准狠，句句不带脏字却刀刀暴击，",
      "观测报告：您的白眼翻动频率已超过风扇一档，拉黑名单长度是通讯录的三倍，人间清醒得像刚从冰柜里拿出来，",
      "鉴定结论：您的嘴是本店最高危特种设备，开口自带弹幕和音效，朋友挨骂还要点赞，对头听完直接破防住院，",
    ],
    roastClosers: [
      "处方结论：火气留三分给生活，七分用来护住自己在乎的人和事。",
      "本台鉴定：嘴硬心软才是您的出厂设置，请继续保持这份清醒。",
      "医嘱：喷归喷，饭要吃，觉要睡，别让烂人烂事偷走您的睡眠质量。",
      "结论：祝您刀刀暴击，句句上头，但记得对空气发泄，省得赔医药费。",
    ],
    stamps: [
      "已确诊：嘴部失控",
      "已确诊：毒舌成瘾",
      "特批：准许在线发疯",
      "已确诊：火力过剩",
    ],
    prescriptions: [
      "遵医嘱：每日发疯限时一小时，喷人前默数三秒，对家人朋友启用温柔模式。",
      "用法用量：把火气写进备忘录再删掉，比喷真人安全，比憋着健康。",
      "处方：本周至少对镜子夸自己一次，火力对准烂事，温柔留给值得的人。",
    ],
    taxRates: ["13%", "23%", "45%"],
  },
};

/* ==================== 本地模因合成引擎 ==================== */

/** 情绪胶囊 → 商品明细：胶囊本身就是商品名，数量与正负单价随机 */
function tagToItem(tag: string, kit: LocalModeKit, remark: string): ReceiptItem {
  const qty = pick(kit.quantities);
  const isPayout = Math.random() < 0.5;
  const unitPrice = isPayout ? pick(kit.negativePrices) : pick(kit.positivePrices);
  const qtyNum = Number(qty.replace(/^x/i, "")) || 1;
  return {
    name: tag,
    qty,
    unitPrice: formatMoney(unitPrice),
    total: formatMoney(unitPrice * qtyNum),
    remark,
  };
}

function fillerToItem(
  filler: { name: string; remark: string },
  kit: LocalModeKit
): ReceiptItem {
  const qty = pick(kit.quantities);
  const isPayout = Math.random() < 0.5;
  const unitPrice = isPayout ? pick(kit.negativePrices) : pick(kit.positivePrices);
  const qtyNum = Number(qty.replace(/^x/i, "")) || 1;
  return {
    name: filler.name,
    qty,
    unitPrice: formatMoney(unitPrice),
    total: formatMoney(unitPrice * qtyNum),
    remark: filler.remark,
  };
}

/**
 * 自定义吐槽 → 专属高额工伤明细（金额固定 ¥-666.00，维权标尺）。
 * 超过 12 字时截断并追加省略号。
 */
function buildCustomNoteItem(note: string): ReceiptItem {
  const display = note.length > 12 ? `${note.slice(0, 12)}...` : note;
  return {
    name: `突发状况：【${display}】`,
    qty: "x1",
    unitPrice: "¥-666.00",
    total: "¥-666.00",
    remark: "现场加急立案，按最高工伤标准赔付",
  };
}

/** 精神状态估值分级：净精神产值越高，等级越离谱 */
function resolveWorthLevel(subtotal: number): WorthLevel {
  if (subtotal >= 150) return "SSR";
  if (subtotal >= 60) return "SR";
  if (subtotal >= -50) return "R";
  if (subtotal >= -200) return "N";
  return "TRASH";
}

/**
 * 本地模因小票合成器：
 * 每个选中的情绪胶囊都会变成一条明细，customNote 包装成 ¥-666.00 的高额工伤单，
 * 不足 4 条时用模式专属兜底商品补齐，最终稳定输出 4~5 条明细。
 */
export function generateLocalReceipt(
  input: CreateReceiptInput
): GeneratedReceiptPayload {
  const kit = LOCAL_KITS[input.mode];
  const note = input.customNote?.trim() ?? "";
  const tags = input.selectedTags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 4);

  const tagRemarkDeck = pickMany(kit.tagRemarks, Math.max(tags.length, 1));
  const items: ReceiptItem[] = tags.map((tag, index) =>
    tagToItem(tag, kit, tagRemarkDeck[index] ?? "本商品经赛博物价局特批")
  );

  if (note.length > 0) {
    items.push(buildCustomNoteItem(note));
  }

  const fillerDeck = pickMany(kit.fillerItems, kit.fillerItems.length);
  while (items.length < 4 && fillerDeck.length > 0) {
    const filler = fillerDeck.shift();
    if (filler) {
      items.push(fillerToItem(filler, kit));
    }
  }

  const subtotal = items.reduce((sum, item) => sum + parseMoney(item.total), 0);
  const mentalTaxRate = pick(kit.taxRates);
  const taxMultiplier = 1 + (parseFloat(mentalTaxRate) || 0) / 100;

  return {
    serialNo: generateSerialNo(),
    nickname: input.nickname,
    mode: input.mode,
    selectedTags: input.selectedTags,
    customNote: note.length > 0 ? note : null,
    items,
    subtotal,
    mentalTaxRate,
    totalWorth: formatMoney(subtotal * taxMultiplier),
    worthLevel: resolveWorthLevel(subtotal),
    roastComment: pick(kit.roastOpeners) + pick(kit.roastClosers),
    stampText: pick(kit.stamps),
    prescription: pick(kit.prescriptions),
    barcodeCode: generateBarcodeCode(),
    barcodeSecret: generateBarcodeSecret(),
    skinTheme: input.skinTheme ?? "acid-green",
    sourceEngine: "local",
  };
}

/* ==================== 双人冤种合单引擎 ==================== */

const MERGE_ROASTS: string[] = [
  "经联合鉴定，两位的灵魂内耗频率已实现深度共振：一个人失眠是意外，两个人凌晨三点同时清醒就是命中注定。建议签署《内耗合伙协议》，把各自的焦虑打包成理财产品互相监督，本店看好你们的长期发展。",
  "本店隆重宣布：今天最贵的不是这张小票，是你们俩凑在一起还能把日子过出工伤组的气势。甲方班味缠身，乙方心事重重，拼在一起刚好凑成一套完整的人类精神图谱，建议裱起来传家。",
  "两位的痛苦今天撞了个满怀，本店按最高规格开具了联名确诊单。请记住：能一起发疯的人，比能一起吃苦的人更稀有。友谊的小船已原地升级为破冰船，祝早日互相放生，或白头到老。",
];

const MERGE_PRESCRIPTIONS: string[] = [
  "遵医嘱：每天互相汇报一次内耗进度，每周互放一天假；谁先破防谁请客，共振超 300% 直接原地结拜。",
  "用法用量：把对方代号设成手机壁纸，焦虑来袭时先嘲笑对方三秒，再互相鼓励三十分钟，一日三次。",
];

/** 为合单参与者把每个情绪胶囊转成一条明细（不补位、不加税） */
export function generateParticipantItems(
  tags: string[],
  mode: ReceiptMode
): ReceiptItem[] {
  const kit = LOCAL_KITS[mode];
  const trimmed = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  const remarkDeck = pickMany(kit.tagRemarks, Math.max(trimmed.length, 1));
  return trimmed.map((tag, index) =>
    tagToItem(tag, kit, remarkDeck[index] ?? "本商品经赛博物价局特批")
  );
}

function buildSectionHeader(title: string, remark: string): ReceiptItem {
  return {
    name: title,
    qty: "x1",
    unitPrice: "¥0.00",
    total: "¥0.00",
    remark,
  };
}

/**
 * 双人冤种合单小票合成器：
 * 甲方（发起人）症状清单在前，乙方（好友）在后，尾部叠加「双人灵魂内耗共振税」；
 * 共振率由双方胶囊重叠度与数量共同决定，盖章固定为卧龙凤雏联名认证。
 */
export function generateDualMergeReceipt(
  parent: {
    nickname: string;
    mode: ReceiptMode;
    selectedTags: string[];
    items: ReceiptItem[];
    skinTheme: SkinTheme;
  },
  friend: MergeParticipantInput
): GeneratedReceiptPayload {
  const friendItems = generateParticipantItems(
    friend.selectedTags,
    parent.mode
  );
  const sharedTags = friend.selectedTags.filter((tag) =>
    parent.selectedTags.includes(tag)
  );

  const resonanceRate = Math.min(
    990,
    150 +
      sharedTags.length * 100 +
      (parent.selectedTags.length + friend.selectedTags.length) * 15
  );
  const resonanceRemark = pick(
    sharedTags.length > 0
      ? [
          "建议原地结拜或互相放生",
          "同款症状已实锤，本店建议合并账号共享悲伤",
          "灵魂同频确认，赠送电子结婚证一张（不可退换）",
        ]
      : [
          "症状互补型冤种，建议互为情绪充电宝",
          "你们的内耗领域完全不重叠，联合起来可覆盖全地图",
          "一个失眠一个嘴碎，建议搭伙组建夜间互助小组",
        ]
  );
  const resonanceAmount = -(520 + sharedTags.length * 131.4);
  const resonanceItem: ReceiptItem = {
    name: "双人灵魂内耗共振税",
    qty: "x1",
    unitPrice: formatMoney(resonanceAmount),
    total: formatMoney(resonanceAmount),
    remark: `共振率 ${resonanceRate}% · ${resonanceRemark}`,
  };

  const items: ReceiptItem[] = [
    buildSectionHeader(
      `${SECTION_HEADER_PREFIXES[0]}：${parent.nickname}】`,
      "甲方症状清单，请自觉对号入座"
    ),
    ...parent.items,
    buildSectionHeader(
      `${SECTION_HEADER_PREFIXES[1]}：${friend.nickname}】`,
      "乙方症状清单，新鲜出炉现挂现烫"
    ),
    ...friendItems,
    resonanceItem,
  ];

  const subtotal = items.reduce((sum, item) => sum + parseMoney(item.total), 0);

  return {
    serialNo: generateSerialNo(),
    nickname: `${parent.nickname} 🤝 ${friend.nickname}`,
    mode: parent.mode,
    selectedTags: [...parent.selectedTags, ...friend.selectedTags],
    customNote: null,
    items,
    subtotal,
    mentalTaxRate: `${resonanceRate}%`,
    totalWorth: formatMoney(subtotal * (1 + resonanceRate / 100)),
    worthLevel: resolveWorthLevel(subtotal),
    roastComment: pick(MERGE_ROASTS),
    stampText: MERGE_STAMP_TEXT,
    prescription: pick(MERGE_PRESCRIPTIONS),
    barcodeCode: generateBarcodeCode(),
    barcodeSecret: "WOLONG-FENGCHU",
    skinTheme: parent.skinTheme,
    sourceEngine: "dual-merge",
  };
}

/* ==================== LLM 引擎 ==================== */

const llmReceiptSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        qty: z.string().trim().min(1).max(12),
        unitPrice: z.string().trim().min(1).max(20),
        total: z.string().trim().min(1).max(20),
        remark: z.string().trim().max(60),
      })
    )
    .min(4)
    .max(5),
  mentalTaxRate: z.string().trim().min(1).max(10),
  totalWorth: z.string().trim().min(1).max(24),
  worthLevel: z.enum(["SSR", "SR", "R", "N", "TRASH"]),
  roastComment: z.string().trim().min(20).max(180),
  stampText: z.string().trim().min(1).max(20),
  prescription: z.string().trim().min(1).max(90),
});

function buildLlmSystemPrompt(): string {
  return [
    "你是「赛博便利店（SoulReceipt）」的小票打印引擎，为顾客生成一张毒舌又治愈的精神状态确诊小票。",
    "要求：全程中文；梗浓度拉满、犀利但不刻薄；不出现敏感违规内容；不提任何真实品牌与真实人物。",
    "只输出一个 JSON 对象，禁止 markdown 代码块、禁止任何解释文字。字段结构：",
    '{"items":[{"name":"商品名，18字以内，可含emoji","qty":"如 x2 或 x3.5","unitPrice":"如 ¥8.80，可为负数表示工伤赔付，如 ¥-66.00","total":"单价乘以数量，格式 ¥xx.xx","remark":"一句犀利备注，20字以内"}],"mentalTaxRate":"如 13%","totalWorth":"如 ¥-888.00","worthLevel":"SSR、SR、R、N、TRASH 五选一","roastComment":"60~100字的毒舌又温暖的总结锐评","stampText":"印章文字，12字以内，如 已确诊：班味入骨","prescription":"一句搞笑处方，60字以内"}',
    "items 数组必须 4~5 条，其中至少一条要围绕顾客的自定义吐槽展开。",
  ].join("\n");
}

/**
 * LLM 算账：OpenAI 兼容 Chat Completions，5.5s 硬超时。
 * 返回值严格通过 zod 校验 + 安检复检，任何一环失败都会抛错并由外层降级。
 */
async function generateLlmReceipt(
  input: CreateReceiptInput,
  apiKey: string
): Promise<GeneratedReceiptPayload> {
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1")
    .trim()
    .replace(/\/+$/, "");
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const modeConfig = MODE_CONFIGS[input.mode];

  const userContent = JSON.stringify({
    nickname: input.nickname,
    mode: `${modeConfig.title}（${modeConfig.subtitle}）`,
    selectedTags: input.selectedTags,
    customNote: input.customNote ?? "",
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildLlmSystemPrompt() },
        { role: "user", content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(5500),
  });

  if (!response.ok) {
    throw new Error(`LLM 接口返回 HTTP ${response.status}`);
  }

  const raw: unknown = await response.json();
  const content = (
    raw as { choices?: Array<{ message?: { content?: unknown } }> }
  )?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("LLM 返回缺少文本内容");
  }

  // 防御：剥掉部分模型无视 json_object 指令时包裹的 markdown 代码块
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const parsed = llmReceiptSchema.parse(JSON.parse(cleaned));

  // LLM 输出也要过安检门，防止被注入带偏
  const joined = [
    parsed.roastComment,
    parsed.stampText,
    parsed.prescription,
    ...parsed.items.map((item) => `${item.name}${item.remark}`),
  ].join("\n");
  if (!checkInputSafety(joined).safe) {
    throw new Error("LLM 输出未通过内容安检");
  }

  const subtotal = parsed.items.reduce(
    (sum, item) => sum + parseMoney(item.total),
    0
  );

  return {
    serialNo: generateSerialNo(),
    nickname: input.nickname,
    mode: input.mode,
    selectedTags: input.selectedTags,
    customNote: input.customNote?.trim() || null,
    items: parsed.items,
    subtotal,
    mentalTaxRate: parsed.mentalTaxRate,
    totalWorth: parsed.totalWorth,
    worthLevel: parsed.worthLevel,
    roastComment: parsed.roastComment,
    stampText: parsed.stampText,
    prescription: parsed.prescription,
    barcodeCode: generateBarcodeCode(),
    barcodeSecret: generateBarcodeSecret(),
    skinTheme: input.skinTheme ?? "acid-green",
    sourceEngine: "llm",
  };
}

/* ==================== 对外入口 ==================== */

/**
 * 双模入口：有 Key 走 LLM，其余情况（含超时/报错/输出不合规）100% 静默降级本地引擎，
 * 保证本函数永远 resolve 出一张完整小票，绝不 reject。
 */
export async function generateReceiptPayload(
  input: CreateReceiptInput
): Promise<GeneratedReceiptPayload> {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (apiKey) {
    try {
      return await generateLlmReceipt(input, apiKey);
    } catch {
      // LLM 任何异常（超时/网络/格式/安检不过）都静默降级，接口绝不因此 500
    }
  }
  return generateLocalReceipt(input);
}
