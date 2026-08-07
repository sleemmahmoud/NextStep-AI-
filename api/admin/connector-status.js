const { ADMIN_EMAILS } = require("../_lib/adminEmails");
const { verifyRequestAuth } = require("../_lib/verifyAuth");
const { getFirebaseAdmin } = require("../_lib/firebaseAdmin");

async function verifyAdmin(req) {
  const { email } = await verifyRequestAuth(req);
  if (!email || !ADMIN_EMAILS.includes(email)) return null;
  return email;
}

// بيرجّع حالة كل Connector (meta/connectorHealth) + ملخص آخر تشغيلة
// (meta/aggregatorLastRun) — للعرض في لوحة المراقبة بلوحة الإدارة.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: { message: "GET بس مسموح." } });
    return;
  }

  const adminEmail = await verifyAdmin(req);
  if (!adminEmail) {
    res.status(403).json({ error: { message: "لازم تكون أدمن مسجّل دخول." } });
    return;
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const [healthSnap, lastRunSnap] = await Promise.all([
      db.doc("meta/connectorHealth").get(),
      db.doc("meta/aggregatorLastRun").get(),
    ]);

    res.status(200).json({
      connectors: healthSnap.exists ? healthSnap.data().connectors || {} : {},
      lastRun: lastRunSnap.exists ? lastRunSnap.data() : null,
    });
  } catch (err) {
    console.error("[connector-status] error:", err);
    res.status(500).json({ error: { message: "حصل خطأ أثناء جلب حالة المصادر." } });
  }
};
