/**
 * SoulReceipt · 赛博收银机拟真声效合成器
 *
 * 全部音效由 Web Audio API 实时合成：零外部音频文件、零加载延迟、零 404 风险。
 * - SSR（typeof window === "undefined"）环境下所有方法安全静默跳过；
 * - AudioContext 惰性初始化（兼容 webkitAudioContext），suspended 时自动 resume；
 * - 静音状态持久化于 localStorage 的 soul_receipt_muted 键；
 * - 合成过程任何异常都被吞掉，绝不打断页面交互。
 */

const MUTED_STORAGE_KEY = "soul_receipt_muted";

/** 读取浏览器 AudioContext 构造器（兼容旧版 Safari 的 webkitAudioContext） */
function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  // AudioContext 在 lib.dom 中是全局 var 而非 Window 接口属性，故经 globalThis 取
  const g = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  /** 通用白噪音缓存（热敏滋滋声 / 印章瞬态共用） */
  private noiseBuffer: AudioBuffer | null = null;
  /** 撕纸专用白噪音缓存（带锯齿顿挫抖动） */
  private tearBuffer: AudioBuffer | null = null;
  private _isMuted = false;

  constructor() {
    // 单例在模块加载时创建，SSR 下不得触碰任何浏览器 API
    if (typeof window !== "undefined") {
      try {
        this._isMuted =
          window.localStorage.getItem(MUTED_STORAGE_KEY) === "true";
      } catch {
        // 隐私模式等 localStorage 不可用的场景，默认保持有声
      }
    }
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  set isMuted(value: boolean) {
    this._isMuted = value;
    if (typeof window === "undefined") return;
    try {
      if (value) {
        window.localStorage.setItem(MUTED_STORAGE_KEY, "true");
      } else {
        window.localStorage.removeItem(MUTED_STORAGE_KEY);
      }
    } catch {
      // 持久化失败不影响本次会话的静音状态
    }
  }

  /** 切换静音状态，返回切换后的最新状态 */
  toggleMuted(): boolean {
    this.isMuted = !this._isMuted;
    return this._isMuted;
  }

  /* ==================== 六大音效 ==================== */

  /**
   * 情绪胶囊点选咔哒声：triangle 波 600Hz → 180Hz 快速滑落（45ms），
   * 模拟机械收银按键的下压触感。pitch 可整体调高/调低音高。
   */
  playClick(pitch = 1): void {
    const normalized = Number.isFinite(pitch) && pitch > 0 ? pitch : 1;
    this.play((ctx) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(600 * normalized, now);
      osc.frequency.exponentialRampToValueAtTime(
        180 * normalized,
        now + 0.045
      );
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    });
  }

  /**
   * 结账启动收银铃声「叮——」：sine 1200Hz 基音 + 2400Hz 泛音叠加，
   * 指数级音量衰减 0.6 秒，还原便利店收银机开箱的清脆铃声。
   */
  playCashRegisterDing(): void {
    this.play((ctx) => {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.32, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      master.connect(ctx.destination);
      [1200, 2400].forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, now);
        gain.gain.setValueAtTime(index === 0 ? 1 : 0.4, now);
        osc.connect(gain).connect(master);
        osc.start(now);
        osc.stop(now + 0.62);
      });
    });
  }

  /**
   * 热敏打印头步进声（核心 ASMR）：
   * 60ms bandpass 白噪音（中心 2800Hz，热敏纸加热摩擦滋滋声）
   * + 110Hz 方波短脉冲（步进电机走纸齿轮声）。
   * lineIndex 递增时频率微调：每 4 行一个周期的起伏 + 缓慢整体爬升，吐纸自带节奏感。
   */
  playThermalPrintStep(lineIndex = 0): void {
    this.play((ctx) => {
      const now = ctx.currentTime;
      const wobble =
        1 + (lineIndex % 4) * 0.06 + Math.min(lineIndex * 0.004, 0.25);

      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      noise.loop = true;
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 2800 * wobble;
      bandpass.Q.value = 1.2;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      noise.connect(bandpass).connect(noiseGain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.07);

      const stepper = ctx.createOscillator();
      const stepperGain = ctx.createGain();
      stepper.type = "square";
      stepper.frequency.setValueAtTime(110 * wobble, now);
      stepperGain.gain.setValueAtTime(0.055, now);
      stepperGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      stepper.connect(stepperGain).connect(ctx.destination);
      stepper.start(now);
      stepper.stop(now + 0.06);
    });
  }

  /**
   * 手势横向撕纸「嘶啦——」声：
   * 0.35 秒白噪音 Buffer 经 bandpass 滤波，中心频率 800Hz 线性扫频至 3500Hz，
   * 音量包络先快升（50ms 冲到峰值）后缓降，还原锯齿刀口撕裂热敏纸的顿挫听感。
   */
  playPaperTear(): void {
    this.play((ctx) => {
      const now = ctx.currentTime;
      const duration = 0.35;
      const noise = ctx.createBufferSource();
      noise.buffer = this.getTearBuffer(ctx);
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.setValueAtTime(800, now);
      bandpass.frequency.linearRampToValueAtTime(3500, now + duration);
      bandpass.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      noise.connect(bandpass).connect(gain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + duration + 0.02);
    });
  }

  /**
   * 红色确诊印章重锤「砰！」声：
   * sine 从 150Hz 极速下潜至 35Hz（0.25s，物理震感）
   * + 80ms 低通白噪音瞬态冲击（印泥拍击质感）。
   */
  playHeavyStamp(): void {
    this.play((ctx) => {
      const now = ctx.currentTime;

      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = "sine";
      thump.frequency.setValueAtTime(150, now);
      thump.frequency.exponentialRampToValueAtTime(35, now + 0.25);
      thumpGain.gain.setValueAtTime(0.0001, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.9, now + 0.012);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      thump.connect(thumpGain).connect(ctx.destination);
      thump.start(now);
      thump.stop(now + 0.27);

      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 900;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.5, now + 0.008);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      noise.connect(lowpass).connect(noiseGain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.09);
    });
  }

  /**
   * 超市激光扫码枪「滴！」声：2650Hz 方波 + 正弦混合（方波提穿透力、正弦压毛刺），
   * 120ms 短促利落，点击小票底部条形码时触发。
   */
  playBarcodeBeep(): void {
    this.play((ctx) => {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.22, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      master.connect(ctx.destination);

      const square = ctx.createOscillator();
      const squareGain = ctx.createGain();
      square.type = "square";
      square.frequency.setValueAtTime(2650, now);
      squareGain.gain.value = 0.35;
      square.connect(squareGain).connect(master);

      const sine = ctx.createOscillator();
      const sineGain = ctx.createGain();
      sine.type = "sine";
      sine.frequency.setValueAtTime(2650, now);
      sineGain.gain.value = 0.65;
      sine.connect(sineGain).connect(master);

      square.start(now);
      square.stop(now + 0.13);
      sine.start(now);
      sine.stop(now + 0.13);
    });
  }

  /* ==================== 内部基建 ==================== */

  /**
   * 所有音效的统一入口：
   * 静音直接返回 → SSR 静默 → 惰性初始化 AudioContext →
   * suspended 时自动 resume → 合成异常静默吞掉。
   */
  private play(synthesize: (ctx: AudioContext) => void): void {
    if (this._isMuted) return;
    if (typeof window === "undefined") return;

    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    if (!this.ctx) {
      this.ctx = new Ctor();
    }
    const ctx = this.ctx;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }

    try {
      synthesize(ctx);
    } catch {
      // 个别浏览器实现差异导致的合成异常，静默跳过，绝不打断交互
    }
  }

  /** 通用白噪音（1 秒循环，按 sampleRate 缓存一次） */
  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (
      this.noiseBuffer &&
      this.noiseBuffer.sampleRate === ctx.sampleRate
    ) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 1);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  /** 撕纸专用白噪音（0.35 秒，样本叠随机顿挫抖动，模拟锯齿刀口） */
  private getTearBuffer(ctx: AudioContext): AudioBuffer {
    if (this.tearBuffer && this.tearBuffer.sampleRate === ctx.sampleRate) {
      return this.tearBuffer;
    }
    const duration = 0.35;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const jitter = 0.7 + Math.random() * 0.3;
      data[i] = (Math.random() * 2 - 1) * jitter;
    }
    this.tearBuffer = buffer;
    return buffer;
  }
}

/** 全局唯一实例：客户端组件直接 import 使用 */
export const soundEngine = new SoundEngine();
