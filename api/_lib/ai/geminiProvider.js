const { callGemini } = require("../gemini");
const { isCircuitOpen, reportProviderResult } = require("./circuitBreaker");

const PROVIDER_ID = "gemini";
const TIMEOUT_MS = 15000;

function withTimeout(promise, ms) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Gemini: انتهت المهلة بعد ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

// بيستقبل سؤال نصي بسيط + Prompt نظام اختياري، ويرجّع رد موحّد الشكل.
// بيتحقق من الدائرة القاطعة الأول قبل أي محاولة فعلية.
async function askGemini(question, systemPrompt) {
  const circuitOpen = await isCircuitOpen(PROVIDER_ID);
  if (circuitOpen) {
    return { ok: false, reason: "circuit-open" };
  }

  const geminiBody = {
    contents: [{ role: "user", parts: [{ text: question }] }],
    ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
  };

  // محاولة واحدة + إعادة محاولة واحدة بس (مش 3 زي الأجريجيتور) — النظام
  // ده تفاعلي والمستخدم مستني رد فوري، فطول الانتظار بيأثر مباشرة على
  // التجربة (قسم 5 في وثيقة التصميم).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { res, text } = await withTimeout(callGemini(geminiBody), TIMEOUT_MS);
      if (!res.ok) {
        if (attempt === 0) continue; // جرّب مرة تانية بس
        await reportProviderResult(PROVIDER_ID, false);
        return { ok: false, reason: "provider-error", status: res.status };
      }
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        await reportProviderResult(PROVIDER_ID, false);
        return { ok: false, reason: "invalid-response" };
      }
      const answerText = parsed?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      if (!answerText.trim()) {
        await reportProviderResult(PROVIDER_ID, false);
        return { ok: false, reason: "empty-response" };
      }
      await reportProviderResult(PROVIDER_ID, true);
      return { ok: true, text: answerText, raw: parsed };
    } catch (err) {
      if (attempt === 0) continue;
      await reportProviderResult(PROVIDER_ID, false);
      return { ok: false, reason: "timeout-or-network", error: err && err.message };
    }
  }
  return { ok: false, reason: "unknown" };
}

module.exports = { askGemini, PROVIDER_ID };
