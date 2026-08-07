const { normalizeArabic } = require("./textNormalize");

// أنماط ثابتة معروفة — لو السؤال مطابق لواحد منهم، بنرد فورًا من غير ما
// نلمس Knowledge Base ولا Gemini خالص. القايمة دي قابلة للتوسع بسهولة
// (أضف عنصر جديد بس، مفيش تعديل مطلوب في أي حتة تانية).
const RULES = [
  {
    patterns: ["ازاي اسجل دخول", "تسجيل الدخول", "how to login", "مشكله في تسجيل الدخول"],
    answer: "تقدر تسجّل دخول بإيميلك وكلمة السر، أو بحساب Google مباشرة من زرار 'تسجيل الدخول بحساب Google'. لو نسيت كلمة السر، دوس على 'نسيت كلمة المرور' تحت زرار الدخول.",
  },
  {
    patterns: ["ازاي احدث ملفي", "تعديل الملف الشخصي", "update profile", "بيانات ملفي"],
    answer: "روح لقسم 'ملفي' من القايمة الرئيسية، هتلاقي زرار تعديل جنب بياناتك — أي تعديل بيتحفظ تلقائيًا.",
  },
  {
    patterns: ["ازاي اقدم على فرصه", "التقديم على فرصه", "how to apply"],
    answer: "افتح تفاصيل الفرصة اللي عايزها من قسم 'الفرص المقترحة'، هتلاقي رابط 'قدّم الآن' بيوديك مباشرة لصفحة التقديم الرسمية عند الجهة نفسها.",
  },
  {
    patterns: ["كام سؤال ليا النهارده", "الكوتا بتاعتي", "quota", "حد الاستخدام"],
    answer: "تقدر تشوف عدد الأسئلة المتبقية ليك النهاردة من نفس شاشة المساعد الذكي — بيتصفر تلقائيًا كل يوم.",
  },
  {
    patterns: ["ازاي اتواصل معاكم", "دعم فني", "support", "شكوى", "مشكله في الموقع"],
    answer: "لو عندك مشكلة تقنية أو استفسار، تقدر تبعتلنا من خلال قسم التواصل في الموقع، وهنرد عليك في أقرب وقت.",
  },
];

// بيرجّع الرد لو فيه نمط مطابق، أو null لو مفيش تطابق واضح.
function matchRule(question) {
  const normalized = normalizeArabic(question);
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (normalized.includes(normalizeArabic(pattern))) {
        return { answer: rule.answer, matchedPattern: pattern };
      }
    }
  }
  return null;
}

module.exports = { matchRule, RULES };
