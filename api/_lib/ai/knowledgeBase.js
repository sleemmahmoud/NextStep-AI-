const { tokenize, jaccardSimilarity } = require("./textNormalize");
const { expandWithSynonyms } = require("./synonyms");

// كل ملفات المحتوى بيتحملوا مرة واحدة وقت الـcold start (مش قراءة من
// Firestore في كل طلب) — قسم 9 من وثيقة التصميم (Scalability).
const CATEGORY_FILES = [
  "scholarships", "courses", "volunteering", "cv", "interviews",
  "leadership", "english", "universities", "technology", "career",
  "productivity", "general",
];

let cachedArticles = null;
function getAllArticles() {
  if (cachedArticles) return cachedArticles;
  cachedArticles = [];
  for (const cat of CATEGORY_FILES) {
    const articles = require(`./knowledgeContent/${cat}`);
    for (const a of articles) cachedArticles.push({ ...a, category: cat });
  }
  return cachedArticles;
}

// حد الثقة اللي فوقه بنعتبر النتيجة "إجابة مباشرة" بدل "اقتراحات بس".
const CONFIDENCE_THRESHOLD = 0.18;

// بيدوّر في كل المقالات ويرجّع أفضل تطابقات مرتبة بالنقاط (قسم 3 في
// وثيقة التصميم: تطبيع + مرادفات + stemming + Jaccard + ترتيب).
function search(query, { limit = 3 } = {}) {
  const queryTokens = expandWithSynonyms(tokenize(query));
  const queryText = queryTokens.join(" ");

  const scored = getAllArticles().map((article) => {
    const haystack = `${article.title} ${article.keywords.join(" ")}`;
    const titleScore = jaccardSimilarity(queryText, haystack) * 0.7;
    const contentScore = jaccardSimilarity(queryText, article.content) * 0.3;
    return { article, score: titleScore + contentScore };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit).filter((s) => s.score > 0);

  return {
    confident: top.length > 0 && top[0].score >= CONFIDENCE_THRESHOLD,
    results: top,
  };
}

module.exports = { search, getAllArticles, CONFIDENCE_THRESHOLD };
