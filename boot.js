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

// ============================================================
// Install Banner احترافي (Sprint 6) — بيستخدم beforeinstallprompt بدل ما
// نسيب المتصفح يوري الـUI الافتراضي بتاعه بس. قواعد الإخفاء:
// - المستخدم رفض؟ منوريهاش تاني لمدة 7 أيام.
// - المستخدم ثبّت التطبيق؟ منوريهاش تاني خالص أبدًا.
// - التطبيق متثبت بالفعل (standalone mode)؟ منوريهاش من الأساس.
// ============================================================
(function () {
  var DISMISS_KEY = 'nsai_install_dismissed_at';
  var INSTALLED_KEY = 'nsai_install_done';
  var COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

  function isRunningAsInstalledApp() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true; // iOS Safari
  }

  function isDismissedRecently() {
    try {
      var raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      return (Date.now() - parseInt(raw, 10)) < COOLDOWN_MS;
    } catch (e) { return false; }
  }

  function isPermanentlyInstalled() {
    try { return localStorage.getItem(INSTALLED_KEY) === '1'; } catch (e) { return false; }
  }

  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    if (isRunningAsInstalledApp() || isPermanentlyInstalled() || isDismissedRecently()) {
      return; // مفيش داعي نحتفظ حتى بالـevent لو مش هنوريه أصلًا
    }
    deferredPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', function () {
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {}
    hideInstallBanner();
    deferredPrompt = null;
  });

  function showInstallBanner() {
    if (document.getElementById('nsai-install-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'nsai-install-banner';
    banner.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;' +
      'background:#0A2C35;color:#fff;border-radius:14px;padding:14px 16px;' +
      'display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.25);' +
      'font-family:inherit;direction:rtl;';
    banner.innerHTML =
      '<div style="font-size:22px;">📲</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:800;font-size:13.5px;">ثبّت NextStep AI على جهازك</div>' +
        '<div style="font-size:11.5px;opacity:0.8;">وصول أسرع، وشغّال حتى من غير نت</div>' +
      '</div>' +
      '<button id="nsai-install-yes" style="border:none;border-radius:9px;padding:9px 14px;background:#E8A93B;color:#0A2C35;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit;white-space:nowrap;">تثبيت</button>' +
      '<button id="nsai-install-no" style="border:none;background:transparent;color:#B9C4C6;font-size:18px;cursor:pointer;padding:4px 6px;line-height:1;" aria-label="إغلاق">✕</button>';
    document.body.appendChild(banner);

    document.getElementById('nsai-install-yes').addEventListener('click', function () {
      hideInstallBanner();
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice.outcome !== 'accepted') {
          try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
        }
        deferredPrompt = null;
      });
    });
    document.getElementById('nsai-install-no').addEventListener('click', function () {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
      hideInstallBanner();
    });
  }

  function hideInstallBanner() {
    var el = document.getElementById('nsai-install-banner');
    if (el) el.remove();
  }
})();
