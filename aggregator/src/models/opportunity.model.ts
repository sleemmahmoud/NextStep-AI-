// ============================================================
// الموديل الموحّد للفرصة — زي ما اتفق عليه في وثيقة الـArchitecture
// (AGGREGATOR_ARCHITECTURE_V2.md، قسم 4). أي حقل هنا موثّق سببه في الوثيقة.
// ============================================================

// ⚠️ نفس قيم app.js CATEGORIES بالظبط (مفرد) — راجع types.ts القديم للسبب.
export type OpportunityCategory =
  | "scholarship"
  | "internship"
  | "job"
  | "volunteering"
  | "competition"
  | "conference"
  | "course";

export type OpportunityStatus = "active" | "expired";

// شكل خام قبل أي معالجة — كل Connector بيرجّع مصفوفة من ده من fetch()
export interface RawOpportunity {
  title: string;
  description: string;
  organization: string;
  opportunityType?: string;
  category?: OpportunityCategory; // اختياري — لو المصدر مبعتوش، enrichmentService بيحدده
  country?: string;
  city?: string;
  language?: string;
  eligibility?: string;
  funding?: string;
  deadline?: string;
  applicationStart?: string;
  applicationEnd?: string; // بيتوحّد مع deadline وقت الـnormalize لو deadline مش موجود
  image?: string;
  applyUrl: string; // = url
  sourceUrl?: string;
  tags?: string[];
  publishedAt?: number | null;
  sourceId?: string; // معرف الفرصة عند المصدر نفسه لو موجود (أهم حاجة لمنع التكرار الدقيق)
}

// الشكل الكامل بعد المعالجة، قبل التحويل لصيغة Firestore الفعلية (عبر adapter جوه firestoreService)
export interface OpportunityRecord extends RawOpportunity {
  category: OpportunityCategory; // بقى إجباري بعد الـenrichment
  source: string; // id الـConnector
  status: OpportunityStatus;
  verified: boolean;
  featured: boolean; // دايمًا false من النظام الآلي — الأدمن بس اللي يغيّرها
  createdAt: number;
  updatedAt: number;
  lastChecked: number;
}
