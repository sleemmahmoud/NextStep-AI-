import type { OpportunityCategory, RawOpportunity, OpportunityRecord } from "./opportunity.model";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface SaveResult {
  id: string;
  wasNew: boolean;
}

export type HealthState = "ok" | "degraded" | "down" | "circuit-open";

export interface HealthStatus {
  state: HealthState;
  checkedAt: number;
  message?: string;
}

// ============================================================
// العقد الموحّد — كل مصدر لازم يطبّقه بالظبط. راجع
// AGGREGATOR_ARCHITECTURE_V2.md قسم 2 لتفاصيل ليه كل دالة موجودة.
// ============================================================
export interface IConnector {
  id: string;
  name: string;
  category: OpportunityCategory;
  enabled: boolean;
  rateLimitPerDay?: number;

  // نقطة الدخول الوحيدة الإجبارية فعليًا — أي تعقيد داخلي (POST body،
  // تحويل XML/JSON) بيبقى مخفي جواها بالكامل.
  fetch(): Promise<RawOpportunity[]>;

  // الثلاثة دول اختياريين — لو الـConnector مطبّقهمش، بيتاخد التنفيذ
  // الافتراضي المشترك من services/ (زي ما هو موضّح في الوثيقة).
  validate?(item: RawOpportunity): ValidationResult;
  normalize?(item: RawOpportunity): RawOpportunity;
  save?(item: OpportunityRecord): Promise<SaveResult>;

  // فحص خفيف اختياري لصفحة المراقبة — لو مش متوفر، النظام بيعتبر آخر
  // نتيجة fetch() فعلية هي المؤشر الوحيد على حالة المصدر.
  healthCheck?(): Promise<HealthStatus>;
}
