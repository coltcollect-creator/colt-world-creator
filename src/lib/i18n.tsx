import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "he" | "en";

const DICT: Record<string, { he: string; en: string }> = {
  // brand / global
  "app.name": { he: "COLT Market World", en: "COLT Market World" },
  "app.tagline": { he: "אספו · סחרו · שחקו", en: "Collect · Trade · Play" },
  "nav.play": { he: "משחק", en: "Play" },
  "nav.inventory": { he: "מלאי", en: "Inventory" },
  "nav.customize": { he: "התאמה אישית", en: "Customize" },
  "nav.quests": { he: "משימות", en: "Quests" },
  "nav.credits": { he: "קרדיטים", en: "Credits" },
  "nav.history": { he: "היסטוריה", en: "History" },
  "nav.profile": { he: "פרופיל", en: "Profile" },
  "nav.settings": { he: "הגדרות", en: "Settings" },
  "nav.messages": { he: "הודעות", en: "Messages" },
  "nav.signout": { he: "התנתקות", en: "Sign out" },
  "nav.owner": { he: "ממשק בעלים", en: "Owner console" },
  "language.he": { he: "עברית", en: "Hebrew" },
  "language.en": { he: "אנגלית", en: "English" },
  "language.switch": { he: "שפה", en: "Language" },
  // auth
  "auth.title": { he: "היכנסו ל־COLT", en: "Enter COLT" },
  "auth.signin": { he: "התחברות", en: "Sign in" },
  "auth.signup": { he: "הרשמה", en: "Sign up" },
  "auth.email": { he: "אימייל", en: "Email" },
  "auth.password": { he: "סיסמה", en: "Password" },
  "auth.username": { he: "שם משתמש", en: "Username" },
  "auth.reset": { he: "איפוס סיסמה", en: "Reset password" },
  // play
  "play.tip": {
    he: "התקרבו לחנות/דמות ולחצו עליה או על הכפתור שנפתח מתחתיה.",
    en: "Walk near a store or NPC, then press E or tap the button.",
  },
  "play.active": { he: "פעילים כרגע", en: "Active now" },
  "play.chat": { he: "צ׳אט כללי", en: "Global chat" },
  "play.enterStore": { he: "צפו בקטלוג", en: "View catalog" },
  "play.talkNpc": { he: "התחילו שיחה", en: "Start conversation" },
  "play.chatOwner": { he: "שוחחו עם בעל החנות", en: "Chat with the store owner" },
  "play.enterDoor": { he: "היכנסו", en: "Enter" },
  "play.enteredMap": { he: "נכנסתם למקום חדש", en: "Entered a new place" },
  "play.buy": { he: "קנייה", en: "Buy" },
  "play.close": { he: "סגירה", en: "Close" },
  "play.saySomething": { he: "כתבו הודעה לרחבה…", en: "Say something to the hub…" },
  "play.send": { he: "שלח", en: "Send" },
  "owner.tab.mapEditor": { he: "עורך מפה", en: "Map editor" },
  // messages
  "msg.title": { he: "ההודעות שלי", en: "My messages" },
  "msg.new": { he: "שיחה חדשה נפתחה", en: "New conversation opened" },
  "msg.write": { he: "כתבו הודעה…", en: "Write a message…" },
  "msg.empty": {
    he: "אין עדיין שיחות. התקרבו לחנות ולחצו על ״שוחחו עם בעל החנות״.",
    en: "No conversations yet. Walk up to a store and click ‘Chat with owner’.",
  },
  "msg.reply": { he: "השבת", en: "Reply" },
  "msg.markRead": { he: "סימון כנקרא", en: "Mark as read" },
  "msg.status.open": { he: "פתוחה", en: "Open" },
  "msg.status.closed": { he: "סגורה", en: "Closed" },
  "msg.close": { he: "סגור שיחה", en: "Close conversation" },
  "msg.reopen": { he: "פתח מחדש", en: "Reopen" },
  // owner
  "owner.title": { he: "ממשק בעלים", en: "Owner Console" },
  "owner.enter": { he: "כניסה למשחק", en: "Enter game" },
  "owner.tab.dashboard": { he: "לוח בקרה", en: "Dashboard" },
  "owner.tab.messages": { he: "הודעות ממתינות", en: "Pending messages" },
  "owner.tab.broadcast": { he: "הודעות מערכת", en: "System messages" },
  "owner.tab.maps": { he: "מפות", en: "Maps" },
  "owner.tab.stores": { he: "חנויות", en: "Stores" },
  "owner.tab.products": { he: "מוצרים", en: "Products" },
  "owner.tab.vendorproducts": { he: "מוצרי ונדורים", en: "Vendor products" },
  "owner.tab.categories": { he: "קטגוריות", en: "Categories" },

  "owner.tab.cosmetics": { he: "קוסמטיקות", en: "Cosmetics" },
  "owner.tab.npcs": { he: "דמויות (NPC)", en: "NPCs" },
  "owner.tab.wheels": { he: "גלגלי מזל", en: "Wheels of Fortune" },
  "owner.tab.mystery": { he: "קופסאות מסתורין", en: "Mystery Boxes" },
  "owner.tab.quests": { he: "משימות", en: "Quests" },
  "owner.tab.titles": { he: "תארים", en: "Titles" },
  "owner.tab.players": { he: "שחקנים", en: "Players" },
  "owner.tab.users": { he: "ניהול משתמשים", en: "User admin" },
  "owner.tab.orders": { he: "הזמנות ומשלוחים", en: "Orders & Shipments" },
  "owner.tab.transactions": { he: "תנועות אשראי", en: "Transactions" },
  "owner.tab.packages": { he: "חבילות קרדיט", en: "Credit packages" },
  "owner.tab.moderation": { he: "מודרציה", en: "Moderation" },
  "owner.tab.audit": { he: "יומן פעולות", en: "Audit log" },
  "owner.tab.settings": { he: "הגדרות משחק", en: "Game settings" },
  "owner.add": { he: "הוספה", en: "Add new" },
  "owner.edit": { he: "עריכה", en: "Edit" },
  "owner.delete": { he: "מחיקה", en: "Delete" },
  "owner.save": { he: "שמירה", en: "Save" },
  "owner.cancel": { he: "ביטול", en: "Cancel" },
  "owner.confirmDelete": { he: "למחוק את השורה?", en: "Delete this row?" },
  "owner.noRows": { he: "אין רשומות עדיין.", en: "No rows yet." },
  "common.loading": { he: "טוען…", en: "Loading…" },
  "common.yes": { he: "כן", en: "Yes" },
  "common.no": { he: "לא", en: "No" },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string) => string;
  dir: "rtl" | "ltr";
};
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "he";
    return (localStorage.getItem("colt.lang") as Lang) || "he";
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("colt.lang", l);
  };
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);
  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      dir: lang === "he" ? "rtl" : "ltr",
      t: (key, fallback) => DICT[key]?.[lang] ?? fallback ?? key,
    }),
    [lang],
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n outside provider");
  return ctx;
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div
      className={`inline-flex overflow-hidden rounded-full border-2 border-border bg-background text-xs font-bold ${className}`}
    >
      <button
        onClick={() => setLang("he")}
        className={`px-3 py-1 ${lang === "he" ? "bg-primary text-primary-foreground" : ""}`}
      >
        עב
      </button>
      <button
        onClick={() => setLang("en")}
        className={`px-3 py-1 ${lang === "en" ? "bg-primary text-primary-foreground" : ""}`}
      >
        EN
      </button>
    </div>
  );
}
