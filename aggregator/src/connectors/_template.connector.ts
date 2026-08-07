import type { IConnector } from "../models/connector.model";
import type { RawOpportunity, OpportunityCategory } from "../models/opportunity.model";

// ============================================================
// قالب فاضي — انسخ الملف ده لأي مصدر جديد، غيّر الاسم، واملا fetch() بس.
// الباقي (validate/normalize/save) هياخد التنفيذ الافتراضي المشترك تلقائيًا
// من services/ إلا لو احتجت تخصيص خاص بالمصدر ده تحديدًا.
// ============================================================

export const templateConnector: IConnector = {
  id: "template-CHANGE-ME",
  name: "[اسم المصدر هنا]",
  category: "job" as OpportunityCategory, // غيّرها حسب نوع الفرص الأساسي
  enabled: false, // خليها false لحد ما تتأكد إن fetch() شغالة صح

  async fetch(): Promise<RawOpportunity[]> {
    // مثال: نداء API بسيط
    // const res = await fetch("https://api.example.com/opportunities");
    // const body = await res.json();
    // return body.items.map((item: any) => ({
    //   title: item.title,
    //   description: item.description,
    //   organization: item.org,
    //   applyUrl: item.url,
    //   sourceId: String(item.id),
    // }));
    throw new Error("لسه ماتكتبتش fetch() للمصدر ده — امسح الـthrow ده وابدأ.");
  },
};
