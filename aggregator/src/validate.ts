import type { RawOpportunity } from "./types";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// كل قاعدة هنا بترد سبب واضح للرفض — بيتسجل في اللوجز عشان تعرف بالظبط ليه
// فرصة معينة اتجاهلت (مفيدة جدًا لما مصدر يرجّع بيانات وحشة بالغلط).
export function validateRawOpportunity(item: RawOpportunity): ValidationResult {
  if (!item.title || !item.title.trim()) {
    return { valid: false, reason: "العنوان فارغ" };
  }
  if (!item.description || !item.description.trim()) {
    return { valid: false, reason: "الوصف فارغ" };
  }
  if (!item.organization || !item.organization.trim()) {
    return { valid: false, reason: "الجهة غير معروفة" };
  }
  if (!isValidUrl(item.applyUrl)) {
    return { valid: false, reason: "رابط التقديم غير صالح" };
  }
  // حماية بسيطة من محتوى ضخم بالغلط (مصدر بيرجّع صفحة HTML كاملة كـ"وصف"
  // مثلًا) — سقف معقول من غير ما يرفض أوصاف طويلة عادية.
  if (item.description.length > 20000) {
    return { valid: false, reason: "الوصف طويل جدًا (يُشتبه إنه بيانات غير سليمة)" };
  }
  return { valid: true };
}

function isValidUrl(url: string | undefined): boolean {
  if (!url || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
