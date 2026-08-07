export interface ConnectorResult {
  connectorId: string;
  ok: boolean;
  itemsFetched: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsRejected: number;
  possibleDuplicates: number; // تكرار محتمل بين مصادر مختلفة (قسم 5 في الوثيقة) — يتحط علامة، مش يتحذف
  attempts: number;
  error?: string;
  circuitOpen?: boolean; // true لو اتقفل مؤقتًا بسبب فشل متكرر عبر عدة تشغيلات
}

export interface RunReport {
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  connectorsChecked: number;
  connectorsFailed: number;
  totalFetched: number;
  totalNew: number;
  totalUpdated: number;
  totalRejected: number;
  totalPossibleDuplicates: number;
  totalErrors: number;
  expiredMarked: number;
  perConnector: ConnectorResult[];
  triggeredBy: "schedule" | "manual" | "workflow_dispatch";
}
