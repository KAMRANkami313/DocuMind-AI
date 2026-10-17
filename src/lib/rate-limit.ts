interface RateLimitEntry {
  timestamps: number[];
}

const memoryStore = new Map<string, RateLimitEntry>();

const CLEANUP_THRESHOLD = 10_000;
const ENTRY_TTL_MS = 60 * 60 * 1000;

export interface RateLimitOptions {
  points: number;
  duration: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

export async function rateLimit(
  identifier: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = `${options.keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowMs = options.duration * 1000;
  const windowStart = now - windowMs;

  const existing = memoryStore.get(key);
  const recent = existing
    ? existing.timestamps.filter((t) => t > windowStart)
    : [];

  if (recent.length >= options.points) {
    const oldest = recent[0] ?? now;
    const resetInSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      success: false,
      remaining: 0,
      reset: resetInSec,
      limit: options.points,
    };
  }

  recent.push(now);
  memoryStore.set(key, { timestamps: recent });

  if (memoryStore.size > CLEANUP_THRESHOLD) {
    pruneStore(now);
  }

  return {
    success: true,
    remaining: options.points - recent.length,
    reset: options.duration,
    limit: options.points,
  };
}

function pruneStore(now: number): void {
  const cutoff = now - ENTRY_TTL_MS;
  for (const [k, e] of memoryStore) {
    const fresh = e.timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) {
      memoryStore.delete(k);
    } else {
      memoryStore.set(k, { timestamps: fresh });
    }
  }
}

export function clearRateLimitStore(): void {
  memoryStore.clear();
}