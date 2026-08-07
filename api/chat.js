// ============================================================
// /api/chat — بروكسي Gemini الوحيد للمنصة، شغال كـVercel Serverless Function.
// ده البديل الكامل لبروكسي الـCloudflare Worker القديم: نفس المنطق بالظبط
// (حد يومي، موديل واحد، من غير أي retry)، بس هنا بيستخدم Vercel Environment
// Variables وFirestore (عن طريق Firebase Admin SDK) بدل Cloudflare KV
// والـBindings خالص.
// ============================================================
const { callGemini, ADMIN_EMAILS, DAILY_LIMIT, ADMIN_DAILY_LIMIT } = require("./_lib/gemini");
const { checkQuota, consumeQuota } = require("./_lib/quota");
const { verifyRequestAuth } = require("./_lib/verifyAuth");
const { answerQuestion } = require("./_lib/ai/fallbackChain");

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
// أي حقل غير دول بيتشال تلقائيًا قبل ما يوصل لـGemini. "model" مش موجودة هنا
// عن قصد — الموديل ثابت (GEMINI_MODEL جوه _lib/gemini.js) ومش بيتغيّر بناءً
// على أي حاجة جاية من الموقع خالص.
const ALLOWED_GEMINI_FIELDS = ["contents", "generationConfig", "safetySettings", "systemInstruction", "tools", "toolConfig", "cachedContent"];

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: { message: "Method not allowed" } }); return; }

  let parsedBody;
  try {
    parsedBody = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (err) {
    res.status(400).json({ error: { message: "الطلب مش JSON صحيح." } });
    return;
  }

  try {
    const { action } = parsedBody;
    const { uid, email } = await verifyRequestAuth(req);
    if (!uid) {
      res.status(401).json({ error: { message: "لازم تسجّل دخول الأول عشان تستخدم الذكاء الاصطناعي." } });
      return;
    }

    if (action === "quotaStatus") {
      const quota = await checkQuota({ uid, email, ADMIN_EMAILS, DAILY_LIMIT, ADMIN_DAILY_LIMIT });
      if (quota.configError) { res.status(400).json({ error: { message: quota.configError } }); return; }
      res.status(200).json({ limit: quota.limit, used: quota.current, remaining: (quota.limit ?? 0) - (quota.current ?? 0) });
      return;
    }

    // 🆕 مسار المساعد الذكي التفاعلي (Sprint 2 — Hybrid AI Architecture):
    // سؤال المستخدم بيعدي على Rules Engine ثم Knowledge Base الأول (مجانًا
    // وفوري)، وGemini بيتنده بس لو الطبقتين دول مالقوش رد كافٍ. الكوتا
    // بتتخصم فقط لو Gemini فعليًا اتنده ونجح — مش لو الرد جه من Rules أو
    // Knowledge Base أو حتى لو Gemini فشل.
    if (action === "assistantChat") {
      const question = String(parsedBody.question || "").trim();
      if (!question) {
        res.status(400).json({ error: { message: "اكتب سؤالك الأول." } });
        return;
      }
      const quota = await checkQuota({ uid, email, ADMIN_EMAILS, DAILY_LIMIT, ADMIN_DAILY_LIMIT });
      const hasQuota = !quota.configError && quota.allowed;

      const result = await answerQuestion(question, { hasQuota });
      if (result.shouldConsumeQuota) {
        await consumeQuota(quota.docId, quota.current);
      }
      res.status(200).json({
        answer: result.answer,
        source: result.source, // rules | knowledge-base | ai | knowledge-base-fallback | none
        suggestions: result.suggestions || [],
      });
      return;
    }

    const quota = await checkQuota({ uid, email, ADMIN_EMAILS, DAILY_LIMIT, ADMIN_DAILY_LIMIT });
    if (quota.configError) { res.status(400).json({ error: { message: quota.configError } }); return; }
    if (!quota.allowed) {
      console.log(`[quota] رفض — id=${quota.idKey} استهلك ${quota.current}/${quota.limit}`);
      res.status(429).json({ error: { message: `وصلت للحد اليومي لاستخدام الذكاء الاصطناعي (${quota.limit} طلب في اليوم)، هيتصفر تلقائيًا بكرة.` } });
      return;
    }

    // قايمة سماح صريحة قبل ما نبعت أي حاجة لـGemini.
    const geminiBody = {};
    for (const k of ALLOWED_GEMINI_FIELDS) {
      if (parsedBody[k] !== undefined) geminiBody[k] = parsedBody[k];
    }

    console.log(`[gemini] طلب جديد — id=${quota.idKey} (${quota.current}/${quota.limit} النهاردة)`);
    const { res: googleRes, text: data } = await callGemini(geminiBody);
    if (googleRes.ok) {
      await consumeQuota(quota.docId, quota.current);
    } else {
      console.log(`[gemini] فشل — id=${quota.idKey} status=${googleRes.status} — الكوتا مش هتتخصم`);
    }
    res.status(googleRes.status).setHeader("Content-Type", "application/json").send(data);
  } catch (err) {
    console.error("[api/chat] proxy_error:", err);
    res.status(500).json({ error: "proxy_error", message: String(err && err.message || err) });
  }
};
