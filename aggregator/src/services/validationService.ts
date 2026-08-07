import type { RawOpportunity } from "../models/opportunity.model";
import type { ValidationResult } from "../models/connector.model";

// كل قاعدة هنا بترد سبب واضح للرفض — بيتسجل في اللوجز عشان تعرف بالظبط ليه
// فرصة معينة اتجاهلت. القواعد مطابقة لقسم 6 في وثيقة الـArchitecture.
export function validateOpportunity(item: RawOpportunity): ValidationResult {
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
  // حماية من محتوى ضخم بالغلط (مصدر بيرجّع صفحة HTML كاملة كـ"وصف" مثلًا).
  if (item.description.length > 20000) {
    return { valid: false, reason: "الوصف طويل جدًا (يُشتبه إنه بيانات غير سليمة)" };
  }
  // 🆕 لو فيه deadline، لازم يكون تاريخ قابل للفهم — تاريخ غير مفهوم يكسر
  // الترتيب والفلترة في الواجهة بدل ما يفيد.
  if (item.deadline) {
    const ts = Date.parse(item.deadline);
    if (!Number.isFinite(ts)) {
      return { valid: false, reason: "صيغة الموعد النهائي غير مفهومة" };
    }
    // 🆕 لو الموعد فات بالفعل وقت الجلب نفسه، الفرصة ميتة من الأساس —
    // مفيش داعي نحفظها ونشغّل عليها فحص الانتهاء لاحقًا.
    if (ts < Date.now()) {
      return { valid: false, reason: "الفرصة منتهية بالفعل وقت الجلب" };
    }
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
