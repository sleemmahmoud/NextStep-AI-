// قاموس مرادفات صغير وقابل للتوسع — كل مفتاح بيتوسّع لقايمة مرادفات بتتضاف
// لكلمات البحث قبل المطابقة، عشان "شغل" و"وظيفة" و"job" يطابقوا نفس المحتوى.
const SYNONYMS = {
  "شغل": ["وظيفه", "job", "عمل", "توظيف"],
  "فلوس": ["منحه", "تمويل", "funding", "مصاريف"],
  "منحه": ["scholarship", "تمويل دراسي", "منحه دراسيه"],
  "تدريب": ["internship", "تدريب صيفي", "استكشاف مهني"],
  "كورس": ["دوره", "course", "دوره تدريبيه"],
  "سيره": ["cv", "resume", "سيره ذاتيه"],
  "مقابله": ["interview", "انترفيو", "مقابله شخصيه"],
  "جامعه": ["كليه", "university", "college"],
  "انجليزي": ["english", "لغه انجليزيه"],
  "تطوع": ["volunteering", "عمل تطوعي"],
  "قياده": ["leadership", "قائد"],
  "برمجه": ["كود", "coding", "programming", "تكنولوجيا"],
};

// بيرجّع كل الكلمات (الأصلية + مرادفاتها) عشان تتضاف لتوكينز البحث.
function expandWithSynonyms(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    if (SYNONYMS[token]) {
      for (const syn of SYNONYMS[token]) expanded.add(syn);
    }
    // كمان نتأكد لو التوكن نفسه هو مرادف لكلمة أساسية (بحث عكسي بسيط)
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (syns.includes(token)) expanded.add(key);
    }
  }
  return Array.from(expanded);
}

module.exports = { SYNONYMS, expandWithSynonyms };
