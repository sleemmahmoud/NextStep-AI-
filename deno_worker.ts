// نسخة Deno Deploy من نفس البروكسي بتاع Cloudflare — بديل مجاني تمامًا وبدون
// بطاقة بنكية خالص. الكود بنفس المنطق بالظبط (CORS + حد يومي لكل UID + تمرير
// لـGemini)، بس بيستخدم Deno KV بدل Cloudflare KV (KV هنا جاهز تلقائيًا من غير
// أي إعداد إضافي في الداشبورد — ميزة أبسط من Cloudflare في النقطة دي بالظبط).

// غيّر الدومين ده لو موقعك على دومين تاني
const ALLOWED_ORIGIN = "https://sleemmahmoud.github.io";
const CORS_HEADERS: Record<string,string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DAILY_LIMIT = 8; // نفس الرقم المستخدم في app.js، غيّرهم مع بعض

const kv = await Deno.openKv();

async function checkAndConsumeQuota(uid: string | undefined) {
  if (!uid) {
    return { allowed: false, configError: "الطلب وصل من غير uid — تأكد إن app.js بيبعت uid مع كل طلب." };
  }
  const today = new Date().toISOString().slice(0, 10);
  const key = ["aiUsage", uid, today];
  const current = (await kv.get<number>(key)).value ?? 0;
  if (current >= DAILY_LIMIT) return { allowed: false };
  // انتهاء صلاحية بعد 30 ساعة عشان المفتاح يختفي لوحده بعد ما اليوم يخلص
  await kv.set(key, current + 1, { expireIn: 1000 * 60 * 60 * 30 });
  return { allowed: true };
}

function quotaExceededResponse(message: string) {
  return new Response(JSON.stringify({ error: { message } }), {
    status: 429,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    const parsedBody = await req.json();
    const { uid, ...geminiBody } = parsedBody;
    const quota = await checkAndConsumeQuota(uid);
    if (quota.configError) {
      return new Response(JSON.stringify({ error: { message: quota.configError } }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!quota.allowed) {
      return quotaExceededResponse(`وصلت للحد اليومي لاستخدام الذكاء الاصطناعي (${DAILY_LIMIT} طلب في اليوم)، هيتصفر تلقائيًا بكرة.`);
    }

    const model = "gemini-3.5-flash";
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const googleRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // المفتاح ده بياخده الكود من الـEnvironment Variables في داشبورد Deno
          // Deploy، مش مكتوب في الكود خالص — عشان محدش يقدر يشوفه
          "x-goog-api-key": apiKey ?? "",
        },
        body: JSON.stringify(geminiBody),
      }
    );
    const data = await googleRes.text();
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
