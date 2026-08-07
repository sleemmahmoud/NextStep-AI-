// تهيئة Firebase Admin SDK مرة واحدة بس (singleton) — بيتقرا الـService Account
// من متغير البيئة FIREBASE_SERVICE_ACCOUNT على Vercel (مش من ملف .json على
// السيرفر، ومفيش أي اعتماد على Cloudflare KV أو Bindings خالص).
//
// ⚠️ مهم: firebase-admin v14 شالت الـ"Legacy Namespace" بالكامل (كان زمان
// require("firebase-admin") بيرجّع object فيه admin.apps/admin.initializeApp/
// admin.auth()/admin.firestore() كلهم مع بعض). ده كان سبب "Cannot read
// properties of undefined (reading 'length')" لما رفّعنا firebase-admin
// لـ14 من غير ما نعدّل الطريقة دي. دلوقتي بنستخدم الـmodular API الجديد
// (getApps/initializeApp/cert من "firebase-admin/app"، getAuth من
// "firebase-admin/auth"، getFirestore من "firebase-admin/firestore")، لكن
// بنرجّع نفس الشكل القديم بالظبط ({auth(), firestore()}) عشان كل الملفات
// التانية (quota.js, verifyAuth.js, auto-search.js, trigger-aggregator.js)
// تفضل شغالة من غير ما نلمسها خالص.
const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

function getFirebaseAdmin() {
  let app;
  if (!getApps().length) {
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
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  } else {
    app = getApps()[0];
  }
  return {
    auth: () => getAuth(app),
    firestore: () => getFirestore(app),
  };
}

module.exports = { getFirebaseAdmin };
