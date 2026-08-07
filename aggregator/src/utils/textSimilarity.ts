// ============================================================
// نفس خوارزمية تشابه النصوص المستخدمة بالفعل في app.js
// (دالة textSimilarity + normalizeForCompare في أداة "اكتشاف الفرص
// المكررة" بلوحة الإدارة) — منقولة هنا بنفس المنطق بالظبط، مش نسخة
// جديدة مختلفة، عشان القرارين (في الواجهة والـAggregator) يتفقوا مع بعض.
// ============================================================

// بينظّف النص عشان المقارنة تبقى مش حساسة لعلامات ترقيم/مسافات زيادة/تشكيل بسيط.
export function normalizeForCompare(s: string | undefined | null): string {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// تشابه نصي بسيط بطريقة Jaccard على الكلمات (بدون أي مكتبة خارجية أو AI).
export function textSimilarity(a: string, b: string): number {
  const wa = new Set(normalizeForCompare(a).split(" ").filter(Boolean));
  const wb = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = wa.size + wb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// نفس العتبة المستخدمة في app.js بالظبط.
export const TITLE_SIMILARITY_THRESHOLD = 0.72;
