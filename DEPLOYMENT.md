# DEPLOYMENT.md — نشر NextStep AI

> هذا الملف بقى المرجع الرسمي الوحيد للنشر. الملفات القديمة
> `DEPLOYMENT_GUIDE_AGGREGATOR.md` و`DEPLOYMENT_CHECKLIST.md` (من جلسات سابقة)
> بقى محتواهم هنا بالكامل — تقدر تمسحهم من مجلدك، مش محتاجهم منفصلين.

## 1) الملفات ومكانها في الريبو

```
index.html, boot.js, app.js, sw.js, manifest.json   → جذر المشروع (نفس مكان الأصلي)
vercel.json, package.json                            → جذر المشروع
api/**                                               → جذر المشروع (يشتغل مباشرة، بلا Build)
aggregator/**                                        → مجلد منفصل في جذر المشروع (له package.json خاص بيه)
.github/workflows/opportunity-aggregator.yml         → .github/workflows/ في جذر المشروع
```

## 2) Environment Variables / Secrets

### Vercel (Project → Settings → Environment Variables)
| الاسم | القيمة/المصدر |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | محتوى ملف JSON كامل (Firebase Console → ⚙️ Project Settings → Service Accounts → Generate new private key) — كسطر واحد |
| `GITHUB_REPO_OWNER` | اسم المستخدم/المنظمة على GitHub |
| `GITHUB_REPO_NAME` | اسم الريبو |
| `GITHUB_DISPATCH_TOKEN` | GitHub Personal Access Token (خطوات إنشاءه تحت) |
| `GITHUB_WORKFLOW_FILE` | اختياري، افتراضي `opportunity-aggregator.yml` |
| `GITHUB_REPO_DEFAULT_BRANCH` | اختياري، افتراضي `main` |

**إنشاء GITHUB_DISPATCH_TOKEN:**
1. GitHub → صورتك الشخصية → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
2. Repository access → Only select repositories → اختار الريبو.
3. Permissions → Actions → Read and write.
4. Generate، وانسخ التوكن فورًا (بيتعرض مرة واحدة).

بعد أي تعديل في Environment Variables: لازم **Redeploy** يدوي عشان يتفعّل.

### GitHub Secrets (Repo → Settings → Secrets and variables → Actions)
| الاسم | المصدر |
|---|---|
| `FIREBASE_PROJECT_ID` | نفس ملف الـService Account JSON → `project_id` |
| `FIREBASE_CLIENT_EMAIL` | نفس الملف → `client_email` |
| `FIREBASE_PRIVATE_KEY` | نفس الملف → `private_key` (سيبها زي ما هي، فيها `\n` حرفية) |

⚠️ ملف الـService Account حساس جدًا — GitHub Secrets/Vercel Env Vars بس، متحطوش في الكود ولا تشاركه.

## 3) Firestore

- **Rules**: انسخ محتوى `firestore.rules` (من الجلسات السابقة) كامل → Firebase Console → Firestore Database → Rules → Publish.
- **Indexes**: مفيش composite index مطلوب حاليًا (كل الاستعلامات single-field).

## 4) ترتيب تنفيذ خطوات النشر (أول مرة)

1. انسخ كل الملفات (القسم 1) لأماكنها في الريبو.
2. Publish الـFirestore Rules.
3. ضيف الـGitHub Secrets الثلاثة.
4. ضيف Vercel Environment Variables.
5. اعمل Redeploy على Vercel.
6. Push للريبو (لو لسه معملتش).
7. (اختياري) `cd aggregator && npm install` مرة محليًا لتوليد `package-lock.json` وارفعه — يسرّع تشغيلات GitHub Actions.

## 5) اختبار ما بعد النشر (Checklist)

> ✅ اتفحص بمراجعة كود ثابتة (static review) خلال الجلسات السابقة. 🔲 لازم اختبار فعلي في متصفح/جهاز حقيقي.

**Build:**
- ✅ كل ملفات JS عدّت `node --check`. كل TypeScript عدّى type-check.
- 🔲 نفّذ فعليًا: `cd aggregator && npm install && npm run build` مرة على جهاز حقيقي.

**GitHub Actions:**
- 🔲 شغّل الـworkflow يدويًا (Actions → Opportunity Aggregator → Run workflow) وتأكد ✅.
- 🔲 بعد يوم كامل، تأكد إن التشغيلة اليومية حصلت لوحدها.

**Firestore:**
- 🔲 بعد أول تشغيلة، تأكد من ظهور مستندات جديدة في `opportunities` و`meta/aggregatorLastRun`.

**Authentication:**
- 🔲 جرّب دخول بإيميل/باسورد وGoogle، ونسيت كلمة المرور، وتسجيل خروج، فعليًا.

**المساعد الذكي:**
- 🔲 جرّب رسالة فعلية وتأكد من الرد.

**لوحة الإدارة:**
- 🔲 جرّب كل زرار (إعلانات، فرص، مصادر، قصص نجاح، "تحديث الفرص الآن") فعليًا.

**PWA:**
- 🔲 جرّب التثبيت على Chrome/Android/iPhone/Samsung Internet، وتأكد من عدم ظهور تحذير Play Protect.

**Console/Network:**
- 🔲 افتح الموقع فعليًا وشوف الـConsole (F12) للتأكد من صفر أخطاء رانتايم.

كل بند 🔲 محتاج متصفح/جهاز حقيقي أو وصول فعلي لموقعك المنشور — مش حاجة ينفع تتفحص من مراجعة كود.
