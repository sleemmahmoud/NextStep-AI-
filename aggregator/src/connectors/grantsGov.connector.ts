import type { IConnector } from "../models/connector.model";
import type { RawOpportunity } from "../models/opportunity.model";
import { fetchJson, getByPath } from "../fetchers/fetchJsonApi";

// API رسمي حكومي أمريكي (search2)، مُطلق رسميًا في 2025، مُعلن صراحة إنه بلا
// حاجة لتوثيق (no auth). اتأكدت من التوثيق الرسمي ببحث ويب مباشر
// (grants.gov/api/common/search2). ده نفس المصدر اللي شفناه شغّال فعليًا
// (Success ✅) في تشغيلة GitHub Actions حقيقية قبل كده.
export const grantsGovConnector: IConnector = {
  id: "grants-gov",
  name: "Grants.gov (US Federal Grants — Official REST API)",
  category: "scholarship",
  enabled: true,
  rateLimitPerDay: undefined, // مفيش حد معلن صريح لعدد الطلبات

  async fetch(): Promise<RawOpportunity[]> {
    const url = "https://api.grants.gov/v1/api/search2";
    const body = await fetchJson(this.id, url, {
      method: "POST",
      body: { oppStatuses: ["forecasted", "posted"], rows: 50 },
    });
    const list = getByPath(body, "data.oppHits");
    if (!Array.isArray(list)) {
      throw new Error(`رد الـAPI مش مصفوفة زي المتوقع — ${this.id}`);
    }

    const results: RawOpportunity[] = [];
    for (const raw of list) {
      const item = raw as Record<string, unknown>;
      const opportunityId = item.id ?? item.opportunityId;
      if (!opportunityId) continue;
      const title = String(item.title || item.opportunityTitle || "").trim();
      if (!title) continue;
      const agency = String(item.agencyName || item.agency || item.topAgencyName || "").trim();
      const categories = Array.isArray(item.categories) ? item.categories.join("، ") : "";
      // search2 بيرجّع بيانات ملخّصة بس (من غير "synopsis" كامل) — بنبني وصف
      // مختصر من الحقول المتاحة بدل طلب إضافي منفصل لكل فرصة (fetchOpportunity).
      const description = `منحة/تمويل من ${agency || "جهة حكومية أمريكية"}${
        categories ? " — التصنيف: " + categories : ""
      }. للتفاصيل الكاملة والتقديم، ادخل على رابط الفرصة.`;

      results.push({
        title,
        description,
        organization: agency || "Grants.gov",
        country: "United States",
        deadline: item.closeDate ? String(item.closeDate) : undefined,
        applyUrl: `https://www.grants.gov/search-results-detail/${opportunityId}`,
        sourceId: String(opportunityId),
        tags: Array.isArray(item.categories) ? item.categories.map(String) : [],
        publishedAt: item.openDate ? Date.parse(String(item.openDate)) || null : null,
        opportunityType: categories,
      });
    }
    return results;
  },
};
