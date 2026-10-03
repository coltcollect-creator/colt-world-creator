// Comprehensive Unified Decor & Furniture Catalog for 2D, 2.5D, and 3D
export type DecorCategory =
  | "reception"
  | "pots"
  | "plants"
  | "trees"
  | "vending"
  | "mirrors"
  | "sofas"
  | "armchairs"
  | "tables_small"
  | "tables_large"
  | "rugs";

export interface DecorPresetItem {
  id: string;
  name: string;
  category: DecorCategory;
  icon: string;
  color: string;
  w: number;
  d: number;
  h: number;
  allowCustomImage?: boolean;
  desc: string;
}

export const DECOR_CATEGORIES: Array<{ key: DecorCategory; label: string; icon: string }> = [
  { key: "reception", label: "עמדות קבלה", icon: "🛎️" },
  { key: "sofas", label: "ספות ארוכות", icon: "🛋️" },
  { key: "armchairs", label: "כורסאות בודדות", icon: "🪑" },
  { key: "tables_large", label: "שולחנות עמדה / ישיבות", icon: "🏢" },
  { key: "tables_small", label: "שולחנות עגולים קטנים", icon: "☕" },
  { key: "rugs", label: "שטיחים (גודל + תמונה)", icon: "🟪" },
  { key: "trees", label: "עצים מעוצבים", icon: "🌳" },
  { key: "plants", label: "צמחים טרופיים", icon: "🌿" },
  { key: "pots", label: "עציצים דקורטיביים", icon: "🪴" },
  { key: "vending", label: "מכונות משקאות", icon: "🥤" },
  { key: "mirrors", label: "מראות יוקרה", icon: "🪞" },
];

export const ALL_DECOR_PRESETS: DecorPresetItem[] = [
  // 🛎️ 2 עמדות קבלה
  {
    id: "reception_luxury",
    name: "עמדת קבלה שיש וזהב",
    category: "reception",
    icon: "🛎️",
    color: "#f59e0b",
    w: 220,
    d: 110,
    h: 115,
    desc: "דלפק קבלה מעוגל משיש איטלקי עם תאורת לד זהב וצג מחשב",
  },
  {
    id: "reception_cyber",
    name: "עמדת קבלה סייבר ניאון",
    category: "reception",
    icon: "💻",
    color: "#06b6d4",
    w: 230,
    d: 110,
    h: 120,
    desc: "דלפק קבלה עתידני עם לוגו הולוגרמה מואר ומסך תצוגה",
  },

  // 🪴 4 עציצים
  {
    id: "pot_terracotta",
    name: "עציץ חרס כפרי",
    category: "pots",
    icon: "🪴",
    color: "#ea580c",
    w: 80,
    d: 80,
    h: 120,
    desc: "עציץ חרס טרקוטה קלאסי עם שיח ירוק פורח",
  },
  {
    id: "pot_geometric",
    name: "עציץ שיש גיאומטרי",
    category: "pots",
    icon: "🪴",
    color: "#cbd5e1",
    w: 75,
    d: 75,
    h: 130,
    desc: "עציץ שיש לבן גיאומטרי מודרני עם סנסיווריה / לשון החמות",
  },
  {
    id: "pot_gold_tall",
    name: "עציץ פליז מוזהב גבוה",
    category: "pots",
    icon: "🪴",
    color: "#eab308",
    w: 85,
    d: 85,
    h: 165,
    desc: "עציץ צילינדר פליז זהב יוקרתי עם עץ פיקוס כינורי",
  },
  {
    id: "pot_cyber_neon",
    name: "עציץ ניאון עתידני",
    category: "pots",
    icon: "🪴",
    color: "#ec4899",
    w: 80,
    d: 80,
    h: 135,
    desc: "עציץ שחור מט עם מסגרת ניאון ורודה זוהרת וצמחייה עתידנית",
  },

  // 🌿 3 צמחים
  {
    id: "plant_monstera",
    name: "צמח מונסטרה טרופי",
    category: "plants",
    icon: "🌿",
    color: "#16a34a",
    w: 100,
    d: 100,
    h: 150,
    desc: "מונסטרה טרופית שופעת עם עלים מחוררים רחבים",
  },
  {
    id: "plant_bamboo",
    name: "מקבץ במבוק זן",
    category: "plants",
    icon: "🎍",
    color: "#84cc16",
    w: 110,
    d: 60,
    h: 190,
    desc: "גדר קני במבוק יפניים דקים בערוגה מוארכת",
  },
  {
    id: "plant_flower_bush",
    name: "שיח פרחי מג'נטה",
    category: "plants",
    icon: "🌺",
    color: "#d946ef",
    w: 95,
    d: 95,
    h: 110,
    desc: "שיח פריחה עשיר בצבעי סגול-מג'נטה זוהרים",
  },

  // 🌳 4 עצים
  {
    id: "tree_cyber_neon",
    name: "עץ ניאון זוהר סייבר",
    category: "trees",
    icon: "🌲",
    color: "#38bdf8",
    w: 120,
    d: 120,
    h: 220,
    desc: "עץ עתידני עם ענפי קריסטל ניאון כחולים וזוהרים",
  },
  {
    id: "tree_cherry_sakura",
    name: "עץ סאקורה ורוד יפני",
    category: "trees",
    icon: "🌸",
    color: "#f472b6",
    w: 140,
    d: 140,
    h: 210,
    desc: "עץ פריחת הדובדבן המסורתי עם צמרת ורודה מרהיבה",
  },
  {
    id: "tree_palm_tropical",
    name: "דקל ריזורט טרופי",
    category: "trees",
    icon: "🌴",
    color: "#22c55e",
    w: 130,
    d: 130,
    h: 240,
    desc: "עץ דקל גבוה ומרשים עם כפות דקלים נשפכות",
  },
  {
    id: "tree_golden_oak",
    name: "עץ אלון מוזהב מלכותי",
    category: "trees",
    icon: "🍂",
    color: "#ca8a04",
    w: 140,
    d: 140,
    h: 220,
    desc: "עץ אלון סתווי עם עלי זהב וענפים חמים",
  },

  // 🥤 3 מכונות משקאות
  {
    id: "vending_soda_retro",
    name: "מכונת שתייה רטרו אדומה",
    category: "vending",
    icon: "🥤",
    color: "#ef4444",
    w: 80,
    d: 70,
    h: 175,
    desc: "מכונת פחיות שתייה קלאסית אדומה בסגנון רטרו מואר",
  },
  {
    id: "vending_cyber_energy",
    name: "מכונת אנרגיה סייבר",
    category: "vending",
    icon: "⚡",
    color: "#10b981",
    w: 85,
    d: 70,
    h: 180,
    desc: "מכונת משקאות אנרגיה סייברפאנק עם תאורת ירוק ניאון",
  },
  {
    id: "vending_snack_deluxe",
    name: "מכונת חטיפים וקפה דלוקס",
    category: "vending",
    icon: "🍫",
    color: "#3b82f6",
    w: 110,
    d: 75,
    h: 185,
    desc: "מכונת חטיפים רחבה עם חזית זכוכית מוארת ומבחר מוצרים",
  },

  // 🪞 3 מראות
  {
    id: "mirror_luxury_gold",
    name: "מראת קשת זהב בארוק",
    category: "mirrors",
    icon: "🪞",
    color: "#f59e0b",
    w: 70,
    d: 30,
    h: 180,
    desc: "מראת גוף יוקרתית עם מסגרת זהב מקושתת ועיטורים",
  },
  {
    id: "mirror_neon_cyber",
    name: "מראת אינפיניטי ניאון",
    category: "mirrors",
    icon: "🪞",
    color: "#a855f7",
    w: 80,
    d: 25,
    h: 185,
    desc: "מראת עומק אינסופית עם תאורת LED ניאון סגול וכחול",
  },
  {
    id: "mirror_modern_wood",
    name: "מראת עץ מודרנית עומדת",
    category: "mirrors",
    icon: "🪞",
    color: "#b45309",
    w: 65,
    d: 35,
    h: 170,
    desc: "מראת סטנד עומדת מעץ אלון טבעי עם פינות מעוגלות",
  },

  // 🛋️ 4 סוגי ספות ארוכות לישיבה
  {
    id: "sofa_cyber_lounge",
    name: "ספת לאונג' סייבר סגולה",
    category: "sofas",
    icon: "🛋️",
    color: "#8b5cf6",
    w: 220,
    d: 90,
    h: 80,
    desc: "ספת לאונג' מרווחת מעור סגול כהה עם תאורת אווירה תחתונה",
  },
  {
    id: "sofa_luxury_velvet",
    name: "ספת קטיפה אמרלד צ'סטרפילד",
    category: "sofas",
    icon: "🛋️",
    color: "#059669",
    w: 230,
    d: 95,
    h: 85,
    desc: "ספת קטיפה ירוקה מלכותית עם קפיטונז' עמוק וידיות מעוגלות",
  },
  {
    id: "sofa_modern_white",
    name: "ספה נורדית לבנה מודרנית",
    category: "sofas",
    icon: "🛋️",
    color: "#f8fafc",
    w: 210,
    d: 90,
    h: 75,
    desc: "ספה סקנדינבית מעוצבת בבד שמנת ורגלי עץ בהיר",
  },
  {
    id: "sofa_leather_tan",
    name: "ספת עור וינטג' שזופה",
    category: "sofas",
    icon: "🛋️",
    color: "#d97706",
    w: 220,
    d: 90,
    h: 80,
    desc: "ספת עור קוניאק קלאסית בסגנון רטרו חם ומזמין",
  },

  // 🪑 3 סוגי כורסאות בודדות
  {
    id: "armchair_egg_chair",
    name: "כורסת ביצה מסתובבת רד",
    category: "armchairs",
    icon: "🪑",
    color: "#e11d48",
    w: 90,
    d: 85,
    h: 125,
    desc: "כורסת Egg Chair איקונית בצבע אודם עם בסיס כרום מסתובב",
  },
  {
    id: "armchair_modern_grey",
    name: "כורסת מועדון אנתרציט",
    category: "armchairs",
    icon: "🪑",
    color: "#475569",
    w: 95,
    d: 90,
    h: 90,
    desc: "כורסת קלאב מודרנית בריפוד אפור עמוק ורגלי שחור מט",
  },
  {
    id: "armchair_cyber_pod",
    name: "כורסת קפסולה עתידנית",
    category: "armchairs",
    icon: "🪑",
    color: "#0284c7",
    w: 95,
    d: 90,
    h: 120,
    desc: "כורסת קוקון גיימינג מתקדמת עם כריות ארגונומיות ותאורת ניאון",
  },

  // ☕ 2 שולחנות עגולים קטנים
  {
    id: "table_round_glass",
    name: "שולחן קפה זכוכית וזהב",
    category: "tables_small",
    icon: "☕",
    color: "#fef08a",
    w: 90,
    d: 90,
    h: 60,
    desc: "שולחן סלון עגול עם משטח זכוכית מעושנת ורגלי מתכת זהב",
  },
  {
    id: "table_round_cafe",
    name: "שולחן ביסטרו קפה עץ",
    category: "tables_small",
    icon: "☕",
    color: "#92400e",
    w: 80,
    d: 80,
    h: 75,
    desc: "שולחן בית קפה עגול מעץ אלון עם רגל ברזל יצוקה",
  },

  // 🏢 2 שולחנות גדולים כעמדה
  {
    id: "table_large_conference",
    name: "שולחן ישיבות מנהלים גדול",
    category: "tables_large",
    icon: "🏢",
    color: "#78350f",
    w: 280,
    d: 130,
    h: 80,
    desc: "שולחן ישיבות מנהלים ארוך מעץ מלא עם חיבורי חשמל ורגלי מתכת",
  },
  {
    id: "table_large_cyber",
    name: "שולחן עמדת בר סייבר",
    category: "tables_large",
    icon: "🍸",
    color: "#38bdf8",
    w: 260,
    d: 100,
    h: 105,
    desc: "שולחן בר עמידה גבוה עם משטח אקרילי מואר ניאון וכיסאות בר",
  },

  // 🟪 3 שטיחים שניתן לשנות גודל + תמונה
  {
    id: "rug_luxury_oriental",
    name: "שטיח אוריינטלי מלכותי",
    category: "rugs",
    icon: "🟪",
    color: "#b91c1c",
    w: 260,
    d: 180,
    h: 6,
    allowCustomImage: true,
    desc: "שטיח יוקרתי בדוגמה פרסית עשירה (ניתן להעלאת תמונה ושינוי מידות)",
  },
  {
    id: "rug_geometric_modern",
    name: "שטיח גיאומטרי נורדי",
    category: "rugs",
    icon: "🟪",
    color: "#0f766e",
    w: 240,
    d: 160,
    h: 6,
    allowCustomImage: true,
    desc: "שטיח ארוג בדוגמה גיאומטרית מודרנית (ניתן להעלאת תמונה ושינוי מידות)",
  },
  {
    id: "rug_cyber_hologram",
    name: "שטיח רשת סייבר הולוגרמה",
    category: "rugs",
    icon: "🟪",
    color: "#6366f1",
    w: 250,
    d: 170,
    h: 6,
    allowCustomImage: true,
    desc: "שטיח רצפה עתידני עם שולי ניאון זוהרים (ניתן להעלאת תמונה ושינוי מידות)",
  },
];

// Compatibility export
export const COOL_DECOR_PRESETS = ALL_DECOR_PRESETS;
