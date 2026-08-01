// تهيئة Firebase Admin SDK مرة واحدة بس (singleton) — بيتقرا الـService Account
// من متغير البيئة FIREBASE_SERVICE_ACCOUNT على Vercel (مش من ملف .json على
// السيرفر، ومفيش أي اعتماد على Cloudflare KV أو Bindings خالص).
const admin = require("firebase-admin");

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT مش موجود في Environment Variables بتاعة Vercel. " +
        "روح Vercel Dashboard -> Project -> Settings -> Environment Variables وضيفه: " +
        "حط فيه محتوى ملف الـService Account JSON بالكامل (Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key) كسطر واحد."
      );
    }
    let serviceAccount;
    try {
      // بنحوّل الـJSON المخزّن كنص في متغير البيئة لـobject حقيقي هنا بالظبط.
      serviceAccount = JSON.parse(raw.trim());
    } catch (err) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT مش JSON صحيح: " + err.message);
    }
    // مهم: أي مسافة أو سطر جديد زيادة (\n) اتلصق بالغلط في قيمة متغير البيئة
    // FIREBASE_PROJECT_ID أو جوه project_id بيبوظ مسار Firestore بالكامل
    // ويطلع خطأ "illegal characters" من grpc — فبنعمل trim() صريح هنا كحماية.
    const projectId = (process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || "").trim();
    if (serviceAccount.project_id) serviceAccount.project_id = String(serviceAccount.project_id).trim();
    if (serviceAccount.client_email) serviceAccount.client_email = String(serviceAccount.client_email).trim();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  }
  return admin;
}

module.exports = { getFirebaseAdmin };
