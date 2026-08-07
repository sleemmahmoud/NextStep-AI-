import type { RawOpportunity } from "../models/opportunity.model";

// بينضّف النص من HTML tags وكيانات شائعة — نفس منطق stripHtml الموجود في
// fetchers/fetchRss.ts، معمّم هنا عشان أي Connector (مش RSS بس) يستفيد منه.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// بيحاول يحوّل أي صيغة تاريخ لصيغة ISO موحّدة — لو فشل، بيسيب النص الأصلي
// زي ما هو (validationService هو اللي هيرفضه بعدين لو فعلًا مش مفهوم).
function normalizeDate(value: string | undefined): string | undefined {
  if (!value || !value.trim()) return undefined;
  const ts = Date.parse(value.trim());
  if (!Number.isFinite(ts)) return value.trim(); // نسيبه للـvalidation يرفضه بسبب واضح
  return new Date(ts).toISOString();
}

// توحيد الشكل قبل ما يدخل باقي الـPipeline — بيتطبّق على أي RawOpportunity
// من أي Connector، بغض النظر عن مصدره الأصلي.
export function normalizeOpportunity(item: RawOpportunity): RawOpportunity {
  const title = stripHtml(item.title || "").trim();
  const description = stripHtml(item.description || "").trim();
  const organization = stripHtml(item.organization || "").trim();
  const applyUrl = (item.applyUrl || "").trim();

  // applicationEnd هو اسم بديل لـdeadline (بعض المصادر بتستخدم المصطلح ده) —
  // لو deadline مش موجود لكن applicationEnd موجود، نوحّدهم هنا.
  const deadline = normalizeDate(item.deadline || item.applicationEnd);
  const applicationStart = normalizeDate(item.applicationStart);

  return {
    ...item,
    title,
    description,
    organization,
    applyUrl,
    deadline,
    applicationStart,
    applicationEnd: deadline, // بعد التوحيد، الاتنين نفس القيمة دايمًا
    country: item.country?.trim(),
    city: item.city?.trim(),
    eligibility: item.eligibility ? stripHtml(item.eligibility).trim() : undefined,
  };
}
