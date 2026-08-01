import { Logger } from "./logger";
import { withRetry } from "./retry";
import { getEnabledSources, JSON_API_SOURCES } from "./sources";
import { fetchRssSource } from "./fetchers/fetchRss";
import { fetchJsonApiSource } from "./fetchers/fetchJsonApi";
import { validateRawOpportunity } from "./validate";
import { classifyOpportunity } from "./classify";
import { upsertOpportunity, markExpiredOpportunities, writeRunReport } from "./firestoreClient";
import type { OpportunitySource, RawOpportunity, RunReport, SourceResult, OpportunityRecord } from "./types";

async function fetchFromSource(source: OpportunitySource, logger: Logger): Promise<RawOpportunity[]> {
  if (source.kind === "rss") {
    return fetchRssSource(source);
  }
  const jsonDef = JSON_API_SOURCES.find((d) => d.source.id === source.id);
  if (!jsonDef) {
    throw new Error(`مفيش mapItem معرّف للمصدر ${source.id} (json-api لازم يكون ليه واحد في sources.ts)`);
  }
  return fetchJsonApiSource(jsonDef.source, jsonDef.arrayPath, jsonDef.mapItem);
}

async function processSource(source: OpportunitySource, logger: Logger): Promise<SourceResult> {
  const result: SourceResult = {
    sourceId: source.id,
    ok: false,
    itemsFetched: 0,
    itemsNew: 0,
    itemsUpdated: 0,
    itemsRejected: 0,
    attempts: 0,
  };

  try {
    const rawItems = await withRetry(() => fetchFromSource(source, logger), {
      label: `fetch:${source.id}`,
      logger,
    });
    result.itemsFetched = rawItems.length;
    result.ok = true;

    for (const raw of rawItems) {
      const validation = validateRawOpportunity(raw);
      if (!validation.valid) {
        result.itemsRejected++;
        logger.warn(`[${source.id}] فرصة اترفضت: ${validation.reason}`, { title: raw.title });
        continue;
      }

      const now = Date.now();
      const record: OpportunityRecord = {
        title: raw.title.trim(),
        description: raw.description.trim(),
        category: classifyOpportunity(raw),
        organization: raw.organization.trim(),
        country: raw.country?.trim() || "",
        deadline: raw.deadline?.trim() || "",
        source: source.name,
        applyUrl: raw.applyUrl.trim(),
        tags: raw.tags || [],
        status: "active",
        publishedAt: raw.publishedAt ?? null,
        createdAt: now,
        updatedAt: now,
      };

      try {
        const { wasNew } = await upsertOpportunity(record);
        if (wasNew) result.itemsNew++;
        else result.itemsUpdated++;
      } catch (err) {
        result.itemsRejected++;
        logger.error(`[${source.id}] فشل حفظ فرصة في Firestore`, {
          title: record.title,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    result.ok = false;
    result.error = err instanceof Error ? err.message : String(err);
    logger.error(`[${source.id}] المصدر فشل تمامًا بعد كل المحاولات — بننتقل للمصدر اللي بعده`, {
      error: result.error,
    });
  }

  return result;
}

export async function runAggregator(
  triggeredBy: RunReport["triggeredBy"] = "schedule"
): Promise<RunReport> {
  const logger = new Logger();
  const startedAt = Date.now();
  const sources = getEnabledSources();

  logger.info(`بدء التشغيل — عدد المصادر المفعّلة: ${sources.length}`, { triggeredBy });

  // Promise.allSettled بدل Promise.all عمدًا: فشل مصدر واحد ميوقفش تنفيذ
  // باقي المصادر خالص (متطلب صريح: "لا توقف العملية بالكامل").
  const settled = await Promise.allSettled(sources.map((s) => processSource(s, logger)));
  const perSource: SourceResult[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          sourceId: sources[i].id,
          ok: false,
          itemsFetched: 0,
          itemsNew: 0,
          itemsUpdated: 0,
          itemsRejected: 0,
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
    sourcesChecked: perSource.length,
    sourcesFailed: perSource.filter((r) => !r.ok).length,
    totalFetched: sum(perSource, "itemsFetched"),
    totalNew: sum(perSource, "itemsNew"),
    totalUpdated: sum(perSource, "itemsUpdated"),
    totalRejected: sum(perSource, "itemsRejected"),
    totalErrors: perSource.filter((r) => !r.ok).length,
    expiredMarked,
    perSource,
    triggeredBy,
  };

  logger.info("انتهى التشغيل", report);
  await writeRunReport(report);
  return report;
}

function sum(list: SourceResult[], key: keyof SourceResult): number {
  return list.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
}

// بيسمح نشغّل الملف مباشرة (node dist/run.js) من الـGitHub Actions workflow.
if (require.main === module) {
  const triggeredBy = (process.env.TRIGGERED_BY as RunReport["triggeredBy"]) || "schedule";
  runAggregator(triggeredBy)
    .then((report) => {
      console.log(`✅ تم — فرص جديدة: ${report.totalNew}, محدّثة: ${report.totalUpdated}, أخطاء مصادر: ${report.totalErrors}`);
      process.exit(report.sourcesFailed === report.sourcesChecked && report.sourcesChecked > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("❌ فشل التشغيل بالكامل (خطأ غير متوقع):", err);
      process.exit(1);
    });
}
