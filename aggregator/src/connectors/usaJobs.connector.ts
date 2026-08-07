import type { IConnector } from "../models/connector.model";
import type { RawOpportunity } from "../models/opportunity.model";
import { fetchJson } from "../fetchers/fetchJsonApi";
import { requireEnv } from "../config";

// API رسمي للحكومة الأمريكية (USAJobs)، اتأكدت من توثيقه الرسمي
// (developer.usajobs.gov). محتاج API Key + Email مسجّلين مجانًا — التسجيل
// فوري بالإيميل ومفيش انتظار موافقة (تفاصيل التسجيل في التقرير النهائي).
//
// ⚠️ أغلب وظائف USAJobs محتاجة جنسية أو إقامة أمريكية للتقديم — قيمته
// لجمهور NextStep AI (طلاب مصريين) محدودة مقارنة بباقي المصادر، لكنه
// مصدر رسمي حقيقي ومطلوب في القايمة، فاتضاف زي ما هو.
interface UsaJobsItem {
  MatchedObjectId?: string;
  MatchedObjectDescriptor?: {
    PositionTitle?: string;
    PositionURI?: string;
    UserArea?: { Details?: { JobSummary?: string } };
    OrganizationName?: string;
    PositionLocationDisplay?: string;
    ApplicationCloseDate?: string;
    PublicationStartDate?: string;
  };
}

export const usaJobsConnector: IConnector = {
  id: "usajobs",
  name: "USAJobs (US Federal Government — Official API)",
  category: "job",
  enabled: false, // ⚠️ اتقفل عمدًا — أغلب وظائفه محتاجة جنسية/إقامة أمريكية،
  // قيمته لجمهور NextStep AI (طلاب مصريين/عرب) محدودة. متسيبش المصدر ده
  // بره النظام (ممكن يفيد لو المنصة اتوسعت لجمهور دولي مستقبلًا)، بس مش
  // مفعّل افتراضيًا. فعّله يدويًا (enabled:true) لو احتجته.

  async fetch(): Promise<RawOpportunity[]> {
    // المفتاحين دول لازم يتحطوا في GitHub Secrets — لو مش موجودين، بيرمي
    // خطأ واضح بدل ما يفشل بصمت (requireEnv نفس المستخدمة في باقي المشروع).
    const apiKey = requireEnv("USAJOBS_API_KEY");
    const userAgentEmail = requireEnv("USAJOBS_USER_AGENT_EMAIL");

    const url = "https://data.usajobs.gov/api/search?ResultsPerPage=100";
    const body = (await fetchJson(this.id, url, {
      method: "GET",
      headers: {
        "Host": "data.usajobs.gov",
        "User-Agent": userAgentEmail,
        "Authorization-Key": apiKey,
      },
    })) as { SearchResult?: { SearchResultItems?: UsaJobsItem[] } };

    const items = body?.SearchResult?.SearchResultItems;
    if (!Array.isArray(items)) {
      throw new Error(`رد USAJobs API مش بالشكل المتوقع — ${this.id}`);
    }

    const results: RawOpportunity[] = [];
    for (const raw of items) {
      const d = raw.MatchedObjectDescriptor;
      if (!d || !d.PositionTitle || !d.PositionURI) continue;
      results.push({
        title: d.PositionTitle.trim(),
        description: d.UserArea?.Details?.JobSummary || `وظيفة حكومية أمريكية من ${d.OrganizationName || "USAJobs"}.`,
        organization: d.OrganizationName || "USAJobs",
        country: "United States",
        deadline: d.ApplicationCloseDate,
        applyUrl: d.PositionURI,
        sourceId: raw.MatchedObjectId,
        publishedAt: d.PublicationStartDate ? Date.parse(d.PublicationStartDate) || null : null,
      });
    }
    return results;
  },
};
