const { ADMIN_EMAILS } = require("../_lib/adminEmails");
const { verifyRequestAuth } = require("../_lib/verifyAuth");

async function verifyAdmin(req) {
  const { email } = await verifyRequestAuth(req);
  if (!email || !ADMIN_EMAILS.includes(email)) return null;
  return email;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "POST بس مسموح." } });
    return;
  }

  const adminEmail = await verifyAdmin(req);
  if (!adminEmail) {
    res.status(403).json({ error: { message: "لازم تكون أدمن مسجّل دخول عشان تشغّل التحديث." } });
    return;
  }

  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const workflowFile = process.env.GITHUB_WORKFLOW_FILE || "opportunity-aggregator.yml";
  const ref = process.env.GITHUB_REPO_DEFAULT_BRANCH || "main";

  if (!owner || !repo || !token) {
    res.status(500).json({
      error: {
        message:
          "الإعدادات ناقصة على Vercel: لازم تضيف GITHUB_REPO_OWNER و GITHUB_REPO_NAME و GITHUB_DISPATCH_TOKEN كـEnvironment Variables (راجع دليل الـDeployment).",
      },
    });
    return;
  }

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref, inputs: { triggeredBy: `admin:${adminEmail}` } }),
      }
    );

    if (ghRes.status === 204) {
      res.status(200).json({
        ok: true,
        message:
          "تم تشغيل التحديث بنجاح ✓ العملية بتاخد دقيقة لدقيقتين تقريبًا — تقدر تشوف النتيجة (فرص جديدة/مكررة/أخطاء) بعدين من نفس الشاشة دي، أو من GitHub Actions مباشرة.",
      });
    } else {
      const body = await ghRes.text();
      res.status(502).json({
        error: {
          message: `GitHub رفض الطلب (HTTP ${ghRes.status}). تأكد إن GITHUB_DISPATCH_TOKEN صالح ومعاه صلاحية "Actions: Read and write"، وإن اسم الملف/الفرع صحيح.`,
          details: body.slice(0, 500),
        },
      });
    }
  } catch (err) {
    console.error("[trigger-aggregator] error:", err);
    res.status(500).json({ error: { message: "حصل خطأ أثناء الاتصال بـGitHub." } });
  }
};
