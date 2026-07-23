import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, addDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ============ Firebase project config ============
const firebaseConfig = {
  apiKey: "AIzaSyAY8ihS9KRd4uqrwCwR0f2jFhnaR4ILmsQ",
  authDomain: "nextstep-ai-af65e.firebaseapp.com",
  projectId: "nextstep-ai-af65e",
  storageBucket: "nextstep-ai-af65e.firebasestorage.app",
  messagingSenderId: "178277149852",
  appId: "1:178277149852:web:c81835624591e8887f9159",
  measurementId: "G-NREFQNLTJD"
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

// ============ constants ============
const TAGS = ["برمجة","تصميم","ريادة أعمال","تسويق رقمي","لغات","علوم","هندسة","قيادة وتطوع","فنون وإعلام","أعمال وتمويل","رياضة","مهارات تواصل"];
// شجرة مهارات فرعية: كل تصنيف عريض (زي "تصميم" أو "لغات") ليه مهارات محددة تحته،
// عشان لما المستخدم يقول "عايز أتعلم" يقدر يحدد بالظبط (مونتاج، إنجليزي، بايثون...)
// بدل ما يختار بس تصنيف عام، وده اللي بيخلي البحث عن الكورسات المقترحة له دقيق.
const SKILL_TREE = {
  "برمجة": ["Python","JavaScript / تطوير الويب","تطبيقات الموبايل","الذكاء الاصطناعي وتعلم الآلة","قواعد البيانات","الأمن السيبراني"],
  "تصميم": ["مونتاج فيديو","تصميم جرافيك","UI/UX","فوتوشوب","إليستريتور","موشن جرافيك"],
  "ريادة أعمال": ["كتابة خطة عمل","تحليل السوق","إدارة المشاريع الناشئة","التمويل والاستثمار"],
  "تسويق رقمي": ["سوشيال ميديا","إعلانات ممولة (Ads)","SEO","تحليل بيانات التسويق","كتابة محتوى تسويقي"],
  "لغات": ["إنجليزي","فرنساوي","ألماني","إسباني","تركي"],
  "علوم": ["فيزياء","كيمياء","أحياء","رياضيات","إحصاء وتحليل بيانات"],
  "هندسة": ["هندسة مدنية","هندسة كهرباء","هندسة ميكانيكا","هندسة حاسبات","الرسم الهندسي (CAD)"],
  "قيادة وتطوع": ["إدارة الفرق","تنظيم الفعاليات","العمل التطوعي المجتمعي","حل النزاعات"],
  "فنون وإعلام": ["تصوير فوتوغرافي","مونتاج فيديو","كتابة محتوى وصحافة","الإذاعة والبودكاست"],
  "أعمال وتمويل": ["محاسبة","تحليل مالي","إدارة الأعمال","الاستثمار في البورصة"],
  "رياضة": ["كرة قدم","سباحة","كمال أجسام ولياقة","يوجا"],
  "مهارات تواصل": ["التحدث أمام الجمهور","كتابة إيميلات احترافية","التفاوض","إدارة الوقت"],
};
const STAGES = [
  {id:"middle", label:"إعدادي"},
  {id:"high", label:"ثانوي"},
  {id:"university", label:"جامعي"},
  {id:"graduate", label:"خريج"}
];
const STAGE_LABEL = Object.fromEntries(STAGES.map(s=>[s.id,s.label]));
const GRADE_OPTIONS = {
  middle: ["الصف الأول الإعدادي","الصف الثاني الإعدادي","الصف الثالث الإعدادي"],
  high: ["الصف الأول الثانوي","الصف الثاني الثانوي","الصف الثالث الثانوي"],
  university: ["الفرقة الأولى","الفرقة الثانية","الفرقة الثالثة","الفرقة الرابعة","فرقة أعلى"]
};
const CATEGORIES = {scholarship:"منحة دراسية",internship:"تدريب",job:"وظيفة",volunteering:"تطوع",competition:"مسابقة",conference:"مؤتمر",hackathon:"هاكاثون",exchange:"برنامج تبادل",course:"دورة",bootcamp:"بوت كامب",event:"فعالية"};
// ضع إيميلك هنا لقفل الموافقة والرفض عليك انت بس. سايبها فاضية دلوقتي = أي حد مسجل دخول
// يقدر يوافق (عادي طول ما انت المستخدم الوحيد)، هتتقفل تلقائيًا أول ما تحط إيميلك هنا.
const ADMIN_EMAILS = ["sleemmahmoud81@gmail.com", "nextstepai010@gmail.com", "mhmwdshhath468@gmail.com"];
function isAdmin(){
  return ADMIN_EMAILS.length===0 || (state.user && ADMIN_EMAILS.includes(state.user.email));
}

// ============ state ============
let state = {
  screen:"loading", authMode:"login", authError:"", authBusy:false, resetMsg:"",
  user:null, profile:null,
  setupName:"", setupStage:"", setupInterests:new Set(), setupSkills:new Set(), setupLocation:"", setupError:"",
  setupLearnSkills:new Set(), learnSkillsCategoryOpen:"",
  setupAge:"", setupCountry:"مصر", setupSchool:"", setupEnglish:"", setupGoal:"", setupCvLink:"",
  setupAchievements:"", setupPhotoBase64:"", setupGradeDetail:"", setupWorking:"", setupWorkplace:"",
  setupPhone:"", setupLinkedin:"", setupGithub:"", setupContactEmail:"",
  cvGenerating:false,
  opportunities:[], activeTab:"recommended", openOppId:null, seedBusy:false, searchQuery:"", filterCategory:"", filterStage:"",
  editingOppId:null, editOppTags:new Set(), editOppStages:new Set(),
  chatMessages:[], chatBusy:false, aiConnected:true,
  resources:[], adminOpen:null, adminOppTags:new Set(), adminOppStages:new Set(), adminResTags:new Set(), adminMsg:"", toastMsg:"",
  editingResourceId:null,
  learningSubTab:"tips",
  pendingOpps:[], searchTopic:"", searchBusy:false, searchErr:"",
  quizzes:[], completedResourceIds:[], completedLessonIds:[], quizResults:{}, activeQuizId:null, quizAnswers:{}, quizSubmitted:false
};

// ============ matching ============
function calcMatch(profile, opp){
  const userTags = new Set([...(profile.interests||[]), ...(profile.skills||[]), profile.stage]);
  const oppTags = opp.tags||[];
  const stageOk = !opp.stageTags || opp.stageTags.length===0 || opp.stageTags.includes(profile.stage);
  const matched = oppTags.filter(t=>userTags.has(t));
  let score = oppTags.length ? Math.round((matched.length/oppTags.length)*100) : 50;
  if(!stageOk) score = Math.round(score*0.35);
  score = Math.max(5, Math.min(100, score));
  const missing = oppTags.filter(t=>!(profile.skills||[]).includes(t));
  return {score, matched, missing, stageOk};
}
function renderDeadlineAlerts(){
  if(!state.profile) return "";
  const soon = state.opportunities.filter(o=>{
    const d = daysUntil(o.deadline);
    if(!(d>=0 && d<=5)) return false;
    return calcMatch(state.profile,o).score>=50;
  });
  if(soon.length===0) return "";
  return `<div class="note-box" style="background:#FDF3E2;color:#8A5B10;max-width:760px;margin:14px auto 0;">
    🔔 عندك ${soon.length} فرصة مناسبة ليك قربت على آخر موعد: ${soon.map(o=>escapeHtml(o.title)).join("، ")}
  </div>`;
}
function stageDisplayText(p){
  if(p.stage==="graduate"){
    if(p.working==="yes") return `خريج — شغال${p.workplace?" في "+p.workplace:""}`;
    if(p.working==="no") return "خريج — بيدوّر على شغل";
    return "خريج";
  }
  return p.gradeDetail || STAGE_LABEL[p.stage] || "";
}
// بترجع نص تنبيه لو الفرصة مش موجّهة لمرحلة المستخدم الدراسية (وترجع "" لو
// مفيش مشكلة، يعني الفرصة متاحة لكل المراحل أو بتستهدف مرحلته بالظبط).
function stageMismatchNote(profile, opp){
  if(!opp.stageTags || opp.stageTags.length===0) return "";
  if(opp.stageTags.includes(profile.stage)) return "";
  const oppStageLabels = opp.stageTags.map(s=>STAGE_LABEL[s]||s).join("/");
  return `⚠️ الفرصة دي مش مناسبة ليك — إنت في مرحلة "${STAGE_LABEL[profile.stage]||stageDisplayText(profile)}"، والفرصة دي موجّهة لمرحلة "${oppStageLabels}".`;
}
function profileCompleteness(p){
  const fields = [p.name, p.age, p.country, p.stage, p.school, p.englishLevel, p.goal, p.location, p.cvLink, p.achievements, p.photoBase64,
    (p.interests&&p.interests.length)?"x":"", (p.skills&&p.skills.length)?"x":""];
  const filled = fields.filter(v=>v && String(v).trim()).length;
  return Math.round((filled/fields.length)*100);
}
function computeXP(p){
  const quizXP = Object.values(state.quizResults||{}).filter(r=>r.passed).length*20;
  const resourceXP = (state.completedResourceIds||[]).length*8;
  return Math.round(profileCompleteness(p)*0.3) + quizXP + resourceXP;
}
function computeLevel(xp){ return Math.floor(xp/50)+1; }
function computeAchievements(p){
  const passedQuizzes = Object.values(state.quizResults||{}).filter(r=>r.passed).length;
  return [
    {id:"start", label:"أول خطوة", unlocked: profileCompleteness(p)>=50},
    {id:"full", label:"ملف مكتمل 100%", unlocked: profileCompleteness(p)>=100},
    {id:"quiz1", label:"أول شهادة", unlocked: passedQuizzes>=1},
    {id:"quiz3", label:"متعلّم نشيط (3 شهادات)", unlocked: passedQuizzes>=3}
  ];
}
function daysUntil(dateStr){
  const diff = new Date(dateStr+"T23:59:59") - new Date();
  return Math.ceil(diff/(1000*60*60*24));
}
function deadlineInfo(dateStr){
  const d = daysUntil(dateStr);
  if(d<0) return {text:"انتهى الموعد", urgent:true};
  if(d===0) return {text:"اليوم آخر موعد للتقديم!", urgent:true};
  if(d===1) return {text:"متبقي يوم واحد فقط", urgent:true};
  if(d===2) return {text:"متبقي يومين فقط", urgent:true};
  if(d<=10) return {text:`متبقي ${d} أيام فقط`, urgent:true};
  return {text:`آخر موعد: ${dateStr}`, urgent:false};
}

// ============ firestore actions ============
async function loadProfile(uid){
  try{
    const snap = await getDoc(doc(db,"users",uid));
    return snap.exists() ? snap.data() : null;
  }catch(err){
    console.error("loadProfile error:", err);
    return null;
  }
}
function isValidLink(link){
  return typeof link==="string" && /^https?:\/\/.+/i.test(link.trim());
}
function isOppStillValid(o){
  if(!isValidLink(o.link)) return false;
  if(/^\d{4}-\d{2}-\d{2}$/.test(o.deadline||"")){
    const today = new Date(new Date().toISOString().slice(0,10));
    if(new Date(o.deadline) < today) return false;
  }
  return true;
}
async function loadOpportunities(){
  try{
    const snap = await getDocs(collection(db,"opportunities"));
    state.opportunities = snap.docs.map(d=>({id:d.id, ...d.data()})).filter(isOppStillValid);
  }catch(err){
    console.error("loadOpportunities error:", err);
    state.opportunities = state.opportunities||[];
  }
}
async function loadResources(){
  try{
    const snap = await getDocs(collection(db,"resources"));
    state.resources = snap.docs.map(d=>({id:d.id, ...d.data()}));
  }catch(err){
    console.error("loadResources error:", err);
    state.resources = state.resources||[];
  }
}
async function loadPendingOpps(){
  try{
    const snap = await getDocs(collection(db,"pendingOpportunities"));
    state.pendingOpps = snap.docs.map(d=>({id:d.id, ...d.data()}));
  }catch(err){
    console.error("loadPendingOpps error:", err);
    state.pendingOpps = state.pendingOpps||[];
  }
}
async function loadQuizzes(){
  try{
    const snap = await getDocs(collection(db,"quizzes"));
    state.quizzes = snap.docs.map(d=>({id:d.id, ...d.data()}));
  }catch(err){
    console.error("loadQuizzes error:", err);
    state.quizzes = state.quizzes||[];
  }
}
async function approvePending(id){
  if(!isAdmin()) return;
  const item = state.pendingOpps.find(x=>x.id===id);
  if(!item) return;
  try{
    const {id:_drop, groundingSources, searchEntryPointHtml, ...clean} = item;
    await addDoc(collection(db,"opportunities"), {...clean, tags: clean.tags||[], stageTags: clean.stageTags||[], requirements: clean.requirements||[], reviewed:true});
    await deleteDoc(doc(db,"pendingOpportunities", id));
    await loadOpportunities();
    await loadPendingOpps();
  }catch(err){
    console.error("approvePending error:", err);
    state.toastMsg = "حصل خطأ أثناء الموافقة على الفرصة، جرب تاني.";
    setTimeout(()=>{ state.toastMsg=""; render(); }, 4000);
  }
  render();
}
async function rejectPending(id){
  if(!isAdmin()) return;
  try{
    await deleteDoc(doc(db,"pendingOpportunities", id));
    await loadPendingOpps();
  }catch(err){
    console.error("rejectPending error:", err);
    state.toastMsg = "حصل خطأ أثناء رفض الفرصة، جرب تاني.";
    setTimeout(()=>{ state.toastMsg=""; render(); }, 4000);
  }
  render();
}
// بيمسح فرصة منشورة خالص (مش pending) — للأدمن بس، من تفاصيل الفرصة نفسها.
async function deleteOpportunity(id){
  if(!isAdmin()) return;
  if(!window.confirm("متأكد إنك عايز تمسح الفرصة دي نهائيًا؟")) return;
  try{
    await deleteDoc(doc(db,"opportunities", id));
    state.openOppId = null;
    await loadOpportunities();
    state.toastMsg = "تم حذف الفرصة.";
  }catch(err){
    console.error("deleteOpportunity error:", err);
    state.toastMsg = "حصل خطأ أثناء حذف الفرصة، جرب تاني.";
  }
  render();
  setTimeout(()=>{ state.toastMsg=""; render(); }, 4000);
}
// بيحدّث فرصة موجودة أصلًا (بدل ما تتمسح وتتضاف تاني) — أهم استخدام ليها إنك
// تحط/تصلّح الوسوم (tags) على فرص قديمة اتضافت زمان من غير وسوم، عشان نسبة
// التطابق بتاعتها تبقى صح بدل ما تفضل 50% ثابتة للجميع.
async function updateOpportunity(form){
  if(!isAdmin() || !state.editingOppId) return;
  const fd = new FormData(form);
  const reqsRaw = fd.get("requirements")||"";
  const updated = {
    title: fd.get("title"), organization: fd.get("organization"), category: fd.get("category"),
    description: fd.get("description"), deadline: fd.get("deadline"),
    requirements: reqsRaw.split("\n").map(s=>s.trim()).filter(Boolean),
    link: fd.get("link")||"",
    tags: [...state.editOppTags], stageTags: [...state.editOppStages]
  };
  try{
    await updateDoc(doc(db,"opportunities", state.editingOppId), updated);
    await loadOpportunities();
    state.toastMsg = "تم حفظ التعديلات على الفرصة ✓";
  }catch(err){
    console.error("updateOpportunity error:", err);
    state.toastMsg = "حصل خطأ أثناء حفظ التعديلات، جرب تاني.";
  }
  state.editingOppId = null; state.editOppTags = new Set(); state.editOppStages = new Set();
  render();
  setTimeout(()=>{ state.toastMsg=""; render(); }, 4000);
}
// بيمسح مصدر تعليمي (فيديو/PDF/مقال/كورس) — للأدمن بس.
async function deleteResource(id){
  if(!isAdmin()) return;
  if(!window.confirm("متأكد إنك عايز تمسح المصدر ده نهائيًا؟")) return;
  try{
    await deleteDoc(doc(db,"resources", id));
    await loadResources();
    state.toastMsg = "تم حذف المصدر.";
  }catch(err){
    console.error("deleteResource error:", err);
    state.toastMsg = "حصل خطأ أثناء حذف المصدر، جرب تاني.";
  }
  render();
  setTimeout(()=>{ state.toastMsg=""; render(); }, 4000);
}
// بتحفظ تعديلات كورس موجود: بتضيف فيديوهات جديدة (من غير ما تلمس اللي موجودة)،
// وبتحدّث العنوان/الوصف/الشهادة/الوسوم لو اتغيّروا.
async function submitResourceEdit(form, resourceId){
  if(!isAdmin()) return;
  const r = state.resources.find(x=>x.id===resourceId);
  if(!r) return;
  const fd = new FormData(form);
  const newLessons = parseLessonsRaw(fd.get("newLessonsRaw"));
  const updated = {
    title: fd.get("title") || r.title,
    description: fd.get("description") || "",
    hasCertificate: fd.get("hasCertificate")==="true",
    tags: [...state.adminResTags],
    lessons: [...(r.lessons||[]), ...newLessons],
  };
  try{
    await updateDoc(doc(db,"resources", resourceId), updated);
    await loadResources();
    state.adminMsg = newLessons.length ? `تم الحفظ ✓ اتضاف ${newLessons.length} فيديو جديد للكورس.` : "تم حفظ التعديلات ✓";
  }catch(err){
    console.error("submitResourceEdit error:", err);
    state.adminMsg = "حصل خطأ أثناء حفظ التعديلات، جرب تاني.";
  }
  state.editingResourceId = null; state.adminResTags = new Set();
  render();
  setTimeout(()=>{ state.adminMsg=""; render(); }, 4000);
}
// بتمسح فيديو واحد بس من كورس موجود (بالانديكس بتاعه جوه مصفوفة lessons).
async function removeLessonFromCourse(resourceId, idx){
  if(!isAdmin()) return;
  const r = state.resources.find(x=>x.id===resourceId);
  if(!r) return;
  if(!window.confirm("متأكد إنك عايز تمسح الفيديو ده من الكورس؟")) return;
  const lessons = (r.lessons||[]).filter((_,i)=>i!==idx);
  try{
    await updateDoc(doc(db,"resources", resourceId), {lessons});
    await loadResources();
  }catch(err){
    console.error("removeLessonFromCourse error:", err);
    state.adminMsg = "حصل خطأ أثناء حذف الفيديو، جرب تاني.";
  }
  render();
  setTimeout(()=>{ state.adminMsg=""; render(); }, 4000);
}
async function toggleResourceComplete(resId){
  const isDone = state.completedResourceIds.includes(resId);
  state.completedResourceIds = isDone ? state.completedResourceIds.filter(id=>id!==resId) : [...state.completedResourceIds, resId];
  render();
  try{
    await updateDoc(doc(db,"users",state.user.uid), {completedResourceIds: state.completedResourceIds});
  }catch(err){
    console.error("toggleResourceComplete error:", err);
    state.toastMsg = "حصل خطأ أثناء حفظ التقدم، جرب تاني.";
    render();
    setTimeout(()=>{ state.toastMsg=""; render(); }, 4000);
  }
}
// بتعلّم فيديو معيّن جوه كورس (بيتخزن كـ "resourceId:index") كمكتمل أو لأ.
function lessonKey(resourceId, idx){ return `${resourceId}:${idx}`; }
async function toggleLessonComplete(resourceId, idx){
  const key = lessonKey(resourceId, idx);
  const isDone = state.completedLessonIds.includes(key);
  state.completedLessonIds = isDone ? state.completedLessonIds.filter(k=>k!==key) : [...state.completedLessonIds, key];
  render();
  try{
    await updateDoc(doc(db,"users",state.user.uid), {completedLessonIds: state.completedLessonIds});
  }catch(err){
    console.error("toggleLessonComplete error:", err);
    state.toastMsg = "حصل خطأ أثناء حفظ التقدم، جرب تاني.";
    render();
    setTimeout(()=>{ state.toastMsg=""; render(); }, 4000);
  }
}
function courseProgress(r){
  const total = (r.lessons||[]).length;
  const done = (r.lessons||[]).filter((_,i)=>state.completedLessonIds.includes(lessonKey(r.id,i))).length;
  return {done, total};
}
async function submitQuizAnswers(){
  const quiz = state.quizzes.find(q=>q.id===state.activeQuizId);
  if(!quiz) return;
  let score = 0;
  quiz.questions.forEach((q,i)=>{ if(state.quizAnswers[i]===q.correct) score++; });
  const total = quiz.questions.length;
  const passed = (score/total) >= 0.7;
  state.quizResults = {...state.quizResults, [quiz.id]: {score, total, passed, completedAt: Date.now()}};
  state.quizSubmitted = true;
  render();
  try{
    await updateDoc(doc(db,"users",state.user.uid), {quizResults: state.quizResults});
  }catch(err){
    console.error("submitQuizAnswers error:", err);
    state.toastMsg = "حصل خطأ أثناء حفظ نتيجة الاختبار، النتيجة ظهرت بس ممكن متتحفظش.";
    render();
    setTimeout(()=>{ state.toastMsg=""; render(); }, 4000);
  }
}
async function htmlToPdf(innerHtml, filename, widthPx, heightPx){
  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:-9999px;top:0;width:${widthPx}px;height:${heightPx}px;background:#fff;direction:rtl;font-family:'Cairo',Tahoma,Arial,sans-serif;`;
  holder.innerHTML = innerHtml;
  document.body.appendChild(holder);
  await new Promise(r=>setTimeout(r,80));
  const canvas = await html2canvas(holder, {scale:2, backgroundColor:"#ffffff", useCORS:true});
  document.body.removeChild(holder);
  const imgData = canvas.toDataURL("image/png");
  const jsPDFLib = window.jspdf && window.jspdf.jsPDF;
  if(!jsPDFLib){ alert("مكتبة تجهيز الملف لسه بتتحمل، جرب تاني بعد ثانية."); return; }
  const pdf = new jsPDFLib({orientation: widthPx>heightPx?"landscape":"portrait", unit:"px", format:[widthPx, heightPx]});
  pdf.addImage(imgData, "PNG", 0, 0, widthPx, heightPx);
  pdf.save(filename);
}
// زي htmlToPdf بس بتضمن صفحة واحدة بس دايمًا: بتسيب المحتوى ياخد ارتفاعه الطبيعي
// (من غير ما تقصّه لو طويل)، وبعدين لو طلع أطول من مقاس الصفحة بتصغّره كله بنفس
// النسبة عشان يتظبط في صفحة واحدة، بدل ما يتقطع نص الكلام أو يتقسم على صفحتين.
async function htmlToSinglePagePdf(innerHtml, filename, widthPx, pageHeightPx){
  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:-9999px;top:0;width:${widthPx}px;background:#fff;direction:rtl;font-family:'Cairo',Tahoma,Arial,sans-serif;`;
  holder.innerHTML = innerHtml;
  document.body.appendChild(holder);
  await new Promise(r=>setTimeout(r,80));
  const naturalHeightPx = holder.scrollHeight;
  const canvas = await html2canvas(holder, {scale:2, backgroundColor:"#ffffff", useCORS:true, height: naturalHeightPx, windowHeight: naturalHeightPx});
  document.body.removeChild(holder);
  const imgData = canvas.toDataURL("image/png");
  const jsPDFLib = window.jspdf && window.jspdf.jsPDF;
  if(!jsPDFLib){ alert("مكتبة تجهيز الملف لسه بتتحمل، جرب تاني بعد ثانية."); return; }
  const fitScale = Math.min(1, pageHeightPx/naturalHeightPx);
  const drawWidth = widthPx*fitScale;
  const drawHeight = naturalHeightPx*fitScale;
  const offsetX = (widthPx-drawWidth)/2;
  const pdf = new jsPDFLib({orientation:"portrait", unit:"px", format:[widthPx, pageHeightPx]});
  pdf.addImage(imgData, "PNG", offsetX, 0, drawWidth, drawHeight);
  pdf.save(filename);
}
// بتطلب من الذكاء الاصطناعي جملة احترافية قصيرة لمتن الشهادة، وبترجع نص
// احتياطي جاهز فورًا لو الطلب فشل لأي سبب (كوتا خلصت، مشكلة شبكة، إلخ)
// عشان الشهادة تتولد دايمًا حتى لو الـAI مش متاح دلوقتي.
async function generateCertificateText(courseName, userName){
  const fallback = `يشهد فريق NextStep AI بأن ${userName} أتم بنجاح واجتهاد كورس "${courseName}"، ويتمنى له مزيدًا من التقدم في مسيرته المهنية.`;
  try{
    const prompt = `اكتب جملة احترافية واحدة بس (من غير أي مقدمة أو علامات اقتباس) لمتن شهادة إتمام كورس، بالعربي الفصيح البسيط، تقول إن الشخص اسمه "${userName}" أتم بنجاح كورس اسمه "${courseName}"، بأسلوب رسمي ومشجّع ومختصر (سطر أو سطرين بحد أقصى).`;
    const res = await fetch(GEMINI_PROXY_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ contents:[{role:"user", parts:[{text:prompt}]}], uid: state.user && state.user.uid })
    });
    if(!res.ok) return fallback;
    const data = await res.json();
    const cand = data && data.candidates && data.candidates[0];
    const text = cand && cand.content && cand.content.parts && cand.content.parts.map(x=>x.text||"").join("").trim();
    return text || fallback;
  }catch(err){
    console.error("generateCertificateText error:", err);
    return fallback;
  }
}
function certificateHtml(bodyText, dateStr){
  return `
  <div style="width:1200px;height:850px;background:linear-gradient(135deg,#0A2C35,#0E3A45);display:flex;flex-direction:column;align-items:center;justify-content:space-between;color:#fff;box-sizing:border-box;border:8px solid #E8A33D;padding:60px;text-align:center;">
    <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:26px;letter-spacing:2px;">NextStep AI</div>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="font-size:42px;font-weight:800;margin:20px 0 8px;">شهادة إتمام</div>
      <div style="width:110px;height:3px;background:#E8A33D;margin-bottom:26px;"></div>
      <div style="font-size:19px;max-width:820px;line-height:1.9;">${escapeHtml(bodyText)}</div>
    </div>
    <div style="width:100%;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:13px;opacity:.75;">${dateStr}</div>
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="font-family:'Brush Script MT','Segoe Script',cursive;font-size:34px;color:#E8A33D;">Saleem Mahmoud</div>
        <div style="width:170px;height:2px;background:#E8A33D;margin:4px 0 6px;"></div>
        <div style="font-size:13px;opacity:.85;">سليم محمود — المدرب والمؤسس</div>
      </div>
    </div>
  </div>`;
}
async function downloadCertificate(quizId){
  const quiz = state.quizzes.find(q=>q.id===quizId);
  const result = state.quizResults[quizId];
  if(!quiz || !result) return;
  try{
  const dateStr = new Date(result.completedAt).toLocaleDateString("ar-EG");
  const bodyText = `يشهد فريق NextStep AI بأن ${escapeHtml(state.profile.name||"")} أكمل بنجاح اختبار "${escapeHtml(quiz.title)}" بنتيجة ${result.score}/${result.total}.`;
  const html = certificateHtml(bodyText, dateStr);
  await htmlToPdf(html, `شهادة - ${quiz.title}.pdf`, 1200, 850);
  }catch(err){
    console.error("downloadCertificate error:", err);
    alert("حصل خطأ أثناء تجهيز الشهادة، جرب تاني.");
  }
}
// شهادة إتمام كورس (مش مرتبطة باختبار) — بتتفعّل تلقائيًا أول ما المستخدم يخلص
// كل فيديوهات الكورس، من غير ما يحتاج يعدي اختبار الأول. المتن بيتكتب بمساعدة
// الذكاء الاصطناعي عشان يبقى احترافي، وموقّع باسم المدرب (سليم محمود).
async function downloadCourseCertificate(resourceId){
  const r = state.resources.find(x=>x.id===resourceId);
  if(!r) return;
  const {done, total} = courseProgress(r);
  if(total===0 || done<total) return;
  try{
    const dateStr = new Date().toLocaleDateString("ar-EG");
    const bodyText = await generateCertificateText(r.title, state.profile.name||"");
    const html = certificateHtml(bodyText, dateStr);
    await htmlToPdf(html, `شهادة - ${r.title}.pdf`, 1200, 850);
  }catch(err){
    console.error("downloadCourseCertificate error:", err);
    alert("حصل خطأ أثناء تجهيز الشهادة، جرب تاني.");
  }
}
function formatAchievementsList(text){
  const lines = (text||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return "";
  return `<ul style="margin:0;padding-inline-start:20px;">${lines.map(l=>`<li style="margin-bottom:6px;">${escapeHtml(l.replace(/^[-•*]\s*/,""))}</li>`).join("")}</ul>`;
}
function buildCvHtml(p){
  return `
  <div style="width:900px;min-height:1273px;background:#fff;box-sizing:border-box;padding:0;">
    <div style="background:#0E3A45;color:#fff;padding:40px 50px;display:flex;align-items:center;gap:24px;">
      ${p.photoBase64?`<img src="${p.photoBase64}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #E8A33D;">`:""}
      <div>
        <div style="font-size:34px;font-weight:800;">${escapeHtml(p.name||"")}</div>
        <div style="font-size:15px;color:#F3C57A;margin-top:8px;">${escapeHtml(stageDisplayText(p))}${p.school?" — "+escapeHtml(p.school):""}</div>
        <div style="font-size:13px;color:#E4EDEE;margin-top:6px;">${escapeHtml(p.location||"")}${p.country?"، "+escapeHtml(p.country):""}${p.age?" — "+p.age+" سنة":""}</div>
        <div style="font-size:12.5px;color:#F3C57A;margin-top:6px;">${escapeHtml(p.email||"")}${p.phone?"  ·  "+escapeHtml(p.phone):""}${p.linkedin?"  ·  LinkedIn":""}${p.github?"  ·  GitHub":""}</div>
      </div>
    </div>
    <div style="padding:35px 50px;">
      ${p.goal?`<div style="margin-bottom:26px;"><div style="font-size:14px;font-weight:800;color:#0E3A45;border-bottom:2px solid #E8A33D;display:inline-block;padding-bottom:4px;margin-bottom:10px;">الهدف المهني</div><div style="font-size:14.5px;color:#14262B;">${escapeHtml(p.goal)}</div></div>`:""}
      <div style="margin-bottom:26px;">
        <div style="font-size:14px;font-weight:800;color:#0E3A45;border-bottom:2px solid #E8A33D;display:inline-block;padding-bottom:4px;margin-bottom:10px;">المهارات</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">${(p.skills||[]).map(s=>`<span style="background:#E4EDEE;color:#164B58;padding:5px 12px;border-radius:99px;font-size:13px;">${escapeHtml(s)}</span>`).join("")||"<span style='color:#5C7278;font-size:13px;'>لسه معملتش إضافة مهارات</span>"}</div>
      </div>
      <div style="margin-bottom:26px;">
        <div style="font-size:14px;font-weight:800;color:#0E3A45;border-bottom:2px solid #E8A33D;display:inline-block;padding-bottom:4px;margin-bottom:10px;">الاهتمامات</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">${(p.interests||[]).map(s=>`<span style="background:#FDF3E2;color:#8A5B10;padding:5px 12px;border-radius:99px;font-size:13px;">${escapeHtml(s)}</span>`).join("")||"<span style='color:#5C7278;font-size:13px;'>لسه معملتش إضافة اهتمامات</span>"}</div>
      </div>
      ${p.achievements?`<div style="margin-bottom:26px;"><div style="font-size:14px;font-weight:800;color:#0E3A45;border-bottom:2px solid #E8A33D;display:inline-block;padding-bottom:4px;margin-bottom:10px;">الخبرات والإنجازات والمشاركات</div><div style="font-size:14px;color:#14262B;line-height:1.7;">${formatAchievementsList(p.achievements)}</div></div>`:""}
      ${p.englishLevel?`<div style="margin-bottom:26px;"><div style="font-size:14px;font-weight:800;color:#0E3A45;border-bottom:2px solid #E8A33D;display:inline-block;padding-bottom:4px;margin-bottom:10px;">اللغة الإنجليزية</div><div style="font-size:14.5px;">${escapeHtml(p.englishLevel)}</div></div>`:""}
    </div>
  </div>`;
}
// نسخة مخصصة لأنظمة ATS: بدون صورة، وبدون badges/pills ملونة، بس عناوين وفقرات
// ونقط نص عادي بسيط عمود واحد. ملحوظة هندسية مهمة: مكتبة jsPDF برسم نص حقيقي
// (pdf.text) مش بتدعم اللغة العربية صح من غير خط مخصص + إعادة تشكيل للحروف
// (reshaping) وترتيب اتجاه (bidi)، ودعمها حتى بعد كده جزئي وبيتكسر لما يبقى في
// سطر فيه عربي وإنجليزي مع بعض (زي الإيميل جوه سطر عربي) — يعني لو استخدمناها
// هنا الكلام العربي هيطلع مبعثر أو معكوس. فالأضمن إننا نفضل نستخدم رسم المتصفح
// نفسه للنص (html2canvas) اللي بيطلع عربي سليم 100%، وبس نخلي الناتج PDF حقيقي
// قابل للتنزيل مباشرة (مش نافذة طباعة) وبتصميم بسيط ملوش صورة ولا ألوان.
function buildAtsCvHtml(p){
  const skillsLine = (p.skills||[]).join(" · ") || "—";
  const interestsLine = (p.interests||[]).join(" · ") || "—";
  return `
  <div style="width:900px;min-height:1273px;background:#fff;box-sizing:border-box;padding:50px 55px;color:#111;">
    <div style="font-size:30px;font-weight:800;margin-bottom:4px;">${escapeHtml(p.name||"")}</div>
    <div style="font-size:14px;color:#333;margin-bottom:4px;">${escapeHtml(stageDisplayText(p))}${p.school?" — "+escapeHtml(p.school):""}</div>
    <div style="font-size:13px;color:#333;margin-bottom:2px;">${escapeHtml(p.location||"")}${p.country?"، "+escapeHtml(p.country):""}${p.age?" — "+p.age+" سنة":""}</div>
    <div style="font-size:13px;color:#333;margin-bottom:24px;">${escapeHtml(p.email||"")}${p.phone?"  ·  "+escapeHtml(p.phone):""}${p.linkedin?"  ·  LinkedIn":""}${p.github?"  ·  GitHub":""}</div>
    ${p.goal?`<div style="margin-bottom:22px;"><div style="font-size:15px;font-weight:800;border-bottom:1px solid #999;padding-bottom:4px;margin-bottom:8px;">الهدف المهني</div><div style="font-size:14px;line-height:1.7;">${escapeHtml(p.goal)}</div></div>`:""}
    <div style="margin-bottom:22px;"><div style="font-size:15px;font-weight:800;border-bottom:1px solid #999;padding-bottom:4px;margin-bottom:8px;">المهارات</div><div style="font-size:14px;line-height:1.7;">${escapeHtml(skillsLine)}</div></div>
    <div style="margin-bottom:22px;"><div style="font-size:15px;font-weight:800;border-bottom:1px solid #999;padding-bottom:4px;margin-bottom:8px;">الاهتمامات</div><div style="font-size:14px;line-height:1.7;">${escapeHtml(interestsLine)}</div></div>
    ${p.achievements?`<div style="margin-bottom:22px;"><div style="font-size:15px;font-weight:800;border-bottom:1px solid #999;padding-bottom:4px;margin-bottom:8px;">الخبرات والإنجازات والمشاركات</div><div style="font-size:14px;line-height:1.7;">${formatAchievementsList(p.achievements)}</div></div>`:""}
    ${p.englishLevel?`<div><div style="font-size:15px;font-weight:800;border-bottom:1px solid #999;padding-bottom:4px;margin-bottom:8px;">اللغة الإنجليزية</div><div style="font-size:14px;">${escapeHtml(p.englishLevel)}</div></div>`:""}
  </div>`;
}
// بتاخد بيانات البروفايل الخام وتحاول تحسّن صياغة "الهدف المهني" و"الإنجازات"
// بالذكاء الاصطناعي في طلب واحد بس (توفيرًا في الحصة)، وترجع نسخة معدّلة من
// البروفايل للاستخدام في الـCV بس — من غير ما تلمس أو تحفظ حاجة في بروفايل
// المستخدم الأصلي. بترجع {profile, polished} — polished=false يبقى صريح إن
// التحسين متعملش (بدل ما نرجع النص الأصلي بصمت واليوزر يفتكر إنه اتحسّن).
async function polishCvContent(p){
  const rawGoal = (p.goal||"").trim();
  const rawAch = (p.achievements||"").trim();
  if(!rawGoal && !rawAch) return {profile:p, polished:false};
  try{
    const prompt = `أنت خبير عالمي في كتابة السير الذاتية الاحترافية (CV writer). تحت كلام خام كتبه طالب/خريج مصري عن نفسه. مطلوب منك تعيد صياغته بالكامل — مش مجرد تعديل بسيط — بحيث يبقى احترافي جدًا:
- استخدم أفعال قوية وحركة (طوّر، قاد، نفّذ، ساهم، حقق...) بدل الجمل الجامدة.
- اختصر وركّز على الأهم، من غير حشو أو تكرار.
- حافظ على المعنى والحقائق زي ما هي بالظبط، من غير ما تختلق أي معلومة أو رقم أو إنجاز مش مذكور خالص.
- اكتب بالعربية الفصحى البسيطة والمفهومة (مش عامية، ومش لغة معقدة زيادة).

الهدف المهني الخام: """${rawGoal||"-"}"""
الإنجازات والمشاركات الخام (كل نقطة في سطر): """${rawAch||"-"}"""

رد بصيغة JSON بس من غير أي كلام زيادة قبله أو بعده ومن غير أي علامات markdown، بالشكل ده بالظبط: {"goal":"النص المحسّن للهدف","achievements":"سطر1\\nسطر2\\nسطر3"}`;
    const res = await fetch(GEMINI_PROXY_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        contents:[{role:"user", parts:[{text: prompt}]}],
        uid: state.user && state.user.uid
      })
    });
    if(!res.ok) return {profile:p, polished:false};
    const data = await res.json();
    const cand = data && data.candidates && data.candidates[0];
    const text = (cand && cand.content && cand.content.parts && cand.content.parts.map(x=>x.text||"").join("") || "").trim();
    // بنستخرج أول { ... } موجود في الرد بدل ما نعتمد بس على إزالة ```json من
    // الأول والآخر — أكثر تحمّلًا لو الـAI ضاف أي نص زيادة حوالين الـJSON.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if(!jsonMatch) return {profile:p, polished:false};
    const parsed = JSON.parse(jsonMatch[0]);
    const newGoal = (parsed.goal && rawGoal) ? parsed.goal : p.goal;
    const newAch = (parsed.achievements && rawAch) ? parsed.achievements : p.achievements;
    const changed = (newGoal!==p.goal) || (newAch!==p.achievements);
    return {profile: {...p, goal:newGoal, achievements:newAch}, polished: changed};
  }catch(err){
    console.error("polishCvContent error:", err);
    return {profile:p, polished:false}; // أي مشكلة (شبكة، JSON مش مظبوط...) نرجع للنص الأصلي بدل ما نوقف الـCV
  }
}
async function generateCV(){
  const allowed = await tryConsumeCvUsage("design");
  if(!allowed){ alert(`وصلت للحد اليومي لعمل الـCV بالتصميم المميز (${currentCvLimit()} في اليوم). جرب تاني بكرة.`); return; }
  state.cvGenerating = true; render();
  let p = {...state.profile, email: state.profile.contactEmail || state.user.email};
  try{
    const polishResult = await polishCvContent(p);
    p = polishResult.profile;
    await htmlToSinglePagePdf(buildCvHtml(p), `CV - ${p.name||"NextStep"}.pdf`, 900, 1273);
    state.toastMsg = polishResult.polished ? "تم تحميل الـCV بعد تحسين الصياغة بالذكاء الاصطناعي ✓" : "تم تحميل الـCV (من غير تحسين AI — إما وصلت لحد الاستخدام اليومي أو الخدمة مش متاحة دلوقتي).";
    setTimeout(()=>{ state.toastMsg=""; render(); }, 5000);
  }catch(err){
    console.error("generateCV error:", err);
    alert("حصل خطأ أثناء تجهيز ملف الـCV، جرب تاني.");
  }
  state.cvGenerating = false; render();
}
async function downloadAtsCv(){
  const allowed = await tryConsumeCvUsage("ats");
  if(!allowed){ alert(`وصلت للحد اليومي لعمل الـCV بصيغة ATS (${currentCvLimit()} في اليوم). جرب تاني بكرة.`); return; }
  state.cvGenerating = true; render();
  let p = {...state.profile, email: state.profile.contactEmail || state.user.email};
  try{
    const polishResult = await polishCvContent(p);
    p = polishResult.profile;
    await htmlToSinglePagePdf(buildAtsCvHtml(p), `CV-ATS - ${p.name||"NextStep"}.pdf`, 900, 1273);
    state.toastMsg = polishResult.polished ? "تم تحميل الـCV بعد تحسين الصياغة بالذكاء الاصطناعي ✓" : "تم تحميل الـCV (من غير تحسين AI — إما وصلت لحد الاستخدام اليومي أو الخدمة مش متاحة دلوقتي).";
    setTimeout(()=>{ state.toastMsg=""; render(); }, 5000);
  }catch(err){
    console.error("downloadAtsCv error:", err);
    alert("حصل خطأ أثناء تجهيز ملف الـCV، جرب تاني.");
  }
  state.cvGenerating = false; render();
}
// ============ auth actions ============
async function handleGoogleSignIn(){
  state.authError=""; state.authBusy=true; render();
  try{
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const info = getAdditionalUserInfo(cred);
    if(info && info.isNewUser){
      await setDoc(doc(db,"users",cred.user.uid), {
        name: cred.user.displayName||"", email: cred.user.email||"",
        photoBase64: cred.user.photoURL||"", createdAt: Date.now()
      }, {merge:true});
    }
  }catch(err){
    if(err.code!=="auth/popup-closed-by-user"){
      state.authError = mapAuthError(err.code);
    }
  }
  state.authBusy=false; render();
}
async function handleAuthSubmit(email, password, name){
  state.authError=""; state.authBusy=true; render();
  try{
    if(state.authMode==="signup"){
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db,"users",cred.user.uid), { name: name||"", email, createdAt: Date.now() });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  }catch(err){
    state.authError = mapAuthError(err.code);
  }
  state.authBusy=false; render();
}
function mapAuthError(code){
  const map = {
    "auth/email-already-in-use":"البريد الإلكتروني ده مسجل قبل كده، جرّب تسجيل الدخول بدل الإنشاء.",
    "auth/invalid-email":"صيغة البريد الإلكتروني مش صحيحة.",
    "auth/weak-password":"كلمة المرور لازم تكون 6 حروف أو أرقام على الأقل.",
    "auth/wrong-password":"كلمة المرور غلط.",
    "auth/invalid-credential":"البريد الإلكتروني أو كلمة المرور غلط.",
    "auth/user-not-found":"مفيش حساب بالبريد ده، جرّب تعمل حساب جديد.",
    "auth/unauthorized-domain":"الدومين اللي بتفتح منه الموقع مش مضاف في Firebase. روح Authentication ← Settings ← Authorized domains وضيفه (مثلاً الدومين اللي طلع من Netlify).",
    "auth/missing-password":"اكتب كلمة المرور.",
  };
  return map[code] || "حصل خطأ، جرّب تاني.";
}
async function handleLogout(){ await signOut(auth); }
async function handleResetPassword(email){
  if(!email){ state.authError="اكتب إيميلك في الحقل فوق الأول، وبعدين دوس نسيت كلمة المرور."; render(); return; }
  try{
    await sendPasswordResetEmail(auth, email);
    state.resetMsg = "بعتنالك رابط إعادة تعيين كلمة المرور على بريدك، افتح الإيميل واتبع الخطوات.";
    state.authError="";
  }catch(err){
    state.authError = mapAuthError(err.code);
  }
  render();
}

// ============ profile setup submit ============
async function submitAdminQuiz(form){
  if(!isAdmin()){ state.adminMsg = "إنشاء الاختبارات للأدمن بس دلوقتي."; state.adminOpen=null; render(); setTimeout(()=>{state.adminMsg="";render();},4000); return; }
  const fd = new FormData(form);
  const lines = (fd.get("questionsRaw")||"").split("\n").map(l=>l.trim()).filter(Boolean);
  const questions = [];
  for(const line of lines){
    const parts = line.split("|").map(p=>p.trim());
    if(parts.length<6) continue;
    const [q, o1, o2, o3, o4, correct] = parts;
    const idx = parseInt(correct,10)-1;
    if(idx<0 || idx>3) continue;
    questions.push({q, options:[o1,o2,o3,o4], correct: idx});
  }
  if(questions.length===0){
    state.adminMsg = "معرفتش أفهم صيغة أي سؤال، راجع المثال وحاول تاني.";
    render(); setTimeout(()=>{state.adminMsg="";render();},4000); return;
  }
  try{
    await addDoc(collection(db,"quizzes"), { resourceId: fd.get("resourceId"), title: fd.get("title"), questions });
    await loadQuizzes();
    state.adminMsg = `تم إنشاء الاختبار بـ ${questions.length} سؤال ✓`; state.adminOpen=null;
  }catch(err){
    console.error("submitAdminQuiz error:", err);
    state.adminMsg = "حصل خطأ أثناء حفظ الاختبار، جرب تاني.";
  }
  render();
  setTimeout(()=>{ state.adminMsg=""; render(); }, 4000);
}
async function submitAdminOpp(form){
  const fd = new FormData(form);
  const reqsRaw = fd.get("requirements")||"";
  const opp = {
    title: fd.get("title"), organization: fd.get("organization"), category: fd.get("category"),
    description: fd.get("description"), deadline: fd.get("deadline"),
    requirements: reqsRaw.split("\n").map(s=>s.trim()).filter(Boolean),
    link: fd.get("link")||"",
    tags: [...state.adminOppTags], stageTags: [...state.adminOppStages]
  };
  try{
    if(isAdmin()){
      await addDoc(collection(db,"opportunities"), {...opp, reviewed:true});
      await loadOpportunities();
      state.adminMsg = "تمت إضافة الفرصة بنجاح ✓ هتلاقيها في الفرص المقترحة";
    } else {
      await addDoc(collection(db,"pendingOpportunities"), {...opp, createdAt:Date.now()});
      await loadPendingOpps();
      state.adminMsg = "تم إرسال الفرصة للمراجعة، هتظهر للطلاب أول ما تتوافق عليها.";
    }
  }catch(err){
    console.error("submitAdminOpp error:", err);
    state.adminMsg = "حصل خطأ أثناء حفظ الفرصة، جرب تاني.";
  }
  state.adminOppTags = new Set(); state.adminOppStages = new Set();
  state.adminOpen = null;
  render();
  setTimeout(()=>{ state.adminMsg=""; render(); }, 4000);
}
// بيحوّل سطر واحد من الـtextarea لكائن فيديو (lesson) كامل — الصيغة:
// "عنوان الفيديو | رابط اليوتيوب | رابط PDF (اختياري) | لينكات إضافية (اختياري)"
// اللينكات الإضافية نفسها بصيغة "اسم=رابط" ومفصولة بـ ؛ لو أكتر من واحد.
function parseLessonLine(line){
  const parts = line.split("|").map(s=>s.trim());
  const title = parts[0]||"";
  const link = parts[1]||"";
  if(!title || !isValidLink(link)) return null;
  const lesson = {title, link};
  const pdf = (parts[2]||"").trim();
  if(isValidLink(pdf)) lesson.pdfLink = pdf;
  const extrasRaw = (parts[3]||"").trim();
  if(extrasRaw){
    const extraLinks = extrasRaw.split("؛").map(s=>s.trim()).filter(Boolean).map(pair=>{
      const idx = pair.indexOf("=");
      if(idx===-1) return null;
      const label = pair.slice(0,idx).trim();
      const url = pair.slice(idx+1).trim();
      return (label && isValidLink(url)) ? {label, url} : null;
    }).filter(Boolean);
    if(extraLinks.length) lesson.extraLinks = extraLinks;
  }
  return lesson;
}
function parseLessonsRaw(raw){
  return (raw||"").split("\n").map(l=>l.trim()).filter(Boolean).map(parseLessonLine).filter(Boolean);
}
async function submitAdminResource(form){
  if(!isAdmin()){
    state.adminMsg = "إضافة المصادر التعليمية للأدمن بس دلوقتي.";
    state.adminOpen = null; render();
    setTimeout(()=>{ state.adminMsg=""; render(); }, 4000);
    return;
  }
  const fd = new FormData(form);
  const type = fd.get("type");
  const res = { title: fd.get("title"), type, description: fd.get("description")||"", tags: [...state.adminResTags], isPremium: fd.get("isPremium")==="true" };
  if(type==="course"){
    const lessons = parseLessonsRaw(fd.get("lessonsRaw"));
    if(lessons.length===0){
      state.adminMsg = "محتاج فيديو واحد على الأقل بالشكل الصح (عنوان | رابط)، راجع المثال وحاول تاني.";
      render(); setTimeout(()=>{ state.adminMsg=""; render(); }, 4000); return;
    }
    res.lessons = lessons;
    res.link = "";
    res.hasCertificate = fd.get("hasCertificate")==="true";
    // ملف PDF ولينكات اختياريين للكورس ككل (بالإضافة للي ممكن يكون لكل فيديو لوحده)
    const pdfLinkRaw = (fd.get("pdfLink")||"").trim();
    res.pdfLink = isValidLink(pdfLinkRaw) ? pdfLinkRaw : "";
    const extraLines = (fd.get("extraLinksRaw")||"").split("\n").map(l=>l.trim()).filter(Boolean);
    res.extraLinks = extraLines.map(line=>{
      const idx = line.indexOf("|");
      if(idx===-1) return null;
      const label = line.slice(0,idx).trim();
      const url = line.slice(idx+1).trim();
      return (label && isValidLink(url)) ? {label, url} : null;
    }).filter(Boolean);
  } else {
    const link = fd.get("link")||"";
    if(!isValidLink(link)){
      state.adminMsg = "محتاج رابط صحيح للمصدر.";
      render(); setTimeout(()=>{ state.adminMsg=""; render(); }, 4000); return;
    }
    res.link = link;
    res.lessons = [];
  }
  try{
    await addDoc(collection(db,"resources"), res);
    await loadResources();
    state.adminMsg = "تمت إضافة المصدر بنجاح ✓ هتلاقيه في تبويب مركز التعلم";
  }catch(err){
    console.error("submitAdminResource error:", err);
    state.adminMsg = "حصل خطأ أثناء حفظ المصدر، جرب تاني.";
  }
  state.adminResTags = new Set();
  state.adminOpen = null;
  render();
  setTimeout(()=>{ state.adminMsg=""; render(); }, 4000);
}
async function submitProfile(){
  if(!state.setupName.trim() || !state.setupStage){
    state.setupError = "من فضلك اكتب اسمك واختار مرحلتك الدراسية."; render(); return;
  }
  if(state.setupInterests.size===0 || state.setupSkills.size===0){
    state.setupError = "اختار اهتمام ومهارة واحدة على الأقل عشان نقدر نقترحلك فرص مناسبة."; render(); return;
  }
  const profile = {
    name: state.setupName.trim(), stage: state.setupStage, gradeDetail: state.setupGradeDetail,
    working: state.setupWorking, workplace: state.setupWorkplace.trim(),
    age: state.setupAge?Number(state.setupAge):null, country: state.setupCountry.trim(),
    school: state.setupSchool.trim(), englishLevel: state.setupEnglish, goal: state.setupGoal,
    interests: [...state.setupInterests], skills: [...state.setupSkills], learnSkills: [...state.setupLearnSkills],
    location: state.setupLocation.trim(), cvLink: state.setupCvLink.trim(),
    achievements: state.setupAchievements.trim(), photoBase64: state.setupPhotoBase64,
    phone: state.setupPhone.trim(), linkedin: state.setupLinkedin.trim(), github: state.setupGithub.trim(),
    contactEmail: state.setupContactEmail.trim(),
    completedResourceIds: state.completedResourceIds||[], completedLessonIds: state.completedLessonIds||[], quizResults: state.quizResults||{},
    createdAt: state.profile?.createdAt || Date.now()
  };
  try{
    await setDoc(doc(db,"users",state.user.uid), profile, {merge:true});
    state.profile = profile;
    await loadOpportunities();
    await loadResources();
    await loadPendingOpps();
    await loadQuizzes();
    state.screen = "dashboard";
  }catch(err){
    console.error("submitProfile error:", err);
    state.setupError = "حصل خطأ أثناء حفظ ملفك الشخصي. تأكد من اتصال الإنترنت وجرب تاني.";
  }
  render();
}

// ============ render ============
const app = document.getElementById("app");

function render(){
  if(state.screen==="loading") return renderLoading();
  if(state.screen==="auth") return renderAuth();
  if(state.screen==="profile-setup") return renderProfileSetup();
  if(state.screen==="dashboard") return renderDashboard();
}

function renderLoading(){
  app.innerHTML = `<div class="center-screen"><div class="spinner"></div></div>`;
}

function renderAuth(){
  const isSignup = state.authMode==="signup";
  app.innerHTML = `
  <div class="center-screen">
    <div class="auth-wrap">
      <div class="brand"><div class="brand-mark">${logoIconSvg()}</div><div class="brand-word">NextStep AI</div></div>
      <div class="card auth-card">
        <div class="auth-title">${isSignup?"إنشاء حساب جديد":"تسجيل الدخول"}</div>
        <div class="auth-sub">${isSignup?"ابدأ رحلتك نحو الفرصة الصح":"اهلاً بيك تاني، سجّل دخولك للمتابعة"}</div>
        ${state.authError?`<div class="error-box">${state.authError}</div>`:""}
        ${state.resetMsg?`<div class="note-box" style="background:#EAF6EF;color:#1F7A47;margin-bottom:14px;">${state.resetMsg}</div>`:""}
        <form id="auth-form">
          ${isSignup?`<div class="field"><label>الاسم</label><input name="name" type="text" placeholder="اسمك بالكامل" required></div>`:""}
          <div class="field"><label>البريد الإلكتروني</label><input id="auth-email" name="email" type="email" placeholder="example@email.com" required></div>
          <div class="field"><label>كلمة المرور</label><input name="password" type="password" placeholder="6 حروف أو أرقام على الأقل" required></div>
          <button type="submit" class="btn btn-gold btn-block" ${state.authBusy?"disabled":""}>${state.authBusy?"لحظة...":(isSignup?"إنشاء الحساب":"دخول")}</button>
        </form>
        <div style="display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--ink-muted);font-size:13px;"><div style="flex:1;height:1px;background:var(--border);"></div>أو<div style="flex:1;height:1px;background:var(--border);"></div></div>
        <button class="btn btn-ghost btn-block" data-action="google-signin" ${state.authBusy?"disabled":""}>تسجيل الدخول بحساب Google</button>
        ${!isSignup?`<div class="switch-line"><a data-action="forgot-password">نسيت كلمة المرور؟</a></div>`:""}
        <div class="switch-line">
          ${isSignup? `عندك حساب بالفعل؟ <a data-action="show-login">سجّل دخولك</a>` : `لسه معملتش حساب؟ <a data-action="show-signup">أنشئ واحد جديد</a>`}
        </div>
      </div>
    </div>
  </div>`;
}

function renderProfileSetup(){
  app.innerHTML = `
  <div class="center-screen">
    <div class="card setup-wrap">
      <div class="setup-progress"><span style="width:60%"></span></div>
      <h2 style="font-size:19px;font-weight:800;margin-bottom:4px;">كمّل ملفك الشخصي</h2>
      <div class="auth-sub">هنستخدم البيانات دي عشان نقترحلك الفرص الأنسب ليك</div>
      ${state.setupError?`<div class="error-box">${state.setupError}</div>`:""}

      <div class="field"><label>اسمك</label><input id="setup-name" type="text" value="${state.setupName}" placeholder="اسمك بالكامل"></div>

      <div style="display:flex;gap:10px;">
        <div class="field" style="flex:1;"><label>عمرك</label><input id="setup-age" type="number" min="10" max="99" value="${state.setupAge}" placeholder="مثال: 16"></div>
        <div class="field" style="flex:1;"><label>الدولة</label><input id="setup-country" type="text" value="${state.setupCountry}"></div>
      </div>

      <div class="field"><label>مرحلتك الدراسية</label>
        <div class="stage-grid">
          ${STAGES.map(s=>`<button type="button" class="stage-opt ${state.setupStage===s.id?"selected":""}" data-action="pick-stage" data-stage="${s.id}">${s.label}</button>`).join("")}
        </div>
      </div>

      ${state.setupStage && GRADE_OPTIONS[state.setupStage] ? `
      <div class="field"><label>تحديدًا</label>
        <div class="tag-grid">
          ${GRADE_OPTIONS[state.setupStage].map(g=>`<button type="button" class="pill ${state.setupGradeDetail===g?"selected":""}" data-action="pick-grade-detail" data-grade="${g}">${g}</button>`).join("")}
        </div>
      </div>` : ""}

      ${state.setupStage==="graduate" ? `
      <div class="field"><label>الوضع الوظيفي</label>
        <div class="tag-grid">
          <button type="button" class="pill ${state.setupWorking==="yes"?"selected":""}" data-action="pick-working" data-working="yes">شغال</button>
          <button type="button" class="pill ${state.setupWorking==="no"?"selected":""}" data-action="pick-working" data-working="no">بدوّر على شغل</button>
        </div>
      </div>
      ${state.setupWorking==="yes"?`<div class="field"><label>شغال فين؟</label><input id="setup-workplace" type="text" value="${escapeHtml(state.setupWorkplace)}" placeholder="اسم الشركة أو الجهة"></div>`:""}
      ` : ""}

      <div class="field"><label>اسم المدرسة أو الجامعة (اختياري)</label><input id="setup-school" type="text" value="${state.setupSchool}" placeholder="مثال: مدرسة النصر الثانوية"></div>

      <div style="display:flex;gap:10px;">
        <div class="field" style="flex:1;"><label>مستوى إنجليزيك</label>
          <select id="setup-english">
            <option value="">اختار</option>
            <option value="مبتدئ" ${state.setupEnglish==="مبتدئ"?"selected":""}>مبتدئ</option>
            <option value="متوسط" ${state.setupEnglish==="متوسط"?"selected":""}>متوسط</option>
            <option value="جيد" ${state.setupEnglish==="جيد"?"selected":""}>جيد</option>
            <option value="ممتاز" ${state.setupEnglish==="ممتاز"?"selected":""}>ممتاز</option>
          </select>
        </div>
        <div class="field" style="flex:1;"><label>هدفك الحالي</label>
          <select id="setup-goal">
            <option value="">اختار</option>
            <option value="منحة دراسية" ${state.setupGoal==="منحة دراسية"?"selected":""}>منحة دراسية</option>
            <option value="تدريب" ${state.setupGoal==="تدريب"?"selected":""}>تدريب</option>
            <option value="وظيفة" ${state.setupGoal==="وظيفة"?"selected":""}>وظيفة</option>
            <option value="تعلّم مهارة" ${state.setupGoal==="تعلّم مهارة"?"selected":""}>تعلّم مهارة جديدة</option>
          </select>
        </div>
      </div>

      <div class="field"><label>اهتماماتك</label>
        <div class="tag-grid">
          ${TAGS.map(t=>`<button type="button" class="pill ${state.setupInterests.has(t)?"selected":""}" data-action="toggle-interest" data-tag="${t}">${t}</button>`).join("")}
        </div>
      </div>

      <div class="field"><label>مهاراتك الحالية</label>
        <div class="tag-grid">
          ${TAGS.map(t=>`<button type="button" class="pill ${state.setupSkills.has(t)?"selected":""}" data-action="toggle-skill" data-tag="${t}">${t}</button>`).join("")}
        </div>
      </div>

      <div class="field"><label>🎯 عايز تتعلم مهارة إيه بالظبط؟ (اختياري)</label>
        <div style="font-size:12px;color:var(--ink-muted);margin-bottom:8px;">اختار المجال الأول، وبعدين حدد المهارة بالظبط — ده اللي هيخلي اقتراحات الكورسات ليك دقيقة (مثال: تصميم ← مونتاج فيديو).</div>
        <div class="tag-grid" style="margin-bottom:10px;">
          ${TAGS.map(t=>`<button type="button" class="pill ${state.learnSkillsCategoryOpen===t?"selected":""}" data-action="open-learn-category" data-tag="${t}">${t}</button>`).join("")}
        </div>
        ${state.learnSkillsCategoryOpen?`<div class="tag-grid" style="border-top:1px dashed #ccc;padding-top:10px;">
          ${(SKILL_TREE[state.learnSkillsCategoryOpen]||[]).map(sub=>`<button type="button" class="pill ${state.setupLearnSkills.has(sub)?"selected":""}" data-action="toggle-learn-skill" data-tag="${escapeHtml(sub)}">${sub}</button>`).join("")}
        </div>`:""}
        ${state.setupLearnSkills.size?`<div style="margin-top:10px;font-size:12.5px;color:var(--ink-muted);">اخترت: ${[...state.setupLearnSkills].join("، ")}</div>`:""}
      </div>

      <div class="field"><label>محافظتك أو مدينتك (اختياري)</label><input id="setup-location" type="text" value="${state.setupLocation}" placeholder="مثال: الغربية"></div>

      <div class="field"><label>رابط الـ CV بتاعك (اختياري)</label><input id="setup-cvlink" type="url" value="${state.setupCvLink}" placeholder="رابط Google Drive أو أي مكان تاني"></div>
      <div class="note-box" style="margin-top:0;margin-bottom:16px;">رفع ملف CV مباشرة هيتفعّل بعد ما نفعّل Storage على المشروع. دلوقتي الأسهل إنك تحط رابط مشاركة من Google Drive.</div>

      <div class="field"><label>صورة شخصية (اختياري)</label>
        <div style="display:flex;align-items:center;gap:12px;">
          ${state.setupPhotoBase64?`<img src="${state.setupPhotoBase64}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;">`:""}
          <input id="setup-photo" type="file" accept="image/*">
        </div>
      </div>

      <div class="field"><label>إنجازاتك ومشاركاتك (اختياري)</label><textarea id="setup-achievements" rows="3" placeholder="خبرات، تطوع، شهادات، مشاريع، أنشطة رياضية... أي حاجة تفتكرها">${escapeHtml(state.setupAchievements)}</textarea></div>

      <div style="display:flex;gap:10px;">
        <div class="field" style="flex:1;"><label>رقم الموبايل (اختياري)</label><input id="setup-phone" type="tel" value="${escapeHtml(state.setupPhone)}" placeholder="01xxxxxxxxx"></div>
        <div class="field" style="flex:1;"><label>LinkedIn (اختياري)</label><input id="setup-linkedin" type="url" value="${escapeHtml(state.setupLinkedin)}" placeholder="رابط بروفايلك"></div>
      </div>
      <div class="field"><label>إيميل للتواصل (اختياري، لو مختلف عن إيميل الدخول)</label><input id="setup-contact-email" type="email" value="${escapeHtml(state.setupContactEmail)}" placeholder="example@email.com"></div>
      <div class="field"><label>GitHub (اختياري، للمهتمين بالبرمجة)</label><input id="setup-github" type="url" value="${escapeHtml(state.setupGithub)}" placeholder="رابط بروفايلك"></div>

      <button class="btn btn-primary btn-block" data-action="submit-profile">حفظ ومتابعة</button>
    </div>
  </div>`;
}

function renderDashboard(){
  const tab = state.activeTab;
  app.innerHTML = `
    <div class="topbar">
      <div class="brand-word" style="display:flex;align-items:center;gap:9px;"><span class="brand-mark" style="width:30px;height:30px;">${logoIconSvg()}</span>NextStep AI</div>
      <div class="topbar-right">
        <span class="hi-text">أهلاً، ${escapeHtml(state.profile.name.split(" ")[0]||"")}</span>
        <button class="icon-btn" data-action="logout" title="تسجيل خروج">⎋</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab ${tab==="recommended"?"active":""}" data-action="tab" data-tab="recommended">الفرص المقترحة</button>
      <button class="tab ${tab==="resources"?"active":""}" data-action="tab" data-tab="resources">مركز التعلم</button>
      <button class="tab ${tab==="chat"?"active":""}" data-action="tab" data-tab="chat">المساعد الذكي</button>
      <button class="tab ${tab==="profile"?"active":""}" data-action="tab" data-tab="profile">ملفي</button>
      ${isAdmin()?`<button class="tab ${tab==="admin"?"active":""}" data-action="tab" data-tab="admin">الإدارة</button>`:""}
    </div>
    ${renderDeadlineAlerts()}
    <div class="content ${tab==="chat"?"content-chat":""}">
      ${tab==="recommended"?renderOppList():""}
      ${tab==="resources"?renderResourcesTab():""}
      ${tab==="chat"?renderChatTab():""}
      ${tab==="profile"?renderProfileTab():""}
      ${tab==="admin"?renderAdminTab():""}
    </div>
    ${state.openOppId?renderModal():""}
    ${state.activeQuizId?renderQuizModal():""}
    ${state.toastMsg?`<div class="global-toast">${state.toastMsg}</div>`:""}
  `;
  if(tab==="chat") scrollChatToBottom();
}

function isOppExpired(o){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(o.deadline||"")) return false;
  const today = new Date(new Date().toISOString().slice(0,10));
  return new Date(o.deadline) < today;
}
function renderOppList(){
  let list = state.opportunities.filter(o=>!isOppExpired(o));
  const hadAnyBeforeSearch = list.length>0;
  if(state.searchQuery.trim()){
    const q = state.searchQuery.trim().toLowerCase();
    list = list.filter(o=>(o.title||"").toLowerCase().includes(q) || (o.organization||"").toLowerCase().includes(q));
  }
  if(state.filterCategory) list = list.filter(o=>o.category===state.filterCategory);
  if(state.filterStage) list = list.filter(o=>!o.stageTags || o.stageTags.length===0 || o.stageTags.includes(state.filterStage));
  const searchBar = hadAnyBeforeSearch ? `
    <div class="cat-chip-row">
      <button type="button" class="pill ${!state.filterCategory?"selected":""}" data-action="quick-filter-cat" data-cat="">الكل</button>
      ${Object.entries(CATEGORIES).map(([k,v])=>`<button type="button" class="pill ${state.filterCategory===k?"selected":""}" data-action="quick-filter-cat" data-cat="${k}">${v}</button>`).join("")}
    </div>
    <form id="search-form" style="display:flex;gap:8px;margin-bottom:10px;">
      <input id="search-input" type="text" value="${escapeHtml(state.searchQuery)}" placeholder="دور على فرصة بالاسم أو الجهة..." style="flex:1;padding:11px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;">
      <button type="submit" class="btn btn-ghost" style="padding:11px 18px;">بحث</button>
      ${state.searchQuery?`<button type="button" class="btn btn-ghost" data-action="clear-search" style="padding:11px 14px;">✕</button>`:""}
    </form>
    <div style="display:flex;gap:8px;margin-bottom:14px;">
      <select id="filter-stage" data-action-change="filter-stage" style="flex:1;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13.5px;background:#fff;">
        <option value="">كل المراحل</option>
        ${STAGES.map(s=>`<option value="${s.id}" ${state.filterStage===s.id?"selected":""}>${s.label}</option>`).join("")}
      </select>
    </div>` : "";
  if(list.length===0){
    if(state.searchQuery.trim()){
      return searchBar + `<div class="empty-state"><h3>مفيش نتايج لـ "${escapeHtml(state.searchQuery)}"</h3><p>جرب كلمة تانية أو امسح البحث.</p></div>`;
    }
    return searchBar + `<div class="empty-state"><h3>مفيش فرص متاحة دلوقتي</h3><p>لو انت الأدمن، ضيف فرص حقيقية من تبويب "الإدارة" — يدويًا أو بالبحث بالـAI.</p></div>`;
  }
  const withScores = list.map(o=>({o, m:calcMatch(state.profile,o)}));
  // ترتيب أساسي حسب نسبة التطابق من الأعلى للأقل (عشان الأعلى نسبة يفضل دايمًا
  // فوق)، وبس لو اتنين بنفس النسبة بالظبط، اللي مصنّفة لمرحلة المستخدم بالظبط
  // بتتحط الأول بينهم.
  withScores.sort((a,b)=>{
    if(b.m.score!==a.m.score) return b.m.score-a.m.score;
    const aExact = (a.o.stageTags||[]).includes(state.profile.stage) ? 1 : 0;
    const bExact = (b.o.stageTags||[]).includes(state.profile.stage) ? 1 : 0;
    return bExact-aExact;
  });
  return searchBar + withScores.map(({o,m})=>{
    const dl = deadlineInfo(o.deadline);
    const mismatch = stageMismatchNote(state.profile, o);
    return `
    <div class="card opp-card" data-action="open-detail" data-id="${o.id}">
      <div class="opp-main">
        <span class="opp-cat">${CATEGORIES[o.category]||o.category}</span>
        ${o.reviewed?`<span class="badge-verified">✅ تم التحقق</span>`:""}
        <div class="opp-title">${escapeHtml(o.title)}</div>
        <div class="opp-org">${escapeHtml(o.organization||"")}</div>
        <div class="opp-deadline ${dl.urgent?"urgent":"normal"}">${dl.text}</div>
        ${mismatch?`<div style="font-size:12px;color:#B4232C;margin-top:6px;">${mismatch}</div>`:""}
      </div>
      <div class="match-badge lat" style="--pct:${m.score}"><span>${m.score}%</span></div>
    </div>`;
  }).join("");
}

function renderProfileTab(){
  const p = state.profile;
  const pct = profileCompleteness(p);
  const xp = computeXP(p);
  const level = computeLevel(xp);
  const xpIntoLevel = xp % 50;
  const achievements = computeAchievements(p);
  return `
  <div class="card" style="padding:18px 20px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-weight:800;font-size:15px;">المستوى ${level}</span>
      <span class="lat" style="font-size:12.5px;color:var(--ink-muted);">${xp} XP</span>
    </div>
    <div class="setup-progress" style="margin-bottom:14px;"><span style="width:${(xpIntoLevel/50)*100}%"></span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${achievements.map(a=>`<span class="pill ${a.unlocked?"selected":""}" style="${a.unlocked?"":"opacity:.45;"}">${a.unlocked?"🏆":"🔒"} ${a.label}</span>`).join("")}
    </div>
  </div>
  <div class="card" style="padding:18px 20px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--ink-muted);margin-bottom:6px;"><span>اكتمال الملف الشخصي</span><span class="lat">${pct}%</span></div>
    <div class="setup-progress" style="margin-bottom:0;"><span style="width:${pct}%"></span></div>
  </div>
  <div class="card" style="padding:20px;">
    ${p.photoBase64?`<div style="text-align:center;margin-bottom:16px;"><img src="${p.photoBase64}" style="width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid var(--gold-300);"></div>`:""}
    <div class="section-label">البيانات الأساسية</div>
    <div class="profile-row"><span class="profile-row-label">الاسم</span><span class="profile-row-value">${escapeHtml(p.name)}</span></div>
    <div class="profile-row"><span class="profile-row-label">العمر</span><span class="profile-row-value">${p.age||"—"}</span></div>
    <div class="profile-row"><span class="profile-row-label">الدولة</span><span class="profile-row-value">${escapeHtml(p.country||"—")}</span></div>
    <div class="profile-row"><span class="profile-row-label">المحافظة</span><span class="profile-row-value">${escapeHtml(p.location||"—")}</span></div>
    <div class="section-label" style="margin-top:14px;">الدراسة</div>
    <div class="profile-row"><span class="profile-row-label">المرحلة الدراسية</span><span class="profile-row-value">${escapeHtml(stageDisplayText(p))}</span></div>
    <div class="profile-row"><span class="profile-row-label">المدرسة / الجامعة</span><span class="profile-row-value">${escapeHtml(p.school||"—")}</span></div>
    <div class="profile-row"><span class="profile-row-label">مستوى الإنجليزي</span><span class="profile-row-value">${escapeHtml(p.englishLevel||"—")}</span></div>
    <div class="section-label" style="margin-top:14px;">الأهداف والمهارات</div>
    <div class="profile-row"><span class="profile-row-label">الهدف الحالي</span><span class="profile-row-value">${escapeHtml(p.goal||"—")}</span></div>
    <div class="profile-row"><span class="profile-row-label">الاهتمامات</span><span class="profile-row-value">${(p.interests||[]).join("، ")||"—"}</span></div>
    <div class="profile-row"><span class="profile-row-label">المهارات</span><span class="profile-row-value">${(p.skills||[]).join("، ")||"—"}</span></div>
    <div class="section-label" style="margin-top:14px;">التواصل والسيرة الذاتية</div>
    ${p.contactEmail?`<div class="profile-row"><span class="profile-row-label">إيميل للتواصل</span><span class="profile-row-value">${escapeHtml(p.contactEmail)}</span></div>`:""}
    <div class="profile-row"><span class="profile-row-label">CV</span><span class="profile-row-value">${p.cvLink?`<a href="${escapeHtml(p.cvLink)}" target="_blank" rel="noopener">فتح الرابط ↗</a>`:"—"}</span></div>
    ${p.achievements?`<div class="profile-row" style="flex-direction:column;align-items:flex-start;gap:4px;"><span class="profile-row-label">الإنجازات والمشاركات</span><span class="profile-row-value" style="font-weight:500;white-space:pre-wrap;">${escapeHtml(p.achievements)}</span></div>`:""}
  </div>
  <button class="btn btn-gold btn-block" data-action="generate-cv" style="margin-bottom:8px;" ${state.cvGenerating?"disabled":""}>${state.cvGenerating?"⏳ الذكاء الاصطناعي بيحسّن السي في...":"📄 تحميل CV (تصميم مميز)"}</button>
  <button class="btn btn-ghost btn-block" data-action="print-cv" style="margin-bottom:6px;" ${state.cvGenerating?"disabled":""}>${state.cvGenerating?"⏳ لحظات...":"📄 تحميل CV بصيغة ATS (PDF بسيط)"}</button>
  <div style="font-size:11.5px;color:var(--ink-muted);margin-bottom:10px;">متبقي ليك النهاردة: ${cvUsageRemaining("design")} من ${currentCvLimit()} (تصميم مميز) — ${cvUsageRemaining("ats")} من ${currentCvLimit()} (ATS)</div>
  <button class="link-btn" data-action="edit-profile">تعديل الملف الشخصي</button>
  `;
}

function renderAdminTab(){
  return `
  <div class="card" style="padding:20px;margin-top:0;">
    <h3 style="font-size:15.5px;font-weight:800;margin-bottom:4px;">إضافة محتوى للمنصة</h3>
    <div class="auth-sub" style="margin-bottom:14px;">ضيف فرصة أو مصدر تعلّمي حقيقي مباشرة، من غير ما تستني حد</div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <button type="button" class="pill ${state.adminOpen==="opp"?"selected":""}" data-action="admin-toggle" data-form="opp">+ فرصة جديدة</button>
      <button type="button" class="pill ${state.adminOpen==="res"?"selected":""}" data-action="admin-toggle" data-form="res">+ مصدر تعلّمي</button>
      <button type="button" class="pill ${state.adminOpen==="ai"?"selected":""}" data-action="admin-toggle" data-form="ai">🔍 البحث بالـAI ${state.pendingOpps.length?`(${state.pendingOpps.length})`:""}</button>
      <button type="button" class="pill ${state.adminOpen==="quiz"?"selected":""}" data-action="admin-toggle" data-form="quiz">+ اختبار</button>
    </div>
    ${(()=>{ const n = state.opportunities.filter(o=>!(o.tags&&o.tags.length)).length; return n>0 ? `
    <div class="note-box" style="margin-bottom:12px;">
      عندك ${n} فرصة قديمة من غير تصنيف (وسوم + مرحلة دراسية) — عشان كده نسبة التطابق بتاعتها بتطلع 50% ثابتة لأي حد، ومش متفلترة حسب المرحلة. دوس الزرار ده والـAI هيصنّفها كلها مرة واحدة.
      <div style="margin-top:8px;"><button type="button" class="btn btn-gold" data-action="bulk-fix-tags" ${state.searchBusy?"disabled":""}>${state.searchBusy?"بيصنّف...":"🏷️ صلّح تصنيف الفرص القديمة تلقائيًا"}</button></div>
    </div>`:""; })()}
    <div class="note-box" style="margin-bottom:12px;">
      كشف وحذف الفرص المكررة (نفس الفرصة أكتر من مرة) أو الوهمية (بيانات غير منطقية) تلقائيًا من غير مراجعة يدوية.
      <div style="margin-top:8px;"><button type="button" class="btn btn-ghost" data-action="cleanup-fake-opps" ${state.searchBusy?"disabled":""}>${state.searchBusy?"بيراجع...":"🧹 اكتشاف وحذف الفرص الوهمية/المكررة تلقائيًا"}</button></div>
    </div>
    ${state.adminMsg?`<div class="note-box" style="background:#EAF6EF;color:#1F7A47;">${state.adminMsg}</div>`:""}
    ${state.adminOpen==="opp"?renderAdminOppForm():""}
    ${state.adminOpen==="res"?renderAdminResourceForm():""}
    ${state.adminOpen==="ai"?renderAiSearchPanel():""}
    ${state.adminOpen==="quiz"?renderAdminQuizForm():""}
  </div>
  `;
}

function renderAdminOppForm(){
  return `
  <form id="admin-opp-form">
    <div class="field"><label>عنوان الفرصة</label><input name="title" type="text" required></div>
    <div class="field"><label>الجهة المنظمة</label><input name="organization" type="text" required></div>
    <div class="field"><label>النوع</label><select name="category">${Object.entries(CATEGORIES).map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select></div>
    <div class="field"><label>الوصف</label><input name="description" type="text" required></div>
    <div class="field"><label>آخر موعد للتقديم</label><input name="deadline" type="date" required></div>
    <div class="field"><label>رابط التقديم</label><input name="link" type="url" required placeholder="https://..."></div>
    <div class="field"><label>المتطلبات (اكتب كل شرط في سطر)</label><textarea name="requirements" rows="3"></textarea></div>
    <div class="field"><label>مناسبة لمرحلة</label><div class="tag-grid">${STAGES.map(s=>`<button type="button" class="pill ${state.adminOppStages.has(s.id)?"selected":""}" data-action="admin-toggle-stage" data-tag="${s.id}">${s.label}</button>`).join("")}</div></div>
    <div class="field"><label>الوسوم (بتتحسب عليها نسبة التطابق)</label><div class="tag-grid">${TAGS.map(t=>`<button type="button" class="pill ${state.adminOppTags.has(t)?"selected":""}" data-action="admin-toggle-tag" data-tag="${t}">${t}</button>`).join("")}</div></div>
    <button type="submit" class="btn btn-gold btn-block">إضافة الفرصة</button>
  </form>`;
}
function renderAdminResourceForm(){
  return `
  <form id="admin-res-form">
    <div class="field"><label>عنوان المصدر</label><input name="title" type="text" required></div>
    <div class="field"><label>النوع</label><select name="type"><option value="video">فيديو (لينك يوتيوب واحد)</option><option value="course">كورس (كذا فيديو يوتيوب)</option><option value="pdf">ملف PDF</option><option value="article">مقال</option></select></div>
    <div class="field"><label>مجاني ولا مميز؟</label><select name="isPremium"><option value="false">مجاني</option><option value="true">مميز (Premium)</option></select></div>
    <div class="field"><label>وصف قصير</label><input name="description" type="text"></div>
    <div class="field"><label>الرابط (لو النوع فيديو أو PDF أو مقال)</label><input name="link" type="url" placeholder="https://..."></div>
    <div class="field"><label>فيديوهات الكورس (لو النوع "كورس" بس — سطر لكل فيديو)</label>
      <textarea name="lessonsRaw" rows="5" placeholder="عنوان الفيديو | رابط اليوتيوب | رابط PDF (اختياري) | لينكات إضافية (اختياري)"></textarea>
    </div>
    <div class="note-box">مثال سطر بسيط: المقدمة وأساسيات المونتاج | https://youtu.be/xxxxxxxx</div>
    <div class="note-box">مثال سطر كامل (كل فيديو ممكن يكون ليه ملف PDF ولينكات خاصة بيه لوحده): المقدمة | https://youtu.be/xxxxxxxx | https://example.com/slides.pdf | مصدر إضافي=https://example.com؛مصدر تاني=https://example2.com</div>
    <div class="note-box">روابط يوتيوب بتتعرض جوه المنصة نفسها (مش خروج للموقع)، والمشاهدة كمان بتتحسب على يوتيوب عادي.</div>
    <div class="field"><label>الكورس ده هيدّي شهادة إتمام؟</label><select name="hasCertificate"><option value="true">أيوه، هيدّي شهادة</option><option value="false">لا، من غير شهادة</option></select></div>
    <div class="field"><label>ملف PDF عام للكورس كله (اختياري)</label><input name="pdfLink" type="url" placeholder="https://..."></div>
    <div class="field"><label>روابط إضافية عامة للكورس (اختياري — سطر لكل رابط)</label>
      <textarea name="extraLinksRaw" rows="3" placeholder="عنوان الرابط | https://..."></textarea>
    </div>
    <div class="note-box">الحقلين اللي فوق دول لملفات/لينكات عامة للكورس كله، بالإضافة لأي ملف/لينك خاص حطيته لكل فيديو لوحده. سيبهم فاضيين لو مش محتاجهم.</div>
    <div class="field"><label>الوسوم</label><div class="tag-grid">${TAGS.map(t=>`<button type="button" class="pill ${state.adminResTags.has(t)?"selected":""}" data-action="admin-toggle-restag" data-tag="${t}">${t}</button>`).join("")}</div></div>
    <button type="submit" class="btn btn-gold btn-block">إضافة المصدر</button>
  </form>
  <div class="note-box">علامة "مميز" دلوقتي وصفية بس (مش متفعّلة فعليًا) لحد ما نظام الاشتراك المدفوع يتبني.</div>`;
}

function renderResourceEditForm(r){
  return `
  <div class="card" style="padding:16px;margin-bottom:12px;">
    <div class="section-label">تعديل الكورس: ${escapeHtml(r.title)}</div>
    <form id="edit-res-form">
      <div class="field"><label>عنوان الكورس</label><input name="title" type="text" value="${escapeHtml(r.title)}" required></div>
      <div class="field"><label>وصف قصير</label><input name="description" type="text" value="${escapeHtml(r.description||"")}"></div>
      <div class="field"><label>الكورس ده هيدّي شهادة إتمام؟</label><select name="hasCertificate"><option value="true" ${r.hasCertificate!==false?"selected":""}>أيوه، هيدّي شهادة</option><option value="false" ${r.hasCertificate===false?"selected":""}>لا، من غير شهادة</option></select></div>
      <div class="section-label">الفيديوهات الحالية (${(r.lessons||[]).length})</div>
      ${(r.lessons||[]).map((lesson,i)=>`
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--border);border-radius:10px;padding:8px 10px;margin-bottom:6px;">
          <span style="font-size:13px;">${i+1}. ${escapeHtml(lesson.title)}</span>
          <button type="button" class="pill" style="color:#B4232C;" data-action="remove-lesson" data-id="${r.id}" data-idx="${i}">🗑️</button>
        </div>`).join("")}
      <div class="field"><label>إضافة فيديوهات جديدة للكورس (اختياري — سطر لكل فيديو)</label>
        <textarea name="newLessonsRaw" rows="4" placeholder="عنوان الفيديو | رابط اليوتيوب | رابط PDF (اختياري) | لينكات إضافية (اختياري)"></textarea>
      </div>
      <div class="note-box">سيب الحقل ده فاضي لو مش عايز تضيف فيديوهات جديدة دلوقتي، وبس عدّل العنوان/الوصف/الشهادة.</div>
      <div class="field"><label>الوسوم</label><div class="tag-grid">${TAGS.map(t=>`<button type="button" class="pill ${state.adminResTags.has(t)?"selected":""}" data-action="admin-toggle-restag" data-tag="${t}">${t}</button>`).join("")}</div></div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button type="submit" class="btn btn-gold" style="flex:1">حفظ التعديلات</button>
        <button type="button" class="btn btn-ghost" style="flex:1" data-action="cancel-edit-resource">إلغاء</button>
      </div>
    </form>
  </div>`;
}

function renderAdminQuizForm(){
  return `
  <form id="admin-quiz-form">
    <div class="field"><label>اربطه بمصدر تعليمي</label>
      <select name="resourceId" required>
        <option value="">اختار المصدر</option>
        ${state.resources.map(r=>`<option value="${r.id}">${escapeHtml(r.title)}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>عنوان الاختبار</label><input name="title" type="text" required></div>
    <div class="field"><label>الأسئلة (سؤال في كل سطر، بالشكل ده بالظبط)</label>
      <textarea name="questionsRaw" rows="6" placeholder="السؤال | خيار1 | خيار2 | خيار3 | خيار4 | رقم الإجابة الصح (1-4)"></textarea>
    </div>
    <div class="note-box">مثال سطر: ما هو أهم عنصر في السيرة الذاتية؟ | الصورة | الخبرات | الخط | الألوان | 2</div>
    <button type="submit" class="btn btn-gold btn-block">إنشاء الاختبار</button>
  </form>`;
}
function renderAiSearchPanel(){
  return `
  <div class="note-box" style="margin-bottom:14px;">الـAI بيدور بجوجل الفعلي ويجيب مصادر حقيقية، بس برضو راجع كل فرصة وتأكد من التفاصيل قبل الموافقة — خصوصًا آخر موعد.</div>
  <form id="ai-search-form" style="display:flex;gap:8px;margin-bottom:8px;">
    <input id="ai-search-input" type="text" value="${escapeHtml(state.searchTopic)}" placeholder="مثال: منح دراسية لطلاب الثانوي" style="flex:1;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14.5px;">
    <button type="submit" class="btn btn-gold" ${state.searchBusy?"disabled":""}>${state.searchBusy?"بيدور...":"دور على فرص"}</button>
  </form>
  ${state.searchErr?`<div class="error-box">${state.searchErr}</div>`:""}
  ${state.pendingOpps.length===0?`<div class="empty-state" style="padding:24px 12px;"><p>مفيش اقتراحات لسه. اكتب موضوع فوق ودوس "دور".</p></div>`:
    state.pendingOpps.map(item=>`
    <div class="card" style="padding:16px;margin-bottom:12px;">
      <span class="opp-cat">${CATEGORIES[item.category]||item.category}</span>
      <div class="opp-title" style="margin-top:8px;">${escapeHtml(item.title)}</div>
      <div class="opp-org">${escapeHtml(item.organization||"")}</div>
      ${(item.deadline && item.deadline!=="غير معلن")?`<div class="opp-deadline normal">آخر موعد (حسب البحث): ${escapeHtml(item.deadline)}</div>`:`<div class="opp-deadline urgent">⚠️ الموعد مش واضح من البحث — افتح الرابط وتأكد بنفسك قبل الموافقة</div>`}
      <div class="desc-text" style="margin:8px 0;">${escapeHtml(item.description||"")}</div>
      ${item.link?`<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener" class="link-btn" style="display:inline-block;">فتح المصدر الأساسي ↗</a>`:""}
      ${(item.groundingSources&&item.groundingSources.length)?`<div class="section-label">مصادر البحث</div><div style="display:flex;flex-direction:column;gap:4px;">${item.groundingSources.map(s=>`<a href="${escapeHtml(s.uri)}" target="_blank" rel="noopener" style="font-size:13px;color:var(--teal-700);">↗ ${escapeHtml(s.title||s.uri)}</a>`).join("")}</div>`:""}
      ${item.searchEntryPointHtml||""}
      ${isAdmin()?`
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="btn btn-gold" style="flex:1" data-action="approve-pending" data-id="${item.id}">✓ موافقة ونشر</button>
        <button class="btn btn-ghost" style="flex:1" data-action="reject-pending" data-id="${item.id}">✕ رفض</button>
      </div>`:`<div class="note-box" style="margin-top:14px;">في انتظار مراجعة الأدمن</div>`}
    </div>`).join("")
  }`;
}

function renderResourceCard(r){
  const quiz = state.quizzes.find(q=>q.resourceId===r.id);
  const result = quiz ? state.quizResults[quiz.id] : null;
  const isDone = state.completedResourceIds.includes(r.id);
  const isCourse = r.type==="course" && (r.lessons||[]).length>0;
  const {done: doneLessons, total: totalLessons} = isCourse ? courseProgress(r) : {done:0,total:0};
  const courseComplete = isCourse && totalLessons>0 && doneLessons>=totalLessons && r.hasCertificate!==false;
  const typeLabel = {video:"فيديو",pdf:"ملف PDF",article:"مقال",course:"كورس (فيديوهات)"};
  if(isCourse && state.editingResourceId===r.id){
    return renderResourceEditForm(r);
  }
  return `
  <div class="card" style="padding:16px;margin-bottom:12px;">
    <span class="opp-cat">${typeLabel[r.type]||r.type}</span>
    ${r.isPremium?`<span class="badge-verified" style="background:#FDF3E2;color:#8A5B10;">⭐ مميز</span>`:""}
    ${isCourse && r.hasCertificate===false?`<span class="badge-verified" style="background:#EFEFEF;color:#666;">من غير شهادة</span>`:""}
    <div class="opp-title" style="margin-top:8px;">${escapeHtml(r.title)}</div>
    ${r.description?`<div class="desc-text" style="margin:6px 0;">${escapeHtml(r.description)}</div>`:""}

    ${(!isCourse && r.type==="video") ? (renderVideoEmbed(r.link) || "") : ""}

    ${isCourse ? `
      <div class="section-label">فيديوهات الكورس (${doneLessons}/${totalLessons})</div>
      ${r.lessons.map((lesson,i)=>{
        const done = state.completedLessonIds.includes(lessonKey(r.id,i));
        const embed = renderVideoEmbed(lesson.link);
        return `
        <div style="border:1px solid var(--border);border-radius:12px;padding:10px;margin-bottom:10px;">
          <div style="font-weight:700;font-size:13.5px;margin-bottom:6px;">${i+1}. ${escapeHtml(lesson.title)}</div>
          ${embed || `<a href="${escapeHtml(lesson.link)}" target="_blank" rel="noopener" class="link-btn">فتح الفيديو ↗</a>`}
          ${(lesson.pdfLink||(lesson.extraLinks&&lesson.extraLinks.length))?`
          <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">
            ${lesson.pdfLink?`<a href="${escapeHtml(lesson.pdfLink)}" target="_blank" rel="noopener" class="link-btn">📄 ملف الفيديو ده ↗</a>`:""}
            ${(lesson.extraLinks||[]).map(l=>`<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="link-btn">🔗 ${escapeHtml(l.label)} ↗</a>`).join("")}
          </div>`:""}
          <button class="pill ${done?"selected":""}" style="margin-top:8px;" data-action="toggle-lesson" data-id="${r.id}" data-idx="${i}">${done?"✓ خلصته":"علّمه كمكتمل"}</button>
        </div>`;
      }).join("")}
      ${r.pdfLink||( r.extraLinks&&r.extraLinks.length)?`
      <div class="section-label">ملفات وروابط عامة للكورس</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
        ${r.pdfLink?`<a href="${escapeHtml(r.pdfLink)}" target="_blank" rel="noopener" class="link-btn">📄 ملف PDF الكورس ↗</a>`:""}
        ${(r.extraLinks||[]).map(l=>`<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="link-btn">🔗 ${escapeHtml(l.label)} ↗</a>`).join("")}
      </div>`:""}
      ${courseComplete?`<button class="btn btn-gold btn-block" data-action="download-course-cert" data-id="${r.id}">🎓 تحميل شهادة إتمام الكورس</button>`:""}
    ` : ""}

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      ${(!isCourse && r.link)?`<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener" class="link-btn">فتح المصدر ↗</a>`:""}
      ${!isCourse?`<button class="pill ${isDone?"selected":""}" data-action="toggle-complete" data-id="${r.id}">${isDone?"✓ خلصته":"علّمه كمكتمل"}</button>`:""}
      ${isAdmin() && isCourse?`<button class="pill" data-action="edit-resource" data-id="${r.id}">✏️ تعديل الكورس</button>`:""}
      ${isAdmin()?`<button class="pill" data-action="delete-resource" data-id="${r.id}" style="color:#B4232C;">🗑️ حذف</button>`:""}
    </div>
    ${quiz?`
      <div class="section-label">اختبار: ${escapeHtml(quiz.title)}</div>
      ${result&&result.passed
        ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><span class="badge-verified">✅ خلصت بنتيجة ${result.score}/${result.total}</span><button class="link-btn" data-action="download-cert" data-id="${quiz.id}">تحميل الشهادة 📜</button></div>`
        : `<button class="btn btn-ghost" data-action="start-quiz" data-id="${quiz.id}">ابدأ الاختبار (${quiz.questions.length} سؤال)</button>`
      }`:""}
  </div>`;
}
function renderResourcesTab(){
  const introNote = `<div class="note-box" style="margin-bottom:14px;">📚 هنا بتتحط كورسات المنصة وفيديوهات المنصة الخاصة بينا.</div>`;
  if(state.resources.length===0){
    if(isAdmin()){
      return introNote + `<div class="empty-state"><h3>لسه مفيش محتوى في مركز التعلم</h3><p>ضيف أول محتوى من تبويب "الإدارة".</p></div>`;
    }
    return introNote + `<div class="empty-state"><h3>لسه مفيش محتوى في مركز التعلم</h3><p>هيظهر هنا أول ما الأدمن يضيفه.</p></div>`;
  }
  const tips = state.resources.filter(r=>r.type!=="course");
  const courses = state.resources.filter(r=>r.type==="course");
  const sub = state.learningSubTab==="courses" ? "courses" : "tips";
  const subTabs = `
    <div class="tabs" style="margin-bottom:14px;">
      <button class="tab ${sub==="tips"?"active":""}" data-action="learning-subtab" data-subtab="tips">💡 نصائح سريعة</button>
      <button class="tab ${sub==="courses"?"active":""}" data-action="learning-subtab" data-subtab="courses">🎓 الكورسات</button>
    </div>`;
  const list = sub==="tips" ? tips : courses;
  const emptyMsg = sub==="tips"
    ? `<div class="empty-state"><h3>لسه مفيش نصائح سريعة</h3><p>هتظهر هنا أول ما الأدمن يضيفها.</p></div>`
    : `<div class="empty-state"><h3>لسه مفيش كورسات</h3><p>هتظهر هنا أول ما الأدمن يضيفها.</p></div>`;
  return introNote + subTabs + (list.length ? list.map(renderResourceCard).join("") : emptyMsg);
}

function renderChatTab(){
  const msgs = state.chatMessages;
  return `
  <div class="chat-wrap">
    ${state.aiConnected?`<div class="note-box chat-status" style="background:#EAF6EF;color:#1F7A47;">متصل بـ Gemini ✓ — متبقي ليك النهاردة ${aiUsageRemaining()} من ${currentAiLimit()} طلب (شات + بحث ذكي مع بعض). لو ظهرلك رسالة خطأ، ابعتهالي زي ما هي.</div>`:""}
    <div class="chat-messages" id="chat-messages">
      ${msgs.length===0?`<div class="empty-state" style="padding:30px 16px;"><h3>اسأل المساعد أي حاجة عن مسارك المهني</h3><p>وكمان يقدر يدورلك بنفسه على فرص حقيقية دلوقتي، جرب مثلاً: "دورلي على منح دراسية للثانوي" — النتايج ليك انت بس، مش هتتنشر أو تحتاج موافقة حد.</p></div>`:""}
      ${msgs.map(m=>`<div class="chat-bubble-row ${m.role}"><div class="chat-bubble ${m.role}">${escapeHtml(m.text).replace(/\n/g,"<br>")}</div></div>`).join("")}
      ${state.chatBusy?`<div class="chat-bubble-row assistant"><div class="chat-bubble assistant typing"><span></span><span></span><span></span></div></div>`:""}
    </div>
    <form id="chat-form" class="chat-input-row">
      <input id="chat-input" type="text" placeholder="اكتب سؤالك هنا..." autocomplete="off" ${state.chatBusy?"disabled":""}>
      <button type="submit" class="btn btn-gold" ${state.chatBusy?"disabled":""}>إرسال</button>
    </form>
  </div>`;
}
function scrollChatToBottom(){
  requestAnimationFrame(()=>{
    const el = document.getElementById("chat-messages");
    if(el) el.scrollTop = el.scrollHeight;
  });
}
// المفتاح ده هيفضل ظاهر في كود الموقع (لأن الموقع static على GitHub Pages)، فمهم جدًا:
// 1) تقيّده في Google Cloud Console بحيث يشتغل بس من دومين sleemmahmoud.github.io
// 2) تحط Budget Alert على حساب Google Cloud بتاعك عشان تتنبه فورًا لو حد استخدمه من غيرك
// المفتاح بقى مخبّى تمامًا في السيرفر (Deno Deploy) — الموقع بيكلم البروكسي ده بس.
// غيّر الرابط ده بعد ما تعمل الـDeploy على Deno (هيكون شكله https://<اسم-مشروعك>.deno.dev)
const GEMINI_PROXY_URL = "https://nextstep-ai-59-ma045qmk8pfa.sleemmahmoud.deno.net";
function extractQuotaDetail(data){
  try{
    const details = data && data.error && data.error.details;
    if(!Array.isArray(details)) return "";
    const failure = details.find(d=>d["@type"] && d["@type"].includes("QuotaFailure"));
    const violation = failure && failure.violations && failure.violations[0];
    if(!violation) return "";
    const parts = [];
    if(violation.quotaId) parts.push(`النوع: ${violation.quotaId}`);
    if(violation.quotaValue) parts.push(`الحد المسموح: ${violation.quotaValue}`);
    if(violation.quotaDimensions && violation.quotaDimensions.model) parts.push(`الموديل: ${violation.quotaDimensions.model}`);
    return parts.length ? `\n\nتفاصيل الحد بالظبط: ${parts.join(" — ")}` : "";
  }catch(e){ return ""; }
}

// ============ حد الاستخدام اليومي للـAI — لكل مستخدم (UID) على حدة ============
// كل رسالة شات أو بحث AI شخصي بتستهلك من نفس العداد، والعداد ده متخزن جوه
// مستند المستخدم نفسه (users/{uid}.aiUsage) — يعني معزول تمامًا عن أي حساب تاني.
// العداد بيتصفر تلقائيًا أول ما ييجي يوم جديد (بمقارنة التاريخ)، من غير أي تأثير
// على بيانات أو عدّادات باقي المستخدمين.
// ده عداد محلي بتاع الشات بس (لتوفير نداء شبكة لو هيفشل أكيد) — أما الحد
// الحقيقي الملزم فهو في worker.ts (عداد واحد مشترك لكل استخدامات الـAI).
const AI_DAILY_LIMIT = 5;
const ADMIN_AI_DAILY_LIMIT = 5;
function currentAiLimit(){ return isAdmin() ? ADMIN_AI_DAILY_LIMIT : AI_DAILY_LIMIT; }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function getAiUsage(){
  const u = (state.profile && state.profile.aiUsage) || null;
  const today = todayStr();
  if(!u || u.date !== today) return {date: today, count: 0};
  return {date: u.date, count: u.count||0};
}
function aiUsageRemaining(){
  return Math.max(0, currentAiLimit() - getAiUsage().count);
}
// بترجع true لو لسه فيه مساحة اليوم، من غير ما تزوّد حاجة (قراءة بس).
function hasAiUsageLeft(){
  return getAiUsage().count < currentAiLimit();
}
// بتزوّد العداد فعليًا وتحفظه في مستند اليوزر هو بس. بننادي عليها بس بعد ما
// نتأكد إن الرد رجع بنجاح، عشان طلب فشل (شبكة/سيرفر) ما ياكلش من الحصة اليومية
// من غير فايدة.
async function consumeAiUsage(){
  const usage = getAiUsage();
  const updated = {date: usage.date, count: usage.count+1};
  state.profile = {...(state.profile||{}), aiUsage: updated};
  try{
    await updateDoc(doc(db,"users",state.user.uid), {aiUsage: updated});
  }catch(err){
    console.error("consumeAiUsage error:", err);
    // حتى لو فشل الحفظ في Firestore، سيبها تكمل بدل ما توقف المستخدم بسبب مشكلة شبكة عابرة
  }
}
// حد منفصل لعدد مرات عمل الـCV في اليوم، لكل مستخدم لوحده (عداد محلي بس، مش
// ملزم على السيرفر — السيرفر بيتحكم في كل شيء بعداد واحد مشترك).
const CV_DAILY_LIMIT = 1;
const ADMIN_CV_DAILY_LIMIT = 3;
function currentCvLimit(){ return isAdmin() ? ADMIN_CV_DAILY_LIMIT : CV_DAILY_LIMIT; }
function getCvUsage(){
  const u = (state.profile && state.profile.cvUsage) || null;
  const today = todayStr();
  if(!u || u.date !== today) return {date: today, design:0, ats:0};
  return {date: u.date, design: u.design||0, ats: u.ats||0};
}
function cvUsageRemaining(type){
  return Math.max(0, currentCvLimit() - getCvUsage()[type]);
}
async function tryConsumeCvUsage(type){
  const usage = getCvUsage();
  if(usage[type] >= currentCvLimit()) return false;
  const updated = {date: usage.date, design: usage.design, ats: usage.ats, [type]: usage[type]+1};
  state.profile = {...(state.profile||{}), cvUsage: updated};
  try{
    await updateDoc(doc(db,"users",state.user.uid), {cvUsage: updated});
  }catch(err){
    console.error("tryConsumeCvUsage error:", err);
  }
  return true;
}
async function askAI(message){
  const p = state.profile;
  const topMatches = state.opportunities
    .map(o=>({o, score: calcMatch(p,o).score}))
    .sort((a,b)=>b.score-a.score).slice(0,5)
    .map(x=>`${x.o.title} (${CATEGORIES[x.o.category]||x.o.category}, تطابق ${x.score}%)`).join("؛ ") || "لسه مفيش فرص محمّلة";
  const systemText = `إنت مستشار مسار مهني محترف وخبير جوه منصة NextStep AI، بتساعد طلاب المدارس والجامعات والخريجين الجدد في مصر يلاقوا فرص (منح دراسية، تدريب، وظايف، مسابقات) ويطوروا مسارهم المهني. اتكلم زي مستشار بشري حقيقي خبرة، مش زي بوت — دافي، واثق، ومهتم فعلًا بمستقبل اللي بيكلمك، مش رسمي بشكل جامد ومش سطحي.
رد بالعربية المصرية البسيطة والواضحة، بأسلوب احترافي ودود ومباشر، وخليك مختصر ومفيد ومش طويل أوي. اكتب ردودك في فقرات قصيرة أو نقط لو الموضوع فيه أكتر من نقطة.
استخدم بحث جوجل الحي (المتاح ليك كأداة) لما تحتاج معلومة حديثة أو دقيقة — مواعيد، شروط تقديم، تفاصيل برنامج معيّن — بدل ما تعتمد على معرفتك القديمة بس، وده هيخلي إجاباتك أدق وأحدث. لو استخدمت بحث وعندك مصدر حقيقي، اذكره باختصار في الآخر.
لما يكون مناسب، اقترح سؤال متابعة ذكي واحد يساعده يوضح احتياجه أكتر أو يتقدم خطوة (مثلاً: "تحب أساعدك تجهز خطة تحضير لمقابلة الشخصية بتاعتها؟") — من غير ما تبالغ فيها كل رسالة، خليها لما تضيف قيمة فعلًا.
بيانات المستخدم الحالي: الاسم ${p.name||"-"}، المرحلة الدراسية ${stageDisplayText(p)||"-"}، الاهتمامات ${(p.interests||[]).join("، ")||"-"}، المهارات ${(p.skills||[]).join("، ")||"-"}، الهدف الحالي ${p.goal||"-"}.
أعلى الفرص تطابقًا معاه على المنصة دلوقتي: ${topMatches}. لو سأل عن فرص مناسبة، اقترح من دي وقوله يفتح تفاصيلها من تبويب الفرص المقترحة.
استخدم البيانات دي عشان تدّي نصايح مخصصة قدر الإمكان، ومتقولش إنك موديل لغوي أو تتكلم عن نفسك كـAI إلا لو اتسأل مباشرة.`;
  // بنبني تاريخ المحادثة بصيغة Gemini (contents بدل messages)، وبنسيب رسالة اليوزر
  // الأخيرة برا اللوب عشان نضيفها هي وبس بدل التكرار.
  const contents = [];
  state.chatMessages.slice(0,-1).forEach(m=>{
    contents.push({role: m.role==="assistant" ? "model" : "user", parts:[{text: m.text}]});
  });
  contents.push({role:"user", parts:[{text: message}]});
  try{
    const res = await fetch(GEMINI_PROXY_URL + "/chat", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        systemInstruction: {parts:[{text: systemText}]},
        contents,
        uid: state.user && state.user.uid
      })
    });
    const data = await res.json();
    if(!res.ok){
      if(res.status===429){
        return {ok:false, text: (data && data.error && data.error.message) || `⚠️ وصلت للحد اليومي لاستخدام المساعد الذكي، جرب تاني بكرة.`};
      }
      const errMsg = (data && data.error && data.error.message) || `خطأ غير معروف (كود ${res.status})`;
      return {ok:false, text: `⚠️ حصل خطأ: "${errMsg}"`};
    }
    const cand = data && data.candidates && data.candidates[0];
    const text = cand && cand.content && cand.content.parts && cand.content.parts.map(x=>x.text||"").join("") || "";
    if(!text) return {ok:false, text: "معرفتش أرد على السؤال ده، جرب تصيغه بطريقة تانية."};
    const gm = cand && cand.groundingMetadata;
    const sourceHosts = [...new Set((gm && gm.groundingChunks || []).map(c=>c.web && hostnameOf(c.web.uri||c.web.url||"")).filter(Boolean))];
    return {ok:true, text: sourceHosts.length ? `${text}\n\nمصادر: ${sourceHosts.join("، ")}` : text};
  }catch(err){
    return {ok:false, text: "مقدرتش أوصل لخدمة الذكاء الاصطناعي دلوقتي، تأكد من اتصال الإنترنت وجرب تاني."};
  }
}
async function sendChatMessage(text){
  if(!text.trim()) return;
  state.chatMessages.push({role:"user", text:text.trim()});
  if(!hasAiUsageLeft()){
    state.chatMessages.push({role:"assistant", text:`⚠️ وصلت للحد اليومي لاستخدام المساعد الذكي (${currentAiLimit()} طلب في اليوم). هيتصفر تلقائيًا بكرة، جرب تاني وقتها.`});
    render();
    return;
  }
  state.chatBusy = true; render();
  const reply = await askAI(text.trim());
  if(reply.ok) await consumeAiUsage(); // بنزوّد العداد بس لو فعلًا رجع رد سليم
  state.chatMessages.push({role:"assistant", text:reply.text});
  state.chatBusy = false; render();
}
// ملحوظة: البحث التلقائي اليومي بقى بيشتغل من السيرفر نفسه (Deno.cron في
// worker.ts) باستخدام Service Account — من غير ما يستهلك أي حصة AI بتاعة
// أي مستخدم، ومن غير ما يحتاج حد يفتح الداشبورد أصلاً. كان فيه قبل كده نسخة
// من نفس البحث بتشتغل من هنا (من المتصفح) كل مرة الأدمن يفتح الداشبورد أو
// تبويب البحث بالـAI، وكانت بتلف على كل الـ9 مواضيع وتستهلك كوتا البحث
// بتاعة الأدمن قبل ما يقدر يستخدمها يدوي — شيلناها خالص عشان دي كانت بالظبط
// سبب إن الكوتا تخلص من غير ما الأدمن يعمل حاجة بنفسه. قايمة المواضيع نفسها
// (AUTO_SEARCH_TOPICS) بقت موجودة في worker.ts بس دلوقتي.
async function cleanupExpiredOpportunities(){
  const today = new Date(new Date().toISOString().slice(0,10));
  const expired = state.opportunities.filter(o=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(o.deadline||"")) return false;
    return new Date(o.deadline) < today;
  });
  if(!expired.length) return;
  try{
    await Promise.all(expired.map(o=>deleteDoc(doc(db,"opportunities",o.id))));
    await loadOpportunities();
  }catch(e){}
}
// core: calls Gemini + google search grounding, returns {items, sources, searchEntryHtml} or {error}
// this function NEVER touches Firestore by itself — callers decide what to do with the results.
async function fetchAiOpportunities(topic){
  const todayStr = new Date().toISOString().slice(0,10);
  const currentYear = new Date().getFullYear();
  const prompt = `النهاردة تاريخ ${todayStr} (يعني إحنا في سنة ${currentYear}). من معرفتك (من غير بحث حي على الإنترنت)، اقترح لي أشهر وأهم الفرص **الحقيقية والمعروفة والمتكررة سنويًا** (بحد أقصى 15 فرصة) اللي مناسبة لموضوع: "${topic}"، وتستهدف طلاب أو خريجين مصريين أو فرص دولية متاحة لهم.
مهم جدًا: "فرصة" هنا معناها أي نوع من الآتي، مش بس منح أو تطوع: منح دراسية، تدريب، وظائف، تطوع، مسابقات، هاكاثونات، برامج تبادل، **كورسات مجانية أونلاين**، بوت كامب، **مؤتمرات وفعاليات**. لو الموضوع بيتكلم عن "كورس" أو "تعلّم" أو "أتعلم" ركّز على منصات كورسات معروفة (Coursera, edX, Udemy المجاني, Microsoft Learn, freeCodeCamp) بالظبط للمهارة المطلوبة. لو الموضوع بيتكلم عن "مؤتمر" أو "فعالية" ركّز على مؤتمرات وفعاليات معروفة ومتكررة سنويًا. بلاش تفترض إن كل موضوع معناه منحة أو تطوع.
مصادر مقترحة (رشّح منها بس اللي فعلًا معروف ومستمر): Coursera وedX وUdemy وFutureLearn وMicrosoft Learn وfreeCodeCamp وUN Volunteers وUN Careers وErasmus+ وEuropean Youth Portal وDAAD وChevening وBritish Council، وكمان مصادر مصرية زي وزارة الشباب والرياضة وITI وDigital Egypt وNTI وTIEC.
شروط أساسية ولازم تلتزم بيها بدقة (مهم جدًا لإنك من غير بحث حي دلوقتي):
- رشّح بس برامج مستقرة ومعروفة إنها بتتكرر كل سنة أو مستمرة طول الوقت (زي Chevening, Erasmus+, DAAD, UN Volunteers). متختلقش اسم برنامج أو جهة مش متأكد من وجودها الحقيقي.
- **متكتبش تاريخ deadline محدد إلا لو فعلًا متأكد منه من معرفتك** — لو مش متأكد من الموعد بالظبط، اكتب "غير معلن - راجع الموقع الرسمي" بدل ما تخمّن تاريخ ممكن يكون غلط.
- الرابط لازم يكون الموقع الرسمي المعروف للجهة نفسها (الصفحة الرئيسية أو صفحة القسم المعروفة، زي chevening.org أو daad.de)، مش رابط فرعي مخترع ممكن يكون مش موجود.
- صنّف كل فرصة بـ"tags" — اختار من القايمة دي بالظبط (وحط 1 لـ4 وسوم مناسبة فعلاً، من غير ما تخترع وسم برا القايمة): [${TAGS.map(t=>`"${t}"`).join(", ")}]
- حدد كمان "stageTags" — المراحل الدراسية اللي الفرصة دي مناسبة ليها بالظبط، اختار من القايمة دي بس: ["middle","high","university","graduate"] (middle=إعدادي، high=ثانوي، university=جامعي، graduate=خريج). حط كل المراحل المناسبة (ممكن تكون مرحلة واحدة أو أكتر)، ولو الفرصة مناسبة للكل من غير تحديد سن أو مرحلة معينة سيب الـarray فاضي [].
رجّع بس JSON array، من غير أي نص تاني قبله أو بعده، بالشكل ده بالظبط:
[{"title":"عنوان الفرصة","organization":"اسم الجهة","description":"وصف قصير من سطرين بالعربي دايمًا حتى لو المصدر إنجليزي، واذكر فيه إنها فرصة تتكرر سنويًا لو معروف كده","category":"scholarship أو internship أو job أو volunteering أو competition أو conference أو hackathon أو exchange أو course أو bootcamp أو event","deadline":"YYYY-MM-DD لو متأكد بالظبط، وإلا اكتب: غير معلن - راجع الموقع الرسمي","link":"رابط الموقع الرسمي المعروف للجهة","tags":["وسم1","وسم2"],"stageTags":["high","university"]}]
لو مش متأكد إن الفرصة دي حقيقية وموجودة فعلًا، متضيفهاش خالص. لو مفيش فرص معروفة كفاية للموضوع ده رجّع [].`;
  try{
    const res = await fetch(GEMINI_PROXY_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        contents:[{role:"user", parts:[{text:prompt}]}],
        uid: state.user && state.user.uid
      })
    });
    const data = await res.json();
    if(!res.ok){
      if(res.status===429){
        return {error: (data && data.error && data.error.message) || "⚠️ وصلت للحد اليومي لاستخدام البحث الذكي، جرب تاني بكرة."};
      }
      return {error: ((data && data.error && data.error.message) || `خطأ (كود ${res.status})`) + extractQuotaDetail(data)};
    }
    const cand = data && data.candidates && data.candidates[0];
    const text = cand && cand.content && cand.content.parts && cand.content.parts.map(p=>p.text||"").join("") || "";
    const gm = cand && cand.groundingMetadata;
    const sources = (gm && gm.groundingChunks || []).map(c=>c.web).filter(Boolean);
    const sourceHosts = sources.map(s=>hostnameOf(s.uri||s.url||"")).filter(Boolean);
    const searchEntryHtml = gm && gm.searchEntryPoint && gm.searchEntryPoint.renderedContent || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if(!jsonMatch) return {error:"الـAI مرجعش نتايج واضحة، جرب موضوع بحث تاني أو أوضح شوية."};
    let items;
    try{ items = JSON.parse(jsonMatch[0]); }catch(e){ return {error:"معرفتش أقرا رد الـAI، جرب تاني."}; }
    // فلتر إضافي من عندنا: نرفض أي فرصة موعدها فات أو مالهاش رابط حقيقي، حتى لو الـAI غلط
    const today = new Date(todayStr);
    items = items.filter(it=>{
      if(!isValidLink(it.link)) return false;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(it.deadline||"")) return true;
      return new Date(it.deadline) >= today;
    });
    // فلتر أمان إضافي: لو عندنا مصادر بحث حقيقية (grounding)، نستبعد أي رابط رجعه الـAI
    // ومش من نفس نطاق أي مصدر ظهر فعليًا في نتيجة البحث — ده بيقلل احتمال أي رابط مختلق.
    if(sourceHosts.length){
      items = items.filter(it=>{
        const h = hostnameOf(it.link);
        return h && sourceHosts.some(sh=>sh===h || sh.endsWith("."+h) || h.endsWith("."+sh));
      });
    }
    if(!items.length) return {error:"الـAI مالقاش فرص نشطة موثوقة كفاية للموضوع ده دلوقتي، جرب تصيغه بطريقة تانية."};
    return {items, sources, searchEntryHtml};
  }catch(err){
    return {error:"مقدرتش أوصل للخدمة دلوقتي، تأكد من الإنترنت وجرب تاني."};
  }
}
function hostnameOf(url){
  try{ return new URL(url).hostname.replace(/^www\./,"").toLowerCase(); }catch(e){ return ""; }
}
// بتستخرج ID فيديو اليوتيوب من أي شكل رابط (watch?v=، youtu.be/، shorts/، embed/)
// عشان نقدر نعرضه جوه المنصة (iframe) بدل ما نودي المستخدم بره الموقع.
function extractYoutubeId(url){
  if(typeof url!=="string") return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  ];
  for(const p of patterns){
    const m = url.match(p);
    if(m) return m[1];
  }
  return null;
}
// بترجع HTML لتضمين فيديو يوتيوب داخل صفحة الموارد نفسها — الفيديو بيتشغّل
// جوه المنصة، والمشاهدة برضه بتتحسب على يوتيوب عادي زي أي embed تاني.
function renderVideoEmbed(url){
  const id = extractYoutubeId(url);
  if(!id) return "";
  return `<div style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden;margin:10px 0;background:#000;">
    <iframe src="https://www.youtube-nocookie.com/embed/${id}" title="فيديو" style="position:absolute;top:0;right:0;width:100%;height:100%;border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
  </div>`;
}
// Used by the admin's AI search (both the automatic background run and the manual
// "ابحث الآن" button). Publishes straight to the live "opportunities" collection —
// no separate approval step — since only an admin session can ever trigger this.
// بتاخد كل الفرص اللي مالهاش وسوم (زي الفرص القديمة اللي اتضافت قبل ما بقينا
// نحفظ tags) وتبعتها كلها للـAI مرة واحدة عشان يصنّفها، وبعدين تحدّث كل فرصة
// بالوسوم المناسبة على طول — بدل ما الأدمن يفتح كل فرصة لوحدها ويعدّلها يدوي.
// بتاخد حد أقصى 40 فرصة في كل نداء (طلب AI واحد بس)، فلو عندك أكتر من كده
// دوس الزرار تاني بعد ما الأولانية تخلص.
// بتصلّح تصنيف *كل* الفرص القديمة (مش أول دفعة بس) في نفس الكبسة — بتلف على
// كل الفرص الناقصة تصنيف على دفعات (60 فرصة لكل نداء AI)، لحد ما تخلص كلها.
// بما إن الأدمن بقى معفى من حد الاستخدام اليومي (زي السيرفر بالظبط)، اللفة دي
// آمنة ومش هتوقف في نص الطريق بسبب الحصة.
const BULK_TAG_BATCH_SIZE = 60;
async function bulkFixOpportunityTags(){
  if(!isAdmin()) return;
  let untagged = state.opportunities.filter(o=>!(o.tags&&o.tags.length));
  if(untagged.length===0){
    state.adminMsg = "كل الفرص عندها وسوم بالفعل، مفيش حاجة تتصلح.";
    render(); setTimeout(()=>{ state.adminMsg=""; render(); }, 4000); return;
  }
  const totalAtStart = untagged.length;
  state.searchBusy = true;
  state.adminMsg = `بيصنّف... (0 من ${totalAtStart})`;
  render();
  const validStages = STAGES.map(s=>s.id);
  let totalFixed = 0;
  let batchNum = 0;
  const maxBatches = 40; // سقف أمان (40 × 60 = 2400 فرصة) عشان منلفش للأبد لو حصل خطأ متكرر
  while(untagged.length>0 && batchNum<maxBatches){
    batchNum++;
    const batch = untagged.slice(0, BULK_TAG_BATCH_SIZE);
    const list = batch.map(o=>`{"id":"${o.id}","title":${JSON.stringify(o.title||"")},"description":${JSON.stringify(o.description||"")}}`).join(",\n");
    const prompt = `دي قايمة فرص من منصة NextStep AI مالهاش تصنيف دلوقتي. لكل فرصة، حدد اتنين:
1) "tags" — اختار 1 لـ4 وسوم مناسبة بس من القايمة دي بالظبط (من غير ما تخترع وسم برا القايمة): [${TAGS.map(t=>`"${t}"`).join(", ")}]
2) "stageTags" — المراحل الدراسية اللي الفرصة دي مناسبة ليها بالظبط، اختار من: ["middle","high","university","graduate"] (middle=إعدادي، high=ثانوي، university=جامعي، graduate=خريج). حط كل المراحل المناسبة، ولو الفرصة مناسبة للكل من غير تحديد سيب الـarray فاضي [].
الفرص:
[${list}]
رجّع بس JSON array بالشكل ده بالظبط، بنفس عدد الفرص وبنفس الـid، من غير أي نص زيادة قبله أو بعده:
[{"id":"...","tags":["وسم1","وسم2"],"stageTags":["high","university"]}]`;
    try{
      const res = await fetch(GEMINI_PROXY_URL, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ contents:[{role:"user", parts:[{text:prompt}]}], uid: state.user && state.user.uid })
      });
      const data = await res.json();
      if(!res.ok){
        state.adminMsg = (totalFixed>0 ? `تم تصنيف ${totalFixed} فرصة قبل ما يحصل خطأ: ` : "") + ((data && data.error && data.error.message) || "حصل خطأ أثناء التصنيف.");
        break;
      }
      const cand = data && data.candidates && data.candidates[0];
      const text = cand && cand.content && cand.content.parts && cand.content.parts.map(p=>p.text||"").join("") || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      let items = [];
      if(jsonMatch){ try{ items = JSON.parse(jsonMatch[0]); }catch(e){ items = []; } }
      let fixedThisBatch = 0;
      for(const it of items){
        const safeTags = Array.isArray(it.tags) ? it.tags.filter(t=>TAGS.includes(t)) : [];
        const safeStages = Array.isArray(it.stageTags) ? it.stageTags.filter(s=>validStages.includes(s)) : [];
        if(!it.id || safeTags.length===0) continue;
        try{
          await updateDoc(doc(db,"opportunities", it.id), {tags: safeTags, stageTags: safeStages});
          fixedThisBatch++;
        }catch(err){ console.error("bulkFixOpportunityTags update error:", err); }
      }
      totalFixed += fixedThisBatch;
      // شيل اللي اتصنّفوا فعلًا من اللستة عشان الدفعة الجاية تاخد الباقي بس
      const fixedIds = new Set(items.filter(it=>it.id).map(it=>it.id));
      untagged = untagged.filter(o=>!fixedIds.has(o.id));
      state.adminMsg = `بيصنّف... (${totalFixed} من ${totalAtStart})`;
      render();
      if(fixedThisBatch===0) break; // مفيش تقدّم في الدفعة دي، بلاش نلف للأبد
    }catch(err){
      console.error("bulkFixOpportunityTags error:", err);
      state.adminMsg = (totalFixed>0 ? `تم تصنيف ${totalFixed} فرصة قبل ما تنقطع الخدمة. جرب تاني.` : "مقدرتش أوصل للخدمة دلوقتي، تأكد من الإنترنت وجرب تاني.");
      break;
    }
  }
  await loadOpportunities();
  const remaining = state.opportunities.filter(o=>!(o.tags&&o.tags.length)).length;
  if(remaining===0 && totalFixed>0){
    state.adminMsg = `تم تصنيف كل الفرص القديمة (${totalFixed} فرصة) ✓`;
  } else if(totalFixed>0 && remaining>0){
    state.adminMsg = `تم تصنيف ${totalFixed} فرصة — لسه فاضل ${remaining} (الـAI مقدرش يصنّفهم، جرب تاني أو راجعهم يدوي).`;
  }
  state.searchBusy=false; render();
  setTimeout(()=>{ state.adminMsg=""; render(); }, 6000);
}
// بتنضّف الفرص المكررة (نفس الرابط بالظبط) تلقائيًا وأوتوماتيك من غير AI خالص
// (مقارنة رابط بالظبط — آمنة 100%)، وبعدين بتبعت الباقي للـAI عشان يكتشف أي
// فرص شكلها مكرر بمعنى تاني (نفس الفرصة بصياغة مختلفة) أو وهمية/غير منطقية،
// وبتمسحهم على طول من غير مراجعة يدوية زي ما طلبت. بتشتغل على دفعات لحد ما
// تراجع كل الفرص الموجودة.
const FAKE_CHECK_BATCH_SIZE = 50;
async function cleanupFakeAndDuplicateOpportunities(){
  if(!isAdmin()) return;
  state.searchBusy = true; state.adminMsg = "بيراجع الفرص..."; render();

  // الخطوة 1: تكرار بنفس الرابط بالظبط — حذف مباشر وأكيد 100%، من غير AI.
  const seenLinks = new Map();
  const exactDupIds = [];
  for(const o of state.opportunities){
    const key = (o.link||"").trim().toLowerCase();
    if(!key) continue;
    if(seenLinks.has(key)) exactDupIds.push(o.id);
    else seenLinks.set(key, o.id);
  }
  let removedExact = 0;
  for(const id of exactDupIds){
    try{ await deleteDoc(doc(db,"opportunities", id)); removedExact++; }
    catch(err){ console.error("cleanup exact-dup delete error:", err); }
  }
  await loadOpportunities();

  // الخطوة 2: مراجعة بالـAI لباقي الفرص — تكرار بصياغة مختلفة أو فرص وهمية/غير منطقية.
  let remaining = [...state.opportunities];
  let removedByAi = 0;
  let batchNum = 0;
  const maxBatches = 30;
  while(remaining.length>0 && batchNum<maxBatches){
    batchNum++;
    const batch = remaining.slice(0, FAKE_CHECK_BATCH_SIZE);
    remaining = remaining.slice(FAKE_CHECK_BATCH_SIZE);
    const list = batch.map(o=>`{"id":"${o.id}","title":${JSON.stringify(o.title||"")},"organization":${JSON.stringify(o.organization||"")},"link":${JSON.stringify(o.link||"")},"deadline":${JSON.stringify(o.deadline||"")}}`).join(",\n");
    const prompt = `دي قايمة فرص منشورة على منصة NextStep AI. راجعها ولاقي:
1) فرص مكررة بمعنى (نفس الفرصة/البرنامج بالظبط بس بصياغة عنوان مختلفة أو نفس الجهة والبرنامج اتكرر أكتر من مرة) — في حالة التكرار سيب واحدة بس واعتبر الباقي مكرر.
2) فرص شكلها وهمي أو غير منطقي (جهة غير موجودة فعليًا، رابط غير منطقي أو مش شكل رابط حقيقي، بيانات متناقضة أو فارغة من غير معنى).
الفرص:
[${list}]
رجّع بس JSON array فيه الـid بتاع كل فرصة تستاهل تتشال (مكررة أو وهمية) بس، من غير أي نص زيادة قبله أو بعده. لو مفيش حاجة تتشال من الدفعة دي رجّع [] فاضي. الشكل بالظبط:
["id1","id2"]`;
    try{
      const res = await fetch(GEMINI_PROXY_URL, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ contents:[{role:"user", parts:[{text:prompt}]}], uid: state.user && state.user.uid })
      });
      const data = await res.json();
      if(!res.ok) break;
      const cand = data && data.candidates && data.candidates[0];
      const text = cand && cand.content && cand.content.parts && cand.content.parts.map(p=>p.text||"").join("") || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      let ids = [];
      if(jsonMatch){ try{ ids = JSON.parse(jsonMatch[0]); }catch(e){ ids = []; } }
      const batchIds = new Set(batch.map(o=>o.id));
      for(const id of ids){
        if(typeof id!=="string" || !batchIds.has(id)) continue; // تجاهل أي id مش من الدفعة دي أصلًا (أمان إضافي)
        try{ await deleteDoc(doc(db,"opportunities", id)); removedByAi++; }
        catch(err){ console.error("cleanup AI-flagged delete error:", err); }
      }
      state.adminMsg = `بيراجع... (اتحذف لحد دلوقتي: ${removedExact+removedByAi})`;
      render();
    }catch(err){
      console.error("cleanupFakeAndDuplicateOpportunities error:", err);
      break;
    }
  }
  await loadOpportunities();
  const total = removedExact + removedByAi;
  state.adminMsg = total>0
    ? `تم حذف ${total} فرصة (${removedExact} مكررة برابط مطابق + ${removedByAi} مكررة/وهمية اكتشفها الـAI) ✓`
    : "مفيش فرص مكررة أو وهمية اتلاقت — كل حاجة سليمة.";
  state.searchBusy=false; render();
  setTimeout(()=>{ state.adminMsg=""; render(); }, 6000);
}
async function searchForOpportunities(topic){
  state.searchBusy = true; state.searchErr=""; render();
  const result = await fetchAiOpportunities(topic);
  if(result.error){ state.searchErr = result.error; state.searchBusy=false; render(); return; }
  for(const it of result.items){
    const safeTags = Array.isArray(it.tags) ? it.tags.filter(t=>TAGS.includes(t)) : [];
    const validStages = STAGES.map(s=>s.id);
    const safeStages = Array.isArray(it.stageTags) ? it.stageTags.filter(s=>validStages.includes(s)) : [];
    await addDoc(collection(db,"opportunities"), {
      title: it.title||"بدون عنوان", organization: it.organization||"", description: it.description||"",
      category: it.category||"event", deadline: it.deadline||"", link: it.link||"",
      tags: safeTags, stageTags: safeStages, requirements:[], reviewed:true,
      groundingSources: result.sources, searchEntryPointHtml: result.searchEntryHtml, createdAt: Date.now()
    });
  }
  await loadOpportunities();
  state.searchTopic="";
  state.searchBusy=false; render();
}
function calendarLink(o){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(o.deadline||"")) return null;
  const start = o.deadline.replace(/-/g,"");
  const nd = new Date(o.deadline+"T00:00:00"); nd.setDate(nd.getDate()+1);
  const end = nd.toISOString().slice(0,10).replace(/-/g,"");
  const text = encodeURIComponent(`آخر موعد: ${o.title}`);
  const details = encodeURIComponent(`آخر موعد للتقديم على "${o.title}" عبر NextStep AI${o.link?" — "+o.link:""}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
}
async function reportProblem(oppId, oppTitle, reason){
  try{
    await addDoc(collection(db,"reports"), {oppId, oppTitle, reason, reportedBy: state.user.email, createdAt: Date.now()});
    state.toastMsg = "تم إرسال البلاغ، شكرًا لمساعدتك في تحسين البيانات.";
  }catch(err){
    state.toastMsg = `البلاغ متبعتش: ${err.message||"جرب تاني"}`;
  }
  render();
  setTimeout(()=>{ state.toastMsg=""; render(); }, 4000);
}
// فورم تعديل فرصة موجودة، معبّى ببياناتها الحالية — بيستخدم نفس شكل فورم
// الإضافة بس بيحفظ بـupdateOpportunity بدل ما يضيف فرصة جديدة.
function renderOppEditForm(o){
  return `
  <span class="opp-cat">${CATEGORIES[o.category]||o.category}</span>
  <h2 style="font-size:18px;font-weight:800;margin:10px 0 14px;">تعديل الفرصة</h2>
  <form id="edit-opp-form">
    <div class="field"><label>عنوان الفرصة</label><input name="title" type="text" value="${escapeHtml(o.title||"")}" required></div>
    <div class="field"><label>الجهة المنظمة</label><input name="organization" type="text" value="${escapeHtml(o.organization||"")}" required></div>
    <div class="field"><label>النوع</label><select name="category">${Object.entries(CATEGORIES).map(([k,v])=>`<option value="${k}" ${o.category===k?"selected":""}>${v}</option>`).join("")}</select></div>
    <div class="field"><label>الوصف</label><input name="description" type="text" value="${escapeHtml(o.description||"")}" required></div>
    <div class="field"><label>آخر موعد للتقديم</label><input name="deadline" type="date" value="${escapeHtml(o.deadline||"")}"></div>
    <div class="field"><label>رابط التقديم</label><input name="link" type="url" value="${escapeHtml(o.link||"")}" required placeholder="https://..."></div>
    <div class="field"><label>المتطلبات (اكتب كل شرط في سطر)</label><textarea name="requirements" rows="3">${(o.requirements||[]).join("\n")}</textarea></div>
    <div class="field"><label>مناسبة لمرحلة</label><div class="tag-grid">${STAGES.map(s=>`<button type="button" class="pill ${state.editOppStages.has(s.id)?"selected":""}" data-action="edit-toggle-stage" data-tag="${s.id}">${s.label}</button>`).join("")}</div></div>
    <div class="field"><label>الوسوم (بتتحسب عليها نسبة التطابق)</label><div class="tag-grid">${TAGS.map(t=>`<button type="button" class="pill ${state.editOppTags.has(t)?"selected":""}" data-action="edit-toggle-tag" data-tag="${t}">${t}</button>`).join("")}</div></div>
    <div style="display:flex;gap:8px;">
      <button type="submit" class="btn btn-gold" style="flex:1">حفظ التعديلات</button>
      <button type="button" class="btn btn-ghost" style="flex:1" data-action="cancel-edit-opp">إلغاء</button>
    </div>
  </form>`;
}
function renderModal(){
  const o = state.opportunities.find(x=>x.id===state.openOppId);
  if(!o) return "";
  if(state.editingOppId===o.id){
    return `
    <div class="modal-overlay" data-action="close-detail">
      <div class="modal-sheet" data-action="noop">
        <div class="modal-close"><button data-action="close-detail">✕</button></div>
        ${renderOppEditForm(o)}
      </div>
    </div>`;
  }
  const m = calcMatch(state.profile, o);
  const dl = deadlineInfo(o.deadline);
  return `
  <div class="modal-overlay" data-action="close-detail">
    <div class="modal-sheet" data-action="noop">
      <div class="modal-close"><button data-action="close-detail">✕</button></div>
      <span class="opp-cat">${CATEGORIES[o.category]||o.category}</span>
      ${o.reviewed?`<span class="badge-verified">✅ تم التحقق</span>`:""}
      <h2 style="font-size:19px;font-weight:800;margin:10px 0 2px;">${escapeHtml(o.title)}</h2>
      <div class="opp-org">${escapeHtml(o.organization||"")}</div>
      <div class="opp-deadline ${dl.urgent?"urgent":"normal"}" style="margin-top:6px;">${dl.text}</div>

      <div class="section-label">نسبة التطابق</div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="match-badge lat" style="--pct:${m.score}"><span>${m.score}%</span></div>
        <div style="font-size:13.5px;color:var(--ink-muted);">${m.score>=70?"تطابق قوي مع ملفك الشخصي":m.score>=40?"تطابق متوسط، تقدر تقوّيه":"تطابق ضعيف حاليًا"}</div>
      </div>
      ${stageMismatchNote(state.profile, o)?`<div class="note-box" style="background:#FCE9E9;color:#B4232C;margin-top:10px;">${stageMismatchNote(state.profile, o)}</div>`:""}

      ${m.matched.length?`<div class="section-label">ليه بتناسبك</div><div class="why-tags">${m.matched.map(t=>`<span class="pill">${t}</span>`).join("")}</div>`:""}
      ${m.missing.length?`<div class="section-label">مهارات ينصح تكتسبها</div><div class="missing-tags">${m.missing.map(t=>`<span class="pill">${t}</span>`).join("")}</div>`:""}

      <div class="section-label">الوصف</div>
      <div class="desc-text">${escapeHtml(o.description||"")}</div>

      ${(o.requirements&&o.requirements.length)?`<div class="section-label">المتطلبات</div><ul class="req-list">${o.requirements.map(r=>`<li>${escapeHtml(r)}</li>`).join("")}</ul>`:""}

      ${o.link
        ? `<a href="${escapeHtml(o.link)}" target="_blank" rel="noopener" class="btn btn-primary btn-block" style="display:block;box-sizing:border-box;text-align:center;text-decoration:none;margin-top:20px;">قدّم الآن ↗</a>`
        : `<div class="note-box" style="margin-top:20px;">لينك التقديم لسه مش متاح لهذه الفرصة. تقدر تبلّغ لو عندك معلومة تحديث.</div>`
      }
      ${calendarLink(o)?`<a href="${calendarLink(o)}" target="_blank" rel="noopener" class="btn btn-ghost btn-block" style="display:block;box-sizing:border-box;text-align:center;text-decoration:none;margin-top:10px;">📅 ضيفه لتقويم Google</a>`:""}
      <div class="section-label">في مشكلة في البيانات دي؟</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="pill" data-action="report-opp" data-id="${o.id}" data-reason="رابط لا يعمل">⚠️ الرابط باظ</button>
        <button class="pill" data-action="report-opp" data-id="${o.id}" data-reason="الموعد انتهى">⚠️ الموعد انتهى</button>
        <button class="pill" data-action="report-opp" data-id="${o.id}" data-reason="بيانات غلط">⚠️ بيانات غلط</button>
      </div>
      ${isAdmin()?`
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="btn btn-ghost" style="flex:1" data-action="edit-opp" data-id="${o.id}">✏️ تعديل الفرصة</button>
        <button class="btn btn-ghost" style="flex:1;color:#B4232C;" data-action="delete-opp" data-id="${o.id}">🗑️ حذف</button>
      </div>`:""}
    </div>
  </div>`;
}

function resizeImageFile(file, maxSize){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      const img = new Image();
      img.onload = ()=>{
        let w=img.width, h=img.height;
        if(w>h){ if(w>maxSize){ h=Math.round(h*maxSize/w); w=maxSize; } }
        else { if(h>maxSize){ w=Math.round(w*maxSize/h); h=maxSize; } }
        const canvas = document.createElement("canvas");
        canvas.width=w; canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL("image/jpeg",0.72));
      };
      img.onerror = ()=>reject(new Error("الصورة مش واضحة"));
      img.src = e.target.result;
    };
    reader.onerror = ()=>reject(new Error("مقدرتش أقرا الملف"));
    reader.readAsDataURL(file);
  });
}
function escapeHtml(str){
  return String(str||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function renderQuizModal(){
  const quiz = state.quizzes.find(q=>q.id===state.activeQuizId);
  if(!quiz) return "";
  if(state.quizSubmitted){
    const result = state.quizResults[quiz.id];
    return `
    <div class="modal-overlay" data-action="close-quiz">
      <div class="modal-sheet" data-action="noop" style="text-align:center;">
        <div class="modal-close" style="text-align:left;"><button data-action="close-quiz">✕</button></div>
        <div style="font-size:40px;margin:10px 0;">${result.passed?"🎉":"💪"}</div>
        <h2 style="font-size:19px;font-weight:800;">${result.passed?"مبروك، نجحت!":"قريب المرة الجاية"}</h2>
        <p style="color:var(--ink-muted);margin:8px 0 20px;">نتيجتك: ${result.score} من ${result.total}</p>
        ${result.passed?`<button class="btn btn-gold btn-block" data-action="download-cert" data-id="${quiz.id}">تحميل الشهادة 📜</button>`:`<div class="note-box">محتاج 70% على الأقل عشان تاخد الشهادة، راجع المصدر وجرب تاني.</div>`}
      </div>
    </div>`;
  }
  const answeredAll = quiz.questions.every((q,i)=>state.quizAnswers[i]!==undefined);
  return `
  <div class="modal-overlay" data-action="close-quiz">
    <div class="modal-sheet" data-action="noop">
      <div class="modal-close"><button data-action="close-quiz">✕</button></div>
      <h2 style="font-size:18px;font-weight:800;margin-bottom:14px;">${escapeHtml(quiz.title)}</h2>
      ${quiz.questions.map((q,i)=>`
        <div style="margin-bottom:18px;">
          <div style="font-weight:700;font-size:14.5px;margin-bottom:8px;">${i+1}. ${escapeHtml(q.q)}</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${q.options.map((opt,oi)=>`<button type="button" class="pill ${state.quizAnswers[i]===oi?"selected":""}" style="text-align:right;justify-content:flex-start;" data-action="pick-quiz-answer" data-q="${i}" data-opt="${oi}">${escapeHtml(opt)}</button>`).join("")}
          </div>
        </div>`).join("")}
      <button class="btn btn-gold btn-block" data-action="submit-quiz" ${answeredAll?"":"disabled"}>أرسل الإجابات</button>
    </div>
  </div>`;
}
function logoIconSvg(){
  return `<svg viewBox="0 0 70 70" width="60%" height="60%"><rect x="6" y="40" width="11" height="20" rx="3" fill="#0E3A45"/><rect x="21" y="28" width="11" height="32" rx="3" fill="#0E3A45"/><rect x="36" y="14" width="11" height="46" rx="3" fill="#0E3A45"/><circle cx="41.5" cy="8" r="6" fill="#0E3A45"/><circle cx="41.5" cy="8" r="2.3" fill="#F3C57A"/></svg>`;
}

// ============ events (delegated) ============

// Keep free-text profile-setup fields in sync with `state` on every keystroke.
// Without this, clicking a stage/interest/skill button (which calls render())
// would re-render these inputs from the (still-empty) state and silently wipe
// out anything the user had just typed.
const SETUP_TEXT_FIELD_MAP = {
  "setup-name":"setupName", "setup-age":"setupAge", "setup-country":"setupCountry",
  "setup-workplace":"setupWorkplace", "setup-school":"setupSchool", "setup-location":"setupLocation",
  "setup-cvlink":"setupCvLink", "setup-achievements":"setupAchievements", "setup-phone":"setupPhone",
  "setup-linkedin":"setupLinkedin", "setup-github":"setupGithub", "setup-contact-email":"setupContactEmail"
};
const SETUP_SELECT_FIELD_MAP = { "setup-english":"setupEnglish", "setup-goal":"setupGoal" };
app.addEventListener("input",(e)=>{
  const key = SETUP_TEXT_FIELD_MAP[e.target.id];
  if(key) state[key] = e.target.value;
});

app.addEventListener("change",(e)=>{
  if(e.target.id==="filter-category"){ state.filterCategory = e.target.value; render(); }
  else if(e.target.id==="filter-stage"){ state.filterStage = e.target.value; render(); }
  else if(e.target.id==="setup-photo" && e.target.files[0]){
    resizeImageFile(e.target.files[0], 300).then(b64=>{ state.setupPhotoBase64=b64; render(); }).catch(err=>{
      state.setupError = err.message||"مقدرتش أقرا الصورة"; render();
    });
  }
  else if(SETUP_SELECT_FIELD_MAP[e.target.id]){ state[SETUP_SELECT_FIELD_MAP[e.target.id]] = e.target.value; }
});
app.addEventListener("click",(e)=>{
  const t = e.target.closest("[data-action]");
  if(!t) return;
  const action = t.dataset.action;
  if(action==="noop"){ return; }
  if(action==="show-login"){ state.authMode="login"; state.authError=""; render(); }
  else if(action==="show-signup"){ state.authMode="signup"; state.authError=""; state.resetMsg=""; render(); }
  else if(action==="forgot-password"){
    const emailField = document.getElementById("auth-email");
    handleResetPassword(emailField?emailField.value.trim():"");
  }
  else if(action==="google-signin"){ handleGoogleSignIn(); }
  else if(action==="logout"){ handleLogout(); }
  else if(action==="pick-stage"){ state.setupStage=t.dataset.stage; state.setupGradeDetail=""; render(); }
  else if(action==="pick-grade-detail"){ state.setupGradeDetail=t.dataset.grade; render(); }
  else if(action==="pick-working"){ state.setupWorking=t.dataset.working; render(); }
  else if(action==="toggle-interest"){ const tag=t.dataset.tag; state.setupInterests.has(tag)?state.setupInterests.delete(tag):state.setupInterests.add(tag); render(); }
  else if(action==="toggle-skill"){ const tag=t.dataset.tag; state.setupSkills.has(tag)?state.setupSkills.delete(tag):state.setupSkills.add(tag); render(); }
  else if(action==="open-learn-category"){ const tag=t.dataset.tag; state.learnSkillsCategoryOpen = (state.learnSkillsCategoryOpen===tag) ? "" : tag; render(); }
  else if(action==="toggle-learn-skill"){ const tag=t.dataset.tag; state.setupLearnSkills.has(tag)?state.setupLearnSkills.delete(tag):state.setupLearnSkills.add(tag); render(); }
  else if(action==="submit-profile"){
    state.setupName = document.getElementById("setup-name").value;
    state.setupAge = document.getElementById("setup-age").value;
    state.setupCountry = document.getElementById("setup-country").value;
    state.setupSchool = document.getElementById("setup-school").value;
    state.setupEnglish = document.getElementById("setup-english").value;
    state.setupGoal = document.getElementById("setup-goal").value;
    state.setupLocation = document.getElementById("setup-location").value;
    state.setupCvLink = document.getElementById("setup-cvlink").value;
    state.setupAchievements = document.getElementById("setup-achievements").value;
    state.setupPhone = document.getElementById("setup-phone").value;
    state.setupLinkedin = document.getElementById("setup-linkedin").value;
    state.setupGithub = document.getElementById("setup-github").value;
    const ce = document.getElementById("setup-contact-email");
    if(ce) state.setupContactEmail = ce.value;
    const wp = document.getElementById("setup-workplace");
    if(wp) state.setupWorkplace = wp.value;
    submitProfile();
  }
  else if(action==="tab"){ state.activeTab=t.dataset.tab; state.openOppId=null; render(); }
  else if(action==="open-detail"){ state.openOppId=t.dataset.id; render(); }
  else if(action==="close-detail"){ state.openOppId=null; state.editingOppId=null; state.editOppTags=new Set(); state.editOppStages=new Set(); render(); }
  else if(action==="report-opp"){ reportProblem(t.dataset.id, (state.opportunities.find(x=>x.id===t.dataset.id)||{}).title||"", t.dataset.reason); }
  else if(action==="delete-opp"){ deleteOpportunity(t.dataset.id); }
  else if(action==="bulk-fix-tags"){ bulkFixOpportunityTags(); }
  else if(action==="cleanup-fake-opps"){ cleanupFakeAndDuplicateOpportunities(); }
  else if(action==="edit-opp"){
    const o = state.opportunities.find(x=>x.id===t.dataset.id);
    if(o){
      state.editingOppId = o.id;
      state.editOppTags = new Set(o.tags||[]);
      state.editOppStages = new Set(o.stageTags||[]);
      render();
    }
  }
  else if(action==="cancel-edit-opp"){ state.editingOppId=null; state.editOppTags=new Set(); state.editOppStages=new Set(); render(); }
  else if(action==="edit-toggle-tag"){ const tag=t.dataset.tag; state.editOppTags.has(tag)?state.editOppTags.delete(tag):state.editOppTags.add(tag); render(); }
  else if(action==="edit-toggle-stage"){ const tag=t.dataset.tag; state.editOppStages.has(tag)?state.editOppStages.delete(tag):state.editOppStages.add(tag); render(); }
  else if(action==="learning-subtab"){ state.learningSubTab = t.dataset.subtab; render(); }
  else if(action==="delete-resource"){ deleteResource(t.dataset.id); }
  else if(action==="edit-resource"){
    state.editingResourceId = t.dataset.id;
    const r = state.resources.find(x=>x.id===t.dataset.id);
    state.adminResTags = new Set((r && r.tags) || []);
    render();
  }
  else if(action==="cancel-edit-resource"){ state.editingResourceId=null; state.adminResTags=new Set(); render(); }
  else if(action==="remove-lesson"){ removeLessonFromCourse(t.dataset.id, Number(t.dataset.idx)); }
  else if(action==="clear-search"){ state.searchQuery=""; render(); }
  else if(action==="quick-filter-cat"){ state.filterCategory=t.dataset.cat; render(); }
  else if(action==="approve-pending"){ approvePending(t.dataset.id); }
  else if(action==="reject-pending"){ rejectPending(t.dataset.id); }
  else if(action==="toggle-complete"){ toggleResourceComplete(t.dataset.id); }
  else if(action==="toggle-lesson"){ toggleLessonComplete(t.dataset.id, parseInt(t.dataset.idx,10)); }
  else if(action==="download-course-cert"){ downloadCourseCertificate(t.dataset.id); }
  else if(action==="start-quiz"){ state.activeQuizId=t.dataset.id; state.quizAnswers={}; state.quizSubmitted=false; render(); }
  else if(action==="close-quiz"){ state.activeQuizId=null; render(); }
  else if(action==="pick-quiz-answer"){ state.quizAnswers[t.dataset.q]=parseInt(t.dataset.opt,10); render(); }
  else if(action==="submit-quiz"){ submitQuizAnswers(); }
  else if(action==="download-cert"){ downloadCertificate(t.dataset.id); }
  else if(action==="generate-cv"){ generateCV(); }
  else if(action==="print-cv"){ downloadAtsCv(); }
  else if(action==="admin-toggle"){
    state.adminOpen = state.adminOpen===t.dataset.form ? null : t.dataset.form;
    render();
  }
  else if(action==="admin-toggle-tag"){ const tag=t.dataset.tag; state.adminOppTags.has(tag)?state.adminOppTags.delete(tag):state.adminOppTags.add(tag); render(); }
  else if(action==="admin-toggle-stage"){ const tag=t.dataset.tag; state.adminOppStages.has(tag)?state.adminOppStages.delete(tag):state.adminOppStages.add(tag); render(); }
  else if(action==="admin-toggle-restag"){ const tag=t.dataset.tag; state.adminResTags.has(tag)?state.adminResTags.delete(tag):state.adminResTags.add(tag); render(); }
  else if(action==="edit-profile"){
    const p = state.profile;
    state.setupName=p.name; state.setupStage=p.stage; state.setupGradeDetail=p.gradeDetail||"";
    state.setupWorking=p.working||""; state.setupWorkplace=p.workplace||"";
    state.setupAge=p.age||""; state.setupCountry=p.country||"مصر"; state.setupSchool=p.school||"";
    state.setupEnglish=p.englishLevel||""; state.setupGoal=p.goal||""; state.setupCvLink=p.cvLink||"";
    state.setupAchievements=p.achievements||""; state.setupPhotoBase64=p.photoBase64||"";
    state.setupPhone=p.phone||""; state.setupLinkedin=p.linkedin||""; state.setupGithub=p.github||"";
    state.setupContactEmail=p.contactEmail||"";
    state.setupInterests=new Set(p.interests||[]); state.setupSkills=new Set(p.skills||[]); state.setupLearnSkills=new Set(p.learnSkills||[]);
    state.setupLocation=p.location||""; state.screen="profile-setup"; render();
  }
});

app.addEventListener("submit",(e)=>{
  e.preventDefault();
  if(e.target.id==="auth-form"){
    const fd = new FormData(e.target);
    handleAuthSubmit(fd.get("email"), fd.get("password"), fd.get("name"));
  }
  else if(e.target.id==="chat-form"){
    const input = document.getElementById("chat-input");
    const text = input.value;
    input.value = "";
    sendChatMessage(text);
  }
  else if(e.target.id==="admin-opp-form"){ submitAdminOpp(e.target); }
  else if(e.target.id==="edit-opp-form"){ updateOpportunity(e.target); }
  else if(e.target.id==="admin-res-form"){ submitAdminResource(e.target); }
  else if(e.target.id==="edit-res-form"){ submitResourceEdit(e.target, state.editingResourceId); }
  else if(e.target.id==="admin-quiz-form"){ submitAdminQuiz(e.target); }
  else if(e.target.id==="search-form"){
    state.searchQuery = document.getElementById("search-input").value;
    render();
  }
  else if(e.target.id==="ai-search-form"){
    const topic = document.getElementById("ai-search-input").value.trim();
    if(topic) searchForOpportunities(topic);
  }
});

// ============ boot ============

// Safety net: never let the app stay stuck on the loading spinner.
// If boot hasn't finished within 12s (e.g. Firebase blocked/unreachable on this
// deployment), fall back to the auth screen with an explanatory message instead
// of an endless spinner.
let bootFinished = false;
setTimeout(()=>{
  if(!bootFinished && state.screen==="loading"){
    bootFinished = true; window.__appBooted = true;
    state.user=null; state.profile=null; state.screen="auth";
    state.authError="محصلش اتصال بالسيرفر خلال وقت كافي. تأكد من اتصال الإنترنت وجرب تحدّث الصفحة.";
    try{ render(); }catch(e){ console.error("render error:", e); }
  }
}, 12000);

// Global error handlers: log unexpected runtime errors instead of letting the
// page hang silently, and make sure the user is never left on the spinner.
window.addEventListener("error", (e)=>{
  console.error("Global error:", e.error||e.message);
  if(!bootFinished && state.screen==="loading"){
    bootFinished = true; window.__appBooted = true;
    state.screen="auth";
    state.authError="حصل خطأ غير متوقع أثناء تحميل الصفحة. جرب تحدّثها تاني.";
    try{ render(); }catch(err){ console.error("render error:", err); }
  }
});
window.addEventListener("unhandledrejection", (e)=>{
  console.error("Unhandled promise rejection:", e.reason);
});

try{
  onAuthStateChanged(auth, async (user)=>{
    try{
      if(user){
        state.user = user;
        const profile = await loadProfile(user.uid);
        const isComplete = profile && profile.stage && (profile.interests||[]).length>0 && (profile.skills||[]).length>0;
        if(isComplete){
          state.profile = profile;
          state.completedResourceIds = profile.completedResourceIds||[]; state.completedLessonIds = profile.completedLessonIds||[]; state.quizResults = profile.quizResults||{};
          await loadOpportunities();
          await loadResources();
          await loadPendingOpps();
          await loadQuizzes();
          state.screen = "dashboard";
        } else {
          state.setupName=(profile&&profile.name)||user.displayName||""; state.setupStage=(profile&&profile.stage)||"";
          state.setupPhotoBase64=(profile&&profile.photoBase64)||user.photoURL||"";
          state.setupInterests=new Set((profile&&profile.interests)||[]); state.setupSkills=new Set((profile&&profile.skills)||[]); state.setupLearnSkills=new Set((profile&&profile.learnSkills)||[]);
          state.setupLocation=(profile&&profile.location)||"";
          state.screen = "profile-setup";
        }
      } else {
        state.user=null; state.profile=null; state.screen="auth";
      }
    }catch(err){
      console.error("Boot/auth-state error:", err);
      state.user=null; state.profile=null; state.screen="auth";
      state.authError="حصل خطأ أثناء تحميل بياناتك. جرب تحدّث الصفحة أو سجّل الدخول تاني.";
    }
    bootFinished = true; window.__appBooted = true;
    try{ render(); }catch(err){ console.error("render error:", err); }
    if(state.screen==="dashboard" && isAdmin()){
      try{
        cleanupExpiredOpportunities();
      }catch(err){ console.error("post-boot admin tasks error:", err); }
    }
  });
}catch(err){
  console.error("Failed to attach onAuthStateChanged listener:", err);
  state.screen="auth";
  state.authError="مقدرناش نتصل بخدمة تسجيل الدخول. تأكد من اتصال الإنترنت وجرب تحدّث الصفحة.";
  bootFinished = true; window.__appBooted = true;
  render();
}
