/**
 * 内存滑动窗口限流
 * 单实例部署（Docker/VPS）下精确生效；Serverless 多实例下退化为软限流，
 * 生产可无缝替换为 Upstash Redis 等外部存储（本模块 API 已收敛为单一入口）。
 */

const DEFAULT_WINDOW_MS = 60_000;

interface BucketOptions {
  /** 同一限流策略共用一个 scope，不同接口之间互不挤占 */
  scope?: string;
  windowMs?: number;
  maxRequests: number;
}

const buckets = new Map<string, number[]>();

/** 从代理头解析真实客户端 IP */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

/** 命中限流返回 true（该次请求不计入桶，避免 429 惩罚延长等待） */
export function isRateLimited(ip: string, options: BucketOptions): boolean {
  const scope = options.scope ?? "default";
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const hits = (buckets.get(key) ?? []).filter((ts) => ts > windowStart);
  if (hits.length >= options.maxRequests) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);

  // 防 Map 无限膨胀：桶数超阈值时清理已滑出窗口的 key
  if (buckets.size > 5000) {
    for (const [existingKey, stamps] of buckets) {
      if (stamps.every((ts) => ts <= windowStart)) {
        buckets.delete(existingKey);
      }
    }
  }
  return false;
}
