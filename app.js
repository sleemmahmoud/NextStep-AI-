import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, addDoc,
  query, where
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

// ============ دليل الجامعات / منصات الكورسات / الموارد المجانية ============
// بيانات ثابتة (مش من AI ومش من Firestore) بيراجعها الأدمن يدويًا لو احتاج
// تحديث — أبسط وأضمن استقرارًا من مصدر ديناميكي لمحتوى مرجعي شبه ثابت أصلًا.
const UNIVERSITIES_GUIDE = [
  {region:"مصر", items:[
    {name:"الجامعة الأمريكية بالقاهرة (AUC)", info:"جامعة خاصة معتمدة دوليًا، منح جزئية وكاملة متاحة حسب التفوق والاحتياج المادي.", url:"https://www.aucegypt.edu"},
    {name:"جامعة القاهرة", info:"أقدم وأكبر جامعة حكومية في مصر، تخصصات شاملة تقريبًا في كل المجالات.", url:"https://cu.edu.eg"},
    {name:"جامعة عين شمس", info:"جامعة حكومية كبرى، قوية في الطب والهندسة والألسن.", url:"https://www.asu.edu.eg"},
    {name:"الجامعة الألمانية بالقاهرة (GUC)", info:"جامعة خاصة بشراكة ألمانية، قوية في الهندسة وإدارة الأعمال.", url:"https://www.guc.edu.eg"}
  ]},
  {region:"السعودية", items:[
    {name:"جامعة الملك سعود", info:"من أكبر الجامعات الحكومية بالسعودية، منح للطلاب الدوليين متاحة.", url:"https://ksu.edu.sa"},
    {name:"جامعة الملك عبدالله للعلوم والتقنية (KAUST)", info:"جامعة أبحاث دراسات عليا، كل الطلاب المقبولين يحصلون على منحة كاملة تقريبًا.", url:"https://www.kaust.edu.sa"}
  ]},
  {region:"الإمارات", items:[
    {name:"جامعة الإمارات العربية المتحدة", info:"الجامعة الوطنية الحكومية الأقدم بالإمارات.", url:"https://www.uaeu.ac.ae"},
    {name:"الجامعة الأمريكية في الشارقة (AUS)", info:"جامعة خاصة معتمدة أمريكيًا، تخصصات هندسة وأعمال قوية.", url:"https://www.aus.edu"}
  ]},
  {region:"قطر", items:[
    {name:"جامعة قطر", info:"الجامعة الوطنية الحكومية بقطر، منح للمتفوقين.", url:"https://www.qu.edu.qa"},
    {name:"المدينة التعليمية (Education City)", info:"تضم فروعًا لجامعات عالمية زي جورجتاون وكارنيجي ميلون داخل الدوحة.", url:"https://www.qf.org.qa/education"}
  ]},
  {region:"أمريكا", items:[
    {name:"هارفارد (Harvard University)", info:"منح Need-Based سخية جدًا للطلاب الدوليين المتفوقين أكاديميًا.", url:"https://college.harvard.edu"},
    {name:"MIT", info:"من أقوى الجامعات في الهندسة والحاسبات، منح تغطي الاحتياج المادي بالكامل.", url:"https://www.mit.edu"}
  ]},
  {region:"بريطانيا", items:[
    {name:"جامعة أكسفورد", info:"منح Rhodes وChevening متاحة للطلاب الدوليين المتميزين.", url:"https://www.ox.ac.uk"},
    {name:"جامعة كامبريدج", info:"منح Gates Cambridge للدراسات العليا للطلاب الدوليين.", url:"https://www.cam.ac.uk"}
  ]}
];
const COURSE_PLATFORMS_GUIDE = [
  {name:"Coursera", info:"كورسات جامعات عالمية، فيه Financial Aid مجاني للشهادة.", url:"https://www.coursera.org"},
  {name:"edX", info:"كورسات من هارفارد وMIT وغيرهم، مراجعة مجانية (Audit) متاحة.", url:"https://www.edx.org"},
  {name:"FutureLearn", info:"كورسات جامعات بريطانية بالأساس، تفاعلية وقصيرة المدة.", url:"https://www.futurelearn.com"},
  {name:"Udemy (كورسات مجانية)", info:"فلتر الكورسات المجانية بس من الموقع، جودة متفاوتة فراجع التقييمات.", url:"https://www.udemy.com/courses/free"},
  {name:"Cisco Networking Academy", info:"كورسات شبكات وأمن سيبراني مجانية بشهادة معتمدة من Cisco.", url:"https://skillsforall.com"},
  {name:"Google Skillshop", info:"كورسات وشهادات مجانية في التسويق الرقمي وإعلانات جوجل.", url:"https://skillshop.withgoogle.com"},
  {name:"Microsoft Learn", info:"مسارات تعلم مجانية في السحابة والبرمجة وAI من مايكروسوفت.", url:"https://learn.microsoft.com"},
  {name:"freeCodeCamp", info:"تعلم البرمجة كاملة من الصفر مجانًا مع شهادات لكل مسار.", url:"https://www.freecodecamp.org"},
  {name:"Kaggle Learn", info:"كورسات قصيرة عملية جدًا في تحليل البيانات والذكاء الاصطناعي.", url:"https://www.kaggle.com/learn"},
  {name:"Harvard Online (CS50 وغيره)", info:"كورسات هارفارد المجانية الشهيرة، أشهرها CS50 لمقدمة علوم الحاسب.", url:"https://pll.harvard.edu"},
  {name:"Stanford Online", info:"كورسات مجانية من ستانفورد في الحاسبات والأعمال.", url:"https://online.stanford.edu"},
  {name:"MIT OpenCourseWare", info:"محاضرات ومواد كورسات MIT كاملة مجانًا من غير شهادة.", url:"https://ocw.mit.edu"},
  {name:"OpenLearn (الجامعة المفتوحة ببريطانيا)", info:"كورسات مجانية قصيرة في مجالات متنوعة من The Open University.", url:"https://www.open.edu/openlearn"},
  {name:"SoloLearn", info:"تعلم البرمجة تفاعليًا من الموبايل، مناسب للمبتدئين.", url:"https://www.sololearn.com"},
  {name:"Alison", info:"آلاف الكورسات المجانية بشهادات في مجالات متنوعة.", url:"https://alison.com"}
];
const FREE_RESOURCES_GUIDE = [
  {name:"GitHub Student Developer Pack", info:"أدوات ومنتجات مدفوعة مجانية للطلاب (استضافة، دومين، أدوات تصميم وأكتر).", url:"https://education.github.com/pack"},
  {name:"Canva (قوالب CV وCover Letter)", info:"قوالب سيرة ذاتية وخطاب تقديم مجانية جاهزة للتعديل.", url:"https://www.canva.com/resumes"},
  {name:"Overleaf (قوالب SOP وCV بصيغة LaTeX)", info:"قوالب احترافية لـSOP وCV بصيغة LaTeX، مجانية للاستخدام الأساسي.", url:"https://www.overleaf.com/latex/templates"},
  {name:"Grammarly", info:"مراجعة إملائية ونحوية مجانية للإنجليزي، مفيد جدًا لخطابات التقديم.", url:"https://www.grammarly.com"},
  {name:"Notion", info:"تنظيم خطة التقديم للفرص، وعمل بورتفوليو بسيط مجانًا.", url:"https://www.notion.com"},
  {name:"Scholars4Dev", info:"موقع متخصص في تجميع المنح الدراسية الدولية المحدّثة.", url:"https://www.scholars4dev.com"},
  {name:"Opportunity Desk", info:"موقع بيجمع فرص منح وتدريب ومسابقات دولية للشباب.", url:"https://opportunitydesk.org"}
];
// ضع إيميلك هنا لقفل الموافقة والرفض عليك انت بس. سايبها فاضية دلوقتي = أي حد مسجل دخول
// يقدر يوافق (عادي طول ما انت المستخدم الوحيد)، هتتقفل تلقائيًا أول ما تحط إيميلك هنا.
const ADMIN_EMAILS = ["nextstepai010@gmail.com"];
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
  notifications:[], announcements:[], notifPanelOpen:false, lastSeenAnnouncementAt:0,
  navOpen:false, navCollapsed:false, helpOpenTab:null,
  activeAssessmentId:null, assessmentAnswers:{}, assessmentReport:null, assessmentHistory:[],
  successStories:[], successStoryFilter:"", editingStoryId:null, storyDraft:{title:"",category:"grant",country:"",content:"",imageUrl:""},
  resources:[], adminOpen:null, adminOppTags:new Set(), adminOppStages:new Set(), adminResTags:new Set(), adminMsg:"", toastMsg:"",
  courseDraft: { title:"", description:"", thumbnail:"", courseType:"single", hasCertificate:true,
    lessons:[{title:"",link:"",pdfLink:"",extraLinksRaw:""}], resources:[] },
  editingResourceId:null,
  verifyCertId:null, verifyCertStatus:"loading", verifyCertData:null,
  learningSubTab:"tips", learningCenterSection:"content", profileSection:"info", chatSection:"ai",
  universities:[], uniSearchQuery:"", uniFilterType:"", uniFilterCity:"", openUniId:null, compareUniIds:[], adminUniDraft:null, uniAiBusy:false, adminCollegeDraft:null, showUniCompareModal:false,
  pendingOpps:[], searchTopic:"", searchBusy:false, searchErr:"", searchNote:"", lastFoundItems:[],
  // إعدادات لوحة تحكم البحث اليدوي بالـAI — كلها اختيارية، والقيم الافتراضية
  // دي بالظبط سلوك النظام القديم (نفس الموديل، نفس عدد النتائج) عشان محدش
  // يتأثر لو محدّش الإعدادات دي خالص.
  searchModel:"gemini-3.5-flash", searchDepth:"deep", searchResultCount:5,
  aiQuota:null, aiQuotaLoading:false,
  quizzes:[], completedResourceIds:[], completedLessonIds:[], quizResults:{}, activeQuizId:null, quizAnswers:{}, quizSubmitted:false,
  dashboardLastVisit:null, trackFilter:"", autoSearchMeta:null, guidesSubTab:"universities"
};
// حالات متابعة الفرصة اللي المستخدم يقدر يحددها بنفسه، بتتخزن في ملفه الشخصي
// بس (users/{uid}.oppTracking) — من غير أي Collection أو Document جديد.
const TRACK_STATUSES = {
  saved:"محفوظة", will_apply:"سأقدم", applied:"تم التقديم",
  under_review:"تحت المراجعة", accepted:"مقبول", rejected:"مرفوض"
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
  const trackedCount = Object.keys((p&&p.oppTracking)||{}).length;
  const appliedCount = Object.values((p&&p.oppTracking)||{}).filter(t=>["applied","under_review","accepted"].includes(t.status)).length;
  const streakXP = Math.min((p&&p.streakCount)||0, 30)*2; // مسقوفة عند 30 يوم عشان الستريك الطويل جدًا ميتحكمش في اللفل لوحده
  return Math.round(profileCompleteness(p)*0.3) + quizXP + resourceXP + trackedCount*3 + appliedCount*10 + streakXP;
}
function computeLevel(xp){ return Math.floor(xp/50)+1; }
function computeAchievements(p){
  const passedQuizzes = Object.values(state.quizResults||{}).filter(r=>r.passed).length;
  const tracking = (p&&p.oppTracking)||{};
  const appliedCount = Object.values(tracking).filter(t=>["applied","under_review","accepted"].includes(t.status)).length;
  const acceptedCount = Object.values(tracking).filter(t=>t.status==="accepted").length;
  const streak = (p&&p.streakCount)||0;
  return [
    {id:"start", label:"أول خطوة", unlocked: profileCompleteness(p)>=50},
    {id:"full", label:"ملف مكتمل 100%", unlocked: profileCompleteness(p)>=100},
    {id:"quiz1", label:"أول شهادة", unlocked: passedQuizzes>=1},
    {id:"quiz3", label:"متعلّم نشيط (3 شهادات)", unlocked: passedQuizzes>=3},
    {id:"track1", label:"أول فرصة متابَعة", unlocked: Object.keys(tracking).length>=1},
    {id:"apply1", label:"أول تقديم", unlocked: appliedCount>=1},
    {id:"apply5", label:"مقدّم نشيط (5 تقديمات)", unlocked: appliedCount>=5},
    {id:"accepted1", label:"أول قبول 🎉", unlocked: acceptedCount>=1},
    {id:"streak7", label:"أسبوع متواصل 🔥", unlocked: streak>=7},
    {id:"streak30", label:"شهر متواصل 🔥", unlocked: streak>=30}
  ];
}
// بتحدّث متتالية الدخول اليومية (Daily Streak) — بتتنادى مرة واحدة بس لكل جلسة
// دخول، وبتتغيّر بس لو اليوم مختلف عن آخر يوم مسجّل (يعني مش بتزيد لو المستخدم
// دخل عدة مرات في نفس اليوم). بترجع true لو فعلًا احتاجت تحفظ في Firestore.
function updateStreakOnLogin(p){
  const today = todayStr();
  if(p.lastActiveDate === today) return false;
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const newStreak = p.lastActiveDate === yesterday ? (p.streakCount||0)+1 : 1;
  p.streakCount = newStreak;
  p.longestStreak = Math.max(p.longestStreak||0, newStreak);
  p.lastActiveDate = today;
  return true;
}
// ============ متابعة الفرص (Opportunity Tracking) ============
// بتتخزن كـmap جوه ملف المستخدم نفسه: users/{uid}.oppTracking = { [oppId]: {status, note, updatedAt} }
function getOppTrack(oppId){
  const t = (state.profile && state.profile.oppTracking) || {};
  return t[oppId] || null;
}
async function saveOppTracking(){
  if(!state.user) return;
  try{ await updateDoc(doc(db,"users",state.user.uid), {oppTracking: state.profile.oppTracking||{}}); }
  catch(e){ console.error("saveOppTracking error:", e); }
}
function setOppTrackStatus(oppId, status){
  if(!state.profile) return;
  state.profile.oppTracking = state.profile.oppTracking || {};
  const prev = state.profile.oppTracking[oppId] || {note:""};
  state.profile.oppTracking[oppId] = {...prev, status, updatedAt: Date.now()};
  render();
  saveOppTracking();
}
function saveOppTrackNote(oppId){
  if(!state.profile) return;
  const el = document.getElementById(`track-note-${oppId}`);
  const note = (el ? el.value : "").trim();
  state.profile.oppTracking = state.profile.oppTracking || {};
  const prev = state.profile.oppTracking[oppId] || {status:""};
  state.profile.oppTracking[oppId] = {...prev, note, updatedAt: Date.now()};
  saveOppTracking();
  state.toastMsg = "تم حفظ الملاحظة ✓"; render();
  setTimeout(()=>{ state.toastMsg=""; render(); }, 2500);
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
// بيقرا meta/autoSearch (بيتكتب من worker.ts بعد كل تشغيلة بحث تلقائي يومي) عشان
// نعرض "آخر تحديث" في الرئيسية — لو المستند لسه مش موجود (أول تشغيلة لسه ما
// حصلتش) بيرجّع null بهدوء من غير أي خطأ يظهر للمستخدم.
async function loadAutoSearchMeta(){
  try{
    const snap = await getDoc(doc(db,"meta","autoSearch"));
    state.autoSearchMeta = snap.exists() ? snap.data() : null;
  }catch(err){
    console.error("loadAutoSearchMeta error:", err);
    state.autoSearchMeta = null;
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
async function saveUniversityDraft(){
  const d = state.adminUniDraft || {};
  const payload = {
    name: (document.getElementById("uni-d-name")||{}).value?.trim() || d.name || "",
    type: (document.getElementById("uni-d-type")||{}).value || d.type || "",
    city: (document.getElementById("uni-d-city")||{}).value?.trim() || "",
    briefInfo: (document.getElementById("uni-d-brief")||{}).value?.trim() || "",
    admissionNotes: (document.getElementById("uni-d-admission")||{}).value?.trim() || "",
    tuitionNotes: (document.getElementById("uni-d-tuition")||{}).value?.trim() || "",
    features: (document.getElementById("uni-d-features")||{}).value?.trim() || "",
    website: (document.getElementById("uni-d-website")||{}).value?.trim() || "",
    updatedAt: Date.now(),
  };
  if(!payload.name){
    state.toastMsg = "لازم تكتب اسم الجامعة"; render();
    setTimeout(()=>{state.toastMsg=null; render();}, 2200);
    return;
  }
  try{
    if(d.id){
      await updateDoc(doc(db,"universities",d.id), payload);
      state.universities = state.universities.map(u=>u.id===d.id?{...u,...payload}:u);
    } else {
      payload.colleges = [];
      const ref = await addDoc(collection(db,"universities"), payload);
      state.universities = [...state.universities, {id:ref.id, ...payload}];
    }
    state.adminUniDraft = null;
  }catch(err){
    console.error("saveUniversityDraft error:", err);
    state.toastMsg = "حصل خطأ أثناء الحفظ، حاول تاني.";
    setTimeout(()=>{state.toastMsg=null; render();}, 2500);
  }
  render();
}
async function deleteUniversity(id){
  try{
    await deleteDoc(doc(db,"universities",id));
    state.universities = state.universities.filter(u=>u.id!==id);
    if(state.openUniId===id) state.openUniId = null;
  }catch(err){ console.error("deleteUniversity error:", err); }
  render();
}
async function saveCollegeDraft(){
  const d = state.adminCollegeDraft;
  if(!d || !d.uniId) return;
  const uni = state.universities.find(u=>u.id===d.uniId);
  if(!uni) return;
  const college = {
    name: (document.getElementById("col-d-name")||{}).value?.trim() || "",
    info: (document.getElementById("col-d-info")||{}).value?.trim() || "",
    studyYears: (document.getElementById("col-d-years")||{}).value?.trim() || "",
    requiresMath: !!(document.getElementById("col-d-math")||{}).checked,
    requiresBio: !!(document.getElementById("col-d-bio")||{}).checked,
    majors: (document.getElementById("col-d-majors")||{}).value?.trim() || "",
    careerPaths: (document.getElementById("col-d-career")||{}).value?.trim() || "",
    salaryNote: (document.getElementById("col-d-salary")||{}).value?.trim() || "",
    skillsNeeded: (document.getElementById("col-d-skills")||{}).value?.trim() || "",
    bestUniversities: (document.getElementById("col-d-best")||{}).value?.trim() || "",
    faq: (document.getElementById("col-d-faq")||{}).value?.trim() || "",
  };
  if(!college.name){
    state.toastMsg = "لازم تكتب اسم الكلية"; render();
    setTimeout(()=>{state.toastMsg=null; render();}, 2200);
    return;
  }
  const colleges = [...(uni.colleges||[])];
  if(d.idx!=null) colleges[d.idx] = college;
  else colleges.push(college);
  try{
    await updateDoc(doc(db,"universities",uni.id), {colleges, updatedAt: Date.now()});
    state.universities = state.universities.map(u=>u.id===uni.id?{...u, colleges, updatedAt: Date.now()}:u);
    state.adminCollegeDraft = null;
  }catch(err){
    console.error("saveCollegeDraft error:", err);
    state.toastMsg = "حصل خطأ أثناء حفظ الكلية.";
    setTimeout(()=>{state.toastMsg=null; render();}, 2500);
  }
  render();
}
async function deleteCollege(uniId, idx){
  const uni = state.universities.find(u=>u.id===uniId);
  if(!uni) return;
  const colleges = (uni.colleges||[]).filter((_,i)=>i!==idx);
  try{
    await updateDoc(doc(db,"universities",uniId), {colleges, updatedAt: Date.now()});
    state.universities = state.universities.map(u=>u.id===uniId?{...u, colleges}:u);
  }catch(err){ console.error("deleteCollege error:", err); }
  render();
}
async function loadUniversities(){
  try{
    const snap = await getDocs(collection(db,"universities"));
    state.universities = snap.docs.map(d=>({id:d.id, ...d.data()}));
  }catch(err){
    console.error("loadUniversities error:", err);
    state.universities = state.universities||[];
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

// ============ نظام الإشعارات (In-App Notifications) ============
// تصميم موفّر للاستخدام المجاني: إشعارات شخصية (deadline / إنجاز) بتتكتب
// كـ document واحد لكل مستخدم بس وقت حدوثها فعليًا (مفيش fan-out لكل
// المستخدمين). أما إعلانات عامة (كورس جديد.. إلخ) فبتتخزن في collection
// صغيرة "announcements" يقرأها الكل، من غير ما نكتب نسخة لكل مستخدم.
async function loadNotifications(){
  if(!state.user) return;
  try{
    const snap = await getDocs(query(collection(db,"notifications"), where("userId","==",state.user.uid)));
    state.notifications = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,40);
  }catch(err){
    console.error("loadNotifications error:", err);
    state.notifications = state.notifications||[];
  }
}
async function loadAnnouncements(){
  try{
    const snap = await getDocs(collection(db,"announcements"));
    state.announcements = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,20);
    const key = `nextstep_lastSeenAnnouncement_${state.user.uid}`;
    state.lastSeenAnnouncementAt = localStorage.getItem(key) ? parseInt(localStorage.getItem(key),10) : 0;
  }catch(err){
    console.error("loadAnnouncements error:", err);
    state.announcements = state.announcements||[];
  }
}
async function pushNotification(type, title, body, link){
  if(!state.user) return;
  try{
    const docRef = await addDoc(collection(db,"notifications"), {
      userId: state.user.uid, type, title, body: body||"", link: link||"", read:false, createdAt: Date.now()
    });
    state.notifications.unshift({id:docRef.id, userId:state.user.uid, type, title, body:body||"", link:link||"", read:false, createdAt:Date.now()});
  }catch(err){ console.error("pushNotification error:", err); }
}
async function markNotificationRead(id){
  const n = state.notifications.find(x=>x.id===id);
  if(!n || n.read) return;
  n.read = true; render();
  try{ await updateDoc(doc(db,"notifications",id), {read:true}); }catch(err){ console.error("markNotificationRead error:", err); }
}
async function markAllNotificationsRead(){
  const unread = state.notifications.filter(n=>!n.read);
  unread.forEach(n=>n.read=true);
  render();
  try{ await Promise.all(unread.map(n=>updateDoc(doc(db,"notifications",n.id), {read:true}))); }
  catch(err){ console.error("markAllNotificationsRead error:", err); }
}
function unreadNotifCount(){
  const personal = state.notifications.filter(n=>!n.read).length;
  const newAnnouncements = state.announcements.filter(a=>(a.createdAt||0) > (state.lastSeenAnnouncementAt||0)).length;
  return personal + newAnnouncements;
}
function toggleNotifPanel(){
  state.notifPanelOpen = !state.notifPanelOpen;
  if(state.notifPanelOpen && state.announcements.length){
    const key = `nextstep_lastSeenAnnouncement_${state.user.uid}`;
    state.lastSeenAnnouncementAt = Date.now();
    localStorage.setItem(key, String(state.lastSeenAnnouncementAt));
  }
  render();
}
// بتتفحص مرة واحدة بعد كل تسجيل دخول: فرص متابَعة قرب موعدها، وكورسات
// خلصانة ومستحقة شهادة. بتتجنب التكرار بمراجعة الإشعارات المخزّنة قبل الإضافة.
function generatePersonalNotifications(){
  if(!state.profile) return;
  const existingKeys = new Set(state.notifications.map(n=>`${n.type}:${n.refId}`));
  const tracking = state.profile.oppTracking || {};
  Object.keys(tracking).forEach(oppId=>{
    const t = tracking[oppId];
    if(!t || t.status==="مرفوض" || t.status==="تم التقديم") return;
    const opp = state.opportunities.find(o=>o.id===oppId);
    if(!opp) return;
    const d = daysUntil(opp.deadline);
    if(d>=0 && d<=3 && !existingKeys.has(`deadline:${oppId}`)){
      pushNotification("deadline", "⏰ اقترب الموعد النهائي", `فرصة "${opp.title}" هيقفل التقديم عليها خلال ${d} يوم.`, oppId);
    }
  });
  state.resources.forEach(r=>{
    if(!r.hasCertificate || !(r.lessons||[]).length) return;
    const {done, total} = courseProgress(r);
    if(total>0 && done===total && !existingKeys.has(`course-done:${r.id}`)){
      pushNotification("course-done", "🎓 مبروك! خلّصت الكورس", `كورس "${r.title}" اكتمل بالكامل — شهادتك جاهزة للتحميل.`, r.id);
    }
  });
}

// ============ صفحة قصص النجاح (Success Stories) ============
async function loadSuccessStories(){
  try{
    const snap = await getDocs(collection(db,"success_stories"));
    state.successStories = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(b.featured===true)-(a.featured===true) || (b.createdAt||0)-(a.createdAt||0));
  }catch(err){
    console.error("loadSuccessStories error:", err);
    state.successStories = state.successStories||[];
  }
}
async function saveSuccessStory(){
  if(!isAdmin()) return;
  const d = state.storyDraft;
  if(!d.title.trim() || !d.content.trim()) return;
  try{
    if(state.editingStoryId){
      await updateDoc(doc(db,"success_stories",state.editingStoryId), {...d});
    } else {
      await addDoc(collection(db,"success_stories"), {...d, featured:false, createdAt:Date.now()});
    }
    state.editingStoryId=null; state.storyDraft={title:"",category:"grant",country:"",content:"",imageUrl:""};
    await loadSuccessStories(); render();
  }catch(err){
    console.error("saveSuccessStory error:", err);
    state.toastMsg="حصل خطأ أثناء حفظ القصة، جرب تاني."; render();
    setTimeout(()=>{state.toastMsg="";render();},4000);
  }
}
async function deleteSuccessStory(id){
  if(!isAdmin()) return;
  try{ await deleteDoc(doc(db,"success_stories",id)); await loadSuccessStories(); render(); }
  catch(err){ console.error("deleteSuccessStory error:", err); }
}
async function toggleStoryFeatured(id){
  if(!isAdmin()) return;
  const s = state.successStories.find(x=>x.id===id);
  if(!s) return;
  try{ await updateDoc(doc(db,"success_stories",id), {featured: !s.featured}); await loadSuccessStories(); render(); }
  catch(err){ console.error("toggleStoryFeatured error:", err); }
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
// بتقلب حالة "فرصة مميزة" (زي إعلان/راعي) للفرصة — تعليم يدوي بسيط من الأدمن،
// من غير أي نظام دفع فعلي. الفرص المميزة بتتثبّت فوق قائمة "الفرص المقترحة"
// لكل المستخدمين بغض النظر عن نسبة التطابق.
async function toggleOppFeatured(id){
  if(!isAdmin()) return;
  const o = state.opportunities.find(x=>x.id===id);
  if(!o) return;
  const featured = !o.featured;
  try{
    await updateDoc(doc(db,"opportunities", id), {featured});
    await loadOpportunities();
    state.toastMsg = featured ? "تم تمييز الفرصة ✓ هتظهر فوق للكل" : "تم إلغاء تمييز الفرصة.";
  }catch(err){
    console.error("toggleOppFeatured error:", err);
    // بنورّي كود الخطأ الحقيقي (زي permission-denied أو unavailable) بدل رسالة
    // عامة، عشان لو المشكلة صلاحيات (Firestore rules) تبقى واضحة على طول.
    const code = err && err.code ? ` (${err.code})` : "";
    state.toastMsg = `حصل خطأ أثناء تحديث حالة التمييز${code}، جرب تاني.`;
  }
  render();
  setTimeout(()=>{ state.toastMsg=""; render(); }, 4000);
}
// نفس منطق تمييز الفرص بالظبط، بس للمحتوى التعليمي (كورسات/نصائح صغيرة/نصائح
// عملية) — المحتوى المميز بيظهر فوق أول حاجة في قسمه في مركز التعلم.
async function toggleResourceFeatured(id){
  if(!isAdmin()) return;
  const r = state.resources.find(x=>x.id===id);
  if(!r) return;
  const featured = !r.featured;
  try{
    await updateDoc(doc(db,"resources", id), {featured});
    await loadResources();
    await loadUniversities();
    state.toastMsg = featured ? "تم تمييزه ✓ هيظهر فوق أول حاجة في قسمه" : "تم إلغاء التمييز.";
  }catch(err){
    console.error("toggleResourceFeatured error:", err);
    const code = err && err.code ? ` (${err.code})` : "";
    state.toastMsg = `حصل خطأ أثناء تحديث حالة التمييز${code}، جرب تاني.`;
  }
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
    await loadUniversities();
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
    await loadUniversities();
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
    await loadUniversities();
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
  const fallback = `يتمنى فريق NextStep AI لـ${userName} مزيدًا من التقدم والتميز في مسيرته المهنية.`;
  const prompt = `اكتب جملة واحدة بس قصيرة ومشجّعة (من غير أي مقدمة أو علامات اقتباس) تُكتب أسفل شهادة إتمام كورس اسمه "${courseName}"، بالعربي الفصيح البسيط، بأسلوب رسمي ومختصر (سطر واحد بحد أقصى)، بتتمنى للمتدرب التوفيق في مسيرته المهنية. متكتبش اسم الشخص ولا اسم الكورس تاني في الجملة دي، هما مكتوبين قبل كده فوق.`;
  const result = await callAiProxy("", { contents:[{role:"user", parts:[{text:prompt}]}] }, {timeoutMs:30000, retries:1});
  if(!result.ok) return fallback;
  const cand = result.data && result.data.candidates && result.data.candidates[0];
  const text = cand && cand.content && cand.content.parts && cand.content.parts.map(x=>x.text||"").join("").trim();
  return text || fallback;
}
// بيولّد رقم شهادة قصير وثابت الشكل (زي NSA-7K2-9F1) من اسم المتدرب وعنوان
// الكورس والتاريخ — للعرض بس (مفيش قاعدة بيانات تحقق فعلية خلف الرقم ده لسه)،
// بس شكله زي شهادات Coursera/Google الحقيقية وبيدّي إحساس إن الشهادة موثّقة.
function generateCertId(recipientName, itemTitle, dateStr){
  const raw = `${recipientName}|${itemTitle}|${dateStr}|${Date.now()}`;
  let hash = 0;
  for(let i=0;i<raw.length;i++){ hash = ((hash<<5)-hash + raw.charCodeAt(i))|0; }
  const code = Math.abs(hash).toString(36).toUpperCase().padStart(8,"0").slice(0,8);
  return `NSA-${code.slice(0,3)}-${code.slice(3,7)}`;
}
// بتحفظ نسخة من بيانات الشهادة في Firestore بمعرّف الشهادة نفسه، عشان صفحة
// التحقق (?verify=ID) تقدر تجيبها وتأكد إنها حقيقية فعلًا — من غير ما تحتاج
// تسجيل دخول (قراءة عامة، مكتوبة في firestore.rules). لو الحفظ فشل لأي سبب
// (شبكة مثلاً)، مبنوقفش تحميل الشهادة نفسها بسبب كده — بس الـQR ممكن ما
// يرجّعش نتيجة لحد ما يعيد المحاولة.
async function issueCertificateRecord(certId, recipientName, itemLabel, itemTitle, dateStr){
  try{
    await setDoc(doc(db,"certificates",certId), {
      certId, recipientName, itemLabel, itemTitle, dateStr,
      uid: state.user ? state.user.uid : null,
      issuedAt: Date.now()
    });
  }catch(err){
    console.error("issueCertificateRecord error:", err);
  }
}
function certificateHtml(recipientName, itemLabel, itemTitle, bodyText, dateStr, certId){
  // تصميم احترافي بهوية NextStep AI بس (أبيض + تركواز/أخضر المنصة، من غير أي
  // لون خارج الهوية)، مستوحى من شهادات Cisco/Google/Microsoft: مساحات بيضاء
  // كتير، Typography واضحة، وتوزيع متوازن. الشعار الحقيقي (نفس اللي في باقي
  // الموقع) فوق الشمال، الاسم في النص بحجم كبير، التاريخ تحت اليمين، والتوقيع
  // تحت الشمال. كل عناصر التحقق (QR + رقم الشهادة + لينك التحقق) موجودة زي ما
  // هي بالظبط، اتحطت بس في مكان متوازن تحت النص.
  const verifyUrl = `${window.location.origin}${window.location.pathname}?verify=${certId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(verifyUrl)}`;
  return `
  <div style="width:1200px;height:850px;background:#FFFFFF;position:relative;box-sizing:border-box;font-family:'Cairo',Tahoma,Arial,sans-serif;color:#1A2B2E;">
    <div style="position:absolute;top:0;left:0;right:0;height:8px;background:linear-gradient(90deg,#0A2C35,#1F7A47);"></div>
    <div style="position:absolute;inset:0;border:1px solid #DCE3E1;margin:24px;"></div>

    <!-- الشعار الحقيقي بتاع المنصة، فوق الشمال -->
    <div style="position:absolute;top:52px;left:56px;display:flex;align-items:center;gap:10px;">
      <div style="width:38px;height:38px;border-radius:10px;background:#F1F6F4;display:flex;align-items:center;justify-content:center;">${logoIconSvg()}</div>
      <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:18px;letter-spacing:1px;color:#0A2C35;">NextStep AI</div>
    </div>

    <!-- شارة التوثيق الرقمي، فوق اليمين -->
    <div style="position:absolute;top:56px;right:56px;display:flex;align-items:center;gap:6px;background:#EAF6EF;border-radius:20px;padding:5px 12px;">
      <span style="color:#1F7A47;font-size:13px;">✓</span>
      <span style="font-size:11px;font-weight:700;color:#1F7A47;">شهادة صادرة رقميًا</span>
    </div>

    <div style="position:absolute;top:148px;left:0;right:0;text-align:center;padding:0 110px;">
      <div style="font-size:12px;letter-spacing:4px;color:#1F7A47;font-weight:700;">CERTIFICATE OF COMPLETION</div>
      <div style="font-size:36px;font-weight:800;margin:10px 0 30px;color:#0A2C35;">شهادة إتمام</div>

      <div style="font-size:15px;color:#5B6B6E;">تُمنح هذه الشهادة إلى</div>
      <div style="font-family:'Amiri','Cairo',serif;font-size:46px;font-weight:800;color:#0A2C35;margin:12px 0;">${escapeHtml(recipientName)}</div>
      <div style="width:300px;height:2px;background:#1F7A47;margin:0 auto 24px;"></div>

      <div style="font-size:16px;color:#3A4749;line-height:1.8;">تقديرًا لإتمامه بنجاح ${itemLabel} <strong>"${escapeHtml(itemTitle)}"</strong><br>عبر منصة NextStep AI</div>
      <div style="font-size:13.5px;color:#5B6B6E;max-width:680px;margin:14px auto 0;line-height:1.8;">${escapeHtml(bodyText)}</div>
    </div>

    <!-- عناصر التحقق (QR + رقم الشهادة + لينك التحقق) — نفس البيانات القديمة
         بالظبط، بس في مكان متوازن في النص تحت -->
    <div style="position:absolute;bottom:46px;left:50%;transform:translateX(-50%);text-align:center;">
      <img src="${qrUrl}" width="62" height="62" style="border-radius:6px;border:1px solid #DCE3E1;" crossorigin="anonymous">
      <div style="font-size:9.5px;color:#8C9A9C;margin-top:5px;">Certificate ID: ${certId}</div>
    </div>

    <!-- التاريخ، تحت اليمين -->
    <div style="position:absolute;bottom:50px;right:64px;text-align:right;">
      <div style="font-size:13px;font-weight:700;color:#1A2B2E;">${dateStr}</div>
      <div style="width:100px;height:2px;background:#DCE3E1;margin:6px 0 4px;"></div>
      <div style="font-size:11px;color:#5B6B6E;">تاريخ الإصدار</div>
    </div>

    <!-- التوقيع، تحت الشمال -->
    <div style="position:absolute;bottom:50px;left:64px;text-align:left;">
      <div style="font-family:'Brush Script MT','Segoe Script',cursive;font-size:30px;color:#0A2C35;">Sleem Mahmoud</div>
      <div style="width:150px;height:2px;background:#1F7A47;margin:4px 0 6px;"></div>
      <div style="font-size:12px;font-weight:700;color:#1A2B2E;">Sleem Mahmoud</div>
      <div style="font-size:10.5px;color:#5B6B6E;">Founder – NextStep AI</div>
    </div>
  </div>`;
}
async function downloadCertificate(quizId){
  const quiz = state.quizzes.find(q=>q.id===quizId);
  const result = state.quizResults[quizId];
  if(!quiz || !result) return;
  // لازم يكون اسم المستخدم متسجّل في ملفه الشخصي — لو فاضي، الـAI بيهلوّس ويحط
  // اسم عشوائي (زي "NextStep AI") بدل اسم حقيقي، وده اللي كان بيحصل.
  if(!(state.profile && state.profile.name && state.profile.name.trim())){
    alert("محتاج تكتب اسمك في الملف الشخصي الأول عشان الشهادة تطلع باسمك صح. روح لتبويب \"ملفي\" واكتب اسمك، وبعدين جرب تاني.");
    return;
  }
  try{
  const dateStr = new Date(result.completedAt).toLocaleDateString("ar-EG");
  const bodyText = `بنتيجة ${result.score}/${result.total}، ويتمنى فريق NextStep AI له مزيدًا من التقدم في مسيرته المهنية.`;
  const recipientName = state.profile.name.trim();
  const certId = generateCertId(recipientName, quiz.title, dateStr);
  await issueCertificateRecord(certId, recipientName, "اختبار", quiz.title, dateStr);
  const html = certificateHtml(recipientName, "اختبار", quiz.title, bodyText, dateStr, certId);
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
  // نفس الحماية: من غير اسم حقيقي مسجّل، الـAI بيخترع اسم بدل ما يسيبه فاضي —
  // فبنمنع توليد الشهادة خالص لحد ما المستخدم يكتب اسمه.
  if(!(state.profile && state.profile.name && state.profile.name.trim())){
    alert("محتاج تكتب اسمك في الملف الشخصي الأول عشان الشهادة تطلع باسمك صح. روح لتبويب \"ملفي\" واكتب اسمك، وبعدين جرب تاني.");
    return;
  }
  try{
    const dateStr = new Date().toLocaleDateString("ar-EG");
    const recipientName = state.profile.name.trim();
    const bodyText = await generateCertificateText(r.title, recipientName);
    const certId = generateCertId(recipientName, r.title, dateStr);
    await issueCertificateRecord(certId, recipientName, "كورس", r.title, dateStr);
    const html = certificateHtml(recipientName, "كورس", r.title, bodyText, dateStr, certId);
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
  if(!rawGoal && !rawAch) return {profile:p, polished:false, reason:"لا يوجد نص هدف/إنجازات مكتوب في ملفك الشخصي أصلًا عشان الـAI يحسّنه"};
  try{
    const prompt = `أنت خبير عالمي في كتابة السير الذاتية الاحترافية (CV writer). تحت كلام خام كتبه طالب/خريج مصري عن نفسه. مطلوب منك تعيد صياغته بالكامل — مش مجرد تعديل بسيط — بحيث يبقى احترافي جدًا:
- استخدم أفعال قوية وحركة (طوّر، قاد، نفّذ، ساهم، حقق...) بدل الجمل الجامدة.
- اختصر وركّز على الأهم، من غير حشو أو تكرار.
- حافظ على المعنى والحقائق زي ما هي بالظبط، من غير ما تختلق أي معلومة أو رقم أو إنجاز مش مذكور خالص.
- اكتب بالعربية الفصحى البسيطة والمفهومة (مش عامية، ومش لغة معقدة زيادة).

الهدف المهني الخام: """${rawGoal||"-"}"""
الإنجازات والمشاركات الخام (كل نقطة في سطر): """${rawAch||"-"}"""

رد بصيغة JSON بس من غير أي كلام زيادة قبله أو بعده ومن غير أي علامات markdown، بالشكل ده بالظبط: {"goal":"النص المحسّن للهدف","achievements":"سطر1\\nسطر2\\nسطر3"}`;
    // مهلة 45 ثانية (بدل 25) + إعادة محاولة تلقائية مرة واحدة لو الطلب الأول
    // اتقفل بسبب مهلة أو شبكة — إعادة صياغة CV كامل بترجع JSON أطول من رد شات
    // عادي وممكن تاخد وقت أطول من 25 ثانية في أوقات الضغط.
    const result = await callAiProxy("", { contents:[{role:"user", parts:[{text: prompt}]}] }, {timeoutMs:45000, retries:1});
    if(!result.ok){
      console.error("polishCvContent: failed —", result.reason, result.message);
      const reason = result.reason==="quota" ? "وصلت للحد اليومي لاستخدام الذكاء الاصطناعي"
        : result.reason==="timeout" ? result.message
        : result.reason==="json_error" ? "رد السيرفر مكنش بصيغة سليمة"
        : `السيرفر رفض الطلب: ${result.message}`;
      return {profile:p, polished:false, reason};
    }
    const data = result.data;
    const cand = data && data.candidates && data.candidates[0];
    const text = (cand && cand.content && cand.content.parts && cand.content.parts.map(x=>x.text||"").join("") || "").trim();
    // بنستخرج أول { ... } موجود في الرد بدل ما نعتمد بس على إزالة ```json من
    // الأول والآخر — أكثر تحمّلًا لو الـAI ضاف أي نص زيادة حوالين الـJSON.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if(!jsonMatch){
      console.error("polishCvContent: no JSON found in AI reply:", text.slice(0,300));
      return {profile:p, polished:false, reason:"رد الـAI مكنش بصيغة متوقعة"};
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const newGoal = (parsed.goal && rawGoal) ? parsed.goal : p.goal;
    const newAch = (parsed.achievements && rawAch) ? parsed.achievements : p.achievements;
    const changed = (newGoal!==p.goal) || (newAch!==p.achievements);
    return {profile: {...p, goal:newGoal, achievements:newAch}, polished: changed, reason: changed?"":"رد الـAI مطابق للنص الأصلي"};
  }catch(err){
    console.error("polishCvContent error:", err);
    return {profile:p, polished:false, reason:"حصل خطأ غير متوقع أثناء تحسين الصياغة"}; // أي مشكلة نرجع للنص الأصلي بدل ما نوقف الـCV
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
    state.toastMsg = polishResult.polished ? "تم تحميل الـCV بعد تحسين الصياغة بالذكاء الاصطناعي ✓" : `تم تحميل الـCV من غير تحسين AI${polishResult.reason?" — "+polishResult.reason:""}.`;
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
    state.toastMsg = polishResult.polished ? "تم تحميل الـCV بعد تحسين الصياغة بالذكاء الاصطناعي ✓" : `تم تحميل الـCV من غير تحسين AI${polishResult.reason?" — "+polishResult.reason:""}.`;
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
function resetCourseDraft(){
  state.courseDraft = { title:"", description:"", thumbnail:"", courseType:"single", hasCertificate:true,
    lessons:[{title:"",link:"",pdfLink:"",extraLinksRaw:""}], resources:[] };
}
// بيقرا القيم الحالية من الفورم في الـDOM ويحطها في state.courseDraft قبل أي
// إعادة رسم بتغيّر عدد الفيديوهات/المصادر (إضافة أو حذف سطر) — عشان أي حاجة
// اتكتبت في السطور التانية ما تتمسحش لما نضيف/نشيل سطر.
function syncCourseDraftFromForm(){
  const form = document.getElementById("admin-course-form");
  if(!form) return;
  const fd = new FormData(form);
  state.courseDraft.title = fd.get("title")||"";
  state.courseDraft.description = fd.get("description")||"";
  state.courseDraft.thumbnail = fd.get("thumbnail")||"";
  state.courseDraft.hasCertificate = fd.get("hasCertificate")==="true";
  state.courseDraft.lessons = state.courseDraft.lessons.map((_,i)=>({
    title: fd.get(`lesson_title_${i}`)||"",
    link: fd.get(`lesson_link_${i}`)||"",
    pdfLink: fd.get(`lesson_pdf_${i}`)||"",
    extraLinksRaw: fd.get(`lesson_extra_${i}`)||""
  }));
  state.courseDraft.resources = state.courseDraft.resources.map((_,i)=>({
    title: fd.get(`res_title_${i}`)||"",
    type: fd.get(`res_type_${i}`)||"custom",
    url: fd.get(`res_url_${i}`)||""
  }));
}
function parseExtraLinksField(raw){
  return (raw||"").split("؛").map(s=>s.trim()).filter(Boolean).map(pair=>{
    const idx = pair.indexOf("=");
    if(idx===-1) return null;
    const label = pair.slice(0,idx).trim();
    const url = pair.slice(idx+1).trim();
    return (label && isValidLink(url)) ? {label, url} : null;
  }).filter(Boolean);
}
async function submitAddCourse(form){
  if(!isAdmin()) return;
  const fd = new FormData(form);
  const title = (fd.get("title")||"").trim();
  if(!title){
    state.adminMsg = "محتاج عنوان للكورس."; render();
    setTimeout(()=>{ state.adminMsg=""; render(); }, 4000); return;
  }
  const lessonCount = state.courseDraft.lessons.length;
  const lessons = [];
  for(let i=0;i<lessonCount;i++){
    const lTitle = (fd.get(`lesson_title_${i}`)||"").trim();
    const lLink = (fd.get(`lesson_link_${i}`)||"").trim();
    if(!lTitle || !isValidLink(lLink)) continue; // سطر فاضي أو ناقص بيتجاهل بدل ما يوقف الحفظ كله
    const lesson = {title:lTitle, link:lLink};
    const pdf = (fd.get(`lesson_pdf_${i}`)||"").trim();
    if(isValidLink(pdf)) lesson.pdfLink = pdf;
    const extraLinks = parseExtraLinksField(fd.get(`lesson_extra_${i}`));
    if(extraLinks.length) lesson.extraLinks = extraLinks;
    lessons.push(lesson);
  }
  if(lessons.length===0){
    state.adminMsg = "محتاج فيديو واحد على الأقل بعنوان ورابط يوتيوب صحيح.";
    render(); setTimeout(()=>{ state.adminMsg=""; render(); }, 4000); return;
  }
  const resourceCount = state.courseDraft.resources.length;
  const resTypeIcons = {pdf:"📄", drive:"🗂️", github:"💻", website:"🌐", custom:"🔗"};
  const extraLinks = [];
  for(let i=0;i<resourceCount;i++){
    const rTitle = (fd.get(`res_title_${i}`)||"").trim();
    const rUrl = (fd.get(`res_url_${i}`)||"").trim();
    const rType = fd.get(`res_type_${i}`)||"custom";
    if(rTitle && isValidLink(rUrl)) extraLinks.push({label:`${resTypeIcons[rType]||"🔗"} ${rTitle}`, url:rUrl, resType:rType});
  }
  const res = {
    title, type:"course", section:"courses",
    description: (fd.get("description")||"").trim(),
    thumbnail: (fd.get("thumbnail")||"").trim(),
    tags: [...state.adminResTags], isPremium:false,
    lessons, link:"",
    hasCertificate: fd.get("hasCertificate")==="true",
    pdfLink:"", extraLinks, createdAt: Date.now()
  };
  try{
    await addDoc(collection(db,"resources"), res);
    await loadResources();
    await loadUniversities();
    state.adminMsg = "تم إنشاء الكورس بنجاح ✓ هتلاقيه في مركز التعلم";
  }catch(err){
    console.error("submitAddCourse error:", err);
    state.adminMsg = "حصل خطأ أثناء حفظ الكورس، جرب تاني.";
  }
  resetCourseDraft();
  state.adminResTags = new Set();
  state.adminOpen = null;
  render();
  setTimeout(()=>{ state.adminMsg=""; render(); }, 4000);
}
async function submitAdminResource(form){
  if(!isAdmin()){
    state.adminMsg = "إضافة المصادر التعليمية للأدمن بس دلوقتي.";
    state.adminOpen = null; render();
    setTimeout(()=>{ state.adminMsg=""; render(); }, 4000);
    return;
  }
  const fd = new FormData(form);
  const type = fd.get("type"); // video | pdf | article — الكورسات بقى ليها فورم مخصص (submitAddCourse)
  const section = fd.get("section")==="practical" ? "practical" : "tips";
  const link = fd.get("link")||"";
  if(!isValidLink(link)){
    state.adminMsg = "محتاج رابط صحيح للمصدر.";
    render(); setTimeout(()=>{ state.adminMsg=""; render(); }, 4000); return;
  }
  const res = {
    title: fd.get("title"), type, section, link, lessons:[],
    description: fd.get("description")||"", tags: [...state.adminResTags],
    isPremium: fd.get("isPremium")==="true", createdAt: Date.now()
  };
  try{
    await addDoc(collection(db,"resources"), res);
    await loadResources();
    await loadUniversities();
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
    streakCount: 1, longestStreak: 1, lastActiveDate: todayStr(),
    createdAt: state.profile?.createdAt || Date.now()
  };
  try{
    await setDoc(doc(db,"users",state.user.uid), profile, {merge:true});
    state.profile = profile;
    state.profile.oppTracking = {};
    await loadOpportunities();
    await loadResources();
    await loadUniversities();
    await loadPendingOpps();
    await loadQuizzes();
    state.dashboardLastVisit = null;
    if(state.user) localStorage.setItem(`nextstep_lastVisit_${state.user.uid}`, String(Date.now()));
    state.screen = "dashboard";
  }catch(err){
    console.error("submitProfile error:", err);
    state.setupError = "حصل خطأ أثناء حفظ ملفك الشخصي. تأكد من اتصال الإنترنت وجرب تاني.";
  }
  render();
}

// تخطي إكمال الملف الشخصي — بيحفظ أي بيانات كتبها المستخدم فعلًا (لو كان بدأ
// يكتب) مع علامة profileSkipped:true، وبيدخّله المنصة على طول. طالما الملف
// لسه ناقص (مفيش مرحلة/اهتمامات/مهارات)، الفرص المقترحة هتفضل أقل دقة لحد ما
// يكمّل بياناته من تبويب "ملفي" وقت ما يريح.
async function skipProfileSetup(){
  const profile = {
    name: state.setupName.trim() || (state.user && state.user.displayName) || "مستخدم",
    stage: state.setupStage||"", gradeDetail: state.setupGradeDetail||"",
    working: state.setupWorking||"", workplace: (state.setupWorkplace||"").trim(),
    age: state.setupAge?Number(state.setupAge):null, country: (state.setupCountry||"").trim(),
    school: (state.setupSchool||"").trim(), englishLevel: state.setupEnglish||"", goal: state.setupGoal||"",
    interests: [...state.setupInterests], skills: [...state.setupSkills], learnSkills: [...state.setupLearnSkills],
    location: (state.setupLocation||"").trim(), cvLink: (state.setupCvLink||"").trim(),
    achievements: (state.setupAchievements||"").trim(), photoBase64: state.setupPhotoBase64,
    phone: (state.setupPhone||"").trim(), linkedin: (state.setupLinkedin||"").trim(), github: (state.setupGithub||"").trim(),
    contactEmail: (state.setupContactEmail||"").trim(),
    completedResourceIds: state.completedResourceIds||[], completedLessonIds: state.completedLessonIds||[], quizResults: state.quizResults||{},
    streakCount: 1, longestStreak: 1, lastActiveDate: todayStr(),
    profileSkipped: true,
    createdAt: state.profile?.createdAt || Date.now()
  };
  try{
    await setDoc(doc(db,"users",state.user.uid), profile, {merge:true});
    state.profile = profile;
    state.profile.oppTracking = {};
    await loadOpportunities();
    await loadResources();
    await loadUniversities();
    await loadPendingOpps();
    await loadQuizzes();
    state.dashboardLastVisit = null;
    if(state.user) localStorage.setItem(`nextstep_lastVisit_${state.user.uid}`, String(Date.now()));
    state.activeTab = "profile";
    state.screen = "dashboard";
  }catch(err){
    console.error("skipProfileSetup error:", err);
    state.setupError = "حصل خطأ أثناء الدخول للمنصة. تأكد من اتصال الإنترنت وجرب تاني.";
  }
  render();
}

// ============ render ============
const app = document.getElementById("app");

// استايلات مخصوصة لصفحة "إضافة كورس" الجديدة (كروت، صفوف الفيديوهات/المصادر،
// اختيار نوع الكورس) — مش موجودة في الـCSS الخارجي، فبنحقنها مرة واحدة هنا
// عشان تفضل متوافقة مع باقي هوية المنصة (نفس ألوان الحدود والذهبي المستخدمة
// في باقي الموقع).
(function injectCourseFormStyles(){
  const css = `
  .form-card{border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px;background:#fff;}
  .form-card-title{font-weight:800;font-size:14.5px;margin-bottom:12px;color:#0A2C35;}
  .field-row{display:flex;gap:10px;}
  .field-row .field{flex:1;}
  .type-choice-row{display:flex;gap:10px;margin-bottom:4px;}
  .type-choice{flex:1;border:1.5px solid var(--border);border-radius:12px;padding:14px 10px;text-align:center;cursor:pointer;transition:border-color .15s, background .15s;}
  .type-choice.selected{border-color:#C98A1F;background:#FDF6E8;}
  .type-choice input{display:none;}
  .type-choice .tc-icon{font-size:22px;margin-bottom:6px;}
  .type-choice .tc-label{font-weight:700;font-size:13.5px;}
  .lesson-card{border:1.5px dashed var(--border);border-radius:12px;padding:14px;margin-bottom:12px;background:#FAFAF9;position:relative;}
  .lesson-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
  .lesson-card-head .lesson-num{font-weight:800;font-size:13.5px;color:#0A2C35;background:#EFE6D2;border-radius:8px;padding:3px 10px;}
  .remove-row-btn{background:none;border:none;color:#B4232C;font-size:13px;cursor:pointer;padding:4px 8px;}
  .resource-row{display:flex;gap:8px;align-items:flex-start;border:1.5px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;flex-wrap:wrap;}
  .resource-row .field{flex:1;min-width:120px;margin-bottom:0;}
  .add-row-btn{width:100%;padding:12px;border:1.5px dashed #C98A1F;border-radius:12px;background:#FFFBF2;color:#8A5B10;font-weight:700;font-size:13.5px;cursor:pointer;}
  `;
  const styleTag = document.createElement("style");
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
})();

function render(){
  if(state.screen==="verify-cert") return renderVerifyCertScreen();
  if(state.screen==="loading") return renderLoading();
  if(state.screen==="auth") return renderAuth();
  if(state.screen==="profile-setup") return renderProfileSetup();
  if(state.screen==="dashboard") return renderDashboard();
}
// صفحة تحقق عامة من صحة الشهادة — بتشتغل من غير أي تسجيل دخول (أي حد يمسح
// الـQR أو يفتح اللينك يشوفها)، وبتجيب بيانات الشهادة من Firestore بمعرّفها.
async function loadCertVerification(certId){
  try{
    const snap = await getDoc(doc(db,"certificates",certId));
    state.verifyCertData = snap.exists() ? snap.data() : null;
    state.verifyCertStatus = snap.exists() ? "found" : "notfound";
  }catch(err){
    console.error("loadCertVerification error:", err);
    state.verifyCertStatus = "error";
  }
  render();
}
function renderVerifyCertScreen(){
  const st = state.verifyCertStatus;
  const d = state.verifyCertData;
  const siteUrl = `${window.location.origin}${window.location.pathname}`;
  let body = "";
  if(st==="loading"){
    body = `<div class="spinner" style="margin:40px auto;"></div><p style="text-align:center;color:var(--ink-muted);">بنتأكد من الشهادة...</p>`;
  } else if(st==="found" && d){
    body = `
    <div style="text-align:center;margin-bottom:18px;">
      <div style="font-size:44px;">✅</div>
      <h2 style="font-size:19px;font-weight:800;color:#1F7A47;margin-top:8px;">شهادة موثّقة وأصلية</h2>
      <p style="color:var(--ink-muted);font-size:13.5px;">صادرة فعليًا من منصة NextStep AI</p>
    </div>
    <div class="card" style="padding:18px;text-align:right;">
      <div style="margin-bottom:10px;"><span style="color:var(--ink-muted);font-size:13px;">الاسم</span><div style="font-weight:800;font-size:16px;">${escapeHtml(d.recipientName||"")}</div></div>
      <div style="margin-bottom:10px;"><span style="color:var(--ink-muted);font-size:13px;">أتم بنجاح</span><div style="font-weight:700;font-size:14.5px;">${escapeHtml(d.itemLabel||"")} — ${escapeHtml(d.itemTitle||"")}</div></div>
      <div style="margin-bottom:10px;"><span style="color:var(--ink-muted);font-size:13px;">تاريخ الإصدار</span><div style="font-weight:700;font-size:14.5px;">${escapeHtml(d.dateStr||"")}</div></div>
      <div><span style="color:var(--ink-muted);font-size:13px;">رقم الشهادة</span><div style="font-weight:700;font-size:14.5px;letter-spacing:.5px;">${escapeHtml(state.verifyCertId||"")}</div></div>
    </div>`;
  } else if(st==="notfound"){
    body = `<div style="text-align:center;margin-bottom:10px;">
      <div style="font-size:44px;">⚠️</div>
      <h2 style="font-size:19px;font-weight:800;color:#B4232C;margin-top:8px;">مفيش شهادة بالرقم ده</h2>
      <p style="color:var(--ink-muted);font-size:13.5px;">تأكد إن الرقم أو اللينك مكتوب صح، أو إن الشهادة اتصدرت فعلًا من المنصة.</p>
    </div>`;
  } else {
    body = `<div class="error-box">حصل خطأ أثناء التحقق من الشهادة، جرب تفتح اللينك تاني.</div>`;
  }
  app.innerHTML = `
  <div class="center-screen">
    <div class="auth-wrap">
      <div class="brand"><div class="brand-mark">${logoIconSvg()}</div><div class="brand-word">NextStep AI</div></div>
      ${body}
      <a href="${siteUrl}" class="btn btn-gold btn-block" style="margin-top:20px;display:block;text-align:center;text-decoration:none;">الرجوع للمنصة</a>
    </div>
  </div>`;
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
      <div class="auth-sub">هنستخدم البيانات دي عشان نقترحلك الفرص الأنسب ليك (منح، تدريب، وظايف، تطوع..) ونحسب نسبة تطابقها مع مرحلتك ومهاراتك — من غير بيانات، الاقتراحات بتبقى عشوائية ومش دقيقة.</div>
      <div class="note-box" style="margin:10px 0 14px;">مستعجل؟ تقدر تدخل المنصة دلوقتي وتكمّل البيانات دي لاحقًا من تبويب "ملفي" — بس الفرص المقترحة هتبقى أدق كل ما تزوّد بياناتك.</div>
      ${state.setupError?`<div class="error-box">${state.setupError}</div>`:""}

      <div class="field"><label>اسمك</label><input id="setup-name" type="text" value="${state.setupName}" placeholder="اسمك بالكامل"></div>
      <button type="button" class="link-btn" data-action="skip-profile" style="margin:-2px 0 12px;">تخطي دلوقتي، أكمل بعدين ↗</button>

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
      <button type="button" class="btn btn-ghost btn-block" style="margin-top:8px;" data-action="skip-profile">تخطي دلوقتي، أكمل بعدين</button>
    </div>
  </div>`;
}

function renderDashboard(){
  const tab = state.activeTab;
  const NAV_ITEMS = [
    {id:"recommended", icon:"🎯", label:"الفرص المقترحة"},
    {id:"resources", icon:"🎓", label:"مركز التعلم"},
    {id:"chat", icon:"💬", label:"المساعد الذكي"},
    {id:"profile", icon:"👤", label:"ملفي"},
  ];
  if(isAdmin()) NAV_ITEMS.push({id:"admin", icon:"⚙️", label:"الإدارة"});
  app.innerHTML = `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="brand-word" style="display:flex;align-items:center;gap:9px;"><span class="brand-mark" style="width:30px;height:30px;">${logoIconSvg()}</span>NextStep AI</div>
      </div>
      <div class="topbar-right">
        <span class="hi-text">أهلاً، ${escapeHtml(state.profile.name.split(" ")[0]||"")}</span>
        <button class="icon-btn" data-action="toggle-notif-panel" title="الإشعارات" style="position:relative;">🔔${unreadNotifCount()>0?`<span class="notif-badge">${unreadNotifCount()>9?"9+":unreadNotifCount()}</span>`:""}</button>
        <button class="icon-btn" data-action="logout" title="تسجيل خروج">⎋</button>
      </div>
    </div>
    ${state.notifPanelOpen?renderNotifPanel():""}
    <nav class="topnav">
      <div class="topnav-scroll">
        ${NAV_ITEMS.map(it=>`<button class="topnav-item ${tab===it.id?"active":""}" data-action="tab" data-tab="${it.id}"><span class="nav-icon">${it.icon}</span><span class="nav-label">${it.label}</span></button>`).join("")}
      </div>
    </nav>
    <div class="dash-body">
      <div class="main-col">
        ${renderDeadlineAlerts()}
        <div class="content ${tab==="chat"?"content-chat":""}">
          <div class="page-help-row">${renderHelpButton(tab)}</div>
          ${tab==="recommended"?renderOppList():""}
          ${tab==="resources"?renderLearningCenterTab():""}
          ${tab==="chat"?renderChatTab():""}
          ${tab==="profile"?renderProfileTab():""}
          ${tab==="admin"?renderAdminTab():""}
        </div>
      </div>
    </div>
    ${state.helpOpenTab?renderHelpModal():""}
    ${state.openOppId?renderModal():""}
    ${state.activeQuizId?renderQuizModal():""}
    ${state.activeAssessmentId?renderAssessmentModal():""}
    ${state.showUniCompareModal?renderUniCompareModal():""}
    ${state.toastMsg?`<div class="global-toast">${state.toastMsg}</div>`:""}
  `;
  if(tab==="chat") scrollChatToBottom();
}

const HELP_TEXT = {
  recommended:{title:"الفرص المقترحة", body:"كل الفرص (منح، تدريب، وظايف، تطوع، مسابقات..) متفلترة ومرتبة حسب مدى تطابقها مع ملفك الشخصي. استخدم البحث والفلاتر فوق عشان تضيّق النتايج، ودوس على أي فرصة تشوف تفاصيلها وتقدّم."},
  resources:{title:"مركز التعلم", body:"محتوى تعليمي مجاني (كورسات ونصائح)، بالإضافة لقسمي الاختبارات الشخصية وأدلة الجامعات والموارد المجانية — كلهم دلوقتي هنا في مكان واحد. اختار القسم من الأزرار فوق."},
  chat:{title:"المساعد الذكي", body:"تبويبين: 🤖 الاستشارة الذكية (ردود فورية جاهزة من بيانات ملفك والمنصة، مش توليد AI حر)، و👨‍💼 الاستشارة الشخصية (تواصل مباشر مع Sleem Mahmoud على واتساب لمتابعة ودعم عملي مخصص ليك)."},
  profile:{title:"ملفي", body:"مقسّم لـ4 أقسام: بياناتك الشخصية وزرار تحميل الـCV، متابعاتك للفرص اللي قدّمت عليها، الروودماب بتاع كل مهارة عايز تتعلمها، وخطة التطوير (نقاطك، مستواك، ونسبة اكتمال ملفك)."},
  admin:{title:"الإدارة", body:"لوحة التحكم الكاملة: إضافة فرص وكورسات ومصادر واختبارات وقصص نجاح، مراجعة البحث بالذكاء الاصطناعي، ونشر إعلانات عامة لكل المستخدمين."}
};
function renderHelpButton(tab){
  if(!HELP_TEXT[tab]) return "";
  return `<button class="icon-btn help-btn" data-action="show-help" data-tab="${tab}" title="إزاي أستخدم الصفحة دي؟">؟</button>`;
}
function renderHelpModal(){
  const h = HELP_TEXT[state.helpOpenTab];
  if(!h) return "";
  return `
  <div class="modal-overlay" data-action="close-help">
    <div class="modal-sheet" data-action="noop" style="max-width:380px;">
      <div class="modal-close"><button data-action="close-help">✕</button></div>
      <h2 style="font-size:17px;font-weight:800;margin-bottom:10px;">؟ ${escapeHtml(h.title)}</h2>
      <p style="font-size:14px;line-height:1.8;color:var(--ink-muted);">${escapeHtml(h.body)}</p>
      <button class="btn btn-gold btn-block" style="margin-top:16px;" data-action="close-help">فهمت</button>
    </div>
  </div>`;
}
function isOppExpired(o){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(o.deadline||"")) return false;
  const today = new Date(new Date().toISOString().slice(0,10));
  return new Date(o.deadline) < today;
}
// ============ خطة التطوير (جوا تبويب "ملفي") ============
// بديل تبويب "ملفات" اللي كان مستقل — دلوقتي جزء من صفحة "ملفي" نفسها:
// فيه "الجديد من آخر زيارة"، متابعة الفرص، وروودماب لكل مهارة عايز يتعلمها.
const ROADMAP_DB = {
  "Python": ["اتعلم أساسيات Python (متغيرات، شروط، لوبات، دوال) من مصدر مجاني","اتمرن على مسائل بسيطة يوميًا (حل 2-3 تمارين)","اتعلم مكتبات أساسية زي requests و pandas","اعمل 2-3 مشاريع صغيرة (حاسبة، بوت تليجرام، سكريبت أتمتة)","ارفع المشاريع على GitHub وحطها في الـCV"],
  "JavaScript / تطوير الويب": ["اتعلم HTML و CSS الأساسيات","اتعلم JavaScript الأساسي (متغيرات، دوال، DOM)","اتعلم Git/GitHub عشان ترفع شغلك","اتعلم إطار عمل زي React بعد ما تظبط الأساسيات","اعمل موقع أو تطبيق ويب بسيط وانشره online (Netlify/Vercel)"],
  "تطبيقات الموبايل": ["حدد المسار: Flutter (تطبيق واحد لأندرويد و iOS) أو Kotlin/Swift","اتعلم أساسيات لغة البرمجة المختارة","اتعلم تصميم الواجهات (Widgets/Layouts)","اعمل تطبيق بسيط (قائمة مهام، حاسبة) وجربه على جهازك","انشر أول تطبيق ليك على متجر تجريبي أو شاركه كـ APK"],
  "الذكاء الاصطناعي وتعلم الآلة": ["ثبّت أساسيات البرمجة بـPython كويس الأول","اتعلم الرياضيات المطلوبة (إحصاء، جبر خطي أساسي)","اتعلم مكتبات زي pandas و scikit-learn","اعمل مشروع تصنيف بسيط (زي توقع أسعار أو تصنيف صور)","اتعلم أساسيات الشبكات العصبية لو حابب تتعمق أكتر"],
  "قواعد البيانات": ["اتعلم أساسيات SQL (SELECT, JOIN, WHERE)","اتمرن على قاعدة بيانات تجريبية (زي SQLite)","اتعلم تصميم قواعد بيانات (Normalization, العلاقات)","جرّب قاعدة بيانات NoSQL زي MongoDB للمقارنة","اربط قاعدة بيانات بمشروع برمجي بسيط عملته"],
  "الأمن السيبراني": ["افهم أساسيات الشبكات (IP, DNS, Ports)","اتعلم أساسيات أنظمة التشغيل Linux","اتعلم مفاهيم أمن المعلومات الأساسية (CIA Triad)","جرّب منصات تدريب عملي مجانية (TryHackMe مستوى مبتدئ)","استهدف شهادة مبتدئة معترف بيها لما تحس مستعد"],
  "مونتاج فيديو": ["اختار برنامج مونتاج (CapCut للسهولة، Premiere للاحتراف)","اتعلم القص الأساسي والانتقالات والصوت","اتعلم تصحيح الألوان الأساسي (Color Correction)","مونتج 3-4 فيديوهات قصيرة للتمرين ونشرهم","اعمل شو ريل (Showreel) يجمع أفضل شغلك"],
  "تصميم جرافيك": ["اتعلم أساسيات نظرية التصميم (ألوان، تايبوغرافي، توازن)","اتعلم برنامج زي Canva أو فوتوشوب/إليستريتور","صمم بوستات بسيطة (سوشيال ميديا) للتمرين","اعمل بورتفوليو بـ8-10 تصاميم متنوعة","شارك شغلك واطلب فيدباك من مصممين أكبر"],
  "UI/UX": ["افهم الفرق بين UX (تجربة الاستخدام) و UI (الواجهة)","اتعلم أداة زي Figma من الصفر","اتمرن بإعادة تصميم شاشة تطبيق موجود (Redesign)","اتعلم أساسيات الـWireframing و الـUser Flow","اعمل 2-3 مشاريع كاملة وحطهم في بورتفوليو"],
  "سوشيال ميديا": ["افهم الفرق بين المنصات المختلفة وجمهور كل واحدة","اتعلم إزاي تعمل خطة محتوى شهرية بسيطة","اتمرن على تصميم بوستات وكتابة كابشن جذاب","اتعلم تحليل الإحصائيات الأساسية (Insights)","دير صفحة تجريبية أو ساعد مبادرة بشكل تطوعي عشان تطبّق"],
  "إعلانات ممولة (Ads)": ["افهم أساسيات Meta Ads / Google Ads من مصادر رسمية مجانية","اتعلم استهداف الجمهور (Targeting) الصح","جرّب حملة تجريبية بميزانية صغيرة جدًا لو أمكن","اتعلم قراءة النتائج (CTR, CPC, Conversions)","حسّن حملتك بناءً على النتائج (A/B Testing بسيط)"],
  "SEO": ["افهم إزاي محركات البحث بتشتغل بشكل عام","اتعلم البحث عن الكلمات المفتاحية (Keyword Research)","اتعلم أساسيات الـOn-page SEO (العناوين، الوصف، الروابط)","طبّق اللي اتعلمته على مقال أو صفحة حقيقية","تابع الترتيب بأداة مجانية زي Google Search Console"],
  "إنجليزي": ["حدد مستواك الحالي بأداة تقييم مجانية أونلاين","خصص وقت يومي ثابت (حتى لو 20 دقيقة) للمذاكرة","اتعلم قواعد ومفردات جديدة، وطبّقهم في جمل بنفسك","اسمع بودكاست أو شاهد محتوى بالإنجليزي يوميًا","اتمرن على المحادثة مع حد أو من خلال تطبيقات تبادل لغوي"],
};
function renderRoadmapBlock(){
  const p = state.profile;
  const wants = (p.learnSkills && p.learnSkills.length) ? p.learnSkills : (p.interests||[]);
  if(!wants.length) return `<div class="note-box">لسه محددتش مهارات عايز تتعلمها في ملفك الشخصي — كمّلها عشان نطلعلك روودماب مناسب لكل واحدة.</div>`;
  return wants.map(skill=>{
    const steps = ROADMAP_DB[skill] || ["دوّر على مصدر تعليمي موثوق (كورس أو دليل) عن \""+skill+"\" في مركز التعلم","ابدأ بالأساسيات وخصص وقت ثابت أسبوعيًا للمذاكرة","اتمرن عمليًا بمشروع أو تطبيق بسيط لما تحس مستعد","اطلب فيدباك من حد أعرف منك في المجال ده","ضيف اللي اتعلمته في الـCV والبورتفوليو بتاعك"];
    return `
    <div class="card" style="padding:16px 18px;margin-bottom:10px;">
      <div style="font-weight:800;font-size:14.5px;margin-bottom:8px;">🗺️ روودماب: ${escapeHtml(skill)}</div>
      <ol style="margin:0;padding-inline-start:20px;display:flex;flex-direction:column;gap:6px;font-size:13.5px;line-height:1.6;">
        ${steps.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}
      </ol>
    </div>`;
  }).join("");
}
function renderTrackingSection(){
  const p = state.profile;
  const tracking = (p && p.oppTracking) || {};
  const trackCounts = {};
  Object.values(tracking).forEach(t=>{ if(t.status) trackCounts[t.status] = (trackCounts[t.status]||0)+1; });
  let ids = Object.keys(tracking);
  if(state.trackFilter) ids = ids.filter(id=>tracking[id].status===state.trackFilter);
  const items = ids.map(id=>({id, t:tracking[id], o:state.opportunities.find(o=>o.id===id)})).filter(x=>x.o);
  return `
  <div class="cat-chip-row">
    <button type="button" class="pill ${!state.trackFilter?"selected":""}" data-action="track-filter" data-status="">الكل (${Object.keys(tracking).length})</button>
    ${Object.entries(TRACK_STATUSES).map(([k,label])=>`<button type="button" class="pill ${state.trackFilter===k?"selected":""}" data-action="track-filter" data-status="${k}">${label}: ${trackCounts[k]||0}</button>`).join("")}
  </div>
  ${items.length===0?`<div class="empty-state"><h3>لسه مفيش فرص متابَعة</h3><p>افتح أي فرصة من "الفرص المقترحة" وحدد حالتها (محفوظة، سأقدم...) عشان تتابعها من هنا.</p></div>`:
  items.map(({id,t,o})=>`
  <div class="card opp-card" data-action="open-detail" data-id="${id}">
    <span class="opp-cat">${CATEGORIES[o.category]||o.category}</span>
    <span class="pill" style="margin-right:6px;">${TRACK_STATUSES[t.status]||t.status}</span>
    <div class="opp-title" style="margin-top:6px;">${escapeHtml(o.title)}</div>
    <div class="opp-org">${escapeHtml(o.organization||"")}</div>
    ${t.note?`<div class="desc-text" style="margin-top:6px;">📝 ${escapeHtml(t.note)}</div>`:""}
  </div>`).join("")}
  `;
}
function renderPlanSection(){
  const p = state.profile;
  const pct = profileCompleteness(p);
  const xp = computeXP(p);
  const level = computeLevel(xp);
  const xpIntoLevel = xp % 50;
  const achievements = computeAchievements(p);
  const live = state.opportunities.filter(o=>!isOppExpired(o));
  const lv = state.dashboardLastVisit;
  const newOnes = lv ? live.filter(o=>o.createdAt && o.createdAt>lv) : [];
  const newCourses = lv ? state.resources.filter(r=>r.createdAt && r.createdAt>lv) : [];
  const catCounts = {};
  newOnes.forEach(o=>{ catCounts[o.category] = (catCounts[o.category]||0)+1; });
  const lastRun = state.autoSearchMeta && state.autoSearchMeta.lastRunAt;
  return `
  <div class="card" style="padding:18px 20px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-weight:800;font-size:15px;">المستوى ${level}</span>
      <span class="lat" style="font-size:12.5px;color:var(--ink-muted);">${xp} XP</span>
    </div>
    <div class="setup-progress" style="margin-bottom:14px;"><span style="width:${(xpIntoLevel/50)*100}%"></span></div>
    ${(p.streakCount||0)>0?`<div style="margin-bottom:12px;font-size:13px;color:var(--ink-muted);">🔥 متتالية دخول: ${p.streakCount} يوم${p.longestStreak>p.streakCount?` (أطول متتالية: ${p.longestStreak} يوم)`:""}</div>`:""}
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${achievements.map(a=>`<span class="pill ${a.unlocked?"selected":""}" style="${a.unlocked?"":"opacity:.45;"}">${a.unlocked?"🏆":"🔒"} ${a.label}</span>`).join("")}
    </div>
  </div>
  <div class="card" style="padding:18px 20px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--ink-muted);margin-bottom:6px;"><span>اكتمال الملف الشخصي</span><span class="lat">${pct}%</span></div>
    <div class="setup-progress" style="margin-bottom:0;"><span style="width:${pct}%"></span></div>
  </div>
  <div class="card" style="padding:18px 20px;">
    ${lv ? `
    <div class="note-box" style="background:#EAF6EF;color:#1F7A47;margin-bottom:${lastRun?"6px":"0"};">
      <b>ما الجديد منذ آخر زيارة:</b> ${newOnes.length} فرصة جديدة${newCourses.length?`، ${newCourses.length} مصدر تعلّمي جديد`:""}.
      ${Object.keys(catCounts).length?`<div style="margin-top:6px;">${Object.entries(catCounts).map(([k,n])=>`<span class="pill" style="margin-left:4px;">${CATEGORIES[k]||k}: ${n}</span>`).join("")}</div>`:""}
    </div>` : `<div class="note-box" style="margin-bottom:${lastRun?"6px":"0"};">من الزيارة الجاية هنعرضلك هنا كل حاجة جديدة اتضافت من آخر مرة دخلت المنصة.</div>`}
    ${lastRun?`<div style="font-size:12.5px;color:var(--ink-muted);">آخر بحث تلقائي بالـAI: ${new Date(lastRun).toLocaleString("ar-EG")}</div>`:""}
  </div>
  `;
}
function renderLinkCard(item){
  return `
  <div class="card" style="padding:14px;margin-bottom:10px;">
    <div class="opp-title" style="font-size:14.5px;">${escapeHtml(item.name)}</div>
    <div class="desc-text" style="margin:4px 0 8px;">${escapeHtml(item.info)}</div>
    <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="link-btn">فتح الموقع ↗</a>
  </div>`;
}
const UNI_TYPE_LABEL = {gov:"حكومية", national:"أهلية", private:"خاصة", tech:"تكنولوجية", intl:"دولية معتمدة"};
function renderUniversitiesGuide(){
  if(state.openUniId){
    const uni = state.universities.find(u=>u.id===state.openUniId);
    if(!uni) { state.openUniId=null; }
    else return renderUniversityDetail(uni);
  }
  const q = normalizeAr(state.uniSearchQuery||"");
  let list = state.universities.slice();
  if(q){
    list = list.filter(u=>{
      const hay = normalizeAr([u.name, ...(u.colleges||[]).flatMap(c=>[c.name, c.majors])].filter(Boolean).join(" "));
      return hay.includes(q);
    });
  }
  if(state.uniFilterType) list = list.filter(u=>u.type===state.uniFilterType);
  if(state.uniFilterCity) list = list.filter(u=>(u.city||"")===state.uniFilterCity);
  const cities = [...new Set(state.universities.map(u=>u.city).filter(Boolean))];

  return `
  <div class="note-box" style="margin-bottom:12px;">
    🎓 دليل الجامعات والكليات المصرية — بحث وفلاتر عادية (مش ذكاء اصطناعي)، البيانات بتتضاف وتُراجع من الإدارة.
    ${state.compareUniIds.length>0?`<div style="margin-top:8px;"><button type="button" class="pill selected" data-action="open-uni-compare">⚖️ قارن (${state.compareUniIds.length}) الآن</button> <button type="button" class="link-btn" data-action="clear-uni-compare">إلغاء التحديد</button></div>`:""}
  </div>
  <form id="uni-search-form" style="display:flex;gap:8px;margin-bottom:10px;">
    <input id="uni-search-input" type="text" value="${escapeHtml(state.uniSearchQuery)}" placeholder="دور باسم الجامعة أو الكلية أو التخصص..." style="flex:1;padding:11px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;">
    <button type="submit" class="btn btn-ghost" style="padding:11px 18px;">بحث</button>
  </form>
  <div class="cat-chip-row">
    <button type="button" class="pill ${!state.uniFilterType?"selected":""}" data-action="uni-filter-type" data-type="">كل الأنواع</button>
    ${Object.entries(UNI_TYPE_LABEL).map(([k,v])=>`<button type="button" class="pill ${state.uniFilterType===k?"selected":""}" data-action="uni-filter-type" data-type="${k}">${v}</button>`).join("")}
  </div>
  ${cities.length?`<div class="cat-chip-row">
    <button type="button" class="pill ${!state.uniFilterCity?"selected":""}" data-action="uni-filter-city" data-city="">كل المحافظات</button>
    ${cities.map(c=>`<button type="button" class="pill ${state.uniFilterCity===c?"selected":""}" data-action="uni-filter-city" data-city="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}
  </div>`:""}
  ${isAdmin()?`<button type="button" class="btn btn-ghost btn-block" style="margin-bottom:12px;" data-action="admin-new-uni">+ أضف جامعة (إدارة)</button>`:""}
  ${list.length===0?`<div class="empty-state"><h3>لسه مفيش جامعات مضافة${q||state.uniFilterType||state.uniFilterCity?" بالفلتر ده":""}</h3><p>${isAdmin()?"دوس \"أضف جامعة\" فوق عشان تبدأ تبني الدليل.":"الدليل لسه بيتبنى — تابعنا هيتزوّد قريب."}</p></div>`:
  list.map(u=>`
  <div class="card opp-card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <div style="flex:1;cursor:pointer;" data-action="open-uni" data-id="${u.id}">
        <span class="opp-cat">${UNI_TYPE_LABEL[u.type]||u.type||""}</span>
        <div class="opp-title" style="margin-top:6px;">${escapeHtml(u.name)}</div>
        <div class="opp-org">${escapeHtml(u.city||"")} ${u.colleges&&u.colleges.length?`· ${u.colleges.length} كلية`:""}</div>
      </div>
      <label style="display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--ink-muted);white-space:nowrap;">
        <input type="checkbox" data-action="toggle-compare-uni" data-id="${u.id}" ${state.compareUniIds.includes(u.id)?"checked":""}> قارن
      </label>
    </div>
    ${u.briefInfo?`<div class="desc-text" style="margin-top:6px;">${escapeHtml(u.briefInfo)}</div>`:""}
  </div>`).join("")}

  ${isAdmin()&&state.adminUniDraft?renderAdminUniForm():""}

  <div class="section-label" style="margin-top:22px;">روابط جامعات عالمية إضافية</div>
  ${UNIVERSITIES_GUIDE.map(group=>`
    <div class="section-label" style="font-size:12px;">${group.region}</div>
    ${group.items.map(renderLinkCard).join("")}
  `).join("")}
  `;
}
function renderUniversityDetail(uni){
  return `
  <button type="button" class="link-btn" data-action="close-uni" style="margin-bottom:10px;">→ رجوع لدليل الجامعات</button>
  <div class="card" style="padding:20px;margin-bottom:14px;">
    <span class="opp-cat">${UNI_TYPE_LABEL[uni.type]||uni.type||""}</span>
    <h2 style="font-size:19px;font-weight:800;margin:8px 0 4px;">${escapeHtml(uni.name)}</h2>
    <div style="color:var(--ink-muted);font-size:13px;margin-bottom:10px;">${escapeHtml(uni.city||"")}</div>
    ${uni.briefInfo?`<p style="font-size:13.5px;line-height:1.8;margin-bottom:10px;">${escapeHtml(uni.briefInfo)}</p>`:""}
    ${uni.admissionNotes?`<div class="note-box" style="margin-bottom:10px;"><b>شروط القبول:</b> ${escapeHtml(uni.admissionNotes)}</div>`:""}
    ${uni.tuitionNotes?`<div style="font-size:13px;margin-bottom:6px;"><b>المصروفات:</b> ${escapeHtml(uni.tuitionNotes)}</div>`:""}
    ${uni.features?`<div style="font-size:13px;margin-bottom:6px;"><b>أهم المميزات:</b> ${escapeHtml(uni.features)}</div>`:""}
    ${uni.website?`<a href="${escapeHtml(uni.website)}" target="_blank" rel="noopener" class="link-btn">الموقع الرسمي ↗</a>`:""}
    ${uni.updatedAt?`<div style="font-size:11px;color:var(--ink-muted);margin-top:8px;">آخر تحديث: ${new Date(uni.updatedAt).toLocaleDateString("ar-EG")}</div>`:""}
    ${isAdmin()?`<div style="display:flex;gap:8px;margin-top:12px;"><button class="pill" data-action="admin-edit-uni" data-id="${uni.id}">✏️ تعديل</button><button class="pill" data-action="admin-add-college" data-id="${uni.id}">+ ضيف كلية</button><button class="pill" data-action="admin-delete-uni" data-id="${uni.id}" style="color:#B4232C;">🗑️ حذف</button></div>`:""}
  </div>
  <div class="section-label">الكليات (${(uni.colleges||[]).length})</div>
  ${isAdmin() && state.adminCollegeDraft && state.adminCollegeDraft.uniId===uni.id ? renderAdminCollegeForm() : ""}
  ${(uni.colleges||[]).length===0?`<div class="note-box">لسه مفيش كليات مضافة للجامعة دي.</div>`:
  (uni.colleges||[]).map((c,i)=>`
  <div class="card" style="padding:16px 18px;margin-bottom:10px;">
    <div style="font-weight:800;font-size:14.5px;margin-bottom:6px;">${escapeHtml(c.name)}</div>
    ${c.info?`<div style="font-size:13px;color:var(--ink-muted);line-height:1.6;margin-bottom:8px;">${escapeHtml(c.info)}</div>`:""}
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
      ${c.studyYears?`<span class="pill">📅 ${escapeHtml(c.studyYears)}</span>`:""}
      ${c.requiresMath?`<span class="pill">📐 محتاجة رياضيات</span>`:""}
      ${c.requiresBio?`<span class="pill">🧬 محتاجة أحياء</span>`:""}
    </div>
    ${c.majors?`<div style="font-size:13px;margin-bottom:4px;"><b>الأقسام والتخصصات:</b> ${escapeHtml(c.majors)}</div>`:""}
    ${c.careerPaths?`<div style="font-size:13px;margin-bottom:4px;"><b>فرص العمل بعد التخرج:</b> ${escapeHtml(c.careerPaths)}</div>`:""}
    ${c.salaryNote?`<div style="font-size:13px;margin-bottom:4px;"><b>متوسط الرواتب (تقريبي):</b> ${escapeHtml(c.salaryNote)}</div>`:""}
    ${c.skillsNeeded?`<div style="font-size:13px;margin-bottom:4px;"><b>المهارات المطلوبة:</b> ${escapeHtml(c.skillsNeeded)}</div>`:""}
    ${c.bestUniversities?`<div style="font-size:13px;margin-bottom:4px;"><b>أفضل الجامعات اللي بتقدمها:</b> ${escapeHtml(c.bestUniversities)}</div>`:""}
    ${c.faq?`<div style="font-size:13px;margin-top:6px;"><b>أسئلة شائعة:</b> ${escapeHtml(c.faq)}</div>`:""}
    ${isAdmin()?`<div style="display:flex;gap:8px;margin-top:10px;"><button class="pill" data-action="admin-edit-college" data-id="${uni.id}" data-idx="${i}">✏️ تعديل الكلية</button><button class="pill" data-action="admin-delete-college" data-id="${uni.id}" data-idx="${i}" style="color:#B4232C;">🗑️ حذف</button></div>`:""}
  </div>`).join("")}
  `;
}
function renderUniCompareModal(){
  const unis = state.compareUniIds.map(id=>state.universities.find(u=>u.id===id)).filter(Boolean);
  if(unis.length<1) return "";
  const rows = [
    ["النوع", u=>UNI_TYPE_LABEL[u.type]||u.type||"—"],
    ["المحافظة", u=>u.city||"—"],
    ["عدد الكليات", u=>String((u.colleges||[]).length)],
    ["المصروفات", u=>u.tuitionNotes||"—"],
    ["أهم المميزات", u=>u.features||"—"],
    ["شروط القبول", u=>u.admissionNotes||"—"],
  ];
  return `
  <div class="modal-overlay" data-action="close-uni-compare">
    <div class="modal-sheet" data-action="noop" style="max-width:700px;">
      <div class="modal-close"><button data-action="close-uni-compare">✕</button></div>
      <h2 style="font-size:17px;font-weight:800;margin-bottom:14px;">⚖️ مقارنة الجامعات</h2>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
          <tr><td style="padding:8px;font-weight:700;"></td>${unis.map(u=>`<td style="padding:8px;font-weight:800;border-bottom:2px solid var(--border);">${escapeHtml(u.name)}</td>`).join("")}</tr>
          ${rows.map(([label,fn])=>`<tr><td style="padding:8px;font-weight:700;color:var(--ink-muted);white-space:nowrap;">${label}</td>${unis.map(u=>`<td style="padding:8px;border-bottom:1px solid var(--border);">${escapeHtml(fn(u))}</td>`).join("")}</tr>`).join("")}
        </table>
      </div>
    </div>
  </div>`;
}
function renderAdminUniForm(){
  const d = state.adminUniDraft || {};
  return `
  <div class="card" style="padding:18px;margin:14px 0;">
    <div style="font-weight:800;margin-bottom:10px;">${d.id?"تعديل جامعة":"جامعة جديدة"}</div>
    <div class="field"><label>اسم الجامعة</label><input id="uni-d-name" type="text" value="${escapeHtml(d.name||"")}"></div>
    <div class="field"><label>النوع</label>
      <select id="uni-d-type">
        <option value="">اختار...</option>
        ${Object.entries(UNI_TYPE_LABEL).map(([k,v])=>`<option value="${k}" ${d.type===k?"selected":""}>${v}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>المحافظة</label><input id="uni-d-city" type="text" value="${escapeHtml(d.city||"")}"></div>
    <div class="field"><label>نبذة مختصرة</label><textarea id="uni-d-brief" rows="3">${escapeHtml(d.briefInfo||"")}</textarea></div>
    <div class="field"><label>شروط القبول</label><textarea id="uni-d-admission" rows="2">${escapeHtml(d.admissionNotes||"")}</textarea></div>
    <div class="field"><label>المصروفات (إن وجدت)</label><input id="uni-d-tuition" type="text" value="${escapeHtml(d.tuitionNotes||"")}"></div>
    <div class="field"><label>أهم المميزات</label><textarea id="uni-d-features" rows="2">${escapeHtml(d.features||"")}</textarea></div>
    <div class="field"><label>الموقع الرسمي</label><input id="uni-d-website" type="text" value="${escapeHtml(d.website||"")}"></div>
    <div class="note-box" style="margin-bottom:8px;font-size:12px;">🔍 الزرار ده بيستخدم نفس الـAI Search بتاع الفرص (بحث جوجل حي) عشان يجيب مسودة بيانات — راجعها وعدّلها قبل الحفظ، مش بديل عن التأكد بنفسك.</div>
    <button type="button" class="btn btn-ghost btn-block" data-action="uni-ai-fill" style="margin-bottom:8px;" ${state.uniAiBusy?"disabled":""}>${state.uniAiBusy?"⏳ بيدوّر...":"🔍 جيب بيانات تقريبية بالـAI (اكتب الاسم الأول)"}</button>
    <div style="display:flex;gap:8px;">
      <button type="button" class="btn btn-gold" style="flex:1;" data-action="save-uni-draft">حفظ</button>
      <button type="button" class="btn btn-ghost" style="flex:1;" data-action="cancel-uni-draft">إلغاء</button>
    </div>
  </div>`;
}
function renderAdminCollegeForm(){
  const d = state.adminCollegeDraft || {};
  return `
  <div class="card" style="padding:18px;margin-bottom:14px;">
    <div style="font-weight:800;margin-bottom:10px;">${d.idx!=null?"تعديل كلية":"كلية جديدة"}</div>
    <div class="field"><label>اسم الكلية</label><input id="col-d-name" type="text" value="${escapeHtml(d.name||"")}"></div>
    <div class="field"><label>نبذة / ماذا يدرس الطالب؟</label><textarea id="col-d-info" rows="3">${escapeHtml(d.info||"")}</textarea></div>
    <div class="field"><label>سنوات الدراسة</label><input id="col-d-years" type="text" value="${escapeHtml(d.studyYears||"")}" placeholder="مثال: 4 سنوات"></div>
    <div style="display:flex;gap:14px;margin-bottom:10px;">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;"><input id="col-d-math" type="checkbox" ${d.requiresMath?"checked":""}> محتاجة رياضيات</label>
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;"><input id="col-d-bio" type="checkbox" ${d.requiresBio?"checked":""}> محتاجة أحياء</label>
    </div>
    <div class="field"><label>الأقسام والتخصصات</label><textarea id="col-d-majors" rows="2">${escapeHtml(d.majors||"")}</textarea></div>
    <div class="field"><label>فرص العمل بعد التخرج</label><textarea id="col-d-career" rows="2">${escapeHtml(d.careerPaths||"")}</textarea></div>
    <div class="field"><label>متوسط الرواتب (تقريبي)</label><input id="col-d-salary" type="text" value="${escapeHtml(d.salaryNote||"")}"></div>
    <div class="field"><label>المهارات المطلوبة</label><textarea id="col-d-skills" rows="2">${escapeHtml(d.skillsNeeded||"")}</textarea></div>
    <div class="field"><label>أفضل الجامعات اللي بتقدّمها</label><input id="col-d-best" type="text" value="${escapeHtml(d.bestUniversities||"")}"></div>
    <div class="field"><label>أسئلة شائعة</label><textarea id="col-d-faq" rows="2">${escapeHtml(d.faq||"")}</textarea></div>
    <div style="display:flex;gap:8px;">
      <button type="button" class="btn btn-gold" style="flex:1;" data-action="save-college-draft">حفظ</button>
      <button type="button" class="btn btn-ghost" style="flex:1;" data-action="cancel-college-draft">إلغاء</button>
    </div>
  </div>`;
}
// بيستخدم نفس الـAI proxy وآلية البحث بالضبط اللي بتستخدمها الفرص — الـAI الوحيد
// في المنصة، وده بس بيجيب مسودة يراجعها الأدمن، مش بيتنشر تلقائي.
async function fetchUniversityDataByAI(){
  const name = (document.getElementById("uni-d-name")||{}).value || (state.adminUniDraft && state.adminUniDraft.name) || "";
  if(!name.trim()){
    state.toastMsg = "اكتب اسم الجامعة الأول";
    render(); setTimeout(()=>{state.toastMsg=null; render();}, 2200);
    return;
  }
  state.adminUniDraft = {...(state.adminUniDraft||{}), name: name.trim()};
  state.uniAiBusy = true; render();
  const prompt = `ابحث فعليًا (بحث جوجل حي) عن معلومات حقيقية ومحدثة عن جامعة "${name.trim()}" في مصر. رجّع بس JSON من غير أي نص قبله أو بعده بالشكل ده بالظبط:
{"type":"اختار قيمة واحدة من: gov أو national أو private أو tech أو intl","city":"المحافظة","briefInfo":"نبذة من 2-3 أسطر بالعربي","admissionNotes":"شروط القبول باختصار","tuitionNotes":"المصروفات التقريبية لو معروفة، أو نص فاضي","features":"أهم المميزات","website":"الموقع الرسمي الحقيقي"}
لو مش متأكد من معلومة معينة أو مش لاقيها في نتائج البحث، سيبها نص فاضي "" بدل ما تختلقها أو تخمّنها.`;
  const result = await callAiProxy("", {contents:[{role:"user",parts:[{text:prompt}]}], tools:[{google_search:{}}]}, {timeoutMs:45000});
  state.uniAiBusy = false;
  if(!result.ok){
    state.toastMsg = "تعذر جلب البيانات: " + (result.message||"حاول تاني");
    render(); setTimeout(()=>{state.toastMsg=null; render();}, 3000);
    return;
  }
  try{
    const cand = result.data.candidates && result.data.candidates[0];
    const text = ((cand && cand.content && cand.content.parts)||[]).map(p=>p.text||"").join("");
    const m = text.match(/\{[\s\S]*\}/);
    if(m){
      const parsed = JSON.parse(m[0]);
      state.adminUniDraft = {...state.adminUniDraft, ...parsed};
    } else {
      state.toastMsg = "مالقيتش رد منظم من الـAI، جرب تاني أو دخّل البيانات يدويًا.";
      setTimeout(()=>{state.toastMsg=null; render();}, 3000);
    }
  }catch(err){
    console.error("fetchUniversityDataByAI parse error:", err);
    state.toastMsg = "حصل خطأ في قراءة رد الـAI.";
    setTimeout(()=>{state.toastMsg=null; render();}, 3000);
  }
  render();
}
function renderGuidesTab(){
  const sub = ["universities","courses","resources"].includes(state.guidesSubTab) ? state.guidesSubTab : "universities";
  const subTabs = `
    <div class="tabs" style="margin-bottom:14px;">
      <button class="tab ${sub==="universities"?"active":""}" data-action="guides-subtab" data-subtab="universities">🎓 دليل الجامعات</button>
      <button class="tab ${sub==="courses"?"active":""}" data-action="guides-subtab" data-subtab="courses">💻 منصات الكورسات</button>
      <button class="tab ${sub==="resources"?"active":""}" data-action="guides-subtab" data-subtab="resources">🧰 موارد مجانية</button>
    </div>`;
  let body = "";
  if(sub==="universities"){
    body = renderUniversitiesGuide();
  } else if(sub==="courses"){
    body = `<div class="note-box" style="margin-bottom:12px;">منصات تعليم مجانية أو شبه مجانية، موثوقة وعالمية — اختار حسب مجالك.</div>` + COURSE_PLATFORMS_GUIDE.map(renderLinkCard).join("");
  } else {
    body = `<div class="note-box" style="margin-bottom:12px;">أدوات وقوالب مجانية تساعدك في CV، Cover Letter، وبناء بورتفوليو.</div>` + FREE_RESOURCES_GUIDE.map(renderLinkCard).join("");
  }
  return subTabs + body;
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
  // ترتيب: الفرص المميزة (إعلان/راعي) بتتثبّت فوق الكل الأول بغض النظر عن نسبة
  // التطابق، وبعدين ترتيب أساسي حسب نسبة التطابق من الأعلى للأقل، وبس لو اتنين
  // بنفس النسبة بالظبط، اللي مصنّفة لمرحلة المستخدم بالظبط بتتحط الأول بينهم.
  withScores.sort((a,b)=>{
    const aFeat = a.o.featured ? 1 : 0, bFeat = b.o.featured ? 1 : 0;
    if(bFeat!==aFeat) return bFeat-aFeat;
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
        ${o.featured?`<span class="badge-verified" style="background:#FDF3E2;color:#8A5B10;">⭐ فرصة مميزة</span>`:""}
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
  const section = ["info","tracking","roadmap","plan"].includes(state.profileSection) ? state.profileSection : "info";
  const sectionTabs = `
    <div class="tabs" style="margin-bottom:14px;">
      <button class="tab ${section==="info"?"active":""}" data-action="profile-section" data-section="info">👤 الملف الشخصي</button>
      <button class="tab ${section==="tracking"?"active":""}" data-action="profile-section" data-section="tracking">📌 متابعاتي</button>
      <button class="tab ${section==="roadmap"?"active":""}" data-action="profile-section" data-section="roadmap">🗺️ الـRoadmap</button>
      <button class="tab ${section==="plan"?"active":""}" data-action="profile-section" data-section="plan">📈 خطة التطوير</button>
    </div>`;
  if(section==="tracking") return sectionTabs + renderTrackingSection();
  if(section==="roadmap") return sectionTabs + renderRoadmapBlock();
  if(section==="plan") return sectionTabs + renderPlanSection();
  return sectionTabs + `
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
      <button type="button" class="pill ${state.adminOpen==="course"?"selected":""}" data-action="admin-toggle" data-form="course">🎓 + كورس جديد</button>
      <button type="button" class="pill ${state.adminOpen==="res"?"selected":""}" data-action="admin-toggle" data-form="res">+ مصدر تعلّمي</button>
      <button type="button" class="pill ${state.adminOpen==="ai"?"selected":""}" data-action="admin-toggle" data-form="ai">🔍 البحث بالـAI ${state.pendingOpps.length?`(${state.pendingOpps.length})`:""}</button>
      <button type="button" class="pill ${state.adminOpen==="quiz"?"selected":""}" data-action="admin-toggle" data-form="quiz">+ اختبار</button>
      <button type="button" class="pill ${state.adminOpen==="announce"?"selected":""}" data-action="admin-toggle" data-form="announce">📢 إعلان عام</button>
      <button type="button" class="pill ${state.adminOpen==="stories"?"selected":""}" data-action="admin-toggle" data-form="stories">🌟 قصص نجاح</button>
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
    ${state.adminOpen==="course"?renderAddCourseForm():""}
    ${state.adminOpen==="res"?renderAdminResourceForm():""}
    ${state.adminOpen==="ai"?renderAiSearchPanel():""}
    ${state.adminOpen==="quiz"?renderAdminQuizForm():""}
    ${state.adminOpen==="announce"?renderAdminAnnouncementForm():""}
    ${state.adminOpen==="stories"?renderAdminStoriesPanel():""}
  </div>
  `;
}
// قصص النجاح بقت متاحة للإدارة بس من هنا — التبويب العام "قصص النجاح" اتشال
// من واجهة المستخدم بالكامل بناءً على طلب صريح، لكن نفس المحتوى (success_stories
// في Firestore) لسه موجود ومتاح للإدارة تضيف/تعدّل/تحذف منه هنا لو محتاجينه
// تاني في أي مكان تاني بالمنصة مستقبلًا.
function renderAdminStoriesPanel(){
  return `
  <div style="margin-top:12px;">
    ${renderAdminStoryForm()}
    ${state.successStories.length===0?`<div class="note-box">لسه مفيش قصص نجاح مضافة.</div>`:
      state.successStories.map(s=>`
        <div class="card" style="padding:16px;margin-bottom:10px;">
          ${s.featured?`<div style="color:var(--gold,#B8860B);font-size:12px;font-weight:700;margin-bottom:4px;">⭐ مميزة</div>`:""}
          <div style="font-weight:800;font-size:15.5px;">${escapeHtml(s.title)}</div>
          <div style="color:var(--ink-muted);font-size:12px;margin:4px 0 8px;">${STORY_CATEGORY_LABEL[s.category]||""}${s.country?" · "+escapeHtml(s.country):""}</div>
          <div style="font-size:13.5px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(s.content)}</div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="pill" data-action="edit-story" data-id="${s.id}">✏️ تعديل</button>
            <button class="pill" data-action="toggle-story-featured" data-id="${s.id}">${s.featured?"إلغاء التمييز":"تمييز"}</button>
            <button class="pill" data-action="delete-story" data-id="${s.id}" style="color:#B4232C;">🗑️ حذف</button>
          </div>
        </div>`).join("")}
  </div>`;
}
function renderAdminAnnouncementForm(){
  return `
  <div class="card" style="padding:16px;margin-top:12px;">
    <div style="font-weight:800;margin-bottom:8px;">إعلان عام لكل المستخدمين</div>
    <div class="auth-sub" style="margin-bottom:10px;">بيظهر لكل المستخدمين في جرس الإشعارات — استخدمه لحاجات زي "كورس جديد" أو "ميزة جديدة"، من غير ما يتكلّف كتابة نسخة لكل مستخدم.</div>
    <input type="text" id="announce-title" placeholder="عنوان الإعلان" style="margin-bottom:8px;" />
    <textarea id="announce-body" placeholder="نص الإعلان" rows="3" style="margin-bottom:8px;"></textarea>
    <button class="btn btn-gold btn-block" data-action="post-announcement">نشر الإعلان</button>
    ${state.announcements.length?`
      <div style="margin-top:14px;font-weight:700;font-size:13px;">إعلانات سابقة:</div>
      ${state.announcements.map(a=>`
        <div class="card" style="padding:10px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
          <div><div style="font-weight:700;font-size:13px;">${escapeHtml(a.title)}</div><div style="color:var(--ink-muted);font-size:11.5px;">${timeAgoAr(a.createdAt)}</div></div>
          <button class="pill" data-action="delete-announcement" data-id="${a.id}" style="color:#B4232C;">حذف</button>
        </div>`).join("")}`:""}
  </div>`;
}
async function postAnnouncement(){
  if(!isAdmin()) return;
  const title = (document.getElementById("announce-title")||{}).value||"";
  const body = (document.getElementById("announce-body")||{}).value||"";
  if(!title.trim()) return;
  try{
    await addDoc(collection(db,"announcements"), {title:title.trim(), body:body.trim(), createdAt:Date.now()});
    await loadAnnouncements();
    state.toastMsg = "تم نشر الإعلان ✓"; render();
    setTimeout(()=>{state.toastMsg="";render();},3000);
  }catch(err){
    console.error("postAnnouncement error:", err);
    state.toastMsg = "حصل خطأ أثناء نشر الإعلان."; render();
    setTimeout(()=>{state.toastMsg="";render();},4000);
  }
}
async function deleteAnnouncement(id){
  if(!isAdmin()) return;
  try{ await deleteDoc(doc(db,"announcements",id)); await loadAnnouncements(); render(); }
  catch(err){ console.error("deleteAnnouncement error:", err); }
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
function renderAddCourseForm(){
  const d = state.courseDraft;
  return `
  <form id="admin-course-form">
    <div class="form-card">
      <div class="form-card-title">📘 بيانات الكورس الأساسية</div>
      <div class="field"><label>عنوان الكورس</label><input name="title" type="text" required value="${escapeHtml(d.title)}" placeholder="مثال: أساسيات التصميم الجرافيكي"></div>
      <div class="field"><label>وصف الكورس</label><textarea name="description" rows="3" placeholder="عن إيه الكورس ده وهيستفيد الطالب بإيه">${escapeHtml(d.description)}</textarea></div>
      <div class="field"><label>صورة غلاف (رابط اختياري)</label><input name="thumbnail" type="url" value="${escapeHtml(d.thumbnail)}" placeholder="https://..."></div>
    </div>

    <div class="form-card">
      <div class="form-card-title">🎬 نوع الكورس</div>
      <div class="type-choice-row">
        <div class="type-choice ${d.courseType==='single'?'selected':''}" data-action="course-type-select" data-value="single">
          <div class="tc-icon">🎥</div>
          <div class="tc-label">فيديو واحد</div>
        </div>
        <div class="type-choice ${d.courseType==='multi'?'selected':''}" data-action="course-type-select" data-value="multi">
          <div class="tc-icon">🎞️</div>
          <div class="tc-label">كورس بعدة فيديوهات</div>
        </div>
      </div>
    </div>

    <div class="form-card">
      <div class="form-card-title">📹 ${d.courseType==='single'?"الفيديو":"الفيديوهات"}</div>
      ${d.lessons.map((l,i)=>`
      <div class="lesson-card">
        <div class="lesson-card-head">
          <span class="lesson-num">فيديو ${i+1}</span>
          ${(d.courseType==='multi' && d.lessons.length>1) ? `<button type="button" class="remove-row-btn" data-action="remove-course-lesson" data-idx="${i}">✕ حذف الفيديو ده</button>` : ""}
        </div>
        <div class="field"><label>عنوان الفيديو</label><input name="lesson_title_${i}" type="text" value="${escapeHtml(l.title)}" required></div>
        <div class="field"><label>رابط اليوتيوب</label><input name="lesson_link_${i}" type="url" value="${escapeHtml(l.link)}" required placeholder="https://youtu.be/..."></div>
        <div class="field-row">
          <div class="field"><label>ملف PDF للفيديو ده (اختياري)</label><input name="lesson_pdf_${i}" type="url" value="${escapeHtml(l.pdfLink)}" placeholder="https://..."></div>
          <div class="field"><label>روابط إضافية (اختياري)</label><input name="lesson_extra_${i}" type="text" value="${escapeHtml(l.extraLinksRaw)}" placeholder="اسم=رابط؛اسم٢=رابط٢"></div>
        </div>
      </div>`).join("")}
      ${d.courseType==='multi' ? `<button type="button" class="add-row-btn" data-action="add-course-lesson">+ إضافة فيديو تاني</button>` : ""}
    </div>

    <div class="form-card">
      <div class="form-card-title">📎 مصادر إضافية للكورس (اختياري)</div>
      <div class="note-box" style="margin-bottom:10px;">ملف PDF، لينك Google Drive، GitHub، موقع رسمي، أو أي لينك تاني يخص الكورس كله.</div>
      ${d.resources.map((r,i)=>`
      <div class="resource-row">
        <div class="field"><label>العنوان</label><input name="res_title_${i}" type="text" value="${escapeHtml(r.title)}" placeholder="اسم المصدر"></div>
        <div class="field"><label>النوع</label><select name="res_type_${i}">
          <option value="pdf" ${r.type==='pdf'?'selected':''}>📄 PDF</option>
          <option value="drive" ${r.type==='drive'?'selected':''}>🗂️ Google Drive</option>
          <option value="github" ${r.type==='github'?'selected':''}>💻 GitHub</option>
          <option value="website" ${r.type==='website'?'selected':''}>🌐 موقع رسمي</option>
          <option value="custom" ${r.type==='custom'?'selected':''}>🔗 لينك تاني</option>
        </select></div>
        <div class="field"><label>الرابط</label><input name="res_url_${i}" type="url" value="${escapeHtml(r.url)}" placeholder="https://..."></div>
        <button type="button" class="remove-row-btn" data-action="remove-course-resource" data-idx="${i}" style="align-self:center;">✕</button>
      </div>`).join("")}
      <button type="button" class="add-row-btn" data-action="add-course-resource">+ إضافة مصدر</button>
    </div>

    <div class="form-card">
      <div class="form-card-title">🎓 الشهادة</div>
      <div class="type-choice-row">
        <div class="type-choice ${d.hasCertificate?'selected':''}" data-action="course-cert-select" data-value="true">
          <div class="tc-icon">✅</div>
          <div class="tc-label">أيوه، هيدّي شهادة</div>
        </div>
        <div class="type-choice ${!d.hasCertificate?'selected':''}" data-action="course-cert-select" data-value="false">
          <div class="tc-icon">🚫</div>
          <div class="tc-label">من غير شهادة</div>
        </div>
      </div>
      <input type="hidden" name="hasCertificate" value="${d.hasCertificate}">
    </div>

    <div class="form-card">
      <div class="form-card-title">🏷️ الوسوم</div>
      <div class="tag-grid">${TAGS.map(t=>`<button type="button" class="pill ${state.adminResTags.has(t)?"selected":""}" data-action="admin-toggle-restag" data-tag="${t}">${t}</button>`).join("")}</div>
    </div>

    <button type="submit" class="btn btn-gold btn-block">🚀 إنشاء الكورس</button>
  </form>`;
}
function renderAdminResourceForm(){
  return `
  <div class="note-box" style="margin-bottom:14px;">لإضافة كورس (فيديو واحد أو أكتر) استخدم "+ كورس جديد" فوق — الفورم ده للمحتوى البسيط بس (فيديو مفرد، PDF، أو مقال) اللي بيروح لقسم "نصائح صغيرة" أو "نصائح عملية".</div>
  <form id="admin-res-form">
    <div class="form-card">
      <div class="form-card-title">📄 بيانات المصدر</div>
      <div class="field"><label>العنوان</label><input name="title" type="text" required placeholder="مثال: 5 نصائح لمقابلة الشغل"></div>
      <div class="field"><label>وصف قصير</label><input name="description" type="text" placeholder="سطر أو اتنين يشرحوا المحتوى"></div>
      <div class="field-row">
        <div class="field"><label>النوع</label><select name="type"><option value="video">🎬 فيديو</option><option value="pdf">📄 ملف PDF</option><option value="article">📰 مقال</option></select></div>
        <div class="field"><label>هيتحط فين؟</label><select name="section">
          <option value="tips">💡 نصائح صغيرة</option>
          <option value="practical">🛠️ نصائح عملية</option>
        </select></div>
      </div>
      <div class="field"><label>الرابط</label><input name="link" type="url" required placeholder="https://..."></div>
      <div class="field"><label>مجاني ولا مميز؟</label><select name="isPremium"><option value="false">مجاني</option><option value="true">⭐ مميز (Premium)</option></select></div>
    </div>
    <div class="form-card">
      <div class="form-card-title">🏷️ الوسوم</div>
      <div class="tag-grid">${TAGS.map(t=>`<button type="button" class="pill ${state.adminResTags.has(t)?"selected":""}" data-action="admin-toggle-restag" data-tag="${t}">${t}</button>`).join("")}</div>
    </div>
    <button type="submit" class="btn btn-gold btn-block">إضافة المصدر</button>
  </form>`;
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
  const quota = state.aiQuota;
  const quotaLine = state.aiQuotaLoading ? "بيجيب حد الاستخدام..."
    : quota ? `مستخدم ${quota.used}/${quota.limit} النهاردة (متبقي ${Math.max(0,quota.remaining)}) — بيتصفر تلقائيًا كل يوم`
    : "";
  return `
  <div class="note-box" style="margin-bottom:14px;">الـAI بيدور بجوجل الفعلي ويجيب مصادر حقيقية، بس برضو راجع كل فرصة وتأكد من التفاصيل قبل الموافقة — خصوصًا آخر موعد.${quotaLine?`<div style="margin-top:6px;font-weight:700;">${quotaLine}</div>`:""}</div>
  <div class="field-row" style="margin-bottom:10px;">
    <div class="field"><label>موديل Gemini</label>
      <select id="ai-search-model">
        ${["gemini-3.5-flash","gemini-2.5-flash","gemini-2.0-flash"].map(m=>`<option value="${m}" ${state.searchModel===m?"selected":""}>${m}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>نوع البحث</label>
      <select id="ai-search-depth">
        <option value="quick" ${state.searchDepth==="quick"?"selected":""}>سريع</option>
        <option value="deep" ${state.searchDepth==="deep"?"selected":""}>عميق</option>
        <option value="very_deep" ${state.searchDepth==="very_deep"?"selected":""}>عميق جدًا</option>
      </select>
    </div>
    <div class="field"><label>عدد النتائج</label>
      <select id="ai-search-count">
        ${[5,10,20,30,40].map(n=>`<option value="${n}" ${state.searchResultCount===n?"selected":""}>${n}</option>`).join("")}
      </select>
    </div>
  </div>
  <form id="ai-search-form" style="display:flex;gap:8px;margin-bottom:8px;">
    <input id="ai-search-input" type="text" value="${escapeHtml(state.searchTopic)}" placeholder="مثال: منح دراسية لطلاب الثانوي" style="flex:1;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14.5px;">
    <button type="submit" class="btn btn-gold" ${state.searchBusy?"disabled":""}>${state.searchBusy?"بيدور...":"دور على فرص"}</button>
  </form>
  ${state.searchErr?`<div class="error-box">${state.searchErr}</div>`:""}
  ${state.searchNote?`<div class="note-box" style="margin-top:8px;">${state.searchNote}</div>`:""}
  ${state.lastFoundItems.length?`
  <div class="note-box" style="margin:10px 0;background:#EAF6EF;color:#1F7A47;">✅ الـAI لقى ${state.lastFoundItems.length} فرصة وضافها للموقع على طول — دي هي، راجعها:</div>
  ${state.lastFoundItems.map(item=>`
  <div class="card" style="padding:14px;margin-bottom:10px;">
    <span class="opp-cat">${CATEGORIES[item.category]||item.category||"-"}</span>
    <div class="opp-title" style="margin-top:6px;">${escapeHtml(item.title||"بدون عنوان")}</div>
    <div class="opp-org">${escapeHtml(item.organization||"")}</div>
    ${(item.deadline && item.deadline!=="غير معلن")?`<div class="opp-deadline normal">آخر موعد (حسب البحث): ${escapeHtml(item.deadline)}</div>`:`<div class="opp-deadline urgent">⚠️ الموعد غير معلن — افتح الرابط وتأكد بنفسك</div>`}
    ${(item.country||item.startDate)?`<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px;font-size:12px;color:var(--ink-muted);">${item.country?`<span>🌍 ${escapeHtml(item.country)}</span>`:""}${item.startDate?`<span>📅 يبدأ ${escapeHtml(item.startDate)}</span>`:""}</div>`:""}
    ${item.description?`<div class="desc-text" style="margin:6px 0;">${escapeHtml(item.description)}</div>`:""}
    ${item.link?`<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener" class="link-btn" style="display:inline-block;">فتح المصدر ↗</a>`:""}
  </div>`).join("")}
  `:`<div class="empty-state" style="padding:24px 12px;"><p>مفيش نتايج لسه. اكتب موضوع فوق ودوس "دور على فرص".</p></div>`}`;
}

function renderResourceCard(r){
  const quiz = state.quizzes.find(q=>q.resourceId===r.id);
  const result = quiz ? state.quizResults[quiz.id] : null;
  const isDone = state.completedResourceIds.includes(r.id);
  const isCourse = r.type==="course" && (r.lessons||[]).length>0;
  const {done: doneLessons, total: totalLessons} = isCourse ? courseProgress(r) : {done:0,total:0};
  const courseComplete = isCourse && totalLessons>0 && doneLessons>=totalLessons && r.hasCertificate!==false;
  const typeLabel = {video:"فيديو",pdf:"ملف PDF",article:"مقال",course:"كورس (فيديوهات)"};
  // تسمية التمييز بتتغيّر حسب القسم (كورس/نصيحة سريعة/نصيحة عملية)، بنفس منطق
  // تمييز الفرص بالظبط — بس بمصطلحات مناسبة لكل قسم.
  const sect = resourceSection(r);
  const featuredLabels = {
    courses: {badge:"⭐ كورس مميز", on:"✕ إلغاء تمييز الكورس", off:"⭐ ثبّت الكورس كمميز"},
    tips: {badge:"⭐ نصيحة مميزة", on:"✕ إلغاء تمييز النصيحة", off:"⭐ ثبّت النصيحة كمميزة"},
    practical: {badge:"⭐ نصيحة عملية مميزة", on:"✕ إلغاء التمييز", off:"⭐ ثبّت كنصيحة عملية مميزة"}
  }[sect] || {badge:"⭐ مميز", on:"✕ إلغاء التمييز", off:"⭐ ثبّت كمميز"};
  if(isCourse && state.editingResourceId===r.id){
    return renderResourceEditForm(r);
  }
  return `
  <div class="card" style="padding:16px;margin-bottom:12px;${r.featured?"border:1.5px solid #E8A33D;":""}">
    <span class="opp-cat">${typeLabel[r.type]||r.type}</span>
    ${r.featured?`<span class="badge-verified" style="background:#FDF3E2;color:#8A5B10;">${featuredLabels.badge}</span>`:""}
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
      ${isAdmin()?`<button class="pill" data-action="toggle-resource-featured" data-id="${r.id}">${r.featured?featuredLabels.on:featuredLabels.off}</button>`:""}
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
function resourceSection(r){
  // القسم بيتحدد صراحةً وقت الإضافة (r.section). المصادر القديمة اللي اتضافت
  // قبل ما ميزة الأقسام الثلاثة تتعمل ملهاش r.section محفوظ، فبنرجعلها لنفس
  // السلوك القديم: كورس => قسم الكورسات، أي حاجة تانية => نصائح سريعة.
  return r.section || (r.type==="course" ? "courses" : "tips");
}
function renderLearningCenterTab(){
  const section = ["content","assessments","guides"].includes(state.learningCenterSection) ? state.learningCenterSection : "content";
  const sectionTabs = `
    <div class="tabs" style="margin-bottom:14px;">
      <button class="tab ${section==="content"?"active":""}" data-action="learning-center-section" data-section="content">📚 محتوى تعليمي</button>
      <button class="tab ${section==="assessments"?"active":""}" data-action="learning-center-section" data-section="assessments">🧠 الاختبارات</button>
      <button class="tab ${section==="guides"?"active":""}" data-action="learning-center-section" data-section="guides">📖 أدلة ومصادر</button>
    </div>`;
  if(section==="assessments") return sectionTabs + renderAssessmentsTab();
  if(section==="guides") return sectionTabs + renderGuidesTab();
  return sectionTabs + renderResourcesTab();
}
function renderResourcesTab(){
  const introNote = `<div class="note-box" style="margin-bottom:14px;">📚 هنا بتتحط كورسات المنصة وفيديوهات المنصة الخاصة بينا.</div>`;
  if(state.resources.length===0){
    if(isAdmin()){
      return introNote + `<div class="empty-state"><h3>لسه مفيش محتوى في مركز التعلم</h3><p>ضيف أول محتوى من تبويب "الإدارة".</p></div>`;
    }
    return introNote + `<div class="empty-state"><h3>لسه مفيش محتوى في مركز التعلم</h3><p>هيظهر هنا أول ما الأدمن يضيفه.</p></div>`;
  }
  const byFeaturedFirst = (list)=>[...list].sort((a,b)=>(b.featured?1:0)-(a.featured?1:0));
  const bySection = {
    tips: byFeaturedFirst(state.resources.filter(r=>resourceSection(r)==="tips")),
    courses: byFeaturedFirst(state.resources.filter(r=>resourceSection(r)==="courses")),
    practical: byFeaturedFirst(state.resources.filter(r=>resourceSection(r)==="practical"))
  };
  const sub = ["tips","courses","practical"].includes(state.learningSubTab) ? state.learningSubTab : "tips";
  const subTabs = `
    <div class="tabs" style="margin-bottom:14px;">
      <button class="tab ${sub==="tips"?"active":""}" data-action="learning-subtab" data-subtab="tips">💡 نصائح سريعة</button>
      <button class="tab ${sub==="courses"?"active":""}" data-action="learning-subtab" data-subtab="courses">🎓 الكورسات</button>
      <button class="tab ${sub==="practical"?"active":""}" data-action="learning-subtab" data-subtab="practical">🛠️ نصائح عملية</button>
    </div>`;
  const list = bySection[sub];
  const emptyMsgs = {
    tips: `<div class="empty-state"><h3>لسه مفيش نصائح سريعة</h3><p>هتظهر هنا أول ما الأدمن يضيفها.</p></div>`,
    courses: `<div class="empty-state"><h3>لسه مفيش كورسات</h3><p>هتظهر هنا أول ما الأدمن يضيفها.</p></div>`,
    practical: `<div class="empty-state"><h3>لسه مفيش نصائح عملية</h3><p>هتظهر هنا أول ما الأدمن يضيفها.</p></div>`
  };
  return introNote + subTabs + (list.length ? list.map(renderResourceCard).join("") : emptyMsgs[sub]);
}

// رقم الواتساب — غيّره من هنا بس، وكل الأزرار في المنصة هتتحدث تلقائيًا
const WHATSAPP_NUMBER = "201027405083";
function waLink(text){
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
const CONSULTATION_SERVICES = [
  {icon:"🎓", title:"التقديم على المنح والفرص", desc:"مساعدة عملية في اختيار المنح المناسبة ليك وتجهيز طلب تقديم قوي."},
  {icon:"📄", title:"مراجعة وتحسين السيرة الذاتية (CV)", desc:"مراجعة كاملة للـCV بتاعك وتحسينه ليعكس نقاط قوتك بشكل احترافي."},
  {icon:"💼", title:"إنشاء وتحسين LinkedIn", desc:"بناء بروفايل LinkedIn احترافي يجذب الفرص والتواصل المهني الصح."},
  {icon:"🌐", title:"إنشاء مواقع ومنصات بالذكاء الاصطناعي", desc:"بناء موقع أو منصة فعلية باستخدام أدوات الذكاء الاصطناعي الحديثة."},
  {icon:"💡", title:"استشارات المشاريع والأفكار", desc:"مناقشة فكرة مشروعك وتحويلها لخطة عملية قابلة للتنفيذ."},
  {icon:"📱", title:"صناعة المحتوى والبراند الشخصي", desc:"بناء حضور رقمي وبراند شخصي واضح على السوشيال ميديا."},
  {icon:"🗣️", title:"التدريب على المقابلات الشخصية", desc:"تدريب عملي على أسئلة المقابلات وإزاي تقدّم نفسك بثقة."},
  {icon:"🧭", title:"التوجيه الدراسي والمهني", desc:"مساعدتك تحدد المسار الدراسي أو المهني المناسب لاهتماماتك وقدراتك."},
  {icon:"🤝", title:"القيادة والعمل التطوعي وإدارة المبادرات", desc:"دعم عملي لو بتقود مبادرة أو فريق تطوعي وعايز تنظمه صح."},
  {icon:"🧑‍🏫", title:"جلسات Mentorship ومتابعة فردية", desc:"متابعة شخصية مستمرة ليك في رحلتك المهنية أو الدراسية."},
];
const CONSULTATION_FEATURES = [
  "خبرة في قيادة المبادرات الشبابية",
  "خبرة في المنح والفرص",
  "خبرة في تطوير المنصات باستخدام الذكاء الاصطناعي",
  "متابعة شخصية حقيقية، مش رسائل جاهزة",
  "حلول عملية قابلة للتنفيذ، مش نظرية بس",
];
const CONSULTATION_FAQ = [
  {q:"الاستشارة مدفوعة؟", a:"تواصل معايا على واتساب وهنتفق على التفاصيل حسب نوع الخدمة اللي محتاجها."},
  {q:"هل ده بديل عن المساعد الذكي؟", a:"لأ، المساعد الذكي بيرد فورًا ومجانًا على أسئلة عامة. الاستشارة الشخصية دي لو محتاج متابعة ودعم عملي أعمق ومخصص ليك."},
  {q:"إزاي بحجز؟", a:"دوس على أي زرار \"اطلب الخدمة\" أو زرار الواتساب، وهيفتحلك شات مباشر معايا."},
  {q:"في مواعيد معينة للرد؟", a:"بحاول أرد بأسرع وقت ممكن، وهنتفق على أقرب معاد مناسب للطرفين على الواتساب نفسه."},
];
function renderConsultationTab(){
  return `
  <div class="card" style="padding:26px 22px;text-align:center;margin-bottom:18px;">
    <div style="font-size:15px;color:var(--ink-muted);font-weight:700;margin-bottom:6px;">👨‍💼 استشارة شخصية مع</div>
    <h2 style="font-size:21px;font-weight:800;margin-bottom:10px;">Sleem Mahmoud</h2>
    <p style="font-size:14px;line-height:1.8;color:var(--ink-muted);max-width:480px;margin:0 auto 18px;">إذا كنت تحتاج إلى مساعدة عملية أو متابعة شخصية في المنح، السيرة الذاتية، إنشاء المواقع، المشاريع، القيادة، التطوع، أو تطوير مسارك المهني، يمكنك التواصل مباشرة للحصول على استشارة مخصصة.</p>
    <a href="${waLink("السلام عليكم، أريد حجز استشارة شخصية.")}" target="_blank" rel="noopener" class="btn btn-gold" style="display:inline-flex;text-decoration:none;">💬 تواصل عبر واتساب</a>
  </div>

  <div class="section-label">الخدمات</div>
  <div class="cards-grid">
    ${CONSULTATION_SERVICES.map(s=>`
    <div class="card" style="padding:18px;">
      <div style="font-size:26px;margin-bottom:8px;">${s.icon}</div>
      <div style="font-weight:800;font-size:14.5px;margin-bottom:6px;">${escapeHtml(s.title)}</div>
      <div style="font-size:13px;color:var(--ink-muted);line-height:1.6;margin-bottom:12px;">${escapeHtml(s.desc)}</div>
      <a href="${waLink(`السلام عليكم، أريد الاستفسار عن خدمة: ${s.title}`)}" target="_blank" rel="noopener" class="btn btn-ghost btn-block" style="text-decoration:none;">اطلب الخدمة</a>
    </div>`).join("")}
  </div>

  <div class="section-label" style="margin-top:20px;">ليه تختار الاستشارة دي؟</div>
  <div class="card" style="padding:18px 20px;margin-bottom:18px;">
    ${CONSULTATION_FEATURES.map(f=>`<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;"><span>✅</span><span>${escapeHtml(f)}</span></div>`).join("")}
  </div>

  <div class="section-label">أسئلة شائعة</div>
  ${CONSULTATION_FAQ.map(f=>`
  <div class="card" style="padding:16px 18px;margin-bottom:8px;">
    <div style="font-weight:800;font-size:13.5px;margin-bottom:6px;">${escapeHtml(f.q)}</div>
    <div style="font-size:13px;color:var(--ink-muted);line-height:1.6;">${escapeHtml(f.a)}</div>
  </div>`).join("")}

  <a href="${waLink("السلام عليكم، أريد الاستفسار عن خدمة الاستشارة الشخصية.")}" target="_blank" rel="noopener" class="wa-floating-btn" title="تواصل عبر واتساب">💬</a>
  `;
}
function renderChatTab(){
  const section = state.chatSection==="consultation" ? "consultation" : "ai";
  const chatSectionTabs = `
    <div class="tabs" style="margin-bottom:14px;">
      <button class="tab ${section==="ai"?"active":""}" data-action="chat-section" data-section="ai">🤖 الاستشارة الذكية</button>
      <button class="tab ${section==="consultation"?"active":""}" data-action="chat-section" data-section="consultation">👨‍💼 الاستشارة الشخصية</button>
    </div>`;
  if(section==="consultation") return chatSectionTabs + renderConsultationTab();
  const msgs = state.chatMessages;
  const quickPrompts = ["فرص مناسبة ليا","اعمل CV","طور لغتي الإنجليزية","أفضل كورسات البرمجة","أفضل منح حالية","وظائف مناسبة","كيف أبدأ الذكاء الاصطناعي","كيف أتعلم Flutter","كيف أتعلم التصميم","اعمل بورتفوليو","خطاب تقديم","حسّن حساب GitHub"];
  return chatSectionTabs + `
  <div class="chat-wrap">
    <div class="note-box chat-status" style="background:#EAF6EF;color:#1F7A47;">مساعد فوري ومجاني ✓ بيرد فورًا من بيانات ملفك الشخصي والفرص المتاحة فعليًا على المنصة — من غير أي حد استخدام يومي.</div>
    ${msgs.length===0?`<div class="cat-chip-row" style="margin-bottom:4px;">${quickPrompts.map(q=>`<button type="button" class="pill" data-action="chat-quick" data-q="${escapeHtml(q)}">${q}</button>`).join("")}</div>`:""}
    <div class="chat-messages" id="chat-messages">
      ${msgs.length===0?`<div class="empty-state" style="padding:30px 16px;"><h3>اسأل المساعد أي حاجة عن مسارك المهني</h3><p>جرب مثلاً: "فرص مناسبة ليا"، "إزاي أحسّن الـCV"، أو "عايز أتعلم إيه" — يرد عليك فورًا من غير انتظار.</p></div>`:""}
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
// المفتاح بقى مخبّى تمامًا في السيرفر (Cloudflare Worker) — الموقع بيكلم البروكسي ده بس.
const GEMINI_PROXY_URL = "https://nextstep-ai.mhmwdshhath468.workers.dev";

// ============ نداء موحّد لكل استخدامات الذكاء الاصطناعي ============
// كل ميزات الـAI في الموقع (شات، بحث عن فرص، تحسين CV، توليد نص شهادة،
// تصنيف/تنظيف الفرص بالجملة) بتعدي من هنا وبس — بدل ما كل ميزة تعمل fetch
// لوحدها بمهلة مختلفة. سبب المشكلة اللي كانت موجودة قبل كده: البحث وتحسين
// الـCV كان ليهم AbortController بمهلة قصيرة نسبيًا (25 و55 ثانية) وطلبهم
// بيرجّع رد JSON طويل (5 فرص بتفاصيلها، أو إعادة صياغة كاملة) بياخد وقت أطول
// من كده أحيانًا — فكان بيتقفل بـAbortError قبل ما Gemini يخلص، بينما الشات
// والتصنيف (اللي طلباتهم أخف/من غير مهلة خالص) كانوا شغالين عادي. الحل هنا:
// مهلة أطول وقابلة للتخصيص حسب حجم الطلب + إعادة محاولة تلقائية مرة واحدة لو
// الفشل كان بسبب مهلة/شبكة (مش لو السيرفر رفض الطلب برسالة واضحة زي الكوتا،
// وقتها إعادة المحاولة مش هتغيّر حاجة) + تسجيل (log) للسبب الحقيقي للفشل في
// الكونسول (timeout / quota / server error / json error / network) بدل ما
// نعرض للمستخدم رسالة عامة "الخدمة غير متاحة" من غير أي تفاصيل.
async function callAiProxy(path, body, {timeoutMs=60000, retries=1} = {}){
  const url = GEMINI_PROXY_URL + (path||"");
  let lastErr = null;
  for(let attempt=0; attempt<=retries; attempt++){
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), timeoutMs);
    const startedAt = Date.now();
    try{
      const res = await fetch(url, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({...body, uid: state.user && state.user.uid, email: state.user && state.user.email}),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const elapsed = Date.now()-startedAt;
      let data = null;
      try{ data = await res.json(); }
      catch(parseErr){
        console.error(`[AI ${path||"/"}] رد السيرفر مكنش JSON صحيح (كود ${res.status}, ${elapsed}ms):`, parseErr);
        return {ok:false, reason:"json_error", status:res.status, message:"رد السيرفر مكنش بصيغة JSON سليمة."};
      }
      if(!res.ok){
        const msg = (data && data.error && data.error.message) || `كود ${res.status}`;
        console.error(`[AI ${path||"/"}] السيرفر رفض الطلب (محاولة ${attempt+1}/${retries+1}, ${elapsed}ms):`, msg);
        // كوتا خلصت أو رفض واضح من السيرفر — إعادة المحاولة مش هتفرق، رجّع فورًا بدل ما نستهلك وقت زيادة
        return {ok:false, reason: res.status===429?"quota":"server_error", status:res.status, message: msg, data};
      }
      console.log(`[AI ${path||"/"}] نجح (محاولة ${attempt+1}/${retries+1}, ${elapsed}ms)`);
      return {ok:true, data};
    }catch(err){
      clearTimeout(timeoutId);
      const elapsed = Date.now()-startedAt;
      lastErr = err;
      const isTimeout = err && err.name==="AbortError";
      console.error(`[AI ${path||"/"}] ${isTimeout?"انتهت المهلة":"مشكلة شبكة"} (محاولة ${attempt+1}/${retries+1}, ${elapsed}ms):`, err);
      if(attempt<retries){ console.log(`[AI ${path||"/"}] بيعيد المحاولة تلقائيًا...`); continue; }
    }
  }
  const isTimeout = lastErr && lastErr.name==="AbortError";
  return {
    ok:false,
    reason: isTimeout?"timeout":"network",
    message: isTimeout
      ? `الـAI استغرق أكتر من ${Math.round(timeoutMs/1000)} ثانية حتى بعد إعادة المحاولة، غالبًا في ضغط مؤقت على الخدمة.`
      : "مشكلة شبكة أثناء الاتصال بالـAI حتى بعد إعادة المحاولة."
  };
}
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

// ملحوظة: المساعد الذكي (الشات) بقى محلي 100% (localAssistantReply فوق) ومش
// محتاج أي عداد استخدام يومي — العداد اللي كان هنا اتشال لإنه بقى بلا فايدة.
function todayStr(){ return new Date().toISOString().slice(0,10); }
// حد منفصل لعدد مرات عمل الـCV في اليوم، لكل مستخدم لوحده (عداد محلي بس، مش
// ملزم على السيرفر — السيرفر بيتحكم في كل شيء بعداد واحد مشترك).
const CV_DAILY_LIMIT = 1;
const ADMIN_CV_DAILY_LIMIT = 1;
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
// ============================================================
// المساعد الذكي بقى بيشتغل محليًا (Rule-based) من غير ما يستهلك أي حصة من
// Gemini خالص. السبب: حصة الـAPI المجانية مشتركة بين كل مستخدمي الموقع على
// نفس المفتاح ومحدودة جدًا فعليًا (زي ما ظهر في رسائل "Quota exceeded... limit:
// 20, model: gemini-3.5-flash" اللي كانت بتظهر للمستخدمين) — والشات كان أكتر
// ميزة بتستهلك منها لأن كل رسالة = طلب مستقل بغض النظر عن حد الاستخدام اليومي
// بتاعنا احنا. شيلنا اعتماد الشات على Gemini خالص عشان الحصة المشتركة كلها
// تفضل للحاجات اللي فعلًا محتاجة ذكاء اصطناعي حقيقي وبتُستخدم بمعدل أقل بكتير:
// البحث بالـAI للأدمن، وتصنيف الفرص تلقائيًا، وتنظيف الفرص الوهمية/المكررة.
// المساعد هنا بيرد فورًا (من غير أي استدعاء شبكة خالص) من بيانات بروفايل
// المستخدم والفرص المحمّلة فعليًا على المنصة، بمطابقة كلمات مفتاحية — مش ذكاء
// اصطناعي توليدي حقيقي، لكنه مجاني 100% ومتاح دايمًا من غير أي حد استخدام.
// قاعدة معرفة كبيرة من ردود جاهزة (من غير أي ذكاء اصطناعي خالص) — كل مدخل ليه
// كلمات مفتاحية وردّ محفوظ. بندوّر فيها بالترتيب وناخد أول تطابق، وده بيخليها
// سريعة جدًا (مقارنة كلمات بسيطة، من غير أي نداء شبكة). لو السؤال بيخص بيانات
// حقيقية على المنصة (فرص، CV، كورسات، شهادات)، الردود المخصصة ليها فوق بتتفحص
// الأول وبتاخد الأولوية زي ما كانت بالظبط.
const ASSISTANT_KB = [
  {keys:["اتطور في البرمجة","تطور نفسي في البرمجة","اتعلم برمجة","ابدأ برمجة"], a:"ابدأ بلغة واحدة بس (Python أو JavaScript كويسين للمبتدئين) وركّز فيها 2-3 شهور قبل ما تتشتت بلغة تانية. اتعلم بالمشاريع الصغيرة مش بالنظري بس — اعمل مشروع فعلي كل ما تخلّص موضوع جديد. المستمرية اليومية (حتى نص ساعة) أهم من الجلسات الطويلة المتقطعة."},
  {keys:["ذكاء اصطناعي","machine learning","تعلم الآلة","ai من الصفر"], a:"ابدأ الأساسيات الرياضية (إحصاء واحتمالات بسيطة) وبايثون كويس الأول، بعدها ادخل على مكتبات زي scikit-learn قبل ما تروح لـDeep Learning. كورسات Andrew Ng على Coursera وYouTube قناة زي freeCodeCamp نقطة بداية ممتازة ومجانية."},
  {keys:["استعد للمقابل","مقابلة شخصية","مقابلة شغل","interview"], a:"جهّز إجابات جاهزة لأسئلة زي 'احكيلي عن نفسك' و'ليه نختارك' بأمثلة حقيقية من خبرتك مش كلام عام. ابحث عن الشركة كويس قبل المقابلة واكتب أسئلة تسألها في الآخر. اتمرن بصوت عالي أو قدام مرايا قبلها بيوم."},
  {keys:["اتعلم انجليزي","لغة انجليزية","تحسين الانجليزي","english"], a:"غيّر لغة الموبايل والتطبيقات اللي بتستخدمها كل يوم للإنجليزي، وابدأ تتفرج مسلسلات بترجمة إنجليزية (مش عربي) بدل الترجمة العربي. تطبيقات زي Duolingo كويسة للأساسيات، لكن المحادثة الفعلية (حتى مع نفسك بصوت عالي) هي اللي بتفرق فعلًا."},
  {keys:["اتعلم تصميم","جرافيك ديزاين","تصميم جرافيك","design"], a:"ابدأ بـCanva عشان تفهم أساسيات التكوين والألوان بسهولة، وبعدين انتقل لـFigma (مجاني ومطلوب جدًا في سوق الشغل). قناة Flux على يوتيوب وكورسات Figma الرسمية المجانية نقطة بداية ممتازة."},
  {keys:["عمل حر","فريلانس","freelance","اشتغل اونلاين"], a:"اختار مهارة واحدة تتقنها كويس الأول وابدأ بيها على منصة زي Upwork أو مستقل — مش لازم تكون خبير، ابدأ بمشاريع صغيرة رخيصة عشان تبني تقييمات وبورتفوليو. السعر مش أهم حاجة الأول، الخبرة والتقييمات هي اللي هتفتحلك فرص أكبر بعد كده."},
  {keys:["استفيد من المنصة","استخدم الموقع","ازاي استخدم نيكست"], a:"ابدأ بتعبئة ملفك الشخصي كامل (المهارات والاهتمامات) عشان الفرص المقترحة تبقى دقيقة، وبعدين افتح تبويب 'الفرص المقترحة' يوميًا واتفرج على 'مركز التعلم' في وقتك الفاضي. لو محتاج CV، جرب زرار التحميل من 'ملفي' وقت ما تحس إنك جاهز."},
  {keys:["اختار تخصصي","اختيار التخصص","مش عارف اتخصص في ايه"], a:"جرّب حاجات كتير بسرعة قبل ما تلتزم — كورس تجريبي أو مشروع صغير في كل مجال بيهمّك لمدة أسبوع بس. اسأل نفسك: إيه اللي بتعمله وانت متلاحظش الوقت بيعدي؟ ده أقوى إشارة على الاهتمام الحقيقي."},
  {keys:["نظم وقتي","إدارة الوقت","تنظيم الوقت","time management"], a:"استخدم تقنية بسيطة زي 25 دقيقة شغل / 5 دقايق راحة (بومودورو)، واكتب أهم 3 مهام بس كل يوم بدل ليستة طويلة. النوم الكويس والابتعاد عن الموبايل وقت الشغل بيفرقوا أكتر من أي تطبيق تنظيم."},
  {keys:["ابحث عن منح","منح دراسية","منحة","scholarship"], a:"شوف تبويب 'الفرص المقترحة' هنا أول حاجة، لإنها بتتفلتر حسب مرحلتك الدراسية. برضو مواقع زي Scholars4dev وOpportunityDesk بتجمع منح عالمية محدّثة، وتابع صفحات الجامعات اللي بتستهدفها مباشرة."},
  {keys:["مهارات القيادة","تطور قيادي","ليدرشيب","leadership"], a:"القيادة بتتعلم بالممارسة مش بالقراءة بس — خد أي فرصة تقود بيها مشروع صغير أو فريق ولو من 2-3 أشخاص. اسمع أكتر ما تتكلم، واعترف بغلطك بسرعة قدام فريقك، ده بيبني ثقة حقيقية."},
  {keys:["مهارات التواصل","تواصل فعال","communication skills"], a:"التواصل الكويس أساسه الاستماع الفعلي قبل الرد — خلي هدفك تفهم مش بس ترد. اتمرن تلخّص كلام اللي قدامك بجملة قبل ما تعلّق، ده بيوضح فهمك ويقلل سوء الفهم كتير."},
  {keys:["مواقع تعلم","افضل مواقع للتعلم","تعلم اونلاين"], a:"Coursera وedX لكورسات جامعات عالمية (فيه دعم مادي/تمويل)، YouTube لأي مهارة عملية سريعة، وfreeCodeCamp لو البرمجة هي هدفك. مركز التعلم هنا كمان فيه محتوى منسّق خصيصًا ليك."},
  {keys:["شهادات مجانية","سيرتفكيت مجاني","كورسات مجانية بشهادة"], a:"Google Digital Garage وHubSpot Academy بيدّوا شهادات مجانية معترف بيها في التسويق والمهارات الرقمية. Coursera بتدّي 'audit' مجاني للكورس (من غير شهادة)، بس فيه financial aid لو محتاج الشهادة الرسمية."},
  {keys:["بورتفوليو","portfolio","معرض أعمالي"], a:"ابدأ بـ3-5 مشاريع بس لكن مشتغل عليهم كويس بدل عشرة نص مخلّصين. لو تقني، GitHub كافي كبورتفوليو؛ لو تصميم أو كتابة، موقع بسيط مجاني زي Notion أو Carrd كفاية جدًا في البداية."},
  {keys:["ابدأ في التطوع","تطوع","volunteer"], a:"دور على منظمات محلية صغيرة أو مبادرات جامعية، عادةً بتكون أسهل في القبول من المنظمات الكبيرة وبتدّيك خبرة حقيقية بسرعة. شوف كمان تبويب 'الفرص المقترحة' هنا، فيه فرص تطوع بتتحدّث باستمرار."},
  {keys:["استعد للجامعة","دخول الجامعة","اول سنة جامعة"], a:"جهّز نفسك ذهنيًا إن أسلوب المذاكرة هيختلف عن المدرسة — مفيش متابعة يومية، فالانضباط الذاتي أهم حاجة. حاول تتعرف بيئة الكلية والمكتبة قبل أول يوم لو تقدر، وابدأ تبني شبكة علاقات من أول أسبوع."},
  {keys:["مذاكرة فعالة","اذاكر صح","مهارات الدراسة"], a:"المذاكرة الفعالة مش بالوقت بس — جرّب تلخّص المعلومة بكلامك (مش نسخ) واشرحها لحد تاني حتى لو خيالي، ده بيثبّت الفهم أكتر من القراءة المتكررة. راحات قصيرة منتظمة أحسن من جلسة طويلة متواصلة."},
  {keys:["ثقة بالنفس","الثقة في نفسي","confidence"], a:"الثقة بتتبني بالإنجاز الصغير المتكرر مش بالكلام — حدد هدف صغير قابل للتحقيق وحققه، وكرّرها. قارن نفسك بنفسك بالأمس بس، مش بحد تاني، ده بيقلل ضغط كبير من غير داعي."},
  {keys:["قلق من المستقبل","خايف من الفشل","توتر من الشغل"], a:"القلق من المجهول طبيعي جدًا وكل حد بيمر بيه — قسّم القلق ده لخطوات صغيرة تقدر تتحكم فيها دلوقتي بدل ما تفكر في الصورة الكبيرة كلها مرة واحدة. لو حاسس إن القلق بيأثر على حياتك اليومية بشكل كبير، مش عيب خالص تتكلم مع حد تثق فيه أو مختص."},
  {keys:["linkedin","لينكدإن","بروفايل لينكدإن"], a:"خلّي صورتك واضحة واحترافية، واكتب Headline بيوضح مين انت وإيه بتدور عليه (مش بس مسمى وظيفي عام). اطلب توصيات من زملاء أو أساتذة سابقين، وشارك محتوى بسيط عن اللي بتتعلمه بانتظام."},
  {keys:["اختار كورس اونلاين","كورس اونلاين صح"], a:"شوف تقييمات الكورس وتاريخ آخر تحديث ليه قبل ما تشترك — كورس قديم جدًا ممكن يكون معلوماته اتغيرت. ابدأ بنسخة مجانية أو تجريبية لو متاحة قبل ما تدفع فلوس."},
  {keys:["ريادة اعمال","مشروعي الخاص","ابدأ مشروع","startup"], a:"ابدأ بأصغر نسخة ممكنة من فكرتك تقدر تختبرها بسرعة وبفلوس قليلة، بدل ما تخطط لمشروع كامل من الأول. اتكلم مع عملاء محتملين حقيقيين قبل ما تبني أي حاجة، ده بيوفرلك وقت وفلوس كتير."},
  {keys:["حل المشكلات","تفكير نقدي","critical thinking"], a:"لما تواجه مشكلة، اكتبها بوضوح الأول قبل ما تدور على حل — نص المشاكل بتتحل لما تتفهم صح. اتعود تسأل 'ليه' كذا مرة متتالية عشان توصل للسبب الحقيقي مش العرض بس."},
  {keys:["اول وظيفة","اول شغلانة","fresh grad"], a:"مترفضش فرصة بس لإن المرتب مش زي ما توقعت — الخبرة الأولى بتفتح أبواب أكتر من قيمتها المادية المباشرة. ركّز إنك تتعلم بسرعة وتبني سمعة كويسة في أول 3-6 شهور."},
  {keys:["عمل جماعي","team work","العمل مع فريق"], a:"وضّح دايمًا إيه اللي إنت مسؤول عنه بالظبط في الفريق عشان تتجنب تضارب أو تكرار شغل. لو حصل خلاف، ناقش الفكرة مش الشخص، وده بيخلّي النقاش أهدأ وأنتج بكتير."},
  {keys:["cover letter","خطاب تقديم","كوفر ليتر","رسالة تقديم"], a:"خطاب التقديم الكويس بيبقى مخصص لكل فرصة (مش نفس النص لكل تقديم) — افتحه بجملة توضح ليه بالظبط انت مهتم بالجهة دي، واذكر إنجاز واحد محدد يثبت كلامك بدل ما تكرر اللي موجود في الـCV بكلام تاني. اقفله بدعوة واضحة للتواصل."},
  {keys:["github","جيت هاب","جيتهاب","حساب github"], a:"خلّي الـREADME بتاع كل مشروع واضح: إيه المشروع، إزاي تشغّله، وسكرين شوت لو ينفع. ثبّت أفضل 4-6 مشاريع في الـPinned Repositories عشان تكون أول حاجة تظهر لأي حد يدخل بروفايلك. Commit messages واضحة أهم من عددهم."},
  {keys:["اتعلم برمجة","ابدأ برمجة","اتعلم اكواد","تعلم كوداينج","coding من الصفر"], a:"ابدأ بلغة واحدة بس (Python غالبًا أسهل بداية) وركّز على حل مسائل بسيطة بنفسك بدل ما تتفرج على شروحات كتير من غير تطبيق. بعد الأساسيات، اختار مسار واضح (ويب، موبايل، بيانات) بدل ما تتشتت بين كل حاجة مع بعض."},
  {keys:["اتعلم فلاتر","flutter","تطبيقات موبايل"], a:"Flutter كويس لو عايز تعمل تطبيق أندرويد وآيفون بكود واحد. ابدأ بموقع Flutter الرسمي (فيه Codelabs مجانية ومرتبة)، وبعد أساسيات Dart جرب تعمل تطبيق بسيط بجد (زي to-do list) بدل ما تفضل في الشروحات بس."},
  {keys:["ذكاء اصطناعي","اتعلم ai","machine learning","تعلم الآلة"], a:"ابدأ بأساسيات بايثون والرياضيات البسيطة (إحصاء، جبر خطي بسيط)، وبعدين كورس زي Andrew Ng على Coursera (فيه Financial Aid مجاني). اتعلم بالتطبيق على مشاريع حقيقية من Kaggle بدل النظري بس."},
  {keys:["امن سيبراني","cybersecurity","اتعلم هكر","اختراق اخلاقي"], a:"ابدأ بفهم الشبكات الأساسي (Cisco Networking Academy مجاني ومنظم)، وبعدين منصات زي TryHackMe أو Hack The Box للتطبيق العملي الآمن والقانوني. الشهادات المعروفة للمبتدئين زي CompTIA Security+ بتفتح أبواب كتير."},
  {keys:["تحليل بيانات","data analysis","اتعلم بيانات","data analyst"], a:"Excel وSQL هما الأساس اللي كل حد بيستخدمه فعليًا، متستعجلش عليهم. بعدين Python (pandas) أو Power BI/Tableau للتصور البصري. Kaggle Learn كورسات قصيرة وعملية جدًا لكل ده."},
  {keys:["تصميم جرافيك","graphic design","اتعلم تصميم","فوتوشوب"], a:"اتعلم أساسيات نظرية اللون والتايبوجرافي الأول قبل الأدوات نفسها — الأدوات (Canva وبعدين Photoshop/Illustrator) بتتعلم بسرعة، لكن الحس التصميمي بياخد وقت وممارسة. اتمرن بإعادة تصميم حاجات موجودة كتمرين مفيد جدًا."},
  {keys:["تسويق رقمي","digital marketing","اتعلم تسويق"], a:"ابدأ بـGoogle Digital Garage أو Google Skillshop (مجانيين وبشهادة معتمدة). افهم الفرق بين SEO والإعلانات المدفوعة والسوشيال ميديا الأول، وبعدين تخصص في واحد منهم بعمق."},
  {keys:["اتعلم انجليزي","تحسين انجليزي","english level","لغة انجليزية"], a:"الانغماس أهم من الدروس النظرية — غيّر لغة موبايلك للإنجليزي، وتفرج على محتوى بيهمّك أصلًا بالإنجليزي (مش تعليمي بس). للمحادثة، اتكلم مع نفسك بصوت عالٍ يوميًا ولو 5 دقايق، ده بيفرق أكتر مما تتخيل."},
  {keys:["دراسة بالخارج","study abroad","ادرس بره مصر"], a:"حدد الأول: عايز منحة كاملة ولا هتدفع، وعايز تدرس في بلد بلغة إيه. المنح الكاملة (زي DAAD الألمانية أو Chevening البريطانية) منافسة قوية فابدأ التحضير بدري (سنة قبلها على الأقل). شوف تبويب 'أدلة ومصادر' هنا فيه دليل جامعات مبدئي."},
  {keys:["اختار مجال","اي مجال احسن","مجال المستقبل","تخصص مطلوب"], a:"مفيش 'مجال أفضل' مطلق — اللي بيفرق هو تلاقي حاجة أنت كويس فيها وفي نفس الوقت السوق محتاجها. جرب حاجات فعليًا (مش تقرا عنها بس) قبل ما تلتزم، وخلي قرارك مبني على تجربة حقيقية ولو صغيرة."},
  {keys:["تفاوض على راتب","negotiate salary","المرتب"], a:"اعرف قيمتك في السوق قبل أي مقابلة (شوف مواقع زي Glassdoor لمرتبات مشابهة)، ومتقولش رقمك الأول إلا لو اتسألت. لو عرضولك رقم أقل من توقعك، اسأل بأدب لو فيه مجال للتفاوض بدل ما ترفض أو توافق على طول."},
  {keys:["بناء علاقات مهنية","networking","تواصل مهني"], a:"الشبكة المهنية بتتبني بمساعدة الناس مش بطلب حاجة منهم على طول — علّق بفايدة حقيقية على منشورات ليهم علاقة بمجالك، واحضر فعاليات أو ورش حتى لو أونلاين. أي تواصل اتكلم فيه، تابعه بعدها برسالة شكر قصيرة."},
  {keys:["دور على تدريب","internship","ابحث عن تدريب صيفي"], a:"ابدأ بالتقديم بدري (قبل الصيف بـ2-3 شهور للتدريبات الصيفية)، وقدّم على عدد كبير مش فرصة واحدة بس. شوف تبويب 'الفرص المقترحة' هنا، وتقدر تحدد حالة كل تقديم من تبويب 'متابعتي' عشان تتابع نفسك بسهولة."},
  {keys:["اجهز لمقابلة","مقابلة شخصية","interview","مقابلة عمل"], a:"جهّز 2-3 أمثلة حقيقية من خبرتك (STAR method: الموقف، المهمة، الإجراء، النتيجة) تقدر تستخدمها لأسئلة سلوكية مختلفة. اسأل هما كمان أسئلة في الآخر، ده بيوضح اهتمامك الحقيقي بالفرصة."},
  {keys:["اعمل بورتفوليو تقني","technical portfolio","مشاريع للسيرة الذاتية"], a:"اختار مشاريع بتحل مشكلة حقيقية (ولو بسيطة) بدل تمارين نظرية مكررة زي كل الناس. اكتب في وصف كل مشروع إيه التحدي اللي واجهته وإزاي حليته، مش بس التقنيات اللي استخدمتها."},
  {keys:["اختبار شخصيتي","اختبار الميول","assessment","اختبار القيادة","اختبار الوقت"], a:"عندنا تبويب كامل اسمه \"الاختبارات\" فيه اختبارات ثابتة (قيادة، إدارة وقت، إنتاجية، ميول مهنية، أسلوب تعلم) وكل واحد بياخد دقايق قليلة ونتيجته بتتحفظ في ملفك تلقائيًا."},
  {keys:["قصص نجاح","success stories","ناس نجحت","امثلة نجاح"], a:"معنديش قصص نجاح جاهزة أعرضها دلوقتي، بس تقدر تستوحي من الفرص المتاحة فعليًا في تبويب \"الفرص المقترحة\" وتشوف تجارب مشابهة لمسارك."},
  {keys:["اشعارات","notifications","جرس الاشعارات"], a:"دوس على أيقونة الجرس 🔔 في أعلى الصفحة، هتلاقي فيها تنبيهات لما فرصة متابعها تقرب على آخر موعد، أو لما تخلّص كورس وشهادتك تبقى جاهزة، بالإضافة لأي إعلانات عامة من إدارة المنصة."},
  {keys:["اتاخرت في اداء واجب","تسويف","procrastination","بأجل شغلي"], a:"جرب قاعدة الدقيقتين: لو أي مهمة هتاخد أقل من دقيقتين اعملها فورًا من غير تأجيل. للمهام الكبيرة، ابدأ بأصغر جزء ممكن منها (حتى لو 5 دقايق بس) عشان تكسر حاجز البداية، غالبًا هتكمل لوحدك بعدها."},
  {keys:["حرقان نفسي","burnout","تعبان نفسيا من الشغل","إرهاق دراسي"], a:"خد بريك حقيقي (مش موبايل)، حتى لو يوم واحد بس، وحدد أولوية واحدة تركّز عليها بدل ما تحس إنك لازم تخلّص كل حاجة مرة واحدة. لو الإرهاق مستمر لفترة طويلة ومأثر على حياتك، اتكلم مع حد تثق فيه أو مختص، مفيش داعي تكمل لوحدك."},
  {keys:["متلاق فرص خالص","مفيش فرص مناسبة","محبط من البحث عن شغل"], a:"جرب توسّع دائرة البحث شوية (فرص أونلاين أو في مدن تانية)، وراجع ملفك الشخصي وشوف لو محتاج تضيف مهارات أو اهتمامات جديدة عشان التوصيات تبقى أدق. الرفض جزء طبيعي جدًا من الرحلة، الاستمرارية هي اللي بتفرق في الآخر."},
  {keys:["امتحان قدرات","اختبار قدرات","standardized test","toefl","ielts","sat"], a:"حدد الاختبار اللي محتاجه فعليًا حسب الجهة اللي هتقدّم لها (IELTS/TOEFL للغة، SAT للجامعات الأمريكية)، وابدأ بامتحان تجريبي (Practice Test) الأول عشان تعرف نقاط ضعفك بالظبط قبل ما تذاكر عشوائي."},
  {keys:["اختار بين عرضين شغل","اقارن بين وظيفتين","job offer comparison"], a:"متقارنش بالمرتب بس — شوف فرص التعلم والنمو، وثقافة الفريق، والاستقرار المالي للشركة. لو الفرق بسيط، اختار اللي هيديك خبرة وتعلم أكتر على المدى الطويل مش أعلى رقم فورًا."},
  {keys:["ابني عادة جديدة","habit building","التزام يومي"], a:"اربط العادة الجديدة بحاجة بتعملها أصلًا كل يوم (زي بعد الصلاة أو بعد الفطار)، وابدأ بنسخة صغيرة جدًا منها الأول (5 دقايق بدل ساعة). الاستمرارية اليومية ولو بسيطة أهم من الكمال من أول يوم."},
  {keys:["فقدت الحماس","مش متحمس","motivation","فقدان الدافع"], a:"ارجع لسبب البداية بتاعتك — اكتبه بالورقة لو لازم. قسّم هدفك الكبير لخطوة صغيرة تقدر تنجزها النهارده بس، الإنجاز الصغير بيرجّع الحماس أسرع من التفكير في الهدف الكبير كله."},
  {keys:["اتعامل مع خلاف في فريق","نزاع جماعي","team conflict"], a:"ناقش المشكلة على أساس الفكرة أو الفعل مش الشخص نفسه، واسأل الطرف التاني يفهمك وجهة نظره الأول قبل ما تدافع عن رأيك. لو الخلاف كبير، ممكن تحتاج طرف ثالث محايد يساعد في الحل."},
  {keys:["دراسات عليا","ماجستير","masters degree","phd","دكتوراه"], a:"حدد الأول هدفك من الدراسات العليا: بحث علمي، تخصص أعمق، ولا فرصة هجرة؟ الإجابة بتحدد اختيارك للجامعة والتخصص. المنح للدراسات العليا (زي Fulbright وChevening وDAAD) بتحتاج تحضير مبكر جدًا، ابدأ قبلها بسنة على الأقل."},
  {keys:["امتياز جامعي","gap year","سنة فراغ بعد الثانوية"], a:"لو هتاخد سنة قبل الجامعة أو بعدها، خليها منظمة بهدف واضح (تعلم مهارة، شغل، تطوع) مش وقفة عشوائية. سجّل كل حاجة تعملها فيها، هتفيدك في الـCV وفي المقابلات لاحقًا."},
  {keys:["اعمل موقع شخصي","personal website","portfolio site"], a:"مش لازم موقع معقّد — صفحة بسيطة بـNotion أو Carrd (مجانيين) فيها بورتفوليوك ومعلومات التواصل كفاية جدًا في البداية. لو تقني، GitHub Pages مجاني برضو وسهل."},
  {keys:["فريلانس مصر","مستقل","خمسات","مواقع فريلانس عربي"], a:"مستقل وخمسات كويسين للبداية في السوق العربي لإنهم أسهل في القبول من المنصات العالمية، وبيبنولك تقييمات تقدر تستخدمها بعدين على Upwork. ابدأ بسعر منافس شوية في البداية عشان تبني سمعة."},
  {keys:["اتعلم git","جيت","version control","نسخ احتياطي للكود"], a:"Git أساسي لأي حد في البرمجة — اتعلم الأوامر الأساسية بس الأول (add, commit, push, pull) من موقع git رسمي أو قناة يوتيوب قصيرة، وطبّق على مشروعك الشخصي قبل ما تتعمق في الفروع (branches) المعقدة."},
  {keys:["استعد لتحدي برمجي","leetcode","مقابلة تقنية","technical interview"], a:"ابدأ بحل مسائل سهلة (Easy) على LeetCode أو HackerRank بانتظام بدل ما تحل صعبة من الأول وتحبط. ركّز على فهم طريقة التفكير في الحل مش حفظ الحل نفسه."},
  {keys:["اتعامل مع الرفض","اترفضت من فرصة","dealing with rejection"], a:"الرفض مش دايمًا بيعني إنك مش كويس — أحيانًا بيبقى فيه منافسة كبيرة أو الفرصة مش مناسبة أصلًا. اطلب Feedback لو ينفع، وشوف الرفض كخطوة في الطريق مش نهايته."},
  {keys:["اداب المهنية","بريد الكتروني رسمي","professional email"], a:"ابدأ بتحية مناسبة واذكر موضوع الإيميل في العنوان بوضوح، واخليه مختصر ومباشر. راجعه قبل الإرسال غلطة إملائية بسيطة ممكن تدي انطباع غير مرتب."},
  {keys:["دور على منتور","mentor","ابحث عن موجه"], a:"دور في مجالك على لينكدإن أو مجتمعات أونلاين (زي Discord أو مجموعات فيسبوك متخصصة)، وابدأ برسالة قصيرة محترمة توضح فيها إيه اللي بتحتاج مساعدة فيه بالظبط. مش كل حد هيوافق، وده طبيعي، جرب مع أكتر من شخص."},
  {keys:["توازن بين الدراسة والحياة","work life balance","وقت لنفسي"], a:"حدد وقت ثابت (ولو ساعة بس) يوميًا لنفسك بعيد عن الشغل والمذاكرة، وعامله زي أي التزام تاني ميتأجلش. التوازن مش رفاهية، هو اللي بيخليك تستمر بدون احتراق نفسي."},
  {keys:["ادارة فلوسي","تمويل شخصي","personal finance للطلاب"], a:"ابدأ بحاجة بسيطة: اكتب مصاريفك لمدة شهر بس عشان تعرف فلوسك بتروح فين. حاول تخصص جزء بسيط للادخار حتى لو صغير، العادة أهم من المبلغ في البداية."},
  {keys:["استخدم الذكاء الاصطناعي في المذاكرة","chatgpt للمذاكرة","ai tools للدراسة"], a:"استخدمه لتلخيص أو شرح مفهوم صعب بطريقة تانية، مش عشان يحل الواجب كامل بدالك — التعلم الحقيقي بيحصل لما إنت اللي بتفكر. اتأكد دايمًا من صحة المعلومة من مصدر موثوق كمان."},
  {keys:["مهارات العرض والتقديم","presentation skills","اعمل بريزنتيشن"], a:"ابدأ بفكرة واحدة رئيسية واضحة، ومتحمّلش السلايد بكلام كتير — الصور والنقاط القصيرة أقوى. اتمرن بصوت عالي 2-3 مرات قبل العرض الفعلي، التمرين بيقلل التوتر جدًا."},
  {keys:["مرونة نفسية","resilience","اتعامل مع الضغط"], a:"المرونة النفسية بتتبني بالتعرض التدريجي للتحديات الصغيرة، مش بتجنبها. لما تواجه موقف صعب، اسأل نفسك 'إيه اللي اتعلمته من ده' بدل ما تركز على الفشل نفسه بس."},
  {keys:["اختار مينور","minor جامعي","تخصص فرعي"], a:"اختار المينور اللي بيكمّل تخصصك الأساسي أو بيفتحلك مجال جديد بتحبه فعلًا، مش بس لأنه سهل. اسأل طلاب خلصوه قبلك عن رأيهم الحقيقي فيه."},
  {keys:["مهارات عرض تقني","demo","اعرض مشروعي"], a:"ابدأ بالمشكلة اللي مشروعك بيحلها قبل ما تتكلم عن التقنيات، الناس بتفهم القيمة أسرع كده. جهّز نسخة شغالة 100% للعرض، وتجنب أي جزء لسه فيه باجات وقت الديمو."},
  {keys:["اعمل سيرة ذاتية بدون خبرة","cv من غير خبرة عملية","fresh graduate cv"], a:"ركّز على المشاريع الجامعية والتطوع والأنشطة اللامنهجية بدل الخبرة العملية اللي لسه مبنيتهاش. اذكر المهارات اللي اكتسبتها من كل نشاط بالتحديد مش وصف عام."},
  {keys:["اتصرف في مقابلة عن بعد","remote interview","مقابلة اونلاين"], a:"جرّب الكاميرا والصوت والنت قبل الميعاد بربع ساعة على الأقل، واختار مكان هادي بإضاءة كويسة. بص في الكاميرا مش في الشاشة وانت بتتكلم عشان يحس التواصل بصري بمن قدامك."},
  {keys:["اعمل خطة مذاكرة اسبوعية","جدول مذاكرة","study schedule"], a:"وزّع المواد الصعبة على أوقات تركيزك الأعلى في اليوم (صباحًا لمعظم الناس)، واسيب وقت مرن للمراجعة في آخر الأسبوع. جدول واقعي بتلتزم بيه أحسن من جدول مثالي بتكسره كل يوم."},
  {keys:["اعمل نيتوركينج في فعالية","conference networking","مؤتمر"], a:"جهّز جملة قصيرة تعرّف بيها نفسك ومجالك قبل ما تروح، وحاول تسأل أسئلة حقيقية بدل ما تنتظر دورك تتكلم بس. تابع أي حد اتكلمت معه برسالة بعد الفعالية بيوم أو اتنين."},
  {keys:["قلق من الامتحانات","exam anxiety","خايف من الامتحان"], a:"ذاكر بالتكرار المتباعد (Spaced Repetition) بدل المذاكرة كلها ليلة الامتحان، ده بيقلل القلق جدًا لإنك واثق فعلًا من إنك مذاكر صح. تمارين تنفس بسيطة قبل الامتحان بدقايق بتساعد كمان."},
  {keys:["اتعامل مع امتحان اونلاين","online exam","proctored exam"], a:"اقرا تعليمات الامتحان كويس قبلها بيوم، وجهّز مكانك ونتك من الأول. لو فيه مشكلة تقنية وقت الامتحان، بلّغ المسؤولين فورًا وخد سكرين شوت لو تقدر."},
  {keys:["اعمل خطة انتقالية بعد التخرج","بعد التخرج اعمل ايه","ماذا بعد التخرج"], a:"حدد أولوية واحدة الأول: شغل، دراسات عليا، ولا تعلم مهارة جديدة، مش لازم كل حاجة مرة واحدة. استخدم تبويب 'خطة التطوير الشخصية' لو متاح عندك عشان يديك خطوات واضحة."},
  {keys:["اتعلم عرض افكار","pitch","اعرض فكرة مشروع"], a:"في أول 30 ثانية وضّح المشكلة والحل بجملتين بس، الناس بتفقد التركيز بسرعة لو الافتتاحية طويلة. اقفل دايمًا بطلب واضح (تمويل، تعاون، فرصة) مش كلام عام."},
  {keys:["اعمل شبكة علاقات في الجامعة","تعرف على ناس جديدة كلية","university friends"], a:"انضم لنادي أو نشاط طلابي بيهمّك فعلًا بدل ما تنتظر الصداقات تيجي لوحدها. أول أسبوعين في أي مرحلة جديدة أهم وقت لبناء العلاقات، خد خطوة أولى ولو صعبة شوية."},
  {keys:["اختار شركة اتقدم فيها","اختار جهة عمل","company research"], a:"شوف تقييمات الموظفين على Glassdoor أو LinkedIn، واسأل لو تعرف حد شغال هناك عن ثقافة الشركة الحقيقية. المرتب مهم بس بيئة العمل والفرصة للتعلم بيفرقوا أكتر على المدى الطويل."},
  {keys:["اعمل استعداد لهاكاثون","hackathon prep","مشاركة في هاكاثون"], a:"جهّز فريق متكامل المهارات (برمجة، تصميم، عرض) قبل الهاكاثون لو تقدر، ووزّعوا الأدوار بدري. ركّزوا على حل بسيط شغال 100% بدل فكرة معقدة نص شغالة وقت العرض."},
  {keys:["اتعلم مهارة تفاوض","negotiation skills","تفاوض عام"], a:"جهّز البدائل بتاعتك قبل أي تفاوض (إيه اللي هتعمله لو ماوافقوش)، ده بيدّيك ثقة أكتر. اسمع أكتر ما تتكلم، وغالبًا هتلاقي حل وسط مايكونش واضح من الأول."},
  {keys:["اعمل خطة بديلة","plan b","لو الخطة الاولى فشلت"], a:"وجود خطة بديلة مش معناه إنك مش واثق، ده تخطيط ذكي. حدد نقطة زمنية واضحة تقيّم فيها لو الخطة الأولى ماشية صح ولا وقت التحول للبديلة."},
  {keys:["اعمل سيرة ذاتية بالانجليزي","english cv","cv in english"], a:"خلي الصياغة بسيطة ومباشرة، وابعد عن الترجمة الحرفية من العربي. أفعال قوية في بداية كل نقطة (Led, Built, Managed) بتدّي انطباع أقوى من جمل عامة."},
  {keys:["اتعامل مع فشل مشروع","failed project","مشروعي فشل"], a:"حلّل بصراحة إيه اللي كان ممكن يتعمل بشكل مختلف، ده جزء أساسي من التعلم مش مجرد إحباط. المشاريع اللي بتفشل غالبًا بتعلّم أكتر من اللي بتنجح بسهولة."},
  {keys:["اعمل جدول اهداف سنوي","خطة سنة","yearly goals"], a:"حدد 2-3 أهداف كبيرة بس للسنة (مش قايمة طويلة هتفقد التركيز)، وقسّمهم لأهداف ربع سنوية أصغر تقدر تتابعها بسهولة. راجع تقدمك كل شهر."},
  {keys:["اتعامل مع نقد سلبي","negative feedback","انتقاد لشغلي"], a:"افصل بين نقد الشغل ونقد شخصك — النقد الموجّه للعمل مش هجوم عليك كشخص. اسأل أسئلة توضيحية لو مش فاهم النقد كويس بدل ما ترد دفاعيًا على طول."},
  {keys:["اعمل استعداد لمقابلة جماعية","group interview","assessment center"], a:"في المقابلات الجماعية، الهدف إنك تتعاون وتسمع رأي غيرك مش تسيطر على النقاش. اقترح أفكار بس سيب مساحة للباقيين يشاركوا برضو."},
  {keys:["اتعلم عرض بيانات","data visualization","اعرض بياناتي"], a:"اختار نوع الرسم البياني المناسب للبيانات (مقارنة، اتجاه، توزيع) قبل ما تفكر في الشكل الجمالي. Power BI أو حتى Excel كافيين جدًا للبداية قبل أدوات معقدة."},
  {keys:["اعرف نقاط قوتي وضعفي","strengths and weaknesses","اعرف نفسي"], a:"اسأل 3 أشخاص تثق فيهم يوصفوك بصفتين بس، هتلاقي نمط متكرر بيوضحلك نقاط قوتك الحقيقية. اختبار 'الميول المهنية' في تبويب الاختبارات ممكن يساعدك كمان."},
  {keys:["اتعلم كتابة محتوى","content writing","صناعة محتوى"], a:"ابدأ بالكتابة عن حاجة بتحبها وتعرفها فعلًا، الأصالة بتبان في الكتابة. اقرا كتير في المجال اللي هتكتب فيه، القراءة بتحسّن الكتابة أكتر من أي كورس."},
  {keys:["اتعلم مونتاج فيديو","video editing","تحرير فيديو"], a:"CapCut مجاني وسهل جدًا للبداية على الموبايل، وDaVinci Resolve مجاني وقوي لو عايز حاجة احترافية على الكمبيوتر. ابدأ بفيديوهات قصيرة بسيطة قبل مشاريع معقدة."},
  {keys:["اعمل CV بالذكاء الاصطناعي","توليد سيرة ذاتية","AI CV"], a:"من تبويب 'ملفي' تقدر تولّد CV احترافي بضغطة واحدة، والذكاء الاصطناعي بيحسّن صياغة أهدافك وإنجازاتك تلقائيًا. اكتب بياناتك بالتفصيل الأول في الملف الشخصي عشان النتيجة تبقى أدق."},
  {keys:["اختار بين شركة كبيرة او ناشئة","startup vs corporate","شركة ناشئة"], a:"الشركات الناشئة بتديك خبرة متنوعة ومسؤولية أسرع بس استقرار أقل، والشركات الكبيرة بتديك نظام وتدريب واضح بس نمو أبطأ أحيانًا. اختار حسب اللي محتاجه في المرحلة دي من مسارك."},
  {keys:["اعمل عرض تقديمي للمنحة","scholarship interview","مقابلة منحة"], a:"وضّح ليه المنحة دي بالذات مهمة ليك، واربطها بخطة واضحة لمستقبلك بعد ما تخلصها. جهّز أمثلة حقيقية على إنجازاتك وأنشطتك تدعم كلامك."},
  {keys:["اعمل استعداد لمسابقة","competition prep","اتنافس في مسابقة"], a:"افهم معايير التحكيم بالظبط قبل ما تبدأ الشغل، وركّز وقتك على النقط اللي ليها وزن أكبر في التقييم. اطلب رأي حد بره الفريق يشوف شغلكم بعين جديدة قبل التسليم."},
  {keys:["اعمل بريك من السوشيال ميديا","digital detox","تقليل وقت الموبايل"], a:"جرب تحدد وقت معين في اليوم للسوشيال ميديا بدل الدخول العشوائي المستمر، وقفّل الإشعارات غير الضرورية. هتلاحظ فرق في التركيز والطاقة خلال أسبوع بس."},
  {keys:["اعمل متابعة بعد مقابلة شغل","follow up interview","تابع بعد المقابلة"], a:"ابعت رسالة شكر قصيرة خلال يوم أو اتنين من المقابلة، تفتكر فيها حاجة محددة اتكلمتوا عنها. لو ماردوش خلال المدة اللي اتفقتوا عليها، تواصل مرة واحدة بأدب تسأل عن الموقف."},
  {keys:["اعمل خطة لتعلم لغة تانية","اتعلم لغة جديدة","new language learning"], a:"ابدأ بـ100-200 كلمة أساسية بس وجمل يومية بسيطة قبل القواعد المعقدة. تطبيقات زي Duolingo كويسة للاستمرارية، لكن الممارسة الفعلية مع متحدثين أصليين (حتى أونلاين) بتسرّع التعلم كتير."}
];
// تطبيع النص العربي قبل المطابقة — بيوحّد أشكال الألف/الياء/التاء المربوطة،
// وبيشيل التشكيل و"ال" التعريف من أول كل كلمة. من غير الخطوة دي، أسئلة زي
// "طور لغتي الإنجليزية" أو "كيف أبدأ الذكاء الاصطناعي" كانت مش بتتطابق مع
// قاعدة المعرفة (لأن "الإنجليزية" != "انجليزي"، و"الذكاء الاصطناعي" != "ذكاء
// اصطناعي" في مقارنة نصية حرفية) فيرجع المساعد رد "مش قادر أتعرف" غلط رغم إن
// المعرفة موجودة أصلًا. المساعد لسه مش AI حقيقي — بس قاعدة مطابقة أذكى.
function normalizeAr(s){
  return (s||"").toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g,"")
    .replace(/[إأآا]/g,"ا")
    .replace(/ى/g,"ي")
    .replace(/ة/g,"ه")
    .replace(/ؤ/g,"و")
    .replace(/ئ/g,"ي")
    .replace(/(^|\s)ال/g,"$1")
    .replace(/\s+/g," ")
    .trim();
}
function localAssistantReply(rawMessage){
  const message = (rawMessage||"").trim();
  const lower = message.toLowerCase();
  const normMsg = normalizeAr(message);
  const p = state.profile || {};
  const has = (...words) => words.some(w=>normMsg.includes(normalizeAr(w)));

  const topMatches = state.opportunities
    .map(o=>({o, score: calcMatch(p,o).score}))
    .sort((a,b)=>b.score-a.score).slice(0,3);
  const matchesText = topMatches.length
    ? topMatches.map(x=>`• ${x.o.title} (${CATEGORIES[x.o.category]||x.o.category}، تطابق ${x.score}%)`).join("\n")
    : "لسه مفيش فرص محمّلة على المنصة دلوقتي.";

  if(has("سلام","اهلا","أهلا","هاي","هلا","صباح الخير","مساء الخير")){
    const firstName = (p.name||"").split(" ")[0];
    return `أهلاً ${firstName||""}! 👋 اسألني عن "فرص مناسبة ليا"، "إزاي أحسّن الـCV"، أو أي سؤال عن تطوير مسارك المهني وهرد عليك فورًا.`;
  }
  if(has("فرصة","فرص","منحة","منح","تدريب","وظيفة","وظايف","وظائف","مسابقة","تطوع")){
    return `أقرب الفرص المناسبة ليك دلوقتي حسب ملفك الشخصي:\n${matchesText}\n\nافتح تفاصيلها وقدّم من تبويب "الفرص المقترحة".`;
  }
  if(has("cv","سيرة ذاتية","سي في","سيرتي")){
    return `تقدر تحمّل CV احترافي بضغطة واحدة من تبويب "ملفي" — نسخة تصميم مميز، ونسخة ATS بسيطة. الذكاء الاصطناعي بيحسّن صياغة الهدف المهني والإنجازات تلقائيًا وقت التحميل. لو عايز نتيجة أحسن، اكتب أهدافك وإنجازاتك بالتفصيل الأول من "تعديل الملف الشخصي".`;
  }
  if(has("اتعلم","كورس","كورسات","مهارة","مهارات","اتطور","تعلم")){
    return `تلاقي محتوى تعليمي مجاني في تبويب "مركز التعلم" — مقسّم لنصائح صغيرة سريعة، كورسات كاملة (بتاخد شهادة إتمام بعد ما تخلصها)، ونصائح عملية بفيديوهات أطول. اختار حسب الوقت اللي عندك.`;
  }
  if(has("شهادة","شهادات","سيرتفكيت")){
    return `الشهادات بتطلع بس من الكورسات في "مركز التعلم" — أول ما تخلّص كل فيديوهات الكورس، زرار تحميل الشهادة بيظهر تلقائي، واسمك بيتحط عليها زي ما هو مكتوب في ملفك الشخصي.`;
  }
  if(has("شكرا","تمام","تسلم","حلو","ممتاز")){
    return "العفو! 🙌 لو محتاج أي حاجة تانية أنا موجود.";
  }
  if(has("مين انت","انت مين","بوت")){
    return "أنا المساعد بتاع NextStep AI — بساعدك تلاقي فرص وتطوّر مسارك المهني بناءً على بياناتك وبيانات الفرص المتاحة فعليًا على المنصة، وردودي جاهزة ومحفوظة (مش ذكاء اصطناعي توليدي).";
  }
  // قاعدة المعرفة الموسّعة — بندوّر فيها بعد الأسئلة المخصصة لبيانات المنصة
  for(const entry of ASSISTANT_KB){
    if(has(...entry.keys)) return entry.a;
  }
  return `مش متأكد إني فاهم قصدك بالظبط 🙂 جرب تسأل عن حاجة زي: فرص مناسبة ليك، تحسين الـCV، تعلم مهارة معينة، تنظيم وقتك، الاستعداد لمقابلة شغل، أو الشهادات — أو تصفح مباشرة من تبويبي "الفرص المقترحة" و"مركز التعلم".`;
}
async function sendChatMessage(text){
  if(!text.trim()) return;
  state.chatMessages.push({role:"user", text:text.trim()});
  state.chatBusy = true; render();
  await new Promise(r=>setTimeout(r, 220)); // تأخير بسيط بس عشان يحس إن المساعد "بيفكر"
  state.chatMessages.push({role:"assistant", text: localAssistantReply(text.trim())});
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
// بيدوّر على بداية أول [ ويقرا objects كاملة بس (زوج { } متوازن) لحد ما ياخد
// كل اللي كامل، ويسيب أي جزء اتقطع في نص الرد (بسبب MAX_TOKENS) من غير ما
// يفشل العملية كلها — بدل ما نرجّع خطأ ونضيّع كل النتائج علشان فرصة واحدة بس
// اتقطعت في النص.
function extractCompleteJsonObjects(text){
  const start = text.indexOf("[");
  if(start===-1) return [];
  let depth=0, objStart=-1;
  const objs = [];
  for(let i=start+1;i<text.length;i++){
    const ch = text[i];
    if(ch==="{"){ if(depth===0) objStart=i; depth++; }
    else if(ch==="}"){
      depth--;
      if(depth===0 && objStart!==-1){
        try{ objs.push(JSON.parse(text.slice(objStart, i+1))); }
        catch(e){ /* الجزء ده مش JSON صحيح، تجاهله واكمل اللي بعده */ }
        objStart=-1;
      }
    }
  }
  return objs;
}
// بيرجّع حد الاستخدام اليومي الحالي للأدمن من غير ما يستهلك أي حصة — بنستدعيها
// أول ما لوحة البحث بالـAI تتفتح عشان الأدمن يشوف كام طلب متبقّي قبل ما يبدأ.
async function loadAiQuotaStatus(){
  state.aiQuotaLoading = true; render();
  try{
    const res = await fetch(GEMINI_PROXY_URL, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({action:"quotaStatus", uid: state.user && state.user.uid, email: state.user && state.user.email})
    });
    const data = await res.json();
    state.aiQuota = res.ok ? data : null;
  }catch(e){ state.aiQuota = null; }
  finally{ state.aiQuotaLoading = false; render(); }
}
// خرائط "نوع البحث" لمقدار الدقة/عدد الـtokens المسموح بيهم — عشان "سريع" ياخد
// وقت وحصة أقل، و"عميق جدًا" يدّي الـAI مساحة أكبر يتأكد فيها من كل تفصيلة.
const SEARCH_DEPTH_CONFIG = {
  quick:    {maxOutputTokens: 4096, verify: "افتح المصدر الأساسي وتأكد بسرعة إنه حقيقي."},
  deep:     {maxOutputTokens: 8192, verify: "افتح فعليًا (عن طريق البحث) صفحة كل فرصة قبل ما ترشحها، وتأكد إنها حقيقية وموجودة فعلًا."},
  very_deep:{maxOutputTokens: 8192, verify: "افتح فعليًا (عن طريق البحث) صفحة كل فرصة قبل ما ترشحها، وتأكد من الرابط والـdeadline من أكتر من مصدر لو أمكن — دقة التفاصيل هنا أهم من عدد النتائج."}
};
async function fetchAiOpportunities(topic, opts){
  opts = opts || {};
  const model = opts.model || state.searchModel || "gemini-3.5-flash";
  const depth = SEARCH_DEPTH_CONFIG[opts.depth || state.searchDepth] || SEARCH_DEPTH_CONFIG.deep;
  const resultCount = opts.resultCount || state.searchResultCount || 15;
  const todayStr = new Date().toISOString().slice(0,10);
  const currentYear = new Date().getFullYear();
  // بعد المراجعة: البحث اليدوي ده كان شغال "من معرفة الـAI بس" من غير أي بحث حي
  // فعلي خالص (على عكس البحث التلقائي اليومي اللي شغال بـgoogle_search حقيقي) —
  // وده كان السبب الحقيقي وراء الروابط الضعيفة/المختلقة والـdeadlines الناقصة.
  // دلوقتي بقى بيستخدم بحث جوجل حي فعليًا زي البحث التلقائي بالظبط.
  const prompt = `النهاردة تاريخ ${todayStr} (يعني إحنا في سنة ${currentYear}). استخدم بحث جوجل الحقيقي والحي دلوقتي (متعتمدش على معرفتك القديمة بس) عشان تلاقي لحد ${resultCount} فرصة حقيقية ومعروفة ومناسبة لموضوع: "${topic}"، تستهدف طلاب أو خريجين مصريين أو فرص دولية متاحة لهم.
"فرصة" = منحة/تدريب/وظيفة/تطوع/مسابقة/هاكاثون/تبادل/كورس مجاني/بوت كامب/مؤتمر — حسب الموضوع، مش بس منح.
شروط مهمة:
- ${depth.verify}
- رشّح بس برامج مستقرة معروفة. متختلقش اسم جهة أو برنامج مش متأكد من وجوده الحقيقي.
- الرابط لازم يكون رابط حقيقي من نتيجة البحث بتاعتك، مش رابط مخترع.
- لو لقيت تاريخ deadline حقيقي ومؤكد من المصدر، اكتبه بصيغة YYYY-MM-DD. لو مش لاقي تاريخ واضح، اكتب "غير معلن" بالظبط (متسيبهوش فاضي، ومتخمّنش تاريخ).
- استخرج "startDate" (تاريخ بداية البرنامج/الفرصة) لو موجود بصيغة YYYY-MM-DD، وسيبه "" لو غير معروف.
- استخرج "country" (الدولة اللي الفرصة فيها أو مستهدفاها، زي "مصر" أو "دولي/عن بُعد")، وسيبه "" لو غير واضح.
- لكل فرصة حدد "tags" (1-4 من: [${TAGS.map(t=>`"${t}"`).join(", ")}]) و"stageTags" (من: ["middle","high","university","graduate"]، أو [] لو للكل).
رجّع JSON array بس من غير أي نص زيادة، بالشكل ده: [{"title":"","organization":"","description":"وصف سطرين بالعربي","category":"scholarship أو internship أو job أو volunteering أو competition أو conference أو hackathon أو exchange أو course أو bootcamp أو event","deadline":"YYYY-MM-DD أو غير معلن","startDate":"YYYY-MM-DD أو فاضي","country":"اسم الدولة أو فاضي","link":"","tags":[],"stageTags":[]}]
لو مش متأكد إن الفرصة حقيقية، متضيفهاش. لو مفيش فرص كفاية رجّع [].`;
  try{
    // مهلة 90 ثانية + إعادة محاولة تلقائية مرة — الطلب ده بقى بيولّد لحد 15 فرصة
    // (كان 5) مع بحث حي فعلي، وده بياخد وقت أطول من قبل. رفعنا maxOutputTokens
    // لـ8192 (كان 4096) عشان يستحمل عدد الفرص الأكبر من غير ما يتقطع في النص.
    const result = await callAiProxy("", {
      contents:[{role:"user", parts:[{text:prompt}]}],
      tools:[{google_search:{}}],
      generationConfig: {maxOutputTokens: depth.maxOutputTokens},
      model
    }, {timeoutMs:90000, retries:1});
    if(!result.ok){
      if(result.reason==="quota") return {error: result.message || "⚠️ وصلت للحد اليومي لاستخدام البحث الذكي، جرب تاني بكرة."};
      if(result.reason==="timeout") return {error: `${result.message} جرب موضوع بحث أبسط لو استمرت المشكلة.`};
      if(result.reason==="network") return {error: "مقدرتش أوصل للخدمة دلوقتي، تأكد من الإنترنت وجرب تاني."};
      return {error: (result.message || "خطأ غير معروف") + extractQuotaDetail(result.data)};
    }
    const data = result.data;
    const cand = data && data.candidates && data.candidates[0];
    const text = cand && cand.content && cand.content.parts && cand.content.parts.map(p=>p.text||"").join("") || "";
    const gm = cand && cand.groundingMetadata;
    const sources = (gm && gm.groundingChunks || []).map(c=>c.web).filter(Boolean);
    // ملحوظة مهمة: uri الرجعة من groundingChunks بتكون رابط تحويل (redirect) بتاع
    // Google مش الدومين الحقيقي بتاع المصدر — الاسم الحقيقي موجود في title بس.
    // (ده كان باگ موجود هنا من قبل، بيخلي فلتر الأمان تحت مبيعملش حاجة خالص).
    const sourceHosts = [...new Set(sources.map(s=>(s.title||"").toLowerCase().replace(/^www\./,"")).filter(Boolean))];
    const searchEntryHtml = gm && gm.searchEntryPoint && gm.searchEntryPoint.renderedContent || "";
    if(!text){
      const diag = cand ? `finishReason: ${cand.finishReason||"?"}` : `blockReason: ${(data.promptFeedback&&data.promptFeedback.blockReason)||"?"}`;
      return {error:`الـAI ماردش خالص. [تشخيص: ${diag}]`};
    }
    // بنحاول الأول نقرا الـJSON كامل زي ما هو. لو الرد اتقطع في النص (زي ما بيحصل
    // مع finishReason: MAX_TOKENS)، مش هيبقى فيه ] قافلة فمش هيتلاقى match، أو
    // ممكن يتلاقى بس يبقى ناقص — في الحالتين بنلجأ لـextractCompleteJsonObjects
    // اللي بتاخد بس الفرص اللي اتكتبت كاملة وتسيب الجزء المقطوع بدل ما تفشل كله.
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    let items = null;
    if(jsonMatch){
      try{ items = JSON.parse(jsonMatch[0]); }catch(e){ items = null; }
    }
    if(!items) items = extractCompleteJsonObjects(text);
    if(!items.length){
      if(cand && cand.finishReason==="MAX_TOKENS"){
        return {error:"الرد اتقطع من الـAI لإنه كان طويل قوي، ومحصلش حتى فرصة واحدة كاملة. جرب موضوع بحث أضيق (مثلاً فرصة نوع واحد بدل موضوع عام)."};
      }
      const diag = `finishReason: ${(cand&&cand.finishReason)||"?"}`;
      return {error:`الـAI مرجعش نتايج واضحة. [تشخيص: ${diag}]`};
    }
    // فلتر إضافي من عندنا: نرفض أي فرصة موعدها فات (بس لو الموعد مكتوب بصيغة تاريخ
    // فعلية — "غير معلن" بيعدي زي ما هو من غير رفض) أو مالهاش رابط حقيقي.
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
    const truncatedNote = cand && cand.finishReason==="MAX_TOKENS"
      ? `ملحوظة: رد الـAI اتقطع لإنه كان طويل، فظهرلك ${items.length} فرصة بس (اللي اتقطعت اتشالت تلقائيًا، مش هتشوف بيانات ناقصة).`
      : "";
    return {items, sources, searchEntryHtml, note: truncatedNote};
  }catch(err){
    console.error("fetchAiOpportunities: unexpected error:", err);
    return {error:"حصلت مشكلة غير متوقعة أثناء قراءة نتيجة البحث، جرب تاني."};
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
  // بدل ما نحمّل iframe اليوتيوب فورًا (وده اللي كان بيسبب الشاشة السودة الطويلة
  // خصوصًا لما بيبقى فيه كذا فيديو في نفس صفحة الكورس بيتحمّلوا مع بعض)، بنعرض
  // صورة مصغّرة خفيفة من يوتيوب (بتحمّل فورًا) مع زرار تشغيل — والفيديو الفعلي
  // (iframe) ما بيتحمّلش خالص لحد ما المستخدم يدوس تشغيل. ده أسرع تحميل ممكن
  // فعليًا (Lazy Loading حقيقي 100%) من غير أي تأثير على جودة الفيديو نفسه.
  const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return `<div class="video-facade" data-action="load-video" data-yid="${id}" style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden;margin:10px 0;background:#000 url('${thumb}') center/cover no-repeat;cursor:pointer;">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,25,30,.28);">
      <div style="width:62px;height:62px;border-radius:50%;background:rgba(10,25,30,.72);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.3);">
        <div style="width:0;height:0;border-top:13px solid transparent;border-bottom:13px solid transparent;border-left:20px solid #fff;margin-right:-4px;"></div>
      </div>
    </div>
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
  // منع تشغيل أكتر من عملية AI إدارية (بحث/تصنيف/تنظيف) في نفس الوقت — طلب
  // صريح إنهم يشتغلوا واحد ورا التاني مش مع بعض، وده كمان بيقلل التعليق.
  if(state.searchBusy){
    state.adminMsg = "فيه عملية AI تانية شغالة دلوقتي (بحث/تصنيف/تنظيف) — استناها تخلص الأول.";
    render(); setTimeout(()=>{ state.adminMsg=""; render(); }, 4000); return;
  }
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
  // try/finally هنا مهم: لو أي حاجة فشلت (حتى loadOpportunities في الآخر)، لازم
  // state.searchBusy ترجع false برضه، وإلا الزرار هيفضل عالق "بيصنّف..." للأبد
  // وهو أصلًا مش شغال — ده بالظبط اللي كان بيحصل قبل كده.
  try{
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
      const result = await callAiProxy("", { contents:[{role:"user", parts:[{text:prompt}]}] }, {timeoutMs:60000, retries:1});
      if(!result.ok){
        state.adminMsg = (totalFixed>0 ? `تم تصنيف ${totalFixed} فرصة قبل ما يحصل خطأ: ` : "") + (result.message || "حصل خطأ أثناء التصنيف.");
        break;
      }
      const data = result.data;
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
      if(untagged.length>0) await new Promise(r=>setTimeout(r, 1500)); // مسافة بسيطة بين الدفعات عشان منزحمش حصة الـAPI المشتركة
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
  }catch(err){
    console.error("bulkFixOpportunityTags outer error:", err);
    state.adminMsg = (totalFixed>0 ? `تم تصنيف ${totalFixed} فرصة قبل ما يحصل خطأ غير متوقع.` : "حصل خطأ غير متوقع، جرب تاني.");
  }finally{
    state.searchBusy=false; render();
    setTimeout(()=>{ state.adminMsg=""; render(); }, 6000);
  }
}
// بتنضّف الفرص المكررة (نفس الرابط بالظبط) تلقائيًا وأوتوماتيك من غير AI خالص
// (مقارنة رابط بالظبط — آمنة 100%)، وبعدين بتبعت الباقي للـAI عشان يكتشف أي
// فرص شكلها مكرر بمعنى تاني (نفس الفرصة بصياغة مختلفة) أو وهمية/غير منطقية،
// وبتمسحهم على طول من غير مراجعة يدوية زي ما طلبت. بتشتغل على دفعات لحد ما
// تراجع كل الفرص الموجودة.
const FAKE_CHECK_BATCH_SIZE = 50;
async function cleanupFakeAndDuplicateOpportunities(){
  if(!isAdmin()) return;
  if(state.searchBusy){
    state.adminMsg = "فيه عملية AI تانية شغالة دلوقتي (بحث/تصنيف/تنظيف) — استناها تخلص الأول.";
    render(); setTimeout(()=>{ state.adminMsg=""; render(); }, 4000); return;
  }
  state.searchBusy = true; state.adminMsg = "بيراجع الفرص..."; render();
  let removedExact = 0, removedByAi = 0;
  // try/finally عشان state.searchBusy ترجع false دايمًا حتى لو حصل خطأ غير
  // متوقع في أي خطوة (حتى في loadOpportunities الأخيرة)، وميفضلش الزرار عالق.
  try{

  // الخطوة 1: تكرار بنفس الرابط بالظبط — حذف مباشر وأكيد 100%، من غير AI.
  const seenLinks = new Map();
  const exactDupIds = [];
  for(const o of state.opportunities){
    const key = (o.link||"").trim().toLowerCase();
    if(!key) continue;
    if(seenLinks.has(key)) exactDupIds.push(o.id);
    else seenLinks.set(key, o.id);
  }
  for(const id of exactDupIds){
    try{ await deleteDoc(doc(db,"opportunities", id)); removedExact++; }
    catch(err){ console.error("cleanup exact-dup delete error:", err); }
  }
  await loadOpportunities();

  // الخطوة 2: مراجعة بالـAI لباقي الفرص — تكرار بصياغة مختلفة أو فرص وهمية/غير منطقية.
  let remaining = [...state.opportunities];
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
      const result = await callAiProxy("", { contents:[{role:"user", parts:[{text:prompt}]}] }, {timeoutMs:60000, retries:1});
      if(!result.ok) break;
      const data = result.data;
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
      if(remaining.length>0) await new Promise(r=>setTimeout(r, 1500)); // مسافة بسيطة بين الدفعات عشان منزحمش حصة الـAPI المشتركة
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
  }catch(err){
    console.error("cleanupFakeAndDuplicateOpportunities outer error:", err);
    state.adminMsg = (removedExact+removedByAi)>0 ? `اتحذف ${removedExact+removedByAi} فرصة قبل ما يحصل خطأ غير متوقع.` : "حصل خطأ غير متوقع، جرب تاني.";
  }finally{
    state.searchBusy=false; render();
    setTimeout(()=>{ state.adminMsg=""; render(); }, 6000);
  }
}
async function searchForOpportunities(topic){
  if(state.searchBusy){
    state.searchErr = "فيه عملية AI تانية شغالة دلوقتي (بحث/تصنيف/تنظيف) — استناها تخلص الأول.";
    render(); return;
  }
  state.searchBusy = true; state.searchErr=""; state.searchNote=""; state.lastFoundItems=[]; render();
  try{
    const result = await fetchAiOpportunities(topic);
    if(result.error){ state.searchErr = result.error; return; }
    // منع التكرار: نتجاهل أي فرصة رابطها موجود بالفعل في قاعدة البيانات (بدل ما
    // نضيفها تاني بنفس الرابط)، بنفس منطق البحث التلقائي اليومي بالظبط.
    const existingLinks = new Set(state.opportunities.map(o=>(o.link||"").trim().toLowerCase()));
    const newItems = result.items.filter(it=>!existingLinks.has((it.link||"").trim().toLowerCase()));
    const skippedCount = result.items.length - newItems.length;
    const writes = newItems.map(it=>{
      const safeTags = Array.isArray(it.tags) ? it.tags.filter(t=>TAGS.includes(t)) : [];
      const validStages = STAGES.map(s=>s.id);
      const safeStages = Array.isArray(it.stageTags) ? it.stageTags.filter(s=>validStages.includes(s)) : [];
      return addDoc(collection(db,"opportunities"), {
        title: it.title||"بدون عنوان", organization: it.organization||"", description: it.description||"",
        category: it.category||"event", deadline: it.deadline||"غير معلن", startDate: it.startDate||"", country: it.country||"", link: it.link||"",
        tags: safeTags, stageTags: safeStages, requirements:[], reviewed:true,
        groundingSources: result.sources, searchEntryPointHtml: result.searchEntryHtml, createdAt: Date.now()
      });
    });
    await Promise.all(writes);
    await loadOpportunities();
    state.searchTopic="";
    const truncNote = result.note ? result.note + " " : "";
    const skipNote = skippedCount>0 ? `تم تجاهل ${skippedCount} فرصة كانت موجودة بالفعل على المنصة.` : "";
    state.searchNote = (truncNote + skipNote).trim();
    // بنعرض للأدمن قايمة بالفرص الجديدة اللي الـAI لقاها ودخلها فعليًا على طول
    // (من غير ما نحتاج موافقة لكل فرصة لوحدها) — عشان يشوفها ويراجعها بسرعة
    // بدل ما يدور عليها وسط كل الفرص التانية.
    state.lastFoundItems = newItems;
  }catch(err){
    console.error("searchForOpportunities error:", err);
    state.searchErr = "حصل خطأ غير متوقع أثناء حفظ الفرص، جرب تاني.";
  }finally{
    state.searchBusy=false; render();
  }
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
      ${o.featured?`<span class="badge-verified" style="background:#FDF3E2;color:#8A5B10;">⭐ فرصة مميزة</span>`:""}
      ${o.reviewed?`<span class="badge-verified">✅ تم التحقق</span>`:""}
      <h2 style="font-size:19px;font-weight:800;margin:10px 0 2px;">${escapeHtml(o.title)}</h2>
      <div class="opp-org">${escapeHtml(o.organization||"")}</div>
      <div class="opp-deadline ${dl.urgent?"urgent":"normal"}" style="margin-top:6px;">${dl.text}</div>
      ${(o.country||o.startDate)?`<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:12.5px;color:var(--ink-muted);">${o.country?`<span>🌍 ${escapeHtml(o.country)}</span>`:""}${o.startDate?`<span>📅 يبدأ ${escapeHtml(o.startDate)}</span>`:""}</div>`:""}

      <div class="section-label">نسبة التطابق</div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="match-badge lat" style="--pct:${m.score}"><span>${m.score}%</span></div>
        <div style="font-size:13.5px;color:var(--ink-muted);">${m.score>=70?"تطابق قوي مع ملفك الشخصي":m.score>=40?"تطابق متوسط، تقدر تقوّيه":"تطابق ضعيف حاليًا"}</div>
      </div>
      ${stageMismatchNote(state.profile, o)?`<div class="note-box" style="background:#FCE9E9;color:#B4232C;margin-top:10px;">${stageMismatchNote(state.profile, o)}</div>`:""}

      <div class="section-label">متابعتي للفرصة دي</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${Object.entries(TRACK_STATUSES).map(([k,label])=>`<button type="button" class="pill ${(getOppTrack(o.id)&&getOppTrack(o.id).status===k)?"selected":""}" data-action="set-track-status" data-id="${o.id}" data-status="${k}">${label}</button>`).join("")}
      </div>
      <div class="field" style="margin-top:8px;">
        <label>ملاحظاتي الشخصية (تاريخ التقديم، تفاصيل تهمك، إلخ)</label>
        <textarea id="track-note-${o.id}" rows="2" placeholder="اكتب ملاحظتك هنا...">${escapeHtml((getOppTrack(o.id)&&getOppTrack(o.id).note)||"")}</textarea>
        <button type="button" class="btn btn-ghost" style="margin-top:6px;" data-action="save-track-note" data-id="${o.id}">💾 حفظ الملاحظة</button>
      </div>

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
      </div>
      <button class="btn ${o.featured?"btn-ghost":"btn-gold"} btn-block" style="margin-top:8px;" data-action="toggle-opp-featured" data-id="${o.id}">${o.featured?"✕ إلغاء تمييز الفرصة":"⭐ علّم الفرصة كمميزة"}</button>`:""}
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
function timeAgoAr(ts){
  const diff = Math.max(0, Date.now()-(ts||Date.now()));
  const mins = Math.round(diff/60000);
  if(mins<1) return "الآن";
  if(mins<60) return `من ${mins} دقيقة`;
  const hrs = Math.round(mins/60);
  if(hrs<24) return `من ${hrs} ساعة`;
  return `من ${Math.round(hrs/24)} يوم`;
}
function renderNotifPanel(){
  const personal = state.notifications.slice(0,15);
  const newAnnouncements = state.announcements.filter(a=>(a.createdAt||0)>(state.lastSeenAnnouncementAt||0)-1);
  const combined = [
    ...state.announcements.map(a=>({...a, kind:"announcement"})),
    ...personal.map(n=>({...n, kind:"personal"}))
  ].sort((x,y)=>(y.createdAt||0)-(x.createdAt||0));
  return `
  <div class="modal-overlay" data-action="toggle-notif-panel">
    <div class="modal-sheet" data-action="noop" style="max-width:420px;">
      <div class="modal-close"><button data-action="toggle-notif-panel">✕</button></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h2 style="font-size:17px;font-weight:800;">🔔 الإشعارات</h2>
        ${personal.some(n=>!n.read)?`<button class="pill" data-action="mark-all-notifs-read" style="font-size:12px;">تحديد الكل كمقروء</button>`:""}
      </div>
      ${combined.length===0?`<div class="note-box">مفيش إشعارات لسه.</div>`:
        combined.map(n=>`
          <div class="card" data-action="${n.kind==="personal"?"mark-notif-read":"noop"}" data-id="${n.id}" style="padding:12px;margin-bottom:8px;cursor:pointer;${n.kind==="personal"&&!n.read?"border-right:3px solid var(--gold,#F3C57A);":""}">
            <div style="font-weight:700;font-size:13.5px;">${n.kind==="announcement"?"📢 ":""}${escapeHtml(n.title)}</div>
            <div style="color:var(--ink-muted);font-size:12.5px;margin-top:3px;">${escapeHtml(n.body||"")}</div>
            <div style="color:var(--ink-muted);font-size:11px;margin-top:5px;">${timeAgoAr(n.createdAt)}</div>
          </div>`).join("")}
    </div>
  </div>`;
}
function renderAssessmentsTab(){
  return `
  <div style="max-width:760px;margin:0 auto;">
    <h2 style="font-size:19px;font-weight:800;margin-bottom:4px;">الاختبارات الشخصية</h2>
    <p style="color:var(--ink-muted);font-size:13.5px;margin-bottom:16px;">اختبارات ثابتة بدون ذكاء اصطناعي، بتساعدك تفهم نفسك أكتر — النتيجة بتتحفظ في ملفك.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
      ${ASSESSMENTS.map(a=>`
        <div class="card" style="padding:16px;">
          <div style="font-size:26px;margin-bottom:6px;">${a.icon}</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:4px;">${escapeHtml(a.title)}</div>
          <div style="color:var(--ink-muted);font-size:12.5px;margin-bottom:12px;">${escapeHtml(a.desc)}</div>
          <button class="btn btn-gold btn-block" data-action="start-assessment" data-id="${a.id}">ابدأ الاختبار</button>
        </div>`).join("")}
    </div>
  </div>`;
}
function renderAssessmentModal(){
  const a = ASSESSMENTS.find(x=>x.id===state.activeAssessmentId);
  if(!a) return "";
  if(state.assessmentReport){
    const r = state.assessmentReport;
    const label = a.type==="scale" ? r.band.label : (r.result?r.result.label:"");
    const tip = a.type==="scale" ? r.band.tip : (r.result?r.result.tip:"");
    return `
    <div class="modal-overlay" data-action="close-assessment">
      <div class="modal-sheet" data-action="noop" style="text-align:center;">
        <div class="modal-close" style="text-align:left;"><button data-action="close-assessment">✕</button></div>
        <div style="font-size:38px;margin:8px 0;">${a.icon}</div>
        <h2 style="font-size:18px;font-weight:800;">${escapeHtml(label)}</h2>
        ${a.type==="scale"?`<p style="color:var(--ink-muted);margin:6px 0;">درجتك: ${r.total} من ${a.questions.length*4}</p>`:""}
        <div class="note-box" style="text-align:right;margin-top:14px;">${escapeHtml(tip)}</div>
        <button class="btn btn-gold btn-block" style="margin-top:16px;" data-action="close-assessment">تمام</button>
      </div>
    </div>`;
  }
  const answeredAll = a.questions.every((_,i)=>state.assessmentAnswers[i]!==undefined);
  return `
  <div class="modal-overlay" data-action="close-assessment">
    <div class="modal-sheet" data-action="noop">
      <div class="modal-close"><button data-action="close-assessment">✕</button></div>
      <h2 style="font-size:18px;font-weight:800;margin-bottom:14px;">${a.icon} ${escapeHtml(a.title)}</h2>
      ${a.questions.map((q,i)=>`
        <div style="margin-bottom:18px;">
          <div style="font-weight:700;font-size:14.5px;margin-bottom:8px;">${i+1}. ${escapeHtml(a.type==="scale"?q:q.q)}</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${(a.type==="scale"?SCALE_OPTIONS:q.options.map(o=>o.t)).map((opt,oi)=>`<button type="button" class="pill ${state.assessmentAnswers[i]===oi?"selected":""}" style="text-align:right;justify-content:flex-start;" data-action="pick-assessment-answer" data-q="${i}" data-opt="${oi}">${escapeHtml(opt)}</button>`).join("")}
          </div>
        </div>`).join("")}
      <button class="btn btn-gold btn-block" data-action="submit-assessment" ${answeredAll?"":"disabled"}>اعرض النتيجة</button>
    </div>
  </div>`;
}
const STORY_CATEGORY_LABEL = {grant:"منح",volunteer:"تطوع",competition:"مسابقات",other:"قصص عامة"};
function renderAdminStoryForm(){
  const d = state.storyDraft;
  return `
  <div class="card" style="padding:16px;margin-bottom:16px;">
    <div style="font-weight:800;margin-bottom:10px;">${state.editingStoryId?"تعديل قصة":"إضافة قصة نجاح جديدة"}</div>
    <input type="text" id="story-title" placeholder="عنوان القصة" value="${escapeHtml(d.title)}" style="margin-bottom:8px;" />
    <select id="story-category" style="margin-bottom:8px;">
      ${Object.keys(STORY_CATEGORY_LABEL).map(c=>`<option value="${c}" ${d.category===c?"selected":""}>${STORY_CATEGORY_LABEL[c]}</option>`).join("")}
    </select>
    <input type="text" id="story-country" placeholder="الدولة (اختياري)" value="${escapeHtml(d.country)}" style="margin-bottom:8px;" />
    <textarea id="story-content" placeholder="نص القصة" rows="4" style="margin-bottom:8px;">${escapeHtml(d.content)}</textarea>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-gold" style="flex:1;" data-action="save-story">${state.editingStoryId?"حفظ التعديل":"نشر القصة"}</button>
      ${state.editingStoryId?`<button class="pill" data-action="cancel-edit-story">إلغاء</button>`:""}
    </div>
  </div>`;
}

// ============ بنك الاختبارات الشخصية (بدون AI — أسئلة ودرجات ثابتة) ============
const SCALE_OPTIONS = ["نادرًا","أحيانًا","غالبًا","دائمًا"]; // قيم 1..4
const ASSESSMENTS = [
  { id:"leadership", title:"اختبار القيادة", icon:"🧭", type:"scale",
    desc:"يقيس ميولك القيادية في العمل الجماعي واتخاذ القرار.",
    questions:[
      "بتاخد المبادرة وتقترح حلول لما يحصل مشكلة في فريق.",
      "بتحس مرتاح وانت بتوزّع مهام على زملاءك.",
      "الناس بتيجي تستشيرك لما يحتاروا في قرار.",
      "بتقدر تحفّز فريقك لما الحماس يقل.",
      "بتاخد قرار حتى لو مش كل المعلومات متوفرة.",
      "بتقبل تحمّل مسؤولية غلطة حصلت في شغل الفريق."
    ],
    bands:[
      {max:12,label:"قيادة ناشئة",tip:"عندك أساس كويس. جرب تاخد دور صغير في تنظيم مشروع جماعي أو نادي طلابي عشان تبني الثقة."},
      {max:18,label:"قيادة متوسطة",tip:"عندك ميول قيادية واضحة. طوّرها بقراءة عن اتخاذ القرار، وجرب تقود مجموعة في تحدي أو مسابقة."},
      {max:24,label:"قيادة قوية",tip:"إنت قائد بالفطرة. دوّر على فرص تطوع أو تدريب فيها مسؤولية قيادية حقيقية عشان تصقل المهارة دي."}
    ]
  },
  { id:"time-management", title:"اختبار إدارة الوقت", icon:"⏱️", type:"scale",
    desc:"يقيس مدى قدرتك على تنظيم وقتك وأولوياتك.",
    questions:[
      "بتكتب قائمة مهام يومية أو أسبوعية.",
      "بتخلّص المهام قبل آخر لحظة من الموعد.",
      "بتقدر ترفض مهام مش أولوية عشان تركّز على اللي مهم.",
      "بتاخد فترات راحة منظمة بدل ما تشتغل لحد ما تتعب.",
      "بتراجع وقتك في الآخر وتشوف فين ضاع.",
      "نادرًا ما بتنسى مواعيد مهمة."
    ],
    bands:[
      {max:12,label:"محتاج تنظيم أكتر",tip:"جرب تبدأ بتطبيق بسيط زي قائمة 3 مهام يومية بس، وحدد وقت ثابت للمذاكرة أو الشغل."},
      {max:18,label:"تنظيم متوسط",tip:"عندك عادات كويسة، ضيف عليها تقنية Pomodoro أو تقسيم اليوم لـ Time Blocks."},
      {max:24,label:"إدارة وقت ممتازة",tip:"إنت منظم جدًا. ركّز دلوقتي على تحسين جودة القرارات اللي بتاخدها في وقت أقل."}
    ]
  },
  { id:"productivity", title:"اختبار الإنتاجية", icon:"⚡", type:"scale",
    desc:"يقيس مدى تركيزك وإنجازك اليومي.",
    questions:[
      "بتخلّص أهم مهمة في يومك في أول ساعتين من شغلك.",
      "بتقفل الإشعارات والمشتتات وقت التركيز.",
      "بتحس إنك بتنجز اللي خططتله في نهاية اليوم.",
      "بتاخد بريك قبل ما تحس بالإرهاق الكامل.",
      "بتراجع أهدافك الأسبوعية بشكل دوري.",
      "مستوى طاقتك بيفضل ثابت طول اليوم."
    ],
    bands:[
      {max:12,label:"إنتاجية منخفضة حاليًا",tip:"جرب تبدأ يومك بأهم مهمة (Eat the Frog)، وقلل المشتتات لساعة واحدة بس في البداية."},
      {max:18,label:"إنتاجية متوسطة",tip:"جرب تقنية تقسيم المهام الكبيرة لخطوات صغيرة، وحدد وقت واضح لكل مهمة."},
      {max:24,label:"إنتاجية عالية",tip:"إنت منتج جدًا. ممكن تجرب تفوّض بعض المهام أو توثّق نظامك عشان تساعد بيه غيرك."}
    ]
  },
  { id:"career-interests", title:"اختبار الميول المهنية", icon:"🎯", type:"categorical",
    desc:"يساعدك تعرف أي مجال أقرب لشخصيتك واهتماماتك.",
    categories:{ a:"تقني/تحليلي", b:"إبداعي", c:"اجتماعي/قيادي", d:"تنظيمي/عملي" },
    questions:[
      {q:"لو عندك وقت فاضي، تفضّل تعمل إيه؟", options:[{t:"تحل مسألة برمجة أو بازل منطقي",cat:"a"},{t:"ترسم أو تصمم حاجة",cat:"b"},{t:"تنظّم فعالية مع أصحابك",cat:"c"},{t:"ترتب وتخطط لحاجة",cat:"d"}]},
      {q:"في شغل جماعي، إنت غالبًا بتكون؟", options:[{t:"اللي بيحلل البيانات والأرقام",cat:"a"},{t:"اللي بيقترح أفكار جديدة",cat:"b"},{t:"اللي بيوزع الأدوار ويحفّز الفريق",cat:"c"},{t:"اللي بيتابع الجدول الزمني والتفاصيل",cat:"d"}]},
      {q:"أكتر مادة/مجال استمتعت بيه؟", options:[{t:"رياضيات أو علوم حاسب",cat:"a"},{t:"فنون أو لغة",cat:"b"},{t:"علوم اجتماعية أو تجارة",cat:"c"},{t:"إدارة أعمال أو محاسبة",cat:"d"}]},
      {q:"بتفضّل بيئة شغل فيها؟", options:[{t:"مشاكل تقنية تتحل بمنطق واضح",cat:"a"},{t:"حرية إبداعية وتجريب",cat:"b"},{t:"تواصل مستمر مع ناس",cat:"c"},{t:"نظام وإجراءات واضحة",cat:"d"}]},
      {q:"لو هتختار مشروع تخرج، تختار؟", options:[{t:"تطبيق أو نظام تقني",cat:"a"},{t:"حملة إعلانية أو محتوى إبداعي",cat:"b"},{t:"مبادرة مجتمعية",cat:"c"},{t:"خطة عمل أو دراسة جدوى",cat:"d"}]}
    ],
    results:{
      a:{label:"مجالات تقنية وتحليلية",tip:"برمجة، هندسة، تحليل بيانات، ذكاء اصطناعي. ابدأ من تبويب \"مركز التعلم\" بكورسات البرمجة."},
      b:{label:"مجالات إبداعية",tip:"تصميم، صناعة محتوى، فنون، تسويق إبداعي. دوّر على كورسات التصميم والمحتوى."},
      c:{label:"مجالات اجتماعية وقيادية",tip:"إدارة، موارد بشرية، تطوع وعمل مجتمعي، تعليم. جرب فرص التطوع المتاحة على المنصة."},
      d:{label:"مجالات تنظيمية وعملية",tip:"إدارة أعمال، محاسبة، إدارة مشاريع، لوجستيات. كورسات الأعمال هتفيدك هنا."}
    }
  },
  { id:"learning-style", title:"اختبار أسلوب التعلم", icon:"🧠", type:"categorical",
    desc:"يساعدك تعرف أفضل طريقة تتعلم بيها عشان تذاكر بكفاءة أكتر.",
    categories:{ a:"بصري", b:"سمعي", c:"عملي/حركي", d:"قرائي/كتابي" },
    questions:[
      {q:"لما تتعلم حاجة جديدة، بتفضّل؟", options:[{t:"تشوف رسم أو فيديو أو خريطة ذهنية",cat:"a"},{t:"تسمع شرح أو بودكاست",cat:"b"},{t:"تجرب بنفسك عمليًا",cat:"c"},{t:"تقرا وتلخّص بنفسك",cat:"d"}]},
      {q:"لو ضاع في مكان، بتفضّل؟", options:[{t:"تشوف خريطة",cat:"a"},{t:"تسأل حد ويشرحلك",cat:"b"},{t:"تمشي وتكتشف بنفسك",cat:"c"},{t:"تقرا اللافتات والتعليمات",cat:"d"}]},
      {q:"وانت بتذاكر، بتفتكر أكتر إيه؟", options:[{t:"الألوان والأشكال في نوتاتك",cat:"a"},{t:"صوت المحاضر وهو بيشرح",cat:"b"},{t:"التجارب والأمثلة العملية",cat:"c"},{t:"الجمل اللي كتبتها بنفسك",cat:"d"}]},
      {q:"أفضل شكل مذاكرة بالنسبة لك؟", options:[{t:"فيديوهات ورسومات",cat:"a"},{t:"شرح صوتي أو مناقشة",cat:"b"},{t:"مشاريع وتطبيق عملي",cat:"c"},{t:"كتب وملازم مكتوبة",cat:"d"}]},
      {q:"لو هتشرح حاجة لصاحبك، بتعمل إيه؟", options:[{t:"ترسم مخطط بسيط",cat:"a"},{t:"تشرحله بصوت عالي",cat:"b"},{t:"تعمله مثال حي قدامه",cat:"c"},{t:"تكتبله خطوات",cat:"d"}]}
    ],
    results:{
      a:{label:"متعلّم بصري",tip:"استخدم خرائط ذهنية، ألوان، فيديوهات، ورسوم بيانية وقت المذاكرة."},
      b:{label:"متعلّم سمعي",tip:"استمع لمحاضرات وبودكاست، واشرح المعلومة بصوت عالي لنفسك أو لزميل."},
      c:{label:"متعلّم عملي (حركي)",tip:"ركّز على المشاريع التطبيقية والتجارب العملية بدل النظري بس."},
      d:{label:"متعلّم قرائي/كتابي",tip:"لخّص بالكتابة، واقرا من كتب ومقالات، واكتب ملازمك بنفسك بدل الاعتماد على غيرك."}
    }
  },
  { id:"communication", title:"اختبار مهارات التواصل", icon:"💬", type:"scale",
    desc:"يقيس مدى وضوحك وثقتك في التواصل مع الآخرين.",
    questions:[
      "بتعبّر عن رأيك بوضوح حتى لو مختلف عن الأغلبية.",
      "بتسمع كويس قبل ما ترد على حد.",
      "بتقدر تشرح فكرة معقدة بطريقة بسيطة.",
      "بتحس مرتاح وانت بتتكلم قدام مجموعة ناس.",
      "بتاخد فيدباك من غيرك من غير ما تزعل.",
      "بتقدر تقنع حد برأيك بأدلة مش بس إصرار."
    ],
    bands:[
      {max:12,label:"تواصل محتاج شغل",tip:"ابدأ بحاجات بسيطة: اتكلم أكتر في مجموعات صغيرة، وسجّل نفسك بتشرح حاجة وسمعها لنفسك."},
      {max:18,label:"تواصل متوسط",tip:"جرب تتمرن على العرض (Public Speaking) في مجموعة صغيرة، وركّز على الاستماع الفعّال."},
      {max:24,label:"تواصل قوي",tip:"إنت متواصل قوي. جرب تستخدم المهارة دي في تقديم أو تدريب أو قيادة نقاش."}
    ]
  },
  { id:"self-confidence", title:"اختبار الثقة بالنفس", icon:"🌟", type:"scale",
    desc:"يقيس مدى ثقتك في قدراتك وقراراتك.",
    questions:[
      "بتاخد قرار وانت مقتنع بيه من غير ما تحتاج تأكيد من كل الناس حواليك.",
      "بتقدر تتكلم عن إنجازاتك من غير إحراج زايد.",
      "لما تفشل في حاجة، بتشوفها فرصة تتعلم مش دليل إنك مش كفاية.",
      "بتقدر تقول \"لأ\" لحاجة مش مناسبة ليك من غير ذنب.",
      "بتقدّم نفسك بثقة في مقابلة أو موقف جديد.",
      "رأي الناس فيك مش بيغيّر قرارتك الأساسية."
    ],
    bands:[
      {max:12,label:"ثقة محتاجة بناء",tip:"ابدأ بحاجات صغيرة قدرت عليها فعلًا واحتفل بيها. الثقة بتتبني بالتراكم مش بقرار واحد."},
      {max:18,label:"ثقة متوسطة",tip:"جرب تدوّن إنجازاتك أول بأول، وواجه موقف واحد صعب شوية كل أسبوع عشان تبني عضلة الثقة."},
      {max:24,label:"ثقة قوية",tip:"عندك ثقة كويسة في نفسك. استخدمها في دعم ناس تانية بتحتاج نفس الدفعة."}
    ]
  },
  { id:"problem-solving", title:"اختبار أسلوب حل المشكلات", icon:"🧩", type:"categorical",
    desc:"يساعدك تعرف إزاي بتفكر وتتعامل مع المشاكل والتحديات.",
    categories:{ a:"تحليلي منطقي", b:"إبداعي/خارج الصندوق", c:"تعاوني", d:"عملي سريع" },
    questions:[
      {q:"لما تواجه مشكلة جديدة، أول حاجة بتعملها؟", options:[{t:"تقسّمها لأجزاء صغيرة وتحللها",cat:"a"},{t:"تفكر في حلول غير تقليدية",cat:"b"},{t:"تتكلم مع حد يساعدك تفكر",cat:"c"},{t:"تجرب أقرب حل وتتعلم من النتيجة",cat:"d"}]},
      {q:"لو الحل الأول ما نفعش، بتعمل إيه؟", options:[{t:"ترجع تحلل فين الخطأ بالظبط",cat:"a"},{t:"تجرب زاوية مختلفة تمامًا",cat:"b"},{t:"تسأل رأي فريقك",cat:"c"},{t:"تجرب حل تاني بسرعة",cat:"d"}]},
      {q:"إيه اللي بيدّيك رضا أكتر وانت بتحل مشكلة؟", options:[{t:"إنك لقيت السبب الجذري",cat:"a"},{t:"إنك لقيت حل مبتكر محدش فكر فيه",cat:"b"},{t:"إن الفريق وصل للحل مع بعض",cat:"c"},{t:"إنك خلصت بسرعة وانتقلت للي بعده",cat:"d"}]},
      {q:"في العمل الجماعي، دورك غالبًا؟", options:[{t:"اللي بيحلل الموقف بعمق",cat:"a"},{t:"اللي بيقترح أفكار جديدة",cat:"b"},{t:"اللي بيجمع آراء الكل",cat:"c"},{t:"اللي بينفّذ بسرعة",cat:"d"}]}
    ],
    results:{
      a:{label:"محلّل منطقي",tip:"بتحب تفهم جذر المشكلة قبل ما تتحرك. ده مفيد جدًا في مجالات زي البرمجة وتحليل البيانات والهندسة."},
      b:{label:"مفكّر إبداعي",tip:"بتشوف حلول محدش شايفها. ده يفيدك في التصميم وريادة الأعمال وصناعة المحتوى."},
      c:{label:"متعاون",tip:"بتوصل لأفضل نتيجة مع فريق. دور القيادة أو إدارة المشاريع أو العمل الاجتماعي هيناسبك."},
      d:{label:"عملي سريع",tip:"بتفضّل التنفيذ السريع والتعلم بالتجربة. ده مفيد في بيئات الشغل السريعة زي الـStartups."}
    }
  }
];
function scoreScaleAssessment(assessment, answers){
  let total=0;
  assessment.questions.forEach((_,i)=>{ total += (answers[i]!==undefined?answers[i]+1:0); });
  const band = assessment.bands.find(b=>total<=b.max) || assessment.bands[assessment.bands.length-1];
  return {total, band};
}
function scoreCategoricalAssessment(assessment, answers){
  const tally = {};
  assessment.questions.forEach((q,i)=>{
    const cat = answers[i]!==undefined ? q.options[answers[i]].cat : null;
    if(cat) tally[cat]=(tally[cat]||0)+1;
  });
  let top=null, max=-1;
  Object.keys(tally).forEach(c=>{ if(tally[c]>max){max=tally[c];top=c;} });
  return {tally, top, result: top?assessment.results[top]:null};
}
async function submitAssessment(){
  const a = ASSESSMENTS.find(x=>x.id===state.activeAssessmentId);
  if(!a) return;
  const report = a.type==="scale" ? scoreScaleAssessment(a, state.assessmentAnswers) : scoreCategoricalAssessment(a, state.assessmentAnswers);
  state.assessmentReport = report;
  render();
  if(!state.user) return;
  try{
    await addDoc(collection(db,"quiz_results"), {
      userId: state.user.uid, assessmentId: a.id, title: a.title, report, createdAt: Date.now()
    });
  }catch(err){ console.error("submitAssessment save error:", err); }
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
  else if(e.target.id==="ai-search-model"){ state.searchModel = e.target.value; }
  else if(e.target.id==="ai-search-depth"){ state.searchDepth = e.target.value; }
  else if(e.target.id==="ai-search-count"){ state.searchResultCount = parseInt(e.target.value,10)||15; }
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
  else if(action==="skip-profile"){
    state.setupName = (document.getElementById("setup-name")||{}).value || state.setupName;
    skipProfileSetup();
  }
  else if(action==="tab"){ state.activeTab=t.dataset.tab; state.openOppId=null; state.navOpen=false; render(); }
  else if(action==="toggle-nav"){ state.navOpen = !state.navOpen; render(); }
  else if(action==="toggle-nav-collapse"){ state.navCollapsed = !state.navCollapsed; try{localStorage.setItem("nextstep_navCollapsed", state.navCollapsed?"1":"0");}catch(e){} render(); }
  else if(action==="show-help"){ state.helpOpenTab = t.dataset.tab; render(); }
  else if(action==="close-help"){ state.helpOpenTab = null; render(); }
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
  else if(action==="guides-subtab"){ state.guidesSubTab = t.dataset.subtab; render(); }
  else if(action==="learning-center-section"){ state.learningCenterSection = t.dataset.section; render(); }
  else if(action==="profile-section"){ state.profileSection = t.dataset.section; render(); }
  else if(action==="chat-section"){ state.chatSection = t.dataset.section; render(); }
  else if(action==="open-uni"){ state.openUniId = t.dataset.id; render(); }
  else if(action==="close-uni"){ state.openUniId = null; render(); }
  else if(action==="uni-filter-type"){ state.uniFilterType = t.dataset.type; render(); }
  else if(action==="uni-filter-city"){ state.uniFilterCity = t.dataset.city; render(); }
  else if(action==="toggle-compare-uni"){
    const id = t.dataset.id;
    if(state.compareUniIds.includes(id)) state.compareUniIds = state.compareUniIds.filter(x=>x!==id);
    else if(state.compareUniIds.length<3) state.compareUniIds = [...state.compareUniIds, id];
    render();
  }
  else if(action==="clear-uni-compare"){ state.compareUniIds = []; render(); }
  else if(action==="open-uni-compare"){ state.showUniCompareModal = true; render(); }
  else if(action==="close-uni-compare"){ state.showUniCompareModal = false; render(); }
  else if(action==="admin-new-uni"){ state.adminUniDraft = {}; render(); }
  else if(action==="admin-edit-uni"){
    const uni = state.universities.find(u=>u.id===t.dataset.id);
    if(uni) state.adminUniDraft = {...uni};
    render();
  }
  else if(action==="cancel-uni-draft"){ state.adminUniDraft = null; render(); }
  else if(action==="uni-ai-fill"){ fetchUniversityDataByAI(); }
  else if(action==="save-uni-draft"){ saveUniversityDraft(); }
  else if(action==="admin-delete-uni"){ deleteUniversity(t.dataset.id); }
  else if(action==="admin-add-college"){ state.adminCollegeDraft = {uniId:t.dataset.id, idx:null}; render(); }
  else if(action==="admin-edit-college"){
    const uni = state.universities.find(u=>u.id===t.dataset.id);
    const idx = Number(t.dataset.idx);
    if(uni && uni.colleges && uni.colleges[idx]) state.adminCollegeDraft = {...uni.colleges[idx], uniId:uni.id, idx};
    render();
  }
  else if(action==="cancel-college-draft"){ state.adminCollegeDraft = null; render(); }
  else if(action==="save-college-draft"){ saveCollegeDraft(); }
  else if(action==="admin-delete-college"){ deleteCollege(t.dataset.id, Number(t.dataset.idx)); }
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
  else if(action==="track-filter"){ state.trackFilter=t.dataset.status; render(); }
  else if(action==="chat-quick"){ sendChatMessage(t.dataset.q); }
  else if(action==="approve-pending"){ approvePending(t.dataset.id); }
  else if(action==="reject-pending"){ rejectPending(t.dataset.id); }
  else if(action==="toggle-complete"){ toggleResourceComplete(t.dataset.id); }
  else if(action==="load-video"){
    // بنستبدل الصورة المصغّرة بالـiframe الحقيقي مباشرة في الـDOM من غير ما نعمل
    // render() كامل للصفحة (عشان منعملش reload لأي فيديوهات تانية شغالة فعلاً).
    const yid = t.dataset.yid;
    t.outerHTML = `<div style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden;margin:10px 0;background:#000;">
      <iframe src="https://www.youtube-nocookie.com/embed/${yid}?autoplay=1" title="فيديو" style="position:absolute;top:0;right:0;width:100%;height:100%;border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>`;
  }
  else if(action==="toggle-lesson"){ toggleLessonComplete(t.dataset.id, parseInt(t.dataset.idx,10)); }
  else if(action==="download-course-cert"){ downloadCourseCertificate(t.dataset.id); }
  else if(action==="start-quiz"){ state.activeQuizId=t.dataset.id; state.quizAnswers={}; state.quizSubmitted=false; render(); }
  else if(action==="close-quiz"){ state.activeQuizId=null; render(); }
  else if(action==="pick-quiz-answer"){ state.quizAnswers[t.dataset.q]=parseInt(t.dataset.opt,10); render(); }
  else if(action==="submit-quiz"){ submitQuizAnswers(); }
  else if(action==="download-cert"){ downloadCertificate(t.dataset.id); }
  else if(action==="toggle-notif-panel"){ toggleNotifPanel(); }
  else if(action==="mark-notif-read"){ markNotificationRead(t.dataset.id); }
  else if(action==="mark-all-notifs-read"){ markAllNotificationsRead(); }
  else if(action==="start-assessment"){ state.activeAssessmentId=t.dataset.id; state.assessmentAnswers={}; state.assessmentReport=null; render(); }
  else if(action==="close-assessment"){ state.activeAssessmentId=null; state.assessmentReport=null; render(); }
  else if(action==="pick-assessment-answer"){ state.assessmentAnswers[t.dataset.q]=parseInt(t.dataset.opt,10); render(); }
  else if(action==="submit-assessment"){ submitAssessment(); }
  else if(action==="story-filter"){ state.successStoryFilter=t.dataset.cat; render(); }
  else if(action==="save-story"){
    state.storyDraft.title = document.getElementById("story-title").value;
    state.storyDraft.category = document.getElementById("story-category").value;
    state.storyDraft.country = document.getElementById("story-country").value;
    state.storyDraft.content = document.getElementById("story-content").value;
    saveSuccessStory();
  }
  else if(action==="toggle-story-featured"){ toggleStoryFeatured(t.dataset.id); }
  else if(action==="delete-story"){ deleteSuccessStory(t.dataset.id); }
  else if(action==="edit-story"){
    const s = state.successStories.find(x=>x.id===t.dataset.id);
    if(s){ state.editingStoryId=s.id; state.storyDraft={title:s.title,category:s.category,country:s.country||"",content:s.content,imageUrl:s.imageUrl||""}; render(); }
  }
  else if(action==="cancel-edit-story"){ state.editingStoryId=null; state.storyDraft={title:"",category:"grant",country:"",content:"",imageUrl:""}; render(); }
  else if(action==="post-announcement"){ postAnnouncement(); }
  else if(action==="delete-announcement"){ deleteAnnouncement(t.dataset.id); }
  else if(action==="generate-cv"){ generateCV(); }
  else if(action==="print-cv"){ downloadAtsCv(); }
  else if(action==="admin-toggle"){
    const opening = t.dataset.form;
    if(opening==="course" && state.adminOpen!=="course") resetCourseDraft();
    const willOpenAi = opening==="ai" && state.adminOpen!=="ai";
    state.adminOpen = state.adminOpen===opening ? null : opening;
    render();
    if(willOpenAi) loadAiQuotaStatus();
  }
  else if(action==="admin-toggle-tag"){ const tag=t.dataset.tag; state.adminOppTags.has(tag)?state.adminOppTags.delete(tag):state.adminOppTags.add(tag); render(); }
  else if(action==="admin-toggle-stage"){ const tag=t.dataset.tag; state.adminOppStages.has(tag)?state.adminOppStages.delete(tag):state.adminOppStages.add(tag); render(); }
  else if(action==="admin-toggle-restag"){ const tag=t.dataset.tag; state.adminResTags.has(tag)?state.adminResTags.delete(tag):state.adminResTags.add(tag); render(); }
  else if(action==="set-track-status"){ setOppTrackStatus(t.dataset.id, t.dataset.status); }
  else if(action==="save-track-note"){ saveOppTrackNote(t.dataset.id); }
  else if(action==="course-type-select"){
    syncCourseDraftFromForm();
    state.courseDraft.courseType = t.dataset.value;
    if(t.dataset.value==="single") state.courseDraft.lessons = [state.courseDraft.lessons[0] || {title:"",link:"",pdfLink:"",extraLinksRaw:""}];
    render();
  }
  else if(action==="course-cert-select"){
    syncCourseDraftFromForm();
    state.courseDraft.hasCertificate = t.dataset.value==="true";
    render();
  }
  else if(action==="add-course-lesson"){
    syncCourseDraftFromForm();
    state.courseDraft.lessons.push({title:"",link:"",pdfLink:"",extraLinksRaw:""});
    render();
  }
  else if(action==="remove-course-lesson"){
    syncCourseDraftFromForm();
    const idx = parseInt(t.dataset.idx,10);
    state.courseDraft.lessons.splice(idx,1);
    if(state.courseDraft.lessons.length===0) state.courseDraft.lessons.push({title:"",link:"",pdfLink:"",extraLinksRaw:""});
    render();
  }
  else if(action==="add-course-resource"){
    syncCourseDraftFromForm();
    state.courseDraft.resources.push({title:"",type:"custom",url:""});
    render();
  }
  else if(action==="remove-course-resource"){
    syncCourseDraftFromForm();
    const idx = parseInt(t.dataset.idx,10);
    state.courseDraft.resources.splice(idx,1);
    render();
  }
  else if(action==="toggle-opp-featured"){ toggleOppFeatured(t.dataset.id); }
  else if(action==="toggle-resource-featured"){ toggleResourceFeatured(t.dataset.id); }
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
  else if(e.target.id==="admin-course-form"){ submitAddCourse(e.target); }
  else if(e.target.id==="edit-res-form"){ submitResourceEdit(e.target, state.editingResourceId); }
  else if(e.target.id==="admin-quiz-form"){ submitAdminQuiz(e.target); }
  else if(e.target.id==="search-form"){
    state.searchQuery = document.getElementById("search-input").value;
    render();
  }
  else if(e.target.id==="uni-search-form"){
    state.uniSearchQuery = document.getElementById("uni-search-input").value;
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

const __verifyCertId = new URLSearchParams(window.location.search).get("verify");
if(__verifyCertId){
  // موجود ?verify=ID في الرابط — ده وضع تحقق من شهادة عام، بيشتغل من غير أي
  // تسجيل دخول، فبنعديه بالكامل ومنبدأش onAuthStateChanged خالص.
  state.screen = "verify-cert";
  state.verifyCertId = __verifyCertId;
  state.verifyCertStatus = "loading";
  bootFinished = true; window.__appBooted = true;
  render();
  loadCertVerification(__verifyCertId);
} else {
try{
  onAuthStateChanged(auth, async (user)=>{
    try{
      if(user){
        state.user = user;
        const profile = await loadProfile(user.uid);
        const isComplete = profile && (profile.profileSkipped || (profile.stage && (profile.interests||[]).length>0 && (profile.skills||[]).length>0));
        if(isComplete){
          state.profile = profile;
          state.profile.oppTracking = profile.oppTracking || {};
          if(updateStreakOnLogin(state.profile)){
            updateDoc(doc(db,"users",user.uid), {
              streakCount: state.profile.streakCount, longestStreak: state.profile.longestStreak, lastActiveDate: state.profile.lastActiveDate
            }).catch(err=>console.error("streak update error:", err));
          }
          state.completedResourceIds = profile.completedResourceIds||[]; state.completedLessonIds = profile.completedLessonIds||[]; state.quizResults = profile.quizResults||{};
          try{ state.navCollapsed = localStorage.getItem("nextstep_navCollapsed")==="1"; }catch(e){}
          await loadOpportunities();
          await loadResources();
    await loadUniversities();
          await loadPendingOpps();
          await loadQuizzes();
          await loadAutoSearchMeta();
          await loadNotifications();
          await loadAnnouncements();
          await loadSuccessStories();
          generatePersonalNotifications();
          // "ما الجديد منذ آخر زيارة" — بنقرا وقت آخر زيارة قبل ما نحدّثه بالوقت
          // الحالي، عشان نقدر نقارن الفرص/الكورسات اللي اتضافت بعد التاريخ القديم
          // ده طول الجلسة دي (لو حدّثناه فورًا هيبقى نفس اللحظة ومفيش حاجة "جديدة").
          const lvKey = `nextstep_lastVisit_${user.uid}`;
          state.dashboardLastVisit = localStorage.getItem(lvKey) ? parseInt(localStorage.getItem(lvKey),10) : null;
          localStorage.setItem(lvKey, String(Date.now()));
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
}
