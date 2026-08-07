// Service Worker لموقع NextStep AI.
//
// الاستراتيجية (Sprint 6 — محسّنة):
// - طلبات التنقّل (Navigation، يعني فتح صفحة كاملة زي index.html): Network
//   أولًا (عشان المستخدم ياخد آخر نسخة لو النت شغال)، ولو فشل (أوفلاين)
//   يرجع لنسخة الكاش، ولو مفيش نسخة كاش خالص يورّي offline.html.
// - باقي الملفات الثابتة من نفس الدومين (app.js, style.css, الأيقونات):
//   Cache أولًا (أسرع تحميل)، وبيحدّث الكاش في الخلفية لو لقى نسخة أونلاين.
// - أي طلب لدومين تاني (Firebase, Firestore, Google Fonts, YouTube, CDN,
//   بروكسي الـAI...) بيعدي على النت العادي من غير أي تدخّل خالص.
//
// ملحوظة صيانة: زوّد CACHE_VERSION في كل مرة تغيّر فيها
// index.html/style.css/app.js عشان المستخدمين ياخدوا آخر نسخة.
const CACHE_VERSION = "nextstep-ai-v5";
const OFFLINE_URL = "./offline.html";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=4",
  "./boot.js?v=2",
  "./app.js?v=7",
  "./manifest.json?v=2",
  "./icon-192.png",
  "./icon-512.png",
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // بنحاول نكاش كل ملف لوحده (مش دفعة واحدة) عشان لو ملف واحد فشل
      // الباقي يتكاش عادي بدل ما التثبيت كله يفشل.
      return Promise.all(
        CORE_ASSETS.map((url) => cache.add(url).catch((err) => console.warn("SW: تعذّر كاش", url, err)))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // طلبات التنقّل (فتح صفحة كاملة) — Network-first مع fallback ذكي.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const cachedIndex = await caches.match("./index.html");
          if (cachedIndex) return cachedIndex;
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // باقي الملفات الثابتة — Cache-first (أسرع)، مع تحديث الكاش في الخلفية.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
