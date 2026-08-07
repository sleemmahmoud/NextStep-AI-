import { createHash } from "node:crypto";

// نفس منطق الـhash المستخدم في النظام الحالي وفي auto-search.js (السيرفر) —
// لازم يفضل مطابق تمامًا بين كل الأماكن دي (راجع MAINTENANCE.md).
function hash(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/\/+$/, "");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 40);
}

// المستوى 1 (الأدق) من استراتيجية منع التكرار — لو المصدر بيدّي sourceId
// صريح، بيتحط مع اسم المصدر عشان لو مصدرين مختلفين استخدموا نفس الرقم
// بالصدفة ما يتلخبطوش مع بعض.
export function idFromSourceId(connectorId: string, sourceId: string): string {
  return hash(`${connectorId}:${sourceId}`);
}

// المستوى 2 — لو مفيش sourceId، بنستخدم رابط التقديم نفسه (زي النظام الحالي).
export function idFromUrl(applyUrl: string): string {
  return hash(applyUrl);
}
