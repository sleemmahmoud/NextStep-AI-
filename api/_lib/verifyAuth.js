const { getFirebaseAdmin } = require("./firebaseAdmin");

// بيتحقق من Firebase ID Token (Authorization: Bearer <token>) ويرجّع
// {uid, email} حقيقيين موثّقين من Firebase — مش أي حاجة بتيجي في جسم
// الطلب. كان الكود ده مكرر حرفيًا في api/chat.js و
// api/admin/trigger-aggregator.js، دلوقتي مكان واحد بس.
async function verifyRequestAuth(req) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return { uid: null, email: null };
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) return { uid: null, email: null };
  try {
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email || null };
  } catch (err) {
    console.warn(
      "[verifyRequestAuth] verifyIdToken failed:",
      err && err.message,
      "\nSTACK:",
      err && err.stack,
      "\nTOKEN_LENGTH:", idToken ? idToken.length : "n/a",
      "\nTOKEN_PARTS:", idToken ? idToken.split(".").length : "n/a"
    );
    return { uid: null, email: null };
  }
}

module.exports = { verifyRequestAuth };
