// ============================================================
// مصدر واحد بس لقايمة إيميلات الأدمن على السيرفر — كانت متكررة حرفيًا في
// api/_lib/gemini.js و api/admin/trigger-aggregator.js. أي ملف سيرفر محتاج
// يتحقق من إن حد أدمن، لازم يستورد من هنا بس.
//
// ⚠️ ده مش هو المصدر الوحيد في المشروع كله: app.js (كود المتصفح) لازم يكون
// عنده نفس القايمة كمان، لإن المتصفح مايقدرش يستورد ملف من السيرفر. لو
// ضفت/شلت أدمن، لازم تعدّل في 3 أماكن بالظبط:
//   1) الملف ده (api/_lib/adminEmails.js)
//   2) app.js → const ADMIN_EMAILS
//   3) Firestore Rules → دالة isAdmin()
// تفاصيل الخطوات في MAINTENANCE.md.
const ADMIN_EMAILS = ["nextstepai010@gmail.com", "mhmwdshhath468@gmail.com"];

module.exports = { ADMIN_EMAILS };
