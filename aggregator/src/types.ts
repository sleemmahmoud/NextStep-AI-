// ============================================================
// أنواع البيانات المشتركة لكل النظام. أي حاجة بتتغيّر شكلها (فرصة، نتيجة
// مصدر، تقرير تشغيل) بتتعرّف هنا مرة واحدة بس، والباقي كله بيستورد منها.
// ============================================================

// ⚠️ القيم هنا لازم تفضل مطابقة تمامًا لمفاتيح CATEGORIES في app.js (السطر
// اللي فيه `const CATEGORIES = {scholarship:...}`). الطلب الأصلي كان بأسماء
// جمع (Scholarships, Internships...) لكن الواجهة الفعلية شغالة بأسماء مفرد
// فعليًا — لو خزّنا "scholarships" (جمع) هتتخزن الفرصة بتصنيف الواجهة مش
// عارفاه، فمش هيظهر لها تسمية ولا هتتفلتر صح. اخترنا التوافق مع الواجهة
// الحية بدل الالتزام الحرفي بالاسم المطلوب، عشان "متكسرش أي ميزة موجودة".
export type OpportunityCategory =
  | "scholarship"
  | "internship"
  | "job"
  | "volunteering"
  | "competition"
  | "conference"
  | "course";

export type OpportunityStatus = "active" | "expired";

// شكل الفرصة زي ما هيتخزن بالظبط في Firestore — نفس الحقول المطلوبة بالضبط،
// ومفيش أي حقل زيادة (زي صور أو بيانات وسيطة) بيتسرب للـdocument النهائي.
export interface OpportunityRecord {
  title: string;
  description: string;
  category: OpportunityCategory;
  organization: string;
  country: string;
  deadline: string; // نص زي ما جاي من المصدر (ممكن يكون تاريخ أو "غير معلن")
  source: string; // اسم المصدر (زي ما معرّف في sources.ts)
  applyUrl: string;
  tags: string[];
  status: OpportunityStatus;
  publishedAt: number | null; // timestamp لو متوفر من المصدر، وإلا null
  createdAt: number; // وقت أول ما اتحفظت في القاعدة عندنا (بيتحدد مرة واحدة بس)
  updatedAt: number; // بيتحدث في كل مرة نلمس فيها الفرصة دي (upsert)
}

// الشكل الخام اللي أي fetcher لازم يرجّعه — قبل الـValidation والتصنيف،
// عشان كل مصدر يركّز بس في "إزاي أجيب البيانات" مش في شكلها النهائي.
export interface RawOpportunity {
  title: string;
  description: string;
  organization: string;
  country?: string;
  deadline?: string;
  applyUrl: string;
  tags?: string[];
  publishedAt?: number | null;
  // تلميح تصنيف اختياري لو المصدر نفسه بيقول نوعه (زي RSS category) — مش
  // إلزامي، الـclassifier بيقدر يشتغل من غيره تمامًا.
  categoryHint?: string;
}

export type SourceKind = "rss" | "json-api";

export interface OpportunitySource {
  id: string; // معرف فريد ثابت (بيتسجل في اللوجز)
  name: string; // اسم واضح للعرض
  kind: SourceKind;
  url: string;
  enabled: boolean;
  // ملاحظة توثيقية إجبارية — ليه المصدر ده موثوق ومسموح استخدامه (شرط
  // الاستخدام)، عشان أي حد يراجع القايمة بعدين يعرف السبب من غير ما يدوّر.
  notes: string;
}

export interface SourceResult {
  sourceId: string;
  ok: boolean;
  itemsFetched: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsRejected: number; // فشلوا في الـValidation
  error?: string;
  attempts: number;
}

export interface RunReport {
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  sourcesChecked: number;
  sourcesFailed: number;
  totalFetched: number;
  totalNew: number;
  totalUpdated: number;
  totalRejected: number;
  totalErrors: number;
  expiredMarked: number;
  perSource: SourceResult[];
  triggeredBy: "schedule" | "manual" | "workflow_dispatch";
}
