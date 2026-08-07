import { idFromSourceId, idFromUrl } from "../utils/idHash";
import { textSimilarity, TITLE_SIMILARITY_THRESHOLD } from "../utils/textSimilarity";
import type { RawOpportunity } from "../models/opportunity.model";

// المستوى 1 و2 — تحديد معرف المستند نفسه. لو المصدر بيدّي sourceId، بنستخدمه
// (أدق)، وإلا بنرجع للرابط (زي النظام الحالي بالظبط).
export function computeDocumentId(connectorId: string, item: RawOpportunity): string {
  if (item.sourceId && item.sourceId.trim()) {
    return idFromSourceId(connectorId, item.sourceId.trim());
  }
  return idFromUrl(item.applyUrl);
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  organization: string;
  deadline?: string;
}

// المستوى 3 — تكرار محتمل بين مصادر مختلفة. بيرجّع الـid بتاع أقرب فرصة
// مشابهة (لو فيه)، عشان تتحط علامة possibleDuplicateOf بدل الحذف الآلي
// (قرار واعي موثّق في الـArchitecture، قسم 5).
export function findPossibleDuplicate(
  item: RawOpportunity,
  candidates: DuplicateCandidate[]
): string | null {
  for (const candidate of candidates) {
    const titleSim = textSimilarity(item.title, candidate.title);
    if (titleSim < TITLE_SIMILARITY_THRESHOLD) continue;

    const sameOrg = textSimilarity(item.organization, candidate.organization) > 0.5;
    const sameDeadline = deadlinesClose(item.deadline, candidate.deadline);
    if (sameOrg || sameDeadline) {
      return candidate.id;
    }
  }
  return null;
}

function deadlinesClose(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  return Math.abs(ta - tb) <= threeDaysMs;
}
