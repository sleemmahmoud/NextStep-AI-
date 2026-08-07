// حد الاستخدام اليومي بقى متخزّن في Firestore بدل Cloudflare KV — مجموعة
// "aiUsage"، مستند واحد لكل (مستخدم + يوم)، فيه عدّاد count بس. مفيش أي
// اعتماد على أي تخزين مؤقت (KV/Cache) خالص؛ Firestore هو مصدر الحقيقة الوحيد.
const { getFirebaseAdmin } = require("./firebaseAdmin");

async function checkQuota({ uid, email, ADMIN_EMAILS, DAILY_LIMIT, ADMIN_DAILY_LIMIT }) {
  const isAdminUser = !!(email && ADMIN_EMAILS.includes(email));
  const limit = isAdminUser ? ADMIN_DAILY_LIMIT : DAILY_LIMIT;
  const idKey = isAdminUser ? `admin:${email}` : uid;
  if (!idKey) {
    return { allowed: false, configError: "الطلب وصل من غير uid — تأكد إن app.js بيبعت uid مع كل طلب." };
  }
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const today = new Date().toISOString().slice(0, 10);
  const docId = `${idKey.replace(/[\/]/g, "_")}_${today}`;
  const ref = db.collection("aiUsage").doc(docId);
  const snap = await ref.get();
  const current = snap.exists ? (snap.data().count || 0) : 0;
  if (current >= limit) return { allowed: false, limit, idKey, docId, current };
  return { allowed: true, limit, idKey, docId, current };
}

async function consumeQuota(docId, current) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const { FieldValue } = require("firebase-admin/firestore");
  // ⚠️ إصلاح أمني (Sprint 7): كانت set({count: current+1}) — ده read-then-write
  // مش عملية ذرية، فطلبين متزامنين (تابين مفتوحين أو سكريبت بيضرب بسرعة)
  // ممكن يقروا نفس current القديم ويكتبوا نفس القيمة، والمستخدم يتخطى
  // الحد اليومي فعليًا. FieldValue.increment() عملية ذرية حقيقية على
  // مستوى Firestore نفسه، بتتعامل صح حتى مع آلاف الطلبات المتزامنة.
  await db.collection("aiUsage").doc(docId).set(
    { count: FieldValue.increment(1), updatedAt: Date.now() },
    { merge: true }
  );
}

module.exports = { checkQuota, consumeQuota };
