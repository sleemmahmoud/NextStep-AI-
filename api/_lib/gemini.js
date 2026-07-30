// ============================================================
// أداة استدعاء Gemini المشتركة — بتستخدمها /api/chat.js (البروكسي العادي)
// و/api/cron/auto-search.js (البحث التلقائي اليومي) عشان الاتنين يستخدموا
// نفس المنطق بالظبط (موديل واحد، من غير أي retry خالص).
// ============================================================

// موديل Gemini الوحيد المستخدم في المنصة كلها.
const GEMINI_MODEL = "gemini-3.5-flash";

// لازم تفضل مطابقة تمامًا لمصفوفة TAGS في app.js
const TAGS = ["برمجة", "تصميم", "ريادة أعمال", "تسويق رقمي", "لغات", "علوم", "هندسة", "قيادة وتطوع", "فنون وإعلام", "أعمال وتمويل", "رياضة", "مهارات تواصل"];

// لازم يفضل مطابق تمامًا لمصفوفة ADMIN_EMAILS في app.js
const ADMIN_EMAILS = ["nextstepai010@gmail.com"];

const DAILY_LIMIT = 2;
const ADMIN_DAILY_LIMIT = 8;

// مكالمة Gemini واحدة، بدون أي إعادة محاولة خالص. عند أي فشل بتطبع في
// Vercel Function Logs بلوك JSON كامل فيه: status / url (من غير الـAPI key
// خالص) / model / كود وسبب الخطأ من Google / الرد الكامل زي ما هو من غير
// أي تلخيص.
async function callGemini(geminiBody) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY مش موجود في Environment Variables بتاعة Vercel.");
  const startedAt = Date.now();
  const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(geminiBody),
  });
  const text = await res.text();
  const elapsedMs = Date.now() - startedAt;

  if (!res.ok) {
    let parsedBody;
    try { parsedBody = JSON.parse(text); } catch { parsedBody = null; }
    console.error(
      "[gemini][ERROR]",
      JSON.stringify({
        status: res.status,
        statusText: res.statusText,
        url: requestUrl, // بدون أي API key — الـkey بيتبعت في الـheader بس
        model: GEMINI_MODEL,
        elapsedMs,
        errorCode: parsedBody?.error?.code ?? null,
        errorMessage: parsedBody?.error?.message ?? null,
        errorStatus: parsedBody?.error?.status ?? null, // زي "RESOURCE_EXHAUSTED"
        fullResponseJson: parsedBody ?? text,
      }, null, 2)
    );
  } else {
    console.log(`[gemini][OK] status=${res.status} model=${GEMINI_MODEL} elapsedMs=${elapsedMs} url=${requestUrl}`);
  }

  return { res, text };
}

module.exports = { callGemini, GEMINI_MODEL, TAGS, ADMIN_EMAILS, DAILY_LIMIT, ADMIN_DAILY_LIMIT };
