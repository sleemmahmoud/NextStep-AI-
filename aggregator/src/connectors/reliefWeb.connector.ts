import type { IConnector } from "../models/connector.model";
import type { RawOpportunity } from "../models/opportunity.model";
import { fetchJson } from "../fetchers/fetchJsonApi";
import { stripHtml } from "../fetchers/fetchRss";

// API رسمي بتديره منظومة الأمم المتحدة (OCHA) — اتأكدت منه بالكامل من
// التوثيق الرسمي (apidoc.reliefweb.int): مجاني، بلا حاجة لمفتاح سري
// (بس "appname" تعريفي، لازم يكون مسجّل مسبقًا حسب التحديث الأخير —
// راجع التقرير النهائي لتفاصيل التسجيل)، رخصة CC BY 4.0، حد 1000
// طلب/يوم و1000 نتيجة لكل طلب.
//
// ⚠️ ملحوظة أمانة: تأكدت من وجود الـAPI وتوثيقه الرسمي وحدوده، لكن
// مقدرتش أشغّل استدعاء فعلي حي من بيئتي (بلا إنترنت). أسماء الحقول تحت
// مبنية على التوثيق الرسمي المتاح، لكن التأكيد النهائي 100% بيحصل أول
// مرة يتشغّل فيها الـConnector ده فعليًا على GitHub Actions.
const APP_NAME = "nextstep-ai-eg"; // لازم يتسجل مسبقًا — تفاصيل في التقرير

interface ReliefWebItem {
  id?: string | number;
  fields?: {
    title?: string;
    body?: string;
    "body-html"?: string;
    url?: string;
    url_alias?: string;
    source?: Array<{ name?: string }>;
    country?: Array<{ name?: string }>;
    date?: { closing?: string; created?: string };
    theme?: Array<{ name?: string }>;
    type?: Array<{ name?: string }>;
  };
}

async function fetchReliefWeb(id: string, endpoint: string): Promise<ReliefWebItem[]> {
  const url = `https://api.reliefweb.int/v2/${endpoint}?appname=${encodeURIComponent(APP_NAME)}&limit=100&sort[]=date.created:desc`;
  const body = (await fetchJson(id, url)) as { data?: ReliefWebItem[] };
  if (!Array.isArray(body?.data)) {
    throw new Error(`رد ReliefWeb API مش بالشكل المتوقع (مفيش data[]) — ${id}`);
  }
  return body.data;
}

function mapItem(raw: ReliefWebItem, orgFallback: string): RawOpportunity | null {
  const f = raw.fields;
  if (!f || !f.title) return null;
  const applyUrl = f.url || f.url_alias;
  if (!applyUrl) return null;

  const org = f.source?.[0]?.name || orgFallback;
  const country = f.country?.map((c) => c.name).filter(Boolean).join("، ");
  const description = stripHtml(f["body-html"] || f.body || "").slice(0, 3000);

  return {
    title: f.title.trim(),
    description: description || `فرصة من ${org} عبر منصة ReliefWeb التابعة للأمم المتحدة.`,
    organization: org,
    country: country || undefined,
    deadline: f.date?.closing,
    applyUrl,
    sourceId: raw.id ? String(raw.id) : undefined,
    tags: f.theme?.map((t) => t.name).filter((x): x is string => Boolean(x)) || [],
    publishedAt: f.date?.created ? Date.parse(f.date.created) || null : null,
  };
}

export const reliefWebJobsConnector: IConnector = {
  id: "reliefweb-jobs",
  name: "ReliefWeb Jobs (UN OCHA — Official API)",
  category: "job",
  enabled: true,
  rateLimitPerDay: 1000,

  async fetch(): Promise<RawOpportunity[]> {
    const items = await fetchReliefWeb(this.id, "jobs");
    return items.map((i) => mapItem(i, "ReliefWeb")).filter((x): x is RawOpportunity => x !== null);
  },
};

export const reliefWebTrainingConnector: IConnector = {
  id: "reliefweb-training",
  name: "ReliefWeb Training (UN OCHA — Official API)",
  category: "course",
  enabled: true,
  rateLimitPerDay: 1000,

  async fetch(): Promise<RawOpportunity[]> {
    const items = await fetchReliefWeb(this.id, "training");
    return items.map((i) => mapItem(i, "ReliefWeb")).filter((x): x is RawOpportunity => x !== null);
  },
};
