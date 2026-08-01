// Outer boot watchdog — lives OUTSIDE the module script on purpose.
// If the module script (app.js) fails entirely to load or initialize
// (e.g. a CDN is blocked by the network/firewall), the code inside the
// module never runs, so its own internal safety-timeout never fires either.
// This independent watchdog guarantees the user is never stuck on the
// spinner forever, no matter what fails.
//
// ملحوظة: الكود ده كان قبل كده inline جوه index.html. نقلناه لملف خارجي
// عشان نقدر نشدّد Content-Security-Policy (نمنع 'unsafe-inline' من
// script-src) من غير ما نكسر الميزة دي.
window.__appBooted = false;
// بنمسك أي خطأ JS حقيقي بيحصل أثناء التحميل ونخزّنه هنا، عشان لو التحميل فشل
// نوريه على الشاشة مباشرة (مش رسالة عامة بس) — كده مش محتاجين DevTools خالص
// حتى على الموبايل عشان نعرف السبب الحقيقي.
window.__lastBootError = null;
window.addEventListener('error', function (e) {
  var msg = (e.error && (e.error.message || String(e.error))) || e.message || 'خطأ غير معروف';
  if (e.filename) msg += ' — ملف: ' + e.filename + (e.lineno ? (':' + e.lineno) : '');
  window.__lastBootError = msg;
}, true);
window.addEventListener('unhandledrejection', function (e) {
  var reason = e.reason;
  window.__lastBootError = 'Promise رفض: ' + ((reason && (reason.message || String(reason))) || 'سبب غير معروف');
});
setTimeout(function () {
  if (!window.__appBooted) {
    var appEl = document.getElementById('app');
    if (appEl) {
      var errBox = window.__lastBootError
        ? '<div style="background:#FDECEA;color:#B4232C;border:1px solid #F5C6BE;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12.5px;text-align:right;direction:ltr;word-break:break-word;">' + window.__lastBootError.replace(/</g, '&lt;') + '</div>'
        : '<div style="background:#FDECEA;color:#B4232C;border:1px solid #F5C6BE;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12.5px;">مفيش خطأ JS اتسجّل — يبقى المشكلة شبكة/حجب مش كود.</div>';
      appEl.innerHTML = '<div class="center-screen"><div class="card" style="max-width:420px;padding:28px;text-align:center;">' +
        '<p style="font-weight:800;font-size:16px;margin-bottom:10px;">تعذّر تحميل الموقع</p>' +
        errBox +
        '<p style="color:#5C7278;font-size:14px;margin-bottom:18px;">لو فيه رسالة حمرا فوق، ابعتها زي ما هي. تأكد كمان من اتصال الإنترنت وإن الـ Ad-blocker مش بيمنع الوصول لخدمات Google، وبعدين جرّب تحدّث الصفحة.</p>' +
        '<button id="boot-reload-btn" style="border:none;border-radius:10px;padding:12px 22px;background:#164B58;color:#fff;font-weight:700;cursor:pointer;font-family:inherit;">تحديث الصفحة</button></div></div>';
      // بدل onclick="..." كـattribute (ده كان محتاج 'unsafe-inline' في الـ
      // CSP)، بنربط الحدث هنا بالجافاسكريبت العادي.
      var btn = document.getElementById('boot-reload-btn');
      if (btn) btn.addEventListener('click', function () { location.reload(); });
    }
  }
}, 15000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (err) {
      console.warn('SW registration failed:', err);
    });
  });
}
