import type { OpportunitySource, RawOpportunity } from "../types";
import { withTimeout } from "../retry";
import { CONFIG } from "../config";

// كل API JSON شكل رده مختلف تمامًا عن التاني، فمفيش "شكل موحّد" ممكن نفرضه.
// كل مصدر من النوع ده لازم يجيب معاه mapItem() في sources.ts بتحوّل عنصر
// واحد خام من رد الـAPI لشكل RawOpportunity الموحّد بتاعنا.
export type JsonApiMapper = (rawItem: unknown, source: OpportunitySource) => RawOpportunity | null;

export interface JsonApiRequestOptions {
  method?: "GET" | "POST";
  body?: unknown; // بيتحوّل لـJSON.stringify تلقائيًا لو موجود
}

// المسار جوه الـJSON اللي فيه مصفوفة العناصر (زي "data.oppHits" أو
// "results")، بنوتاته بنقطة. لو مش موجود، بنفترض إن الرد نفسه هو المصفوفة.
export async function fetchJsonApiSource(
  source: OpportunitySource,
  arrayPath: string | null,
  mapItem: JsonApiMapper,
  requestOptions?: JsonApiRequestOptions
): Promise<RawOpportunity[]> {
  const method = requestOptions?.method || "GET";
  const init: RequestInit = { method };
  if (method === "POST") {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(requestOptions?.body ?? {});
  }
  const res = await withTimeout(fetch(source.url, init), CONFIG.FETCH_TIMEOUT_MS, source.id);
  if (!res.ok) {
    throw new Error(`JSON API fetch فشل (${source.id}): HTTP ${res.status}`);
  }
  const body = await res.json();
  const list = arrayPath ? getByPath(body, arrayPath) : body;
  if (!Array.isArray(list)) {
    throw new Error(`رد الـAPI مش مصفوفة زي المتوقع (arrayPath="${arrayPath}") — ${source.id}`);
  }
  const mapped: RawOpportunity[] = [];
  for (const raw of list) {
    const item = mapItem(raw, source);
    if (item) mapped.push(item);
  }
  return mapped;
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
