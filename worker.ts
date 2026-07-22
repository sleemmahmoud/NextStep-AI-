// نسخة Deno Deploy من نفس البروكسي بتاع Cloudflare — بديل مجاني تمامًا وبدون
// بطاقة بنكية خالص. الكود بنفس المنطق بالظبط (CORS + حد يومي لكل UID + تمرير
// لـGemini)، بس بيستخدم Deno KV بدل Cloudflare KV.

// غيّر الدومين ده لو موقعك على دومين تاني
const ALLOWED_ORIGIN = "https://sleemmahmoud.github.io";
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const GEMINI_MODEL = "gemini-3.5-flash";
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "nextstep-ai-bf090";
const TAGS = ["برمجة", "تصميم", "ريادة أعمال", "تسويق رقمي", "لغات", "علوم", "هندسة", "قيادة وتطوع", "فنون وإعلام", "أعمال وتمويل", "رياضة", "مهارات تواصل"];

const kv = await Deno.openKv();

// ============================================================
// الجزء الأول: إدارة الكوتا والصلاحيات
// ============================================================

const ADMIN_EMAILS = ["sleemmahmoud81@gmail.com", "nextstepai010@gmail.com", "mhmwdshhath468@gmail.com"];

const FEATURE_LIMITS: Record<string, { user: number; admin: number }> = {
  chat: { user: 5, admin: 5 },
  search: { user: 5, admin: 8 },
  cv: { user: 2, admin: 6 },
};
const DEFAULT_FEATURE = "chat";

interface QuotaCheckResult {
  allowed: boolean;
  configError?: string;
  limit?: number;
  feat?: string;
  idKey?: string;
  key?: Deno.KvKey;
  current?: number;
}

async function checkQuota(uid: string | undefined, email: string | undefined, feature: string | undefined): Promise<QuotaCheckResult> {
  const feat = (feature && FEATURE_LIMITS[feature]) ? feature : DEFAULT_FEATURE;
  const isAdminUser = !!(email && ADMIN_EMAILS.includes(email));
  const limit = isAdminUser ? FEATURE_LIMITS[feat].admin : FEATURE_LIMITS[feat].user;
  const idKey = isAdminUser ? `admin:${email}` : uid;
  
  if (!idKey) {
    return { allowed: false, configError: "الطلب وصل من غير uid — تأكد إن app.js بيبعت uid مع كل طلب." };
  }
  const today = new Date().toISOString().slice(0, 10);
  const key: Deno.KvKey = ["aiUsage", feat, idKey, today];
  const current = (await kv.get<number>(key)).value ?? 0;
  if (current >= limit) return { allowed: false, limit, feat, idKey, key, current };
  return { allowed: true, limit, feat, idKey, key, current };
}

async function consumeQuota(key: Deno.KvKey, current: number) {
  await kv.set(key, current + 1, { expireIn: 1000 * 60 * 60 * 30 });
}

function quotaExceededResponse(message: string) {
  return new Response(JSON.stringify({ error: { message } }), {
    status: 429,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// دالة الاتصال بـ Gemini بعد الحذف الصريح لأي حقول إضافية
async function callGemini(geminiBody: unknown) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey ?? "",
      },
      body: JSON.stringify(geminiBody),
    },
  );
  return res;
}

// ============================================================
// الجزء الثاني: التوثيق والتعامل مع Firestore (Service Account)
// ============================================================

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getGoogleAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.token;
  }
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY مش موجود في الـ Environment Variables.");
  const sa = JSON.parse(raw) as { client_email: string; private_key: string };

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const encHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encClaims = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${encHeader}.${encClaims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64url(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`فشل الحصول على access token: ${await tokenRes.text()}`);
  }
  const tokenData = await tokenRes.json();
  cachedToken = { token: tokenData.access_token, expiresAt: Date.now() + tokenData.expires_in * 1000 };
  return cachedToken.token;
}

// deno-lint-ignore no-explicit-any
function toFirestoreValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

// deno-lint-ignore no-explicit-any
function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj)) fields[k] = toFirestoreValue(val);
  return fields;
}

async function firestoreLinkExists(link: string, token: string, collectionId = "opportunities"): Promise<boolean> {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: "link" },
              op: "EQUAL",
              value: { stringValue: link },
            },
          },
          limit: 1,
        },
      }),
    },
  );
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data) && data.some((r: Record<string, unknown>) => r.document);
}

async function createFirestoreDoc(
  // deno-lint-ignore no-explicit-any
  fields: Record<string, any>,
  token: string,
  collectionId = "opportunities",
) {
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: toFirestoreFields(fields) }),
    },
  );
}

async function updateAutoSearchMeta(token: string) {
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/meta/autoSearch?updateMask.fieldPaths=lastRunAt`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: toFirestoreFields({ lastRunAt: Date.now() }) }),
    },
  );
}

// ============================================================
// الجزء الثالث: البحث التلقائي للفرص فقط
// ============================================================

const AUTO_SEARCH_TOPICS = [
  "منح دراسية للطلاب المصريين",
  "تدريب صيفي للطلاب والخريجين الجدد",
  "فرص تطوع للشباب",
  "مسابقات ريادة أعمال وتكنولوجيا للطلاب",
  "مؤتمرات دولية ومحلية للطلاب والشباب",
  "وظائف مبتدئين وحديثي التخرج",
  "بوت كامب تدريبي مكثف في التكنولوجيا",
  "برامج تبادل ثقافي وطلابي دولية",
];

function isValidLink(link: unknown): link is string {
  return typeof link === "string" && /^https?:\/\/.+/i.test(link.trim());
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function buildPrompt(topic: string): string {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  return `النهاردة تاريخ ${todayStr} (سنة ${currentYear}). استخدم بحث جوجل لتجد الفرص الحقيقية المناسبة لموضوع: "${topic}".
مهم: الفرص تشمل منح، تدريب، وظائف، تطوع، مسابقات، هاكاثونات، برامج تبادل.
المخرجات المطلوب إرجاعها فقط كـ JSON array بالشكل التالي:
[{"title":"عنوان الفرصة","organization":"اسم الجهة","description":"وصف قصير","category":"internship أو scholarship أو job أو volunteering","deadline":"YYYY-MM-DD","link":"رابط الموقع","tags":["برمجة"],"stageTags":["university"]}]`;
}

// deno-lint-ignore no-explicit-any
async function fetchOpportunitiesForTopic(topic: string): Promise<any[]> {
  const res = await callGemini({
    contents: [{ role: "user", parts: [{ text: buildPrompt(topic) }] }],
    tools: [{ google_search: {} }],
  });
  if (!res.ok) return [];
  const data = await res.json();
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text || "").join("");
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

async function runAutoSearch() {
  console.log("[auto-search] بدء تشغيل التحديث التلقائي للفرص...");
  let token: string;
  try {
    token = await getGoogleAccessToken();
  } catch (err) {
    console.error("[auto-search] فشل التوثيق:", err);
    return;
  }

  for (const topic of AUTO_SEARCH_TOPICS) {
    const items = await fetchOpportunitiesForTopic(topic);
    for (const it of items) {
      try {
        if (isValidLink(it.link) && !(await firestoreLinkExists(it.link, token, "opportunities"))) {
          await createFirestoreDoc({
            title: it.title || "بدون عنوان",
            organization: it.organization || "",
            description: it.description || "",
            category: it.category || "event",
            deadline: it.deadline || "",
            link: it.link || "",
            tags: Array.isArray(it.tags) ? it.tags.filter((t: string) => TAGS.includes(t)) : [],
            stageTags: Array.isArray(it.stageTags) ? it.stageTags.filter((s: string) => ["middle", "high", "university", "graduate"].includes(s)) : [],
            reviewed: true,
            createdAt: Date.now(),
          }, token, "opportunities");
        }
      } catch (err) {
        console.error(`[auto-search] خطأ في حفظ الفرصة:`, err);
      }
    }
  }

  try { await updateAutoSearchMeta(token); } catch { /* ignore */ }
}

Deno.cron("auto search opportunities", "0 1 * * *", async () => {
  await runAutoSearch();
});

// ============================================================
// الجزء الرابع: الـ HTTP Server (المستقبل للطلبات)
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    const parsedBody = await req.json();
    
    // الحل المباشر للمشكلة: استخراج الحقول الإضافية وفصل geminiBody تماماً
    const { uid, email, feature, ...geminiBody } = parsedBody;

    const quota = await checkQuota(uid, email, feature);
    if (quota.configError) {
      return new Response(JSON.stringify({ error: { message: quota.configError } }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!quota.allowed) {
      return quotaExceededResponse(`وصلت للحد اليومي لاستخدام الذكاء الاصطناعي (${quota.limit} طلب اليوم).`);
    }

    // إرسال البيانات النظيفة فقط (geminiBody) لـ Gemini
    const googleRes = await callGemini(geminiBody);
    const data = await googleRes.text();

    if (googleRes.ok) {
      await consumeQuota(quota.key!, quota.current!);
    }

    return new Response(data, {
      status: googleRes.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "proxy_error", message: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
