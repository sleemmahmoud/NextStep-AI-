import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore, FieldValue } from "firebase-admin/firestore";
import { CONFIG, requireEnv } from "../config";
import { computeDocumentId, type DuplicateCandidate } from "./deduplicationService";
import type { OpportunityRecord, RawOpportunity } from "../models/opportunity.model";
import type { RunReport } from "../models/runReport.model";
import type { HealthState } from "../models/connector.model";
import type { Logger } from "../utils/logger";

let app: App | null = null;
let db: Firestore | null = null;

export function getDb(): Firestore {
  if (db) return db;
  if (!getApps().length) {
    const projectId = requireEnv("FIREBASE_PROJECT_ID");
    const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
    const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  db = getFirestore(app!);
  return db;
}

export interface UpsertResult {
  id: string;
  wasNew: boolean;
  possibleDuplicateOf?: string | null;
}

// بنطابق أسماء الحقول مع اللي الواجهة الحية (app.js) شغالة بيها فعليًا
// (link/reviewed بدل applyUrl/status) — نفس القرار الموثّق في ARCHITECTURE.md.
// الحقول الجديدة (eligibility, funding, sourceId, image, ...) بتتحط زيادة —
// الواجهة الحالية هتتجاهلها لحد ما تتطور تستخدمها، وده آمن (Firestore
// schema-less، مفيش أي كسر).
function toFirestorePayload(record: OpportunityRecord, wasNew: boolean, possibleDuplicateOf: string | null) {
  return {
    title: record.title,
    description: record.description,
    category: record.category,
    organization: record.organization,
    country: record.country || "",
    city: record.city || "",
    language: record.language || "",
    eligibility: record.eligibility || "",
    funding: record.funding || "",
    deadline: record.deadline || "غير معلن",
    applicationStart: record.applicationStart || "",
    image: record.image || "",
    link: record.applyUrl, // ← مطابقة اسم الحقل الحقيقي في الواجهة
    sourceUrl: record.sourceUrl || record.applyUrl,
    tags: record.tags || [],
    opportunityType: record.opportunityType || "",
    stageTags: [], // موجودة في الواجهة، فاضية هنا (المُجمِّع مش بيحدد المرحلة الدراسية)
    requirements: [],
    reviewed: true, // نفس اتفاقية "البحث التلقائي" الموجودة أصلًا
    source: record.source,
    sourceId: record.sourceId || "",
    status: record.status,
    verified: record.verified,
    featured: false, // الأدمن بس اللي يغيّرها يدويًا، مش النظام الآلي
    publishedAt: record.publishedAt,
    lastChecked: record.lastChecked,
    possibleDuplicateOf: possibleDuplicateOf || null,
    updatedAt: FieldValue.serverTimestamp(),
    ...(wasNew ? { createdAt: record.createdAt } : {}),
  };
}

export async function upsertOpportunity(
  record: OpportunityRecord,
  possibleDuplicateOf: string | null
): Promise<UpsertResult> {
  const database = getDb();
  const id = computeDocumentId(record.source, record);
  const ref = database.collection(CONFIG.OPPORTUNITIES_COLLECTION).doc(id);
  const existing = await ref.get();
  const wasNew = !existing.exists;

  const payload = toFirestorePayload(record, wasNew, possibleDuplicateOf);
  await ref.set(payload, { merge: true });
  return { id, wasNew, possibleDuplicateOf };
}

// بيجيب مجموعة محدودة من الفرص النشطة في نفس التصنيف، لمقارنتها بأي فرصة
// جديدة واكتشاف تكرار محتمل بين مصادر مختلفة (المستوى 3 في استراتيجية
// منع التكرار). محدود بـDEDUP_CANDIDATES_LIMIT عشان منعملش قراءة ضخمة.
export async function getDedupCandidates(category: string): Promise<DuplicateCandidate[]> {
  const database = getDb();
  const snap = await database
    .collection(CONFIG.OPPORTUNITIES_COLLECTION)
    .where("category", "==", category)
    .where("status", "==", "active")
    .limit(CONFIG.DEDUP_CANDIDATES_LIMIT)
    .get();
  return snap.docs.map((d: any) => {
    const data = d.data();
    return {
      id: d.id,
      title: String(data.title || ""),
      organization: String(data.organization || ""),
      deadline: data.deadline ? String(data.deadline) : undefined,
    };
  });
}

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
    if (deadlineTs === null) continue;
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

// ============================================================
// حالة كل Connector (Circuit Breaker + لوحة المراقبة) — قسم 7 و9 في الوثيقة
// ============================================================
export interface ConnectorHealthEntry {
  connectorId: string;
  lastRunAt: number;
  state: HealthState;
  consecutiveFailures: number;
  circuitOpenUntil: number | null;
  lastError?: string;
  lastDurationMs?: number;
}

export async function getConnectorHealth(connectorId: string): Promise<ConnectorHealthEntry | null> {
  const database = getDb();
  const snap = await database.doc(CONFIG.CONNECTOR_HEALTH_DOC).get();
  if (!snap.exists) return null;
  const all = (snap.data()?.connectors as Record<string, ConnectorHealthEntry>) || {};
  return all[connectorId] || null;
}

// بيتنده بعد كل تشغيلة لكل Connector — بيحدّث عدد الفشل المتتالي وبيقرر
// هل نقفل الدائرة القاطعة (Circuit Breaker) ولا لأ.
export async function updateConnectorHealth(
  connectorId: string,
  ok: boolean,
  durationMs: number,
  error?: string
): Promise<{ circuitOpen: boolean }> {
  const database = getDb();
  const ref = database.doc(CONFIG.CONNECTOR_HEALTH_DOC);
  const snap = await ref.get();
  const all = (snap.exists && (snap.data()?.connectors as Record<string, ConnectorHealthEntry>)) || {};
  const prev = all[connectorId];

  const consecutiveFailures = ok ? 0 : (prev?.consecutiveFailures || 0) + 1;
  const circuitShouldOpen = consecutiveFailures >= CONFIG.CIRCUIT_BREAKER_CONSECUTIVE_FAILURES;

  const entry: ConnectorHealthEntry = {
    connectorId,
    lastRunAt: Date.now(),
    state: circuitShouldOpen ? "circuit-open" : ok ? "ok" : "down",
    consecutiveFailures,
    circuitOpenUntil: circuitShouldOpen
      ? Date.now() + CONFIG.CIRCUIT_BREAKER_COOLDOWN_HOURS * 60 * 60 * 1000
      : null,
    lastError: error,
    lastDurationMs: durationMs,
  };

  await ref.set({ connectors: { ...all, [connectorId]: entry } }, { merge: true });
  return { circuitOpen: circuitShouldOpen };
}

// بيتنده قبل ما نشغّل أي Connector — لو الدائرة القاطعة مقفولة ولسه في
// فترة الانتظار، بنتخطاه تمامًا من غير ما نحاول أصلًا.
export async function isCircuitOpen(connectorId: string): Promise<boolean> {
  const health = await getConnectorHealth(connectorId);
  if (!health || !health.circuitOpenUntil) return false;
  return Date.now() < health.circuitOpenUntil;
}
