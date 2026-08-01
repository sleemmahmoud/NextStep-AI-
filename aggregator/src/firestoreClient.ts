import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { CONFIG, requireEnv } from "./config";
import type { OpportunityRecord, RunReport } from "./types";
import type { Logger } from "./logger";

let app: App | null = null;
let db: Firestore | null = null;

// بيتحقق من Service Account مرة واحدة بس (Singleton) — الطريقة القياسية
// لتشغيل firebase-admin برة بيئة Google Cloud (GitHub Actions هنا).
export function getDb(): Firestore {
  if (db) return db;
  if (!getApps().length) {
    const projectId = requireEnv("FIREBASE_PROJECT_ID");
    const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
    // الـprivate key بييجي من GitHub Secret كنص فيه \n حرفية (literal) —
    // لازم نحوّلها لسطور حقيقية وإلا firebase-admin هيرفض المفتاح.
    const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  db = getFirestore(app!);
  return db;
}

// معرف المستند = hash ثابت من applyUrl. ده هو نظام "منع التكرار" نفسه: مفيش
// حاجة لعمل query نقارن بيها قبل الحفظ — set(...,{merge:true}) بمعرف ثابت
// يعني تلقائيًا "لو موجودة حدّثها، لو مش موجودة أنشئها"، من غير أي قراءة
// إضافية قبلها (أرخص وأسرع من query-then-compare، وده كمان إجابة سؤال
// الـCache: مش محتاجين طبقة Cache منفصلة لإن التصميم نفسه بيلغي الحاجة لقراءة
// مسبقة).
export function stableIdFor(applyUrl: string): string {
  const normalized = applyUrl.trim().toLowerCase().replace(/\/+$/, "");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 40);
}

export interface UpsertResult {
  id: string;
  wasNew: boolean;
}

export async function upsertOpportunity(record: OpportunityRecord): Promise<UpsertResult> {
  const database = getDb();
  const id = stableIdFor(record.applyUrl);
  const ref = database.collection(CONFIG.OPPORTUNITIES_COLLECTION).doc(id);
  const existing = await ref.get();
  const wasNew = !existing.exists;

  // بنطابق أسماء الحقول بالظبط مع اللي الواجهة الحية (app.js) شغالة بيها
  // فعليًا — مش الأسماء المطلوبة حرفيًا في الوصف (applyUrl/status)، عشان
  // منكسرش أي حاجة موجودة (الواجهة بتقرا o.link و o.reviewed، مش
  // o.applyUrl/o.status). راجع الملاحظة في types.ts لتفاصيل السبب.
  const payload = {
    title: record.title,
    description: record.description,
    category: record.category,
    organization: record.organization,
    country: record.country || "",
    deadline: record.deadline || "غير معلن",
    link: record.applyUrl, // ← مطابقة اسم الحقل الحقيقي في الواجهة
    tags: record.tags || [],
    stageTags: [], // موجودة في الواجهة، فاضية هنا (المُجمِّع مش بيحدد المرحلة الدراسية)
    requirements: [],
    reviewed: true, // نفس اتفاقية ميزة "البحث التلقائي" الموجودة أصلًا في الكود
    source: record.source,
    status: record.status,
    publishedAt: record.publishedAt,
    updatedAt: FieldValue.serverTimestamp(),
    ...(wasNew ? { createdAt: record.createdAt } : {}),
  };

  await ref.set(payload, { merge: true });
  return { id, wasNew };
}

// بيدوّر على الفرص اللي فات ميعادها ويحطها status:"expired" بدل ما يمسحها
// (أأمن — ممكن ترجعها لو التاريخ كان غلط من المصدر). الواجهة الحالية أصلًا
// بتفلتر بالـdeadline نفسه (isOppStillValid)، فالـstatus ده تصنيف داخلي
// إضافي للمتابعة/التقارير، مش شرط لإخفائها في الواجهة (الإخفاء الفعلي بيحصل
// أصلًا من منطق الواجهة الحالي).
export async function markExpiredOpportunities(logger: Logger): Promise<number> {
  const database = getDb();
  const snap = await database
    .collection(CONFIG.OPPORTUNITIES_COLLECTION)
    .where("status", "==", "active")
    .limit(CONFIG.EXPIRE_SCAN_LIMIT)
    .get();

  const graceMs = CONFIG.EXPIRE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let batch = database.batch();
  let pending = 0;
  let expiredCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const deadlineTs = parseDeadline(data.deadline);
    if (deadlineTs === null) continue; // تاريخ مش مفهوم — بنسيبها زي ما هي، أأمن من إخفاء غلط
    if (now - deadlineTs > graceMs) {
      batch.update(docSnap.ref, { status: "expired", updatedAt: FieldValue.serverTimestamp() });
      pending++;
      expiredCount++;
      if (pending >= 400) {
        await batch.commit();
        batch = database.batch();
        pending = 0;
      }
    }
  }
  if (pending > 0) await batch.commit();
  logger.info("انتهت مراجعة الفرص المنتهية", { expiredCount });
  return expiredCount;
}

function parseDeadline(deadline: unknown): number | null {
  if (typeof deadline !== "string" || !deadline.trim()) return null;
  const ts = Date.parse(deadline);
  return Number.isFinite(ts) ? ts : null;
}

export async function writeRunReport(report: RunReport): Promise<void> {
  const database = getDb();
  const lastRunRef = database.doc(CONFIG.LAST_RUN_DOC);
  await lastRunRef.set(report, { merge: false });

  const historyRef = database.doc(CONFIG.RUN_HISTORY_DOC);
  const historySnap = await historyRef.get();
  const prevRuns: RunReport[] = (historySnap.exists && (historySnap.data()?.runs as RunReport[])) || [];
  const nextRuns = [report, ...prevRuns].slice(0, CONFIG.RUN_HISTORY_MAX_ENTRIES);
  await historyRef.set({ runs: nextRuns }, { merge: false });
}
