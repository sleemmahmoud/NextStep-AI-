import { CONFIG } from "../config";
import type { Logger } from "./logger";

// بيحاول ينفّذ fn، ولو فشلت، بيعيد المحاولة بعد مهلة متزايدة (exponential
// backoff). لو كل المحاولات فشلت، بيرمي آخر خطأ عادي — المسؤول عن استدعاء
// الدالة دي (run.ts) هو اللي بيقرر يكمل للمصدر اللي بعده بدل ما يوقف الكل.
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { label: string; logger: Logger; maxRetries?: number }
): Promise<T> {
  const maxRetries = opts.maxRetries ?? CONFIG.MAX_RETRIES_PER_SOURCE;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === maxRetries;
      opts.logger.warn(`[retry] ${opts.label} فشلت (محاولة ${attempt + 1}/${maxRetries + 1})`, {
        error: err instanceof Error ? err.message : String(err),
        willRetry: !isLast,
      });
      if (!isLast) {
        const delay = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// مهلة زمنية لأي fetch — لو مصدر علّق (Hanging) من غير ما يرد ولا يفشل،
// بنجبره يتلغي بدل ما يوقف باقي المصادر معاه.
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}: انتهت المهلة بعد ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
