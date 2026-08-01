import { XMLParser } from "fast-xml-parser";
import type { OpportunitySource, RawOpportunity } from "../types";
import { withTimeout } from "../retry";
import { CONFIG } from "../config";

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

// RSS 2.0 عنصر <item> قياسي — بيدعم كمان بعض الحقول الشائعة زيادة (زي
// dc:creator) من غير ما يعتمد عليها.
interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  category?: string | string[];
  "content:encoded"?: string;
}

export async function fetchRssSource(source: OpportunitySource): Promise<RawOpportunity[]> {
  const res = await withTimeout(fetch(source.url), CONFIG.FETCH_TIMEOUT_MS, source.id);
  if (!res.ok) {
    throw new Error(`RSS fetch فشل (${source.id}): HTTP ${res.status}`);
  }
  const xml = await res.text();
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel;
  if (!channel) {
    throw new Error(`RSS مش بالشكل المتوقع (مفيش rss.channel) — ${source.id}`);
  }

  const rawItems: RssItem[] = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];

  return rawItems
    .map((item): RawOpportunity | null => {
      const link = (item.link || "").trim();
      if (!link) return null;
      const description = stripHtml(item.description || item["content:encoded"] || "");
      const publishedAt = item.pubDate ? Date.parse(item.pubDate) : null;
      const categoryHint = Array.isArray(item.category) ? item.category.join(" ") : item.category || "";
      return {
        title: (item.title || "").trim(),
        description,
        organization: source.name, // RSS مالوش حقل "جهة" قياسي — بنستخدم اسم المصدر نفسه
        applyUrl: link,
        deadline: undefined, // مش متوفر عادة في RSS قياسي
        publishedAt: Number.isFinite(publishedAt) ? (publishedAt as number) : null,
        categoryHint,
        tags: [],
      };
    })
    .filter((x): x is RawOpportunity => x !== null);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
