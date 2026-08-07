import type { OpportunityCategory, RawOpportunity, OpportunityRecord } from "../models/opportunity.model";

// نفس منطق classify.ts القديم بالظبط، بدون أي تغيير في الكلمات المفتاحية
// أو الترتيب — بس دلوقتي جزء من مرحلة "الإثراء" (Enrich) في الـPipeline
// الموحّد بدل ما يكون خطوة منفصلة.
const CATEGORY_KEYWORDS: Record<OpportunityCategory, string[]> = {
  scholarship: ["scholarship", "منحة", "منح دراسية", "fully funded", "tuition"],
  competition: ["competition", "hackathon", "مسابقة", "هاكاثون", "challenge", "award", "جائزة"],
  conference: ["conference", "summit", "مؤتمر", "قمة", "forum", "منتدى"],
  volunteering: ["volunteer", "تطوع", "تطوعي", "voluntary"],
  internship: ["internship", "تدريب", "trainee", "co-op", "استكشاف مهني"],
  course: ["course", "كورس", "دورة", "certificate", "شهادة", "bootcamp", "training program"],
  job: ["job", "وظيفة", "hiring", "vacancy", "career", "توظيف", "فرصة عمل", "full-time", "part-time"],
};
const CHECK_ORDER: OpportunityCategory[] = [
  "scholarship",
  "competition",
  "conference",
  "volunteering",
  "internship",
  "course",
  "job",
];

function classify(item: RawOpportunity): OpportunityCategory {
  if (item.category) return item.category; // المصدر نفسه حدد التصنيف — نحترمه
  const haystack = `${item.title} ${item.description} ${item.opportunityType || ""}`.toLowerCase();
  for (const category of CHECK_ORDER) {
    if (CATEGORY_KEYWORDS[category].some((kw) => haystack.includes(kw.toLowerCase()))) {
      return category;
    }
  }
  return "job"; // الافتراضي الأكثر أمانًا لو مفيش تطابق
}

// صور افتراضية بسيطة حسب التصنيف — تُستخدم بس لو المصدر مبعتش صورة خالص.
const DEFAULT_IMAGES: Record<OpportunityCategory, string> = {
  scholarship: "/assets/opportunity-defaults/scholarship.svg",
  internship: "/assets/opportunity-defaults/internship.svg",
  job: "/assets/opportunity-defaults/job.svg",
  volunteering: "/assets/opportunity-defaults/volunteering.svg",
  competition: "/assets/opportunity-defaults/competition.svg",
  conference: "/assets/opportunity-defaults/conference.svg",
  course: "/assets/opportunity-defaults/course.svg",
};

// قايمة صغيرة جدًا لتخمين الدولة من النص لو المصدر مبعتهاش — أفضل جهد
// (best-effort) مش دقيق 100%، ومقصود إنه بسيط: بيتفعّل بس لو country
// فاضي أصلًا، وميكسرش حاجة لو مالقاش تطابق (بيسيبها فاضية زي ما كانت).
const COUNTRY_HINTS: Record<string, string> = {
  egypt: "Egypt", مصر: "Egypt",
  "united states": "United States", usa: "United States",
  germany: "Germany", ألمانيا: "Germany",
  japan: "Japan", اليابان: "Japan",
  "united kingdom": "United Kingdom", britain: "United Kingdom",
};
function guessCountry(item: RawOpportunity): string | undefined {
  if (item.country) return item.country;
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  for (const key of Object.keys(COUNTRY_HINTS)) {
    if (haystack.includes(key)) return COUNTRY_HINTS[key];
  }
  return undefined;
}

export interface EnrichOptions {
  connectorId: string;
  isOfficialSource: boolean; // true لأي Connector API/RSS رسمي (الأربعة الحاليين كلهم كده)
}

// بياخد فرصة بعد الـvalidate/normalize، ويكمّل الحقول الناقصة (زي ما هو
// موضّح في قسم 3 من الـArchitecture) قبل ما تدخل مرحلة الـdedup والحفظ.
export function enrichOpportunity(
  item: RawOpportunity,
  opts: EnrichOptions
): Omit<OpportunityRecord, "source" | "createdAt" | "updatedAt" | "status"> {
  const now = Date.now();
  const category = classify(item);
  return {
    ...item,
    category,
    country: guessCountry(item),
    image: item.image || DEFAULT_IMAGES[category],
    verified: opts.isOfficialSource,
    featured: false, // دايمًا false من النظام الآلي — الأدمن بس اللي يغيّرها يدويًا
    lastChecked: now,
  };
}
