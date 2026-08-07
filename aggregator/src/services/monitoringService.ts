import { updateConnectorHealth, isCircuitOpen } from "./firestoreService";
import type { ConnectorResult } from "../models/runReport.model";

// بعد ما أي Connector يخلص (نجح أو فشل)، بننده الدالة دي عشان تحدّث حالته
// في meta/connectorHealth وتقرر هل الدائرة القاطعة (Circuit Breaker) تتقفل.
export async function reportConnectorRun(
  connectorId: string,
  result: Pick<ConnectorResult, "ok" | "error">,
  durationMs: number
): Promise<{ circuitOpen: boolean }> {
  return updateConnectorHealth(connectorId, result.ok, durationMs, result.error);
}

// بيتنده قبل تشغيل أي Connector — لو true، الـConnector يتخطى تمامًا
// (مسجّل كـ"معطّل مؤقتًا" في التقرير، من غير أي محاولة فعلية).
export async function shouldSkipDueToCircuitBreaker(connectorId: string): Promise<boolean> {
  return isCircuitOpen(connectorId);
}
