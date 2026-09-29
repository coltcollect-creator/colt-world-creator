import { db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from "./firebaseErrors";
import { toast } from "sonner";

export type CardRarity = "common" | "rare" | "epic" | "legendary";

export type AlbumCard = {
  id: string;
  card_number: number;
  title: string;
  description: string;
  image_url: string;
  rarity: CardRarity;
  source_type: "quest" | "treasure" | "event" | "custom";
  source_id?: string;
  source_name?: string;
  active: boolean;
  created_at?: string;
};

export type UserCollectedCard = {
  id: string;
  user_id: string;
  card_id: string;
  card_number: number;
  card_title: string;
  card_image_url: string;
  card_description: string;
  card_rarity: CardRarity;
  source_type: string;
  source_name: string;
  unlocked_at: string;
};

export const DEFAULT_ALBUM_CARDS: AlbumCard[] = [
  {
    id: "card-welcome",
    card_number: 1,
    title: "כרטיס כניסה לקולט",
    description: "מוענק לכל חוקר חדש שנכנס בפעם הראשונה לעולם של COLT Market.",
    image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    rarity: "common",
    source_type: "quest",
    source_id: "login",
    source_name: "כניסה ראשונה לעולם",
    active: true,
  },
  {
    id: "card-first-treasure",
    card_number: 2,
    title: "מפתח התיבה המוזהבת",
    description: "נפתח כאשר מגלים ופותחים תיבת אוצר סודית ברחבי המפה.",
    image_url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80",
    rarity: "rare",
    source_type: "treasure",
    source_id: "any",
    source_name: "פתיחת תיבת אוצר",
    active: true,
  },
  {
    id: "card-collector-apprentice",
    card_number: 3,
    title: "שוליית האספנים",
    description: "השלמת משימת ביקור בדוכני היריד ושוחח עם המדריך הראשי.",
    image_url: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&auto=format&fit=crop&q=80",
    rarity: "common",
    source_type: "quest",
    source_id: "visit_npc",
    source_name: "שיחה עם מדריך",
    active: true,
  },
  {
    id: "card-lucky-spin",
    card_number: 4,
    title: "גלגל הגורל המנצנץ",
    description: "סובב את גלגל המזל של קולט וזכה בפרס ראשון.",
    image_url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=80",
    rarity: "epic",
    source_type: "quest",
    source_id: "wheel",
    source_name: "סיבוב גלגל המזל",
    active: true,
  },
  {
    id: "card-master-vendor",
    card_number: 5,
    title: "תג סוחר מורשה",
    description: "מוענק למשתתפים המובילים של קהילת הסוחרים והאספנים של COLT.",
    image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    rarity: "legendary",
    source_type: "event",
    source_id: "vendor_partner",
    source_name: "תג שותף ונדור",
    active: true,
  },
  {
    id: "card-mystery-unboxed",
    card_number: 6,
    title: "תעלומת קופסת המסתורין",
    description: "נחשף בעת פתיחת קופסת מסתורין נדירה.",
    image_url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80",
    rarity: "rare",
    source_type: "quest",
    source_id: "mystery",
    source_name: "פתיחת קופסת מסתורין",
    active: true,
  },
];

/** Fetch all available album cards defined by owners */
export async function fetchAllAlbumCards(): Promise<AlbumCard[]> {
  const path = "album_cards";
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      // Seed default album cards on initial run
      for (const card of DEFAULT_ALBUM_CARDS) {
        await setDoc(doc(db, path, card.id), card);
      }
      return DEFAULT_ALBUM_CARDS;
    }
    const list: AlbumCard[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<AlbumCard, "id">) });
    });
    return list.sort((a, b) => a.card_number - b.card_number);
  } catch (error) {
    console.warn("Falling back to default cards:", error);
    return DEFAULT_ALBUM_CARDS;
  }
}

/** Subscribe to user's collected cards */
export function subscribeUserCards(
  userId: string,
  onCards: (cards: UserCollectedCard[]) => void
) {
  const path = "user_cards";
  const q = query(collection(db, path), where("user_id", "==", userId));
  return onSnapshot(
    q,
    (snap) => {
      const list: UserCollectedCard[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<UserCollectedCard, "id">) });
      });
      onCards(list.sort((a, b) => a.card_number - b.card_number));
    },
    (err) => {
      console.warn("User cards subscription error:", err);
    }
  );
}

/** Fetch user collected cards once */
export async function fetchUserCards(userId: string): Promise<UserCollectedCard[]> {
  const path = "user_cards";
  try {
    const q = query(collection(db, path), where("user_id", "==", userId));
    const snap = await getDocs(q);
    const list: UserCollectedCard[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<UserCollectedCard, "id">) });
    });
    return list.sort((a, b) => a.card_number - b.card_number);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/** Grant a card to user album and trigger celebratory event */
export async function unlockCardForUser(
  userId: string,
  card: {
    card_id: string;
    card_number: number;
    title: string;
    image_url: string;
    description: string;
    rarity: CardRarity;
    source_type?: string;
    source_name?: string;
  }
): Promise<boolean> {
  const path = "user_cards";
  const docId = `${userId}_${card.card_id}`;
  try {
    const payload: UserCollectedCard = {
      id: docId,
      user_id: userId,
      card_id: card.card_id,
      card_number: card.card_number,
      card_title: card.title,
      card_image_url: card.image_url,
      card_description: card.description,
      card_rarity: card.rarity,
      source_type: card.source_type || "event",
      source_name: card.source_name || "משימה",
      unlocked_at: new Date().toISOString(),
    };

    await setDoc(doc(db, path, docId), payload);

    // Dispatch global event for animated toast/reveal
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("card-unlocked", {
          detail: payload,
        })
      );
    }

    toast.success(`🃏 קלף חדש נוסף לאלבום הכנס שלך: ${card.title}!`, {
      duration: 6000,
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/** Save or update an album card definition (Admin/Owner) */
export async function saveAlbumCard(card: AlbumCard): Promise<void> {
  const path = "album_cards";
  const id = card.id || `card-${Date.now()}`;
  try {
    await setDoc(doc(db, path, id), {
      ...card,
      id,
      created_at: card.created_at || new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/** Delete an album card definition */
export async function deleteAlbumCard(cardId: string): Promise<void> {
  const path = "album_cards";
  try {
    await deleteDoc(doc(db, path, cardId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
