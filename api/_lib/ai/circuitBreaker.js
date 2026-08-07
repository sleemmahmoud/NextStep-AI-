const { getFirebaseAdmin } = require("../firebaseAdmin");

const CONSECUTIVE_FAILURES_TO_OPEN = 3;
const COOLDOWN_MS = 7 * 60 * 1000; // 7 دقايق (وسط النطاق المتفق عليه 5-10)
const HEALTH_DOC = "meta/aiProviderHealth";

// بيتنده قبل أي محاولة لنداء Gemini — لو الدائرة مقفولة ولسه في فترة
// التبريد، بنرجع true عشان نتخطى المحاولة تمامًا ونروح على الـFallback
// (Knowledge Base) على طول من غير ما نستنى Timeout جديد.
async function isCircuitOpen(providerId) {
  try {
    const db = getFirebaseAdmin().firestore();
    const snap = await db.doc(HEALTH_DOC).get();
    if (!snap.exists) return false;
    const entry = (snap.data().providers || {})[providerId];
    if (!entry || !entry.circuitOpenUntil) return false;
    return Date.now() < entry.circuitOpenUntil;
  } catch (err) {
    // لو حصل خطأ في قراءة حالة الدائرة نفسها، الأسلم إننا نفترض إنها
    // مقفولة (false) ونسيب المحاولة الفعلية تحصل — مش نمنع خدمة شغالة
    // بسبب مشكلة في نظام المراقبة نفسه.
    console.warn("[circuitBreaker] isCircuitOpen check failed:", err && err.message);
    return false;
  }
}

// بيتنده بعد كل محاولة (نجحت أو فشلت) عشان يحدّث عداد الفشل المتتالي.
// بعد انتهاء مدة التبريد، أول محاولة جديدة بتتعامل عادي (إعادة اختبار
// تلقائية — مفيش خطوة يدوية مطلوبة).
async function reportProviderResult(providerId, ok) {
  try {
    const db = getFirebaseAdmin().firestore();
    const ref = db.doc(HEALTH_DOC);
    const snap = await ref.get();
    const all = (snap.exists && snap.data().providers) || {};
    const prev = all[providerId];

    const consecutiveFailures = ok ? 0 : (prev?.consecutiveFailures || 0) + 1;
    const shouldOpen = consecutiveFailures >= CONSECUTIVE_FAILURES_TO_OPEN;

    all[providerId] = {
      consecutiveFailures,
      lastCheckedAt: Date.now(),
      circuitOpenUntil: shouldOpen ? Date.now() + COOLDOWN_MS : null,
    };
    await ref.set({ providers: all }, { merge: true });
  } catch (err) {
    console.warn("[circuitBreaker] reportProviderResult failed:", err && err.message);
  }
}

module.exports = { isCircuitOpen, reportProviderResult };
