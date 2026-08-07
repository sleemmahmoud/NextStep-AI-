import { XMLParser } from "fast-xml-parser";
import { withTimeout } from "../utils/retry";
import { CONFIG } from "../config";

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

// RSS 2.0 عنصر <item> قياسي — بيدعم كمان بعض الحقول الشائعة زيادة.
export interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  category?: string | string[];
  "content:encoded"?: string;
  [key: string]: unknown; // بعض المصادر بتضيف حقول خاصة بيها (زي namespace مخصص)
}

// أداة مساعدة عامة (اختيارية) — بترجّع عناصر الـRSS الخام بس، من غير ما
// تفرض شكل تحويل معيّن (كل Connector بيحوّلها لـRawOpportunity بطريقته،
// لإن مصادر مختلفة بتحط معلومات مختلفة في حقول RSS القياسية).
export async function fetchRssItems(id: string, url: string): Promise<RssItem[]> {
  const res = await withTimeout(fetch(url), CONFIG.FETCH_TIMEOUT_MS, id);
  if (!res.ok) {
    throw new Error(`RSS fetch فشل (${id}): HTTP ${res.status}`);
  }
  const xml = await res.text();
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel;
  if (!channel) {
    throw new Error(`RSS مش بالشكل المتوقع (مفيش rss.channel) — ${id}`);
  }
  return Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
