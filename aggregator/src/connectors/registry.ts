import type { IConnector } from "../models/connector.model";
import { grantsGovConnector } from "./grantsGov.connector";
import { reliefWebJobsConnector, reliefWebTrainingConnector } from "./reliefWeb.connector";
import { usaJobsConnector } from "./usaJobs.connector";
// EU Funding & Tenders اتستبعد — راجع FINAL_SOURCES_REPORT.md للسبب
// (آلية الاشتراك الفعلية محتاجة تسجيل دخول EU Login، مش RSS عام).

// ⭐ الملف الوحيد اللي تعدّله لإضافة أو تعطيل مصدر.
export const CONNECTORS: IConnector[] = [
  grantsGovConnector,
  reliefWebJobsConnector,
  reliefWebTrainingConnector,
  usaJobsConnector,
];

export function getEnabledConnectors(): IConnector[] {
  return CONNECTORS.filter((c) => c.enabled);
}
