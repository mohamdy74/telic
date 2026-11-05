export type Locale = "en" | "ar";
export const LOCALES: Locale[] = ["en", "ar"];
export const dirOf = (l: Locale) => (l === "ar" ? "rtl" : "ltr");

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const en = {
  appName: "Grove",
  tagline: "Grow steady, not stressed.",
  nav: {
    dashboard: "Today",
    tasks: "Tasks",
    habits: "Habits",
    focus: "Focus",
    rewards: "Rewards",
    insights: "Insights",
    settings: "Settings",
  },
  pages: {
    dashboard: { title: "Your day, at a glance", body: "Priorities, habits and focus will gather here once you start." },
    tasks: { title: "No tasks yet", body: "Capture what's on your mind. We'll help you sort it out." },
    habits: { title: "Plant your first habit", body: "Small, steady actions. Missed days won't erase your progress." },
    focus: { title: "Ready when you are", body: "Focus sessions and breaks will live here." },
    rewards: { title: "Your progress, rewarded", body: "Levels, achievements and rewards you choose yourself." },
    insights: { title: "Patterns take time", body: "Come back after a few days of activity for useful insights." },
    settings: { title: "Settings", body: "Language and appearance. More options coming soon." },
  },
  comingSoon: "Coming soon",
  command: {
    open: "Search or jump to…",
    placeholder: "Type a page name…",
    empty: "No matches",
    hint: "Navigate",
  },
  settings: {
    language: "Language",
    theme: "Appearance",
    light: "Light",
    dark: "Dark",
  },
  debug: {
    title: "Store status",
    loading: "Loading store…",
    schema: "Schema version",
    storage: "Durable storage",
    granted: "Granted",
    notGranted: "Not granted",
    unknown: "Unknown",
    collections: "Collections",
    records: "Records",
    softDeleted: "Soft-deleted",
    pending: "Pending writes",
    lastSync: "Last sync",
    lastMerge: "Last merge",
    never: "Never",
    dayStart: "Day starts at",
    weekStart: "Week starts on",
    focusTarget: "Daily focus target",
    minutes: "min",
    seed: "Seed sample data",
    flush: "Flush writes",
  },
  daysStreak: { one: "{n} day streak", other: "{n} day streak" } as PluralForms,
  skip: "Skip to content",
  notFound: "Page not found",
  goHome: "Go home",
};

type Dict = typeof en;

const ar: Dict = {
  appName: "بستان",
  tagline: "تقدّم بثبات، بلا ضغط.",
  nav: {
    dashboard: "اليوم",
    tasks: "المهام",
    habits: "العادات",
    focus: "التركيز",
    rewards: "المكافآت",
    insights: "الرؤى",
    settings: "الإعدادات",
  },
  pages: {
    dashboard: { title: "يومك في لمحة", body: "ستظهر هنا أولوياتك وعاداتك وجلسات تركيزك بمجرد أن تبدأ." },
    tasks: { title: "لا توجد مهام بعد", body: "دوّن ما يشغل بالك، وسنساعدك على ترتيبه." },
    habits: { title: "ازرع عادتك الأولى", body: "خطوات صغيرة وثابتة. الأيام الفائتة لن تمحو تقدّمك." },
    focus: { title: "جاهز متى شئت", body: "ستكون جلسات التركيز والاستراحات هنا." },
    rewards: { title: "تقدّمك يُكافأ", body: "مستويات وإنجازات ومكافآت تختارها بنفسك." },
    insights: { title: "الأنماط تحتاج وقتًا", body: "عد بعد بضعة أيام من النشاط لترى رؤى مفيدة." },
    settings: { title: "الإعدادات", body: "اللغة والمظهر. خيارات أخرى قريبًا." },
  },
  comingSoon: "قريبًا",
  command: {
    open: "ابحث أو انتقل إلى…",
    placeholder: "اكتب اسم الصفحة…",
    empty: "لا توجد نتائج",
    hint: "انتقال",
  },
  settings: {
    language: "اللغة",
    theme: "المظهر",
    light: "فاتح",
    dark: "داكن",
  },
  debug: {
    title: "حالة المخزن",
    loading: "جارٍ تحميل المخزن…",
    schema: "إصدار المخطط",
    storage: "تخزين دائم",
    granted: "مُمنوح",
    notGranted: "غير مُمنوح",
    unknown: "غير معروف",
    collections: "المجموعات",
    records: "السجلات",
    softDeleted: "محذوف مؤقتًا",
    pending: "كتابات معلقة",
    lastSync: "آخر مزامنة",
    lastMerge: "آخر دمج",
    never: "أبدًا",
    dayStart: "اليوم يبدأ الساعة",
    weekStart: "الأسبوع يبدأ يوم",
    focusTarget: "هدف التركيز اليومي",
    minutes: "دقيقة",
    seed: "إضافة بيانات تجريبية",
    flush: "كتابة فورية",
  },
  daysStreak: {
    zero: "لا أيام متتالية",
    one: "يوم واحد متتالٍ",
    two: "يومان متتاليان",
    few: "{n} أيام متتالية",
    many: "{n} يومًا متتاليًا",
    other: "{n} يوم متتالٍ",
  },
  skip: "تخطَّ إلى المحتوى",
  notFound: "الصفحة غير موجودة",
  goHome: "الرئيسية",
};

export const dictionaries: Record<Locale, Dict> = { en, ar };
export type { Dict };

/** Picks the correct plural form for a locale (Arabic has 6). */
export function plural(locale: Locale, forms: PluralForms, n: number): string {
  const rule = new Intl.PluralRules(locale).select(n);
  const tpl = forms[rule] ?? forms.other;
  return tpl.replace("{n}", formatNumber(locale, n));
}

export function formatNumber(locale: Locale, n: number) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(n);
}

export function formatDate(locale: Locale, d: Date, opts: Intl.DateTimeFormatOptions = { dateStyle: "full" }) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", opts).format(d);
}
