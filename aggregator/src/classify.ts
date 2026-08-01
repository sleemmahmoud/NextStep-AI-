import type { OpportunityCategory, RawOpportunity } from "./types";

// كل تصنيف ليه كلمات مفتاحية (عربي + إنجليزي). الترتيب هنا مهم: أول تصنيف
// تتطابق كلماته بيكسب — رتبناهم من الأكثر تحديدًا للأعم، عشان "مسابقة برمجة
// لطلاب جامعيين" مثلًا تتصنف "competitions" مش "courses" بالغلط.
const CATEGORY_KEYWORDS: Record<OpportunityCategory, string[]> = {
  scholarship: ["scholarship", "منحة", "منح دراسية", "fully funded", "tuition"],
  competition: ["competition", "hackathon", "مسابقة", "هاكاثون", "challenge", "award", "جائزة"],
  conference: ["conference", "summit", "مؤتمر", "قمة", "forum", "منتدى"],
  volunteering: ["volunteer", "تطوع", "تطوعي", "voluntary"],
  internship: ["internship", "تدريب", "trainee", "co-op", "استكشاف مهني"],
  course: ["course", "كورس", "دورة", "certificate", "شهادة", "bootcamp", "training program"],
  job: ["job", "وظيفة", "hiring", "vacancy", "career", "توظيف", "فرصة عمل", "full-time", "part-time"],
};

// ده الترتيب اللي بيتفحص بيه فعليًا — لازم يكون من الأكثر تحديدًا للأعم.
const CHECK_ORDER: OpportunityCategory[] = [
  "scholarship",
  "competition",
  "conference",
  "volunteering",
  "internship",
  "course",
  "job",
];

export function classifyOpportunity(item: RawOpportunity): OpportunityCategory {
  const haystack = `${item.title} ${item.description} ${item.categoryHint || ""}`.toLowerCase();

  for (const category of CHECK_ORDER) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (keywords.some((kw) => haystack.includes(kw.toLowerCase()))) {
      return category;
    }
  }
  // لو مفيش أي كلمة مطابقة، الافتراضي الأكثر أمانًا هو "job" (أعم تصنيف
  // وأقلهم ضررًا لو غلط) بدل ما نرفض الفرصة بالكامل.
  return "job";
}
