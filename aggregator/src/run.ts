import { Logger } from "./utils/logger";
import { withRetry } from "./utils/retry";
import { getEnabledConnectors } from "./connectors/registry";
import { validateOpportunity } from "./services/validationService";
import { normalizeOpportunity } from "./services/normalizationService";
import { enrichOpportunity } from "./services/enrichmentService";
import { findPossibleDuplicate } from "./services/deduplicationService";
import {
  upsertOpportunity,
  markExpiredOpportunities,
  writeRunReport,
  getDedupCandidates,
} from "./services/firestoreService";
import { reportConnectorRun, shouldSkipDueToCircuitBreaker } from "./services/monitoringService";
import type { IConnector } from "./models/connector.model";
import type { ConnectorResult, RunReport } from "./models/runReport.model";
import type { OpportunityRecord } from "./models/opportunity.model";

async function processConnector(connector: IConnector, logger: Logger): Promise<ConnectorResult> {
  const startedAt = Date.now();
  const result: ConnectorResult = {
    connectorId: connector.id,
    ok: false,
    itemsFetched: 0,
    itemsNew: 0,
    itemsUpdated: 0,
    itemsRejected: 0,
    possibleDuplicates: 0,
    attempts: 0,
  };

  const skip = await shouldSkipDueToCircuitBreaker(connector.id).catch(() => false);
  if (skip) {
    result.circuitOpen = true;
    result.error = "معطّل مؤقتًا (Circuit Breaker) بسبب فشل متكرر في تشغيلات سابقة";
    logger.warn(`[${connector.id}] متخطّى — الدائرة القاطعة مقفولة`, {});
    return result;
  }

  try {
    const rawItems = await withRetry(() => connector.fetch(), { label: `fetch:${connector.id}`, logger });
    result.itemsFetched = rawItems.length;
    result.ok = true;

    const candidatesCache = new Map<string, Awaited<ReturnType<typeof getDedupCandidates>>>();

    for (const raw of rawItems) {
      const validation = connector.validate ? connector.validate(raw) : validateOpportunity(raw);
      if (!validation.valid) {
        result.itemsRejected++;
        logger.warn(`[${connector.id}] فرصة اترفضت: ${validation.reason}`, { title: raw.title });
        continue;
      }

      const normalized = normalizeOpportunity(raw);
      const enriched = enrichOpportunity(normalized, { connectorId: connector.id, isOfficialSource: true });

      if (!candidatesCache.has(enriched.category)) {
        const candidates = await getDedupCandidates(enriched.category).catch(() => []);
        candidatesCache.set(enriched.category, candidates);
      }
      const possibleDuplicateOf = findPossibleDuplicate(normalized, candidatesCache.get(enriched.category)!);
      if (possibleDuplicateOf) result.possibleDuplicates++;

      const now = Date.now();
      const record: OpportunityRecord = {
        ...enriched,
        source: connector.id,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      try {
        const { wasNew } = await upsertOpportunity(record, possibleDuplicateOf);
        if (wasNew) result.itemsNew++;
        else result.itemsUpdated++;
      } catch (err) {
        result.itemsRejected++;
        logger.error(`[${connector.id}] فشل حفظ فرصة في Firestore`, {
          title: record.title,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    result.ok = false;
    result.error = err instanceof Error ? err.message : String(err);
    logger.error(`[${connector.id}] المصدر فشل تمامًا بعد كل المحاولات — بننتقل للمصدر اللي بعده`, {
      error: result.error,
    });
  }

  const durationMs = Date.now() - startedAt;
  await reportConnectorRun(connector.id, { ok: result.ok, error: result.error }, durationMs).catch(() => {});
  return result;
}

export async function runAggregator(triggeredBy: RunReport["triggeredBy"] = "schedule"): Promise<RunReport> {
  const logger = new Logger();
  const startedAt = Date.now();
  const connectors = getEnabledConnectors();

  logger.info(`بدء التشغيل — عدد الـConnectors المفعّلة: ${connectors.length}`, { triggeredBy });

  const settled = await Promise.allSettled(connectors.map((c) => processConnector(c, logger)));
  const perConnector: ConnectorResult[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          connectorId: connectors[i].id,
          ok: false,
          itemsFetched: 0,
          itemsNew: 0,
          itemsUpdated: 0,
          itemsRejected: 0,
          possibleDuplicates: 0,
          attempts: 0,
          error: String(s.reason),
        }
  );

  const expiredMarked = await markExpiredOpportunities(logger).catch((err) => {
    logger.error("فشل فحص الفرص المنتهية", { error: err instanceof Error ? err.message : String(err) });
    return 0;
  });

  const finishedAt = Date.now();
  const report: RunReport = {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    connectorsChecked: perConnector.length,
    connectorsFailed: perConnector.filter((r) => !r.ok).length,
    totalFetched: sum(perConnector, "itemsFetched"),
    totalNew: sum(perConnector, "itemsNew"),
    totalUpdated: sum(perConnector, "itemsUpdated"),
    totalRejected: sum(perConnector, "itemsRejected"),
    totalPossibleDuplicates: sum(perConnector, "possibleDuplicates"),
    totalErrors: perConnector.filter((r) => !r.ok).length,
    expiredMarked,
    perConnector,
    triggeredBy,
  };

  logger.info("انتهى التشغيل", report);
  await writeRunReport(report);
  return report;
}

function sum(list: ConnectorResult[], key: keyof ConnectorResult): number {
  return list.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
}

if (require.main === module) {
  const triggeredBy = (process.env.TRIGGERED_BY as RunReport["triggeredBy"]) || "schedule";
  runAggregator(triggeredBy)
    .then((report) => {
      console.log(
        `✅ تم — فرص جديدة: ${report.totalNew}, محدَّثة: ${report.totalUpdated}, تكرار محتمل: ${report.totalPossibleDuplicates}, أخطاء مصادر: ${report.totalErrors}`
      );
      process.exit(report.connectorsFailed === report.connectorsChecked && report.connectorsChecked > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("❌ فشل التشغيل بالكامل (خطأ غير متوقع):", err);
      process.exit(1);
    });
}
