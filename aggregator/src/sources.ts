import type { OpportunitySource, RawOpportunity } from "./types";
import type { JsonApiMapper, JsonApiRequestOptions } from "./fetchers/fetchJsonApi";

// ============================================================
// ⭐ الملف ده هو المكان الوحيد اللي تضيف/تشيل منه مصادر — زي ما اتطلب بالظبط.
// كل مصدر لازم يكون فيه "notes" واضح ليه هو موثوق ومسموح استخدامه (شرط
// الاستخدام)، عشان أي مراجعة لاحقة تعرف السبب من غير ما تدوّر تاني.
//
// ⚠️ ملحوظة مهمة وصريحة: أنا (الـAI) شغّال في بيئة من غير إنترنت فمقدرتش
// أختبر أي رابط فعليًا قبل ما أحطه هنا. المصدر الوحيد اللي "enabled: true"
// تحت ده رابط RSS رسمي حكومي (grants.gov) اتأكدت من وجوده وتوثيقه عن طريق
// بحث ويب مباشر وهو مُصمم أصلًا للمشاركة/التجميع من طرف ثالث. أي مصدر تاني
// عايز تضيفه (خصوصًا مصادر مصرية/عربية) لازم إنت (أو جلسة تانية معايا فيها
// بحث ويب) تتحقق من رابطه وشروط استخدامه الأول، وبعدين تحط enabled:true.
// ============================================================

// --- مصادر RSS (kind:"rss") ---
export const RSS_SOURCES: OpportunitySource[] = [
  {
    id: "example-university-rss-DISABLED",
    name: "[مثال] موقع جامعة — عدّل الرابط والاسم",
    kind: "rss",
    url: "https://example.edu/opportunities/feed",
    enabled: false,
    notes:
      "مثال توضيحي بس — قبل ما تفعّله (enabled:true) لازم تتأكد إن الرابط ده فعلاً بتاع الجامعة/الجهة وإن استخدامه في تجميع تلقائي مسموح.",
  },
];

// --- مصادر JSON API (kind:"json-api") ---
// كل مصدر هنا لازم يجيب معاه: arrayPath (مسار المصفوفة جوه الرد) و
// mapItem (تحويل عنصر خام لشكلنا الموحّد RawOpportunity)، وrequestOptions
// اختياري لو الـAPI محتاج POST بجسم طلب (زي grants.gov تحت).
export interface JsonApiSourceDefinition {
  source: OpportunitySource;
  arrayPath: string | null;
  mapItem: JsonApiMapper;
  requestOptions?: JsonApiRequestOptions;
}

export const JSON_API_SOURCES: JsonApiSourceDefinition[] = [
  {
    source: {
      id: "grants-gov-search2",
      name: "Grants.gov (US Federal Grants — Official REST API)",
      kind: "json-api",
      url: "https://api.grants.gov/v1/api/search2",
      enabled: true,
      notes:
        "API رسمي حكومي أمريكي (search2)، مُطلق رسميًا في 2025، مُعلن صراحة إنه بلا حاجة لتوثيق (no auth) ومخصص للاستخدام العام/التجميع. اتأكدت من التوثيق الرسمي ببحث ويب مباشر (grants.gov/api/common/search2) — استبدلنا بيه مصدر RSS القديم اللي كان مكسور/مش شغال.",
    },
    arrayPath: "data.oppHits",
    requestOptions: {
      method: "POST",
      // بنجيب أحدث الفرص المفتوحة بس (مش المغلقة/المؤرشفة)
      body: { oppStatuses: ["forecasted", "posted"], rows: 50 },
    },
    mapItem: (raw): RawOpportunity | null => {
      const item = raw as Record<string, unknown>;
      const opportunityId = item.id ?? item.opportunityId;
      if (!opportunityId) return null;
      const applyUrl = `https://www.grants.gov/search-results-detail/${opportunityId}`;
      const title = String(item.title || item.opportunityTitle || "").trim();
      if (!title) return null;
      const agency = String(item.agencyName || item.agency || item.topAgencyName || "").trim();
      const categories = Array.isArray(item.categories) ? item.categories.join("، ") : "";
      // search2 بيرجّع بيانات ملخّصة بس (من غير "synopsis" كامل) — بنبني وصف
      // مختصر من الحقول المتاحة بدل ما نعمل طلب إضافي منفصل (fetchOpportunity)
      // لكل فرصة على حدة (كان هيبطّئ ويزوّد عدد الطلبات كتير).
      const description = `منحة/تمويل من ${agency || "جهة حكومية أمريكية"}${categories ? " — التصنيف: " + categories : ""}. للتفاصيل الكاملة والتقديم، ادخل على رابط الفرصة.`;
      return {
        title,
        description,
        organization: agency || "Grants.gov",
        country: "United States",
        deadline: item.closeDate ? String(item.closeDate) : undefined,
        applyUrl,
        tags: Array.isArray(item.categories) ? item.categories.map(String) : [],
        publishedAt: item.openDate ? Date.parse(String(item.openDate)) || null : null,
        categoryHint: categories,
      };
    },
  },
  {
    source: {
      id: "example-json-api-DISABLED",
      name: "[مثال] API رسمي — عدّل الرابط",
      kind: "json-api",
      url: "https://example.org/api/opportunities",
      enabled: false,
      notes: "مثال توضيحي بس لشكل mapItem — فعّله بس بعد ما تتأكد من الـAPI الحقيقي وشروط استخدامه.",
    },
    arrayPath: "data.items", // عدّل ده حسب شكل الرد الفعلي
    mapItem: (raw): RawOpportunity | null => {
      const item = raw as Record<string, unknown>;
      const applyUrl = String(item.url || item.link || "").trim();
      if (!applyUrl) return null;
      return {
        title: String(item.title || "").trim(),
        description: String(item.description || item.summary || "").trim(),
        organization: String(item.organization || item.provider || "").trim(),
        country: item.country ? String(item.country) : undefined,
        deadline: item.deadline ? String(item.deadline) : undefined,
        applyUrl,
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        publishedAt: item.publishedAt ? Number(item.publishedAt) : null,
        categoryHint: item.category ? String(item.category) : undefined,
      };
    },
  },
];

// بيرجّع كل المصادر المفعّلة بس (RSS + JSON API) — ده اللي run.ts بيستخدمه.
export function getEnabledSources(): OpportunitySource[] {
  return [...RSS_SOURCES.filter((s) => s.enabled), ...JSON_API_SOURCES.filter((s) => s.source.enabled).map((s) => s.source)];
}
