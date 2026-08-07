import { withTimeout } from "../utils/retry";
import { CONFIG } from "../config";

export interface JsonApiRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
}

// أداة مساعدة عامة (اختيارية) — أي Connector يقدر يستخدمها من جواه بدل ما
// يكتب منطق fetch من الصفر، مش إجباري. مسؤولية تحويل الشكل (mapItem) بقت
// مسؤولية الـConnector نفسه دلوقتي، مش جزء من الأداة دي.
export async function fetchJson(
  id: string,
  url: string,
  requestOptions?: JsonApiRequestOptions
): Promise<unknown> {
  const method = requestOptions?.method || "GET";
  const init: RequestInit = { method };
  if (method === "POST" || requestOptions?.body) {
    init.headers = { "Content-Type": "application/json", ...(requestOptions?.headers || {}) };
    init.body = JSON.stringify(requestOptions?.body ?? {});
  } else if (requestOptions?.headers) {
    init.headers = requestOptions.headers;
  }
  const res = await withTimeout(fetch(url, init), CONFIG.FETCH_TIMEOUT_MS, id);
  if (!res.ok) {
    throw new Error(`JSON API fetch فشل (${id}): HTTP ${res.status}`);
  }
  return res.json();
}

// استخراج مصفوفة من رد JSON بمسار منقّط (زي "data.oppHits").
export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
