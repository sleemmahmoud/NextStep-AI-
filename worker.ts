// نسخة Deno Deploy من نفس البروكسي بتاع Cloudflare — بديل مجاني تمامًا وبدون
// بطاقة بنكية خالص. الكود بنفس المنطق بالظبط (CORS + حد يومي لكل UID + تمرير
// لـGemini)، بس بيستخدم Deno KV بدل Cloudflare KV (KV هنا جاهز تلقائيًا من غير
// أي إعداد إضافي في الداشبورد — ميزة أبسط من Cloudflare في النقطة دي بالظبط).
//
// ✨ إضافة جديدة: البحث التلقائي بقى يشتغل من هنا (Deno.cron) مرة كل يوم فعليًا
// من غير ما حد يفتح الداشبورد خالص، وبيكتب في Firestore مباشرة كـ"سيرفر" باستخدام
// Service Account — مش محتاج يوزر مسجل دخول زي المتصفح.

// غيّر الدومين ده لو موقعك على دومين تاني
const ALLOWED_ORIGIN = "https://sleemmahmoud.github.io";
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// رجّعناه لـgemini-3.5-flash: gemini-3.6-flash طلع مش شغال على الفري تير (باقي بيطلب فوترة)،
// أما 3.5 Flash فلسه رسميًا من موديلات الفري تير المجانية.
const GEMINI_MODEL = "gemini-3.5-flash";
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "nextstep-ai-bf090";
// لازم تفضل مطابقة تمامًا لمصفوفة TAGS في app.js
const TAGS = ["برمجة", "تصميم", "ريادة أعمال", "تسويق رقمي", "لغات", "علوم", "هندسة", "قيادة وتطوع", "فنون وإعلام", "أعمال وتمويل", "رياضة", "مهارات تواصل"];

const kv = await Deno.openKv();

// ============================================================
// الجزء الأول: البروكسي العادي (شات + بحث يدوي من الأدمن) — زي ما هو بالظبط
// ============================================================

// لازم يفضل مطابق تمامًا لمصفوفة ADMIN_EMAILS في app.js
const ADMIN_EMAILS = ["sleemmahmoud81@gmail.com", "nextstepai010@gmail.com", "mhmwdshhath468@gmail.com"];

// كل ميزة بتستخدم الـAI ليها عداد يومي منفصل تمامًا عن باقي الميزات، عشان
// ميزة زي "تصنيف الفرص القديمة" أو "تنظيف الفرص الوهمية" ما تاكلش من كوتا
// المساعد الذكي أو العكس. ده اللي كان بيخلي النظام مستقر زمان.
// - chat: المساعد الذكي (شات) — نفس الحد للمستخدم العادي والأدمن.
// - search: أدوات الأدمن اللي بتستخدم AI (البحث اليدوي عن فرص + تصنيف
//   الفرص القديمة تلقائيًا + كشف وحذف الفرص المكررة/الوهمية) — كلهم بيشتركوا
//   في نفس العداد ده عشان هما استخدام واحد منطقيًا (أدوات الأدمن)، لكنه
//   منفصل تمامًا عن عداد الشات.
// - cv: توليد الـCV (تصميم مميز + ATS مع بعض) — منفصل عن الشات والبحث.
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
  // الأدمن بيتعدّ بالإيميل نفسه (مش الـuid) عشان لو دخل من أكتر من جهاز يفضل نفس العداد
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

// بتزوّد العداد فعليًا — بنستدعيها بس بعد ما ريكوست Gemini يرجع بنجاح، عشان لو
// فشل الطلب (شبكة، خطأ من Google، إلخ) الكوتا ما تتاكلش من غير فايدة.
async function consumeQuota(key: Deno.KvKey, current: number) {
  // انتهاء صلاحية بعد 30 ساعة عشان المفتاح يختفي لوحده بعد ما اليوم يخلص
  await kv.set(key, current + 1, { expireIn: 1000 * 60 * 60 * 30 });
}

function quotaExceededResponse(message: string) {
  return new Response(JSON.stringify({ error: { message } }), {
    status: 429,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

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
// الجزء الثاني: أدوات التوثيق مع Google (Service Account) عشان الكتابة
// في Firestore من غير يوزر مسجل دخول — ده اللي بيخلي الـcron يشتغل لوحده
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

// بيرجع access token صالح للاستخدام مع Firestore REST API، وبيكاشه في الذاكرة
// عشان مايعملش JWT جديد مع كل ريكوست (التوكن صالح لمدة ساعة).
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

// ============================================================
// الجزء الثالث: تحويل JS objects لصيغة Firestore REST API
// ============================================================

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
  if (!res.ok) return false; // في شك، منمنعش الإضافة عشان نتيجة بحث ماتضيعش
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
// الجزء الرابع: منطق البحث نفسه (نفس البرومبت والفلاتر بتاعة app.js بالظبط)
// ============================================================

const AUTO_SEARCH_TOPICS = [
  "منح دراسية للطلاب المصريين",
  "تدريب صيفي للطلاب والخريجين الجدد",
  "فرص تطوع للشباب",
  "مسابقات ريادة أعمال وتكنولوجيا للطلاب",
  "كورسات مجانية معتمدة أونلاين",
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
  return `النهاردة تاريخ ${todayStr} (يعني إحنا في سنة ${currentYear}). استخدم بحث جوجل الحقيقي والحي دلوقتي (متعتمدش على معرفتك القديمة بس) عشان تلاقي أشهر وأهم الفرص **الحقيقية والمعروفة والمتكررة سنويًا** (بحد أقصى 15 فرصة) اللي مناسبة لموضوع: "${topic}"، وتستهدف طلاب أو خريجين مصريين أو فرص دولية متاحة لهم.
مهم جدًا: "فرصة" هنا معناها أي نوع من الآتي، مش بس منح أو تطوع: منح دراسية، تدريب، وظائف، تطوع، مسابقات، هاكاثونات، برامج تبادل، **كورسات مجانية أونلاين**، بوت كامب، **مؤتمرات وفعاليات**.
شروط أساسية ولازم تلتزم بيها بدقة، وده أهم جزء في المهمة:
- **افتح فعليًا (عن طريق البحث) صفحة كل فرصة قبل ما ترشحها، وتأكد إن التسجيل/التقديم لسه مفتوح فعلاً دلوقتي بتاريخ ${todayStr}.** لو لقيت إن باب التسجيل قفل، أو الدورة الحالية خلصت ولسه معلنش عن الدورة الجاية، **متضيفش الفرصة دي خالص** في النتيجة النهائية — حتى لو البرنامج نفسه مشهور ومعروف.
- **لازم تلاقي تاريخ deadline حقيقي ومحدد (YYYY-MM-DD) من المصدر نفسه.** لو مش لاقي تاريخ واضح ومؤكد لآخر موعد، **متضيفش الفرصة دي خالص** — ممنوع ترجع أي فرصة من غير تاريخ deadline حقيقي.
- رشّح بس برامج مستقرة ومعروفة إنها بتتكرر كل سنة. متختلقش اسم برنامج أو جهة مش متأكد من وجودها الحقيقي.
- الرابط لازم يكون رابط حقيقي من نتيجة البحث بتاعتك، مش رابط مخترع.
- لكل فرصة، صنّفها بدقة باستخدام: "tags" اختار من القايمة دي بالظبط: [${TAGS.map((t) => `"${t}"`).join(", ")}]، و"stageTags" اختار من ["middle","high","university","graduate"] (أو مصفوفة فاضية [] لو مناسبة لكل المراحل).
رجّع بس JSON array، من غير أي نص تاني قبله أو بعده، بالشكل ده بالظبط:
[{"title":"عنوان الفرصة","organization":"اسم الجهة","description":"وصف قصير من سطرين بالعربي","category":"scholarship أو internship أو job أو volunteering أو competition أو conference أو hackathon أو exchange أو course أو bootcamp أو event","deadline":"YYYY-MM-DD لازم تاريخ حقيقي ومؤكد","link":"رابط الموقع الرسمي المعروف للجهة","tags":["وسم1"],"stageTags":["university"]}]
لو مش متأكد إن الفرصة دي حقيقية وموجودة ومفتوحة فعلًا دلوقتي وليها تاريخ deadline مؤكد، متضيفهاش خالص. لو مفيش فرص مفتوحة كفاية رجّع [].`;
}

// deno-lint-ignore no-explicit-any
async function fetchOpportunitiesForTopic(topic: string): Promise<any[]> {
  const res = await callGemini({
    contents: [{ role: "user", parts: [{ text: buildPrompt(topic) }] }],
    tools: [{ google_search: {} }],
  });
  if (!res.ok) {
    console.error(`[auto-search] Gemini error for topic "${topic}": ${res.status}`);
    return [];
  }
  const data = await res.json();
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text || "").join("");
  const gm = cand?.groundingMetadata;
  // deno-lint-ignore no-explicit-any
  const sources = (gm?.groundingChunks ?? []).map((c: any) => c.web).filter(Boolean);
  // ملحوظة: uri الرجعة من groundingChunks بتكون رابط تحويل (redirect) بتاع
  // Google مش الدومين الحقيقي، فالاسم الحقيقي للمصدر موجود في title بس.
  const sourceHosts = [...new Set(sources.map((s: { title?: string }) => (s.title || "").toLowerCase().replace(/^www\./, "")).filter(Boolean))];
  const searchEntryHtml = gm?.searchEntryPoint?.renderedContent || "";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  // deno-lint-ignore no-explicit-any
  let items: any[];
  try {
    items = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  const today = new Date(new Date().toISOString().slice(0, 10));
  items = items.filter((it) => {
    if (!isValidLink(it.link)) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.deadline || "")) return false;
    return new Date(it.deadline) >= today;
  });
  if (sourceHosts.length) {
    items = items.filter((it) => {
      const h = hostnameOf(it.link);
      return h && sourceHosts.some((sh) => sh === h || sh.endsWith("." + h) || h.endsWith("." + sh));
    });
  }
  return items.map((it) => ({ ...it, __sources: sources, __searchEntryHtml: searchEntryHtml }));
}

// الدالة الرئيسية اللي بيشغّلها الـcron — بتلف على كل مواضيع الفرص، وبعدين
// وتتأكد إن كل فرصة مش موجودة قبل كده (عشان منكررش)، وتنشرها لايف في opportunities.
async function runAutoSearch() {
  console.log("[auto-search] بدأ التشغيل التلقائي اليومي...");
  let token: string;
  try {
    token = await getGoogleAccessToken();
  } catch (err) {
    console.error("[auto-search] فشل التوثيق مع Google:", err);
    return;
  }

  let added = 0, skipped = 0;
  for (const topic of AUTO_SEARCH_TOPICS) {
    const items = await fetchOpportunitiesForTopic(topic);
    for (const it of items) {
      try {
        if (isValidLink(it.link) && (await firestoreLinkExists(it.link, token, "opportunities"))) {
          skipped++;
          continue;
        }
        await createFirestoreDoc({
          title: it.title || "بدون عنوان",
          organization: it.organization || "",
          description: it.description || "",
          category: it.category || "event",
          deadline: it.deadline || "",
          link: it.link || "",
          tags: Array.isArray(it.tags) ? it.tags.filter((t: string) => TAGS.includes(t)) : [],
          stageTags: Array.isArray(it.stageTags) ? it.stageTags.filter((s: string) => ["middle", "high", "university", "graduate"].includes(s)) : [],
          requirements: [],
          reviewed: true,
          groundingSources: it.__sources || [],
          searchEntryPointHtml: it.__searchEntryHtml || "",
          createdAt: Date.now(),
        }, token, "opportunities");
        added++;
      } catch (err) {
        console.error(`[auto-search] فشل حفظ فرصة من موضوع "${topic}":`, err);
      }
    }
  }

  // بقينا مانضيفش كورسات بالـAI تلقائيًا في resources — المصادر التعليمية
  // بقت بيد الأدمن بس (فيديوهاته وملفاته وكورساته الخاصة)، فشلنا خطوة البحث
  // التلقائي عن الكورسات هنا خالص. لسه بندور تلقائيًا على الفرص بس.

  try {
    await updateAutoSearchMeta(token);
  } catch { /* مش مشكلة لو فشلت، دي بس عرض توضيحي في الداشبورد */ }
  console.log(`[auto-search] خلص. فرص: اتضاف ${added}، اتجاهل ${skipped} مكررة.`);
}

// جدولة التشغيل: كل يوم الساعة 1 صباحًا بتوقيت UTC (= 3 أو 4 فجرًا بتوقيت مصر
// حسب التوقيت الصيفي/الشتوي). غيّر الرقم الأول لو عايز معاد مختلف.
Deno.cron("auto search opportunities", "0 1 * * *", async () => {
  await runAutoSearch();
});

// ============================================================
// الجزء الخامس: الـHTTP handler العادي (البروكسي بتاع الشات والبحث اليدوي)
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
    const { uid, email, feature, ...geminiBody } = parsedBody;
    const quota = await checkQuota(uid, email, feature);
    if (quota.configError) {
      return new Response(JSON.stringify({ error: { message: quota.configError } }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!quota.allowed) {
      console.log(`[quota] رفض — feature=${quota.feat} id=${quota.idKey} استهلك ${quota.current}/${quota.limit}`);
      return quotaExceededResponse(`وصلت للحد اليومي لاستخدام الذكاء الاصطناعي (${quota.limit} طلب في اليوم لنفس الميزة)، هيتصفر تلقائيًا بكرة.`);
    }

    console.log(`[gemini] طلب جديد — feature=${quota.feat} id=${quota.idKey} (${quota.current}/${quota.limit} النهاردة)`);
    const googleRes = await callGemini(geminiBody);
    const data = await googleRes.text();
    if (googleRes.ok) {
      // بنزوّد العداد بس دلوقتي — بعد ما اتأكدنا إن Gemini فعلًا رد بنجاح
      await consumeQuota(quota.key!, quota.current!);
      return new Response(data, {
        status: googleRes.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    console.log(`[gemini] فشل — feature=${quota.feat} id=${quota.idKey} status=${googleRes.status} — الكوتا مش هتتخصم`);
    // 🔧 تشخيص مؤقت: بنحط علامة بناء ثابتة (BUILD-MARK-2026-07-23-A) جوه أي
    // خطأ راجع من Gemini، عشان لو نفس الخطأ ظهر تاني نقدر نتأكد فعليًا إن
    // الكود ده هو اللي شغال دلوقتي على Deno Deploy (لو العلامة مش ظاهرة يبقى
    // فيه نسخة تانية قديمة لسه شغالة). شيل السطر ده أول ما تتأكد وتصلح المشكلة.
    let markedData = data;
    try {
      const parsedErr = JSON.parse(data);
      parsedErr.__buildMark = "BUILD-MARK-2026-07-23-A";
      markedData = JSON.stringify(parsedErr);
    } catch { /* لو مش JSON قابل للتحليل، سيبها زي ما هي */ }
    return new Response(markedData, {
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
