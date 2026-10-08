import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { supabase } from "@/integrations/supabase/client";

export type TriviaQuestion = {
  id: string;
  question: string;
  options: string[]; // 4 multiple choice options
  correct_index: number;
  reward_type: "xp" | "gems" | "cosmetic" | "product";
  reward_amount?: number;
  reward_product_id?: string;
  reward_cosmetic_id?: string;
  reward_label: string;
};

export type ProfessorConfig = {
  questions: TriviaQuestion[];
};

export type MysteryVendorProduct = {
  id: string;
  name: string;
  price_credits: number;
  image_url?: string;
  description?: string;
};

export type GroupBuyItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url?: string;
  target_members?: number;
  active: boolean;
  signups: Array<{
    user_id: string;
    username: string;
    email: string;
    phone: string;
    created_at: string;
  }>;
};

export type RoomLockRule = {
  is_locked: boolean;
  lock_type: "none" | "level" | "password" | "album_card" | "cosmetic";
  min_level?: number;
  password?: string;
  required_card_id?: string;
  required_cosmetic_id?: string;
  lock_message?: string;
};

export interface SpecializedNpcDef {
  id: string;
  name: string;
  role: "professor" | "mystery_vendor" | "pirate" | "bouncer" | "matchmaker";
  emoji: string;
  description: string;
  color: string;
}

export const SPECIALIZED_NPCS: SpecializedNpcDef[] = [
  {
    id: "npc-professor",
    name: "הפרופסור (חידה יומית)",
    role: "professor",
    emoji: "🧪",
    description: "שואל חידה יומית אחת על פוקימון/אספנות ומחלק פרסים (XP, ג'מס, קוסמטיקה, מוצר)",
    color: "#10b981",
  },
  {
    id: "npc-mystery-vendor",
    name: "הסוחר המסתורי (Mystery Vendor)",
    role: "mystery_vendor",
    emoji: "🧳",
    description: "סוחר נודד שמסתובב במפה ומציע מוצרים ייעודיים למי שלוחץ עליו",
    color: "#8b5cf6",
  },
  {
    id: "npc-pirate",
    name: "הפיראט (ציד האוצר היומי)",
    role: "pirate",
    emoji: "🏴‍☠️",
    description: "מספק 'רמז לרמז' שמסייע בפתרון ומציאת תיבות האוצר הבאות",
    color: "#d97706",
  },
  {
    id: "npc-bouncer",
    name: "שומר השער (Bouncer / VIP Guard)",
    role: "bouncer",
    emoji: "💂",
    description: "מוצב ליד דלתות סגורות ובודק רמה, סיסמה, קלף מאלבום או פריט קוסמטיקה",
    color: "#ef4444",
  },
  {
    id: "npc-matchmaker",
    name: "השדכן (רכישה קבוצתית Matchmaker)",
    role: "matchmaker",
    emoji: "📢",
    description: "כרוז נודד עם בועות דיבור שמגייס שחקנים לרכישה קבוצתית",
    color: "#ec4899",
  },
];

export interface ArcadeMinigameDef {
  id: string;
  reference_id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  shortDesc: string;
}

export const ARCADE_MINIGAMES: ArcadeMinigameDef[] = [
  {
    id: "minigame-catch-card",
    reference_id: "catch_card",
    name: "תפוס את הקלף",
    icon: "🃏",
    color: "#f59e0b",
    description: "משחק 30 שניות: קלפי Holo נופלים מלמעלה. תפיסה מושלמת מוסיפה +2 שניות!",
    shortDesc: "תפיסת קלפים וצבירת ניקוד",
  },
  {
    id: "minigame-pack-rip",
    reference_id: "pack_rip",
    name: "קריעת בוסטר (Pack Rip)",
    icon: "✂️",
    color: "#10b981",
    description: "5 שלבי דיוק: עצירת הסמן בול ב-Sweet Spot לפתיחה מושלמת וחשיפת קלף זהב!",
    shortDesc: "5 שלבי קריעה מדויקת",
  },
  {
    id: "minigame-grading",
    reference_id: "grading_masher",
    name: "צחצוח ל-PSA 10",
    icon: "🔍",
    color: "#06b6d4",
    description: "תיפוף מהיר ב-3 שניות להעלאת מד הציון עד לקבלת סלאב Gem Mint 10!",
    shortDesc: "תיפוף מהיר לציון 10",
  },
];
