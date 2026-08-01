# ARCHITECTURE.md — هيكل مشروع NextStep AI

## نظرة عامة على المكونات

```
┌─────────────────────┐      ┌──────────────────────┐      ┌────────────────────┐
│  المتصفح (Client)    │      │  Vercel Serverless    │      │  Firebase           │
│  index.html + app.js │ ───▶ │  api/*.js             │ ───▶ │  Auth + Firestore   │
│  (SPA وحدة ملف واحد، │      │  (Node, بلا Build)     │      │                     │
│   لا React ولا Next) │ ◀─── │                        │ ◀─── │                     │
└─────────────────────┘      └──────────────────────┘      └────────────────────┘
                                                                       ▲
                                                                       │ (Firebase Admin SDK)
                                                              ┌────────┴─────────┐
                                                              │ GitHub Actions    │
                                                              │ aggregator/ (TS)  │
                                                              │ يومي + يدوي       │
                                                              └───────────────────┘
```

المشروع **مش** Next.js فعليًا رغم أي إشارة سابقة لكذا — هو صفحة واحدة ثابتة (`index.html`) + ملف JavaScript واحد كبير (`app.js`، ES Module، بدون أي Build step أو Bundler) بيتحمّل مباشرة في المتصفح، بيتكلم مع Firebase (Auth + Firestore) مباشرة من الـclient، وبيتكلم مع Vercel Serverless Functions (`api/`) بس للحاجات اللي لازم تفضل سرية (مفتاح Gemini) أو محتاجة صلاحيات سيرفر (Firebase Admin SDK).

## هيكل الملفات

```
/
├── index.html          ← نقطة الدخول، بتحمّل boot.js ثم app.js
├── boot.js             ← watchdog + تسجيل Service Worker (خارج app.js عمدًا، راجع "قرارات" تحت)
├── app.js              ← كل منطق الواجهة (شاشات، فورم الأدمن، الفلاتر...) في ملف واحد
├── sw.js               ← Service Worker (PWA offline cache)
├── manifest.json        ← PWA manifest
├── vercel.json          ← Headers أمنية + تعريف Vercel Cron (auto-search القديم)
├── package.json         ← تبعية وحيدة: firebase-admin (لملفات api/)
├── firestore.rules      ← (بينشر من Firebase Console، مش من هنا)
│
├── api/                              ← Vercel Serverless Functions (Node، بلا Build)
│   ├── chat.js                       ← بروكسي Gemini للمساعد الذكي (يتحقق من ID Token)
│   ├── admin/
│   │   └── trigger-aggregator.js     ← بيشغّل GitHub Actions يدويًا (زرار لوحة الإدارة)
│   ├── cron/
│   │   └── auto-search.js            ← بحث يومي بـGemini+Google Search (Vercel Cron، نظام قديم)
│   └── _lib/                         ← كود مشترك بين ملفات api/ فوق
│       ├── firebaseAdmin.js          ← تهيئة Firebase Admin SDK (singleton)
│       ├── verifyAuth.js             ← التحقق من Firebase ID Token (مشترك بين chat.js وtrigger-aggregator.js)
│       ├── adminEmails.js            ← قايمة إيميلات الأدمن (مشتركة بين gemini.js وtrigger-aggregator.js)
│       ├── gemini.js                 ← استدعاء Gemini API + الموديل + الكوتا اليومية
│       └── quota.js                  ← فحص/استهلاك الكوتا اليومية للمستخدم
│
└── aggregator/                        ← نظام جمع الفرص، مشروع TypeScript منفصل تمامًا
    ├── package.json / tsconfig.json
    └── src/
        ├── types.ts / config.ts / logger.ts / retry.ts
        ├── validate.ts / classify.ts
        ├── sources.ts                 ← المكان الوحيد لإضافة/تعديل مصادر الفرص
        ├── firestoreClient.ts         ← upsert + expiry + كتابة تقرير التشغيلة
        ├── fetchers/ (fetchRss.ts, fetchJsonApi.ts)
        └── run.ts                     ← نقطة التشغيل (node dist/run.js)

.github/workflows/opportunity-aggregator.yml   ← يشغّل aggregator/ يوميًا + يدويًا
```

## ليه فيه نظامين لجمع الفرص؟

- **`api/cron/auto-search.js`** (قديم، Vercel Cron يومي): بيستخدم Gemini مع أداة Google Search عشان يكتشف برامج معروفة ومتكررة سنويًا حسب مواضيع محددة مسبقًا. مناسب لاكتشاف حاجات "غير رسمية" أو مبعثرة عبر الإنترنت.
- **`aggregator/`** (جديد، GitHub Actions يومي + يدوي): بيعتمد على مصادر رسمية محددة (RSS/APIs) بترتيب أولوية واضح، بدون أي اعتماد على نتائج بحث متغيرة. أكثر استقرارًا وقابل للتوسع لمئات المصادر.

الاتنين بيكتبوا في نفس collection (`opportunities`) وبيستخدموا **نفس نظام منع التكرار بالظبط** (hash ثابت من الرابط كـID)، فمفيش تكرار بينهم حتى لو لقوا نفس الفرصة.

## قرارات تصميم مهمة (ومنطقها)

1. **الـState كله في متغير `state` global واحد + دالة `render()` بتعيد بناء الـDOM** — مفيش Framework (React/Vue). ده قرار قديم من قبل مراجعتنا، احترمناه ومكسرناهوش، لأن تحويله لـFramework تغيير معماري ضخم منفصل تمامًا عن أي طلب اتعمل.
2. **`boot.js` منفصل عن `app.js`**: عشان الـCSP يقدر يمنع `unsafe-inline` من `script-src` (تقليل خطر XSS حقيقي) — الكود اللي المفروض يشتغل حتى لو `app.js` (Module) فشل يتحمّل خالص لازم يكون **برة** الـModule ده.
3. **منع التكرار بمعرف مستند ثابت (hash) بدل query-then-insert**: أرخص (قراءة/كتابة واحدة بدل query + insert)، وبيلغي الحاجة لطبقة Cache منفصلة، وبيخلي أي نظامين مختلفين (القديم والجديد) يتفقوا تلقائيًا على نفس الفرصة.
4. **أسماء حقول الفرص في Firestore (`link`, `reviewed`, تصنيفات مفرد)**: اتحددت عشان تتطابق مع اللي `app.js` (الواجهة الحية) فعليًا بيقراه، مش الأسماء "الأنضف نظريًا" (`applyUrl`, `status`, تصنيفات جمع) — الأولوية لعدم كسر الواجهة الموجودة.
5. **صلاحية الأدمن بطبقتين منفصلتين لازم تتطابق يدويًا**: تحقق client-side (`app.js`، لإخفاء/إظهار الأزرار) + تحقق حقيقي في Firestore Rules (`isAdmin()`) — الأول بس للـUX، التاني هو الحماية الفعلية. تفاصيل التزامن في `MAINTENANCE.md`.

## قابلية التوسع

- **مصادر جديدة للفرص**: ملف واحد (`aggregator/src/sources.ts`)، بلا حاجة لتعديل أي كود تاني.
- **أدمن جديد**: 4 أماكن بالظبط (موثّقة في `MAINTENANCE.md`) — مش أوتوماتيك عمدًا، عشان تفادي إضافة صلاحية أدمن بالغلط في مكان وننساها في مكان تاني.
- **حجم فرص كبير (100k+)**: `loadOpportunities()` فيها حد أقصى وقائي (`limit(1000)`) دلوقتي — الحل الكامل (Pagination حقيقي) لسه محتاج جلسة تصميم منفصلة (موثّق كـ"معروف ومش متصلح" في `FINAL_REPORT.md`).
