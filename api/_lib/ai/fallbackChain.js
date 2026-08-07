const { matchRule } = require("./rulesEngine");
const { search: searchKnowledgeBase } = require("./knowledgeBase");
const { askGemini } = require("./geminiProvider");

const ASSISTANT_SYSTEM_PROMPT =
  "إنت مساعد ذكي في منصة NextStep AI بتساعد طلاب وخريجين مصريين في المنح والتدريب والتطوير المهني. رد بالعامية المصرية البسيطة، وباختصار ووضوح.";

// بيرجّع دايمًا رد للمستخدم — مفيش أي حالة "مفيش رد" خالص، حتى لو كل
// الطبقات فشلت (وقتها بيرجّع رسالة ودّية بدل خطأ تقني، قسم 6 في الوثيقة).
async function answerQuestion(question, { hasQuota }) {
  // المستوى 1: Rules Engine — فوري، مجاني، صفر تأخير.
  const ruleMatch = matchRule(question);
  if (ruleMatch) {
    return { answer: ruleMatch.answer, source: "rules", shouldConsumeQuota: false };
  }

  // المستوى 2: Knowledge Base — بحث محلي، مجاني، بدون AI خالص.
  const kbResult = searchKnowledgeBase(question);
  if (kbResult.confident) {
    const top = kbResult.results[0].article;
    return { answer: top.content, source: "knowledge-base", shouldConsumeQuota: false, articleTitle: top.title };
  }

  // المستوى 3: External AI — بس لو المستخدم عنده كوتا متبقية.
  if (hasQuota) {
    const aiResult = await askGemini(question, ASSISTANT_SYSTEM_PROMPT);
    if (aiResult.ok) {
      return { answer: aiResult.text, source: "ai", shouldConsumeQuota: true };
    }
    // فشل الـAI (أي سبب: circuit-open, timeout, error) — منورّيش أي تفصيل
    // تقني للمستخدم، ونكمل على أفضل حاجة عندنا من الـKnowledge Base.
  }

  // Fallback أخير: أفضل نتيجة KB متاحة حتى لو مش واثقين فيها 100%، أو
  // رسالة ودّية لو مفيش حاجة خالص.
  if (kbResult.results.length > 0) {
    const suggestions = kbResult.results.map((r) => r.article.title);
    return {
      answer: `معنديش إجابة دقيقة 100% للسؤال ده، بس ممكن يفيدك: ${kbResult.results[0].article.content}`,
      source: "knowledge-base-fallback",
      shouldConsumeQuota: false,
      suggestions,
    };
  }

  return {
    answer: "معنديش إجابة دقيقة للسؤال ده دلوقتي 🙏 جرب تصفح الأقسام في المنصة، أو أعد صياغة سؤالك بشكل مختلف.",
    source: "none",
    shouldConsumeQuota: false,
  };
}

module.exports = { answerQuestion };
