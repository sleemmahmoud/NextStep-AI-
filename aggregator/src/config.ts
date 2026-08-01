// ============================================================
// إعدادات النظام كله من مكان واحد. أي قيمة قابلة للتغيير (حدود، مهلات،
// أسماء collections) بتتحط هنا — مفيش أرقام "سحرية" متفرقة في باقي الملفات.
// ============================================================

export const CONFIG = {
  // اسم الـcollection في Firestore اللي بتتخزن فيه الفرص — لازم يفضل مطابق
  // تمامًا لاسم الـcollection اللي بيقراه app.js ("opportunities").
  OPPORTUNITIES_COLLECTION: "opportunities",

  // مستند واحد بيتحدث بعد كل تشغيلة (آخر نتيجة) — بيتقرا من لوحة الإدارة.
  LAST_RUN_DOC: "meta/aggregatorLastRun",

  // مستند فيه آخر N تشغيلة (تاريخ مختصر) — عشان منحتاجش collection جديدة
  // ليها Firestore Rules خاصة بيها، ده جوه "meta" الموجودة أصلًا.
  RUN_HISTORY_DOC: "meta/aggregatorRunHistory",
  RUN_HISTORY_MAX_ENTRIES: 30,

  // أقصى عدد محاولات لكل مصدر لو فشل (Retry) قبل ما نستسلم وننتقل للي بعده.
  MAX_RETRIES_PER_SOURCE: 2,
  RETRY_BASE_DELAY_MS: 1500, // exponential backoff: 1.5s ثم 3s

  // مهلة أقصى لكل طلب HTTP لمصدر واحد.
  FETCH_TIMEOUT_MS: 20000,

  // أي فرصة اتخطى موعدها بأكتر من كذا يوم، بيتم إخفاؤها (status="expired")
  // بدل حذفها نهائيًا — أأمن (ممكن ترجعها لو غلطت في تاريخ) وأسرع (تعديل
  // حقل واحد بدل حذف وإعادة إدخال).
  EXPIRE_GRACE_DAYS: 1,

  // الحد الأقصى لعدد الفرص اللي بيتفحصوا للـexpiry في كل تشغيلة (حماية من
  // قراءة/كتابة عدد ضخم جدًا لو الـcollection كبرت كتير مستقبلًا).
  EXPIRE_SCAN_LIMIT: 5000,
} as const;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Environment variable ${name} مش موجودة. لازم تضيفها في GitHub Secrets (أو Vercel لو دي دالة السيرفر).`
    );
  }
  return value;
}
