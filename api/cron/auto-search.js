// ============================================================
// /api/cron/auto-search — البحث التلقائي اليومي عن فرص جديدة، بيتشغّل عن
// طريق Vercel Cron Jobs (متعرّف في vercel.json) بدل Cloudflare Cron Trigger.
// بيستخدم Firebase Admin SDK مباشرة للكتابة في Firestore — من غير أي JWT
// signing يدوي أو REST calls زي ما كان في نسخة الـCloudflare Worker القديمة.
// ============================================================
const { getFirebaseAdmin } = require("../_lib/firebaseAdmin");
const { callGemini, TAGS } = require("../_lib/gemini");

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

const MAX_ITEMS_PER_TOPIC = 5;

function isValidLink(link) {
  return typeof link === "string" && /^https?:\/\/.+/i.test(link.trim());
}
function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function buildPrompt(topic) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  return `النهاردة تاريخ ${todayStr} (يعني إحنا في سنة ${currentYear}). استخدم بحث جوجل الحقيقي والحي دلوقتي (متعتمدش على معرفتك القديمة بس) عشان تلاقي أشهر وأهم الفرص **الحقيقية والمعروفة والمتكررة سنويًا** (بحد أقصى ${MAX_ITEMS_PER_TOPIC} فرص) اللي مناسبة لموضوع: "${topic}"، وتستهدف طلاب أو خريجين مصريين أو فرص دولية متاحة لهم.
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

async function fetchOpportunitiesForTopic(topic) {
  const { res, text: rawText } = await callGemini({
    contents: [{ role: "user", parts: [{ text: buildPrompt(topic) }] }],
    tools: [{ google_search: {} }],
  });
  if (!res.ok) {
    console.error(`[auto-search] فشل الموضوع "${topic}" — تفاصيل الخطأ الكاملة في اللوج اللي فوق (سطر [gemini][ERROR]).`);
    return [];
  }
  const data = JSON.parse(rawText);
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text || "").join("");
  const gm = cand?.groundingMetadata;
  const sources = (gm?.groundingChunks ?? []).map((c) => c.web).filter(Boolean);
  const sourceHosts = [...new Set(sources.map((s) => (s.title || "").toLowerCase().replace(/^www\./, "")).filter(Boolean))];
  const searchEntryHtml = gm?.searchEntryPoint?.renderedContent || "";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  let items;
  try { items = JSON.parse(jsonMatch[0]); } catch { return []; }

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
  items = items.slice(0, MAX_ITEMS_PER_TOPIC);
  return items.map((it) => ({ ...it, __sources: sources, __searchEntryHtml: searchEntryHtml }));
}

const { createHash } = require("node:crypto");
// نفس منطق الـID بالظبط اللي نظام الـGitHub Actions الجديد (aggregator/)
// بيستخدمه — عشان لو الاتنين لقوا نفس الرابط، يتحطوا في نفس المستند
// (تحديث بدل تكرار)، بدل ما كل نظام يستخدم ID مختلف ويطلع نسختين من نفس
// الفرصة في الـcollection.
// ⚠️ الدالة دي موجودة كمان (بنفس المنطق بالظبط) في aggregator/src/firestoreClient.ts
// — مش نسيان، الاتنين مشروعين منفصلين بتوليتشين مختلف (Vercel serverless plain
// JS هنا، مقابل TypeScript project منفصل بالكامل هناك) فمافيش طريقة عملية
// تشاركهم نفس الملف من غير تعقيد زيادة عن الفايدة. لو غيّرت المنطق هنا، لازم
// تغيّره هناك بالظبط برضه (راجع MAINTENANCE.md).
function stableIdFor(link) {
  const normalized = String(link).trim().toLowerCase().replace(/\/+$/, "");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 40);
}

async function runAutoSearch() {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  console.log("[auto-search] بدأ التشغيل التلقائي اليومي...");

  let added = 0, skipped = 0;
  for (const topic of AUTO_SEARCH_TOPICS) {
    const items = await fetchOpportunitiesForTopic(topic);
    await new Promise((r) => setTimeout(r, 5000));
    for (const it of items) {
      try {
        if (!isValidLink(it.link)) { skipped++; continue; }
        const id = stableIdFor(it.link);
        const ref = db.collection("opportunities").doc(id);
        const existing = await ref.get();
        if (existing.exists) { skipped++; continue; }
        await ref.set({
          title: it.title || "بدون عنوان",
          organization: it.organization || "",
          description: it.description || "",
          category: it.category || "event",
          deadline: it.deadline || "",
          link: it.link || "",
          tags: Array.isArray(it.tags) ? it.tags.filter((t) => TAGS.includes(t)) : [],
          stageTags: Array.isArray(it.stageTags) ? it.stageTags.filter((s) => ["middle", "high", "university", "graduate"].includes(s)) : [],
          requirements: [],
          reviewed: true,
          groundingSources: it.__sources || [],
          searchEntryPointHtml: it.__searchEntryHtml || "",
          createdAt: Date.now(),
        });
        added++;
      } catch (err) {
        console.error(`[auto-search] فشل حفظ فرصة من موضوع "${topic}":`, err);
      }
    }
  }

  try {
    await db.collection("meta").doc("autoSearch").set({ lastRunAt: Date.now() }, { merge: true });
  } catch { /* مش مشكلة لو فشلت، دي بس عرض توضيحي في الداشبورد */ }
  console.log(`[auto-search] خلص. فرص: اتضاف ${added}، اتجاهل ${skipped} مكررة.`);
  return { added, skipped };
}

module.exports = async (req, res) => {
  // حماية بسيطة: لو حاطط CRON_SECRET في متغيرات البيئة، بنتأكد إن الطلب
  // جاي فعلاً من Vercel Cron (بيبعت نفس القيمة في Authorization header
  // تلقائيًا) مش من حد بيجرب يشغّل البحث يدويًا ويستهلك الكوتا الحقيقية.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
  } else {
    console.warn("[auto-search] تحذير: CRON_SECRET مش متظبط في Environment Variables — أي حد عارف رابط الـendpoint ده يقدر يشغّله يدويًا ويستهلك كوتا Gemini. يفضّل تضيفه.");
  }

  try {
    const result = await runAutoSearch();
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/cron/auto-search] fatal error:", err);
    res.status(500).json({ ok: false, error: String(err && err.message || err) });
  }
};
