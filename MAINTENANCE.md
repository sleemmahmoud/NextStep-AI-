# MAINTENANCE.md — صيانة NextStep AI وإضافة ميزات

> يحل محل `POST_LAUNCH_GUIDE.md` من الجلسات السابقة — نفس المحتوى + إضافات، في مكان واحد.

## متابعة يومية

- **Vercel Logs**: Dashboard → مشروعك → Logs/Runtime Logs — أخطاء `api/chat.js` و`api/admin/trigger-aggregator.js` لحظة حدوثها.
- **GitHub Actions**: تبويب Actions → Opportunity Aggregator — كل تشغيلة (يومية/يدوية)، ✅/❌، وتفاصيل كل مصدر.
- **Firestore**: Firebase Console → Firestore Database (تصفح مباشر) + `meta/aggregatorLastRun` (ملخص آخر تشغيلة) + Firebase Console → Usage (عدد القراءات/الكتابات، مهم يوميًا مع نمو البيانات).

## إضافة مصدر فرص جديد

افتح `aggregator/src/sources.ts` بس. ضيف عنصر في `RSS_SOURCES` أو `JSON_API_SOURCES`. تأكد من صحة الرابط وشروط استخدامه أولًا. مفيش أي ملف تاني محتاج تعديل.

## إضافة أدمن جديد

**4 أماكن بالظبط** (لازم الأربعة يتطابقوا):
1. `app.js` → `const ADMIN_EMAILS = [...]`
2. `api/_lib/adminEmails.js` → نفس القايمة (ده المصدر المشترك لكل ملفات `api/`)
3. `api/admin/trigger-aggregator.js` و`api/chat.js` (عن طريق `api/_lib/gemini.js`) بياخدوا القايمة تلقائيًا من `adminEmails.js` — **معدّلش فيهم مباشرة**
4. Firestore Rules → دالة `isAdmin()` → أضف الإيميل، وPublish.

⚠️ ليه مش مكان واحد بس؟ لإن المتصفح (`app.js`) مايقدرش يستورد ملفات السيرفر، فلازم نسخة مستقلة هناك. التزامن اليدوي ده قرار واعي (راجع `ARCHITECTURE.md`)، مش تكرار عشوائي.

## Backup لقاعدة البيانات

```
gcloud firestore export gs://YOUR_BUCKET_NAME
```
(محتاج مشروع Google Cloud على خطة Blaze — مجاني لحد حجم معين). بديل أبسط لو حجم البيانات لسه صغير: سكريبت صغير بـ`firebase-admin` يعمل `getDocs()` لكل collection ويحفظها JSON محليًا.

## استعادة البيانات

```
gcloud firestore import gs://YOUR_BUCKET_NAME/EXPORT_FOLDER
```
⚠️ بيستبدل البيانات بنفس الـIDs — جرّبه على مشروع Firebase تجريبي منفصل الأول لو تقدر.

## تحديث المشروع من غير ما تأثر على المستخدمين

- تعديل في `app.js`/`index.html`: الـService Worker بيتحدث تلقائيًا عند أي زيارة جديدة (`Cache-Control: no-cache` على `sw.js`) — من غير ما المستخدم يمسح الكاش يدويًا.
- تعديل في Firestore Rules: بيتفعّل فورًا بعد Publish، بلا إعادة نشر الموقع.
- تعديل في `aggregator/`: بيتفعّل من أول تشغيلة GitHub Actions جاية، بلا علاقة بـVercel.
- لتغييرات كبيرة (تعديل شكل بيانات collection كامل): اعمل Backup الأول (القسم اللي فات).

---

## إضافة ميزة جديدة — إزاي تبدأ

المشروع كله (الواجهة) في ملف واحد (`app.js`) بنمط: `state` (object عالمي) + `render()` (بيعيد بناء الـHTML كله من `state` في كل مرة) + دوال async بتعدّل `state` وتنده `render()`. عشان تضيف ميزة جديدة:

1. **شاشة/تبويب جديد**: دور على نمط `renderXxxTab()` موجود (زي `renderAdminTab()`) كمثال، واعمل دالة مشابهة. ضيفها في نقطة التنقل (دور على `state.screen===` في الكود).
2. **حقل بيانات جديد في Firestore**: ضيفه في الـobject اللي بيتبعت لـ`addDoc`/`updateDoc`، وضيف قراءته في مكان العرض. لو الحقل حساس أو يحتاج صلاحية خاصة، ضيف/عدّل الـFirestore Rule المناسبة.
3. **زرار جديد في لوحة الإدارة**: زي نمط "تحديث الفرص الآن" (`app.js` قسم `renderAdminTab`) — زرار بـ`data-action`، handler في دالة الـclick الكبيرة (دوّر على `else if(action===`)، ودالة async منفصلة بتنفذ المنطق وتستخدم `friendlyErr()` لو فيها تعامل مع Firestore.
4. **API route جديد**: ضيف ملف جديد في `api/` (أو `api/admin/` لو أدمن بس). لو محتاج تتحقق من هوية المستخدم، استخدم `verifyRequestAuth(req)` من `api/_lib/verifyAuth.js` بدل ما تكتب تحقق جديد من الصفر.
5. **مصدر فرص جديد**: القسم اللي فات (إضافة مصدر فرص جديد).

**قاعدة عامة:** قبل ما تكتب دالة تحقق/hash/helper جديدة، دوّر الأول في `api/_lib/` (للسيرفر) — لو فيه حاجة قريبة، استخدمها أو وسّعها بدل ما تكتب نسخة جديدة (ده بالظبط اللي اتعمل في هذه الجلسة: توحيد `verifyAuth` و`ADMIN_EMAILS` بعد ما كانوا اتكرروا في أكتر من ملف).
