// Service Worker لموقع NextStep AI — بيكاش الملفات الأساسية بس (الصفحة، الستايل،
// الكود، اللوجو) عشان الموقع يشتغل أوفلاين ويتثبّت كـPWA. أي طلب تاني (Firebase،
// Firestore، يوتيوب، أي CDN، البروكسي بتاع الـAI...) بيعدي على النت العادي من
// غير أي تدخّل خالص — عشان منكسرش أي ميزة شغالة حاليًا.
//
// ملحوظة صيانة: زوّد CACHE_VERSION في كل مرة تغيّر فيها index.html/style.css/app.js
// عشان المستخدمين يستلموا النسخة الجديدة بدل ما يفضلوا شغالين بالكاش القديم.
const CACHE_VERSION = "nextstep-ai-v3";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=4",
  "./boot.js?v=1",
  "./app.js?v=5",
  "./manifest.json?v=2",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // بنحاول نكاش كل ملف لوحده (مش دفعة واحدة) عشان لو ملف واحد فشل (مثلاً
      // النت مقطوع وقت التثبيت) الباقي يتكاش عادي بدل ما التثبيت كله يفشل.
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
  // بس GET، وبس نفس الدومين (same-origin) — أي حاجة تانية (Firebase, Firestore,
  // Google Fonts, YouTube, jsPDF/html2canvas CDN, بروكسي الـAI, QR service...)
  // بتعدي على النت العادي من غير أي كاش أو تدخّل خالص.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // بنكاش أي ملف ثابت جديد من نفس الدومين تلقائيًا (زي صور تتضاف بعدين)
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached); // أوفلاين ومفيش نسخة كاش — هنا مش هيلاقي حاجة يرجعها، وده مقبول لملفات مش أساسية
    })
  );
});
