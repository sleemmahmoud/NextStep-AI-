// ============================================================
// أدوات نصية مشتركة لمحرك البحث في قاعدة المعرفة — تطبيع عربي + Stemming
// بسيط + تشابه Jaccard. نفس فلسفة textSimilarity.ts في نظام الأجريجيتور
// (إعادة استخدام نمط ناجح)، بس هنا نسخة CommonJS لإنها بتشتغل في Vercel
// Functions العادية مش في مشروع الـTypeScript المنفصل.
// ============================================================

const STOP_PREFIXES = ["وال", "بال", "كال", "فال", "لل", "ال", "و", "ف", "ب", "ك", "ل"];
const STOP_SUFFIXES = ["ونها", "اتها", "ون", "ين", "ات", "ها", "هم", "كم", "نا", "ة"];

function normalizeArabic(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F]/g, "") // إزالة التشكيل
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Stemming بسيط جدًا بقواعد ثابتة (مش مكتبة NLP) — بيشيل أشهر السوابق
// واللواحق العربية الشائعة. مش دقيق 100% لغويًا، لكنه كافٍ لتحسين تطابق
// البحث بشكل ملموس بدون أي اعتماد خارجي.
function stem(word) {
  let w = word;
  for (const suf of STOP_SUFFIXES) {
    if (w.length > suf.length + 2 && w.endsWith(suf)) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  for (const pre of STOP_PREFIXES) {
    if (w.length > pre.length + 2 && w.startsWith(pre)) {
      w = w.slice(pre.length);
      break;
    }
  }
  return w;
}

function tokenize(text) {
  return normalizeArabic(text)
    .split(" ")
    .filter(Boolean)
    .map(stem);
}

// تشابه Jaccard على الكلمات بعد الـstemming.
function jaccardSimilarity(a, b) {
  const wa = new Set(tokenize(a));
  const wb = new Set(tokenize(b));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = wa.size + wb.size - inter;
  return union === 0 ? 0 : inter / union;
}

module.exports = { normalizeArabic, stem, tokenize, jaccardSimilarity };
