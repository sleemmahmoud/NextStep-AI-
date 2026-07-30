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
      serviceAccount = JSON.parse(raw);
    } catch (err) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT مش JSON صحيح: " + err.message);
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
  }
  return admin;
}

module.exports = { getFirebaseAdmin };
