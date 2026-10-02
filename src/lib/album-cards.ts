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
import { gameDataStore } from "./gameDataStore";
import { supabase } from "@/integrations/supabase/client";
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

/** Fetch all available album cards defined by owners and active quest cards */
export async function fetchAllAlbumCards(): Promise<AlbumCard[]> {
  const path = "album_cards";
  const cardMap = new Map<string, AlbumCard>();

  // 1. Load baseline defaults
  for (const c of DEFAULT_ALBUM_CARDS) {
    cardMap.set(c.id, c);
  }

  // 2. Load Firestore album cards
  try {
    const snap = await getDocs(collection(db, path));
    snap.forEach((d) => {
      const data = d.data() as Omit<AlbumCard, "id">;
      cardMap.set(d.id, { id: d.id, ...data });
    });
  } catch (error) {
    console.warn("Falling back to local cards:", error);
  }

  // 3. Load local gameDataStore album_cards
  const localCards = gameDataStore.getAll("album_cards");
  if (Array.isArray(localCards)) {
    for (const c of localCards) {
      if (c && c.id) {
        cardMap.set(String(c.id), c as AlbumCard);
      }
    }
  }

  // 4. Dynamically include any quests that have an icon/image or card metadata
  const quests = gameDataStore.getAll("quests");
  let nextNum = 7;
  for (const q of quests) {
    const cardImg = q.icon_url || q.image_url || (q.metadata as any)?.card_image_url;
    const cardTitle = q.cosmetic_reward || (q.metadata as any)?.card_title || q.name;
    const cardNum = Number(q.title_reward) || Number((q.metadata as any)?.card_number) || nextNum++;

    if (cardImg || q.cosmetic_reward || (q.metadata as any)?.has_card) {
      const questCardId = `quest-${q.id}`;
      // Merge or update with current quest properties
      const existing = cardMap.get(questCardId);
      cardMap.set(questCardId, {
        id: questCardId,
        card_number: cardNum,
        title: cardTitle || "משימת כנס",
        description: q.description || "הושלמה במרכז המשימות",
        image_url: cardImg || "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&auto=format&fit=crop&q=80",
        rarity: (q.metadata as any)?.card_rarity || "rare",
        source_type: "quest",
        source_id: q.id,
        source_name: `משימה: ${q.name}`,
        active: q.active !== false,
      });
    }
  }

  return Array.from(cardMap.values()).sort((a, b) => a.card_number - b.card_number);
}

/** Synchronizes retroactive quest cards for a player */
export function getCompletedQuestCardsForUser(userId: string): UserCollectedCard[] {
  const result: UserCollectedCard[] = [];
  const playerQuests = gameDataStore.getAll("player_quests").filter((pq) => String(pq.user_id) === String(userId));
  const quests = gameDataStore.getAll("quests");
  const questsMap = new Map(quests.map((q) => [String(q.id), q]));

  for (const pq of playerQuests) {
    const q = questsMap.get(String(pq.quest_id));
    if (!q) continue;

    const isDone = Number(pq.progress) >= Number(q.target_amount || 1) || Boolean(pq.completed_at) || Boolean(pq.claimed_at);
    if (!isDone) continue;

    const cardImg = q.icon_url || q.image_url || (q.metadata as any)?.card_image_url;
    const cardTitle = q.cosmetic_reward || (q.metadata as any)?.card_title || q.name;
    const cardNum = Number(q.title_reward) || Number((q.metadata as any)?.card_number) || 3;

    if (cardImg || q.cosmetic_reward || (q.metadata as any)?.has_card) {
      const cardId = `quest-${q.id}`;
      result.push({
        id: `${userId}_${cardId}`,
        user_id: userId,
        card_id: cardId,
        card_number: cardNum,
        card_title: cardTitle || q.name,
        card_image_url: cardImg || "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&auto=format&fit=crop&q=80",
        card_description: q.description || "משימת כנס",
        card_rarity: (q.metadata as any)?.card_rarity || "rare",
        source_type: "quest",
        source_name: `משימה: ${q.name}`,
        unlocked_at: pq.completed_at || pq.claimed_at || pq.updated_at || new Date().toISOString(),
      });
    }
  }

  return result;
}

/** Subscribe to user's collected cards (including real-time retroactive quest card updates) */
export function subscribeUserCards(
  userId: string,
  onCards: (cards: UserCollectedCard[]) => void
) {
  const path = "user_cards";
  const q = query(collection(db, path), where("user_id", "==", userId));

  const buildMergedList = (firestoreCards: UserCollectedCard[]) => {
    const map = new Map<string, UserCollectedCard>();
    
    // 1. From local gameDataStore user_cards
    const local = gameDataStore.getAll("user_cards").filter((c) => String(c.user_id) === String(userId));
    for (const c of local) {
      map.set(c.card_id, c as UserCollectedCard);
    }

    // 2. From Firestore
    for (const fc of firestoreCards) {
      map.set(fc.card_id, fc);
    }

    // 3. Retroactive Completed Quests (Always reflects the newest quest photo & title!)
    const questCards = getCompletedQuestCardsForUser(userId);
    for (const qc of questCards) {
      const existing = map.get(qc.card_id);
      map.set(qc.card_id, {
        ...(existing || {}),
        ...qc,
        // Preserve original unlock timestamp if present
        unlocked_at: existing?.unlocked_at || qc.unlocked_at,
      });
    }

    return Array.from(map.values()).sort((a, b) => a.card_number - b.card_number);
  };

  // Initial immediate push from local store + quests
  onCards(buildMergedList([]));

  // Asynchronously fetch latest remote quests & player_quests to ensure instant retroactive sync
  (async () => {
    try {
      const [questsRes, pQuestsRes] = await Promise.all([
        supabase.from("quests").select("*"),
        supabase.from("player_quests").select("*").eq("user_id", userId),
      ]);

      if (questsRes.data && Array.isArray(questsRes.data)) {
        for (const q of questsRes.data) {
          gameDataStore.set("quests", q);
        }
      }

      if (pQuestsRes.data && Array.isArray(pQuestsRes.data)) {
        for (const pq of pQuestsRes.data) {
          gameDataStore.set("player_quests", pq);
        }
      }

      onCards(buildMergedList([]));
    } catch {}
  })();

  // Listen for local quest updates
  const handleQuestUpdate = () => {
    onCards(buildMergedList([]));
  };
  window.addEventListener("colt-quest-updated", handleQuestUpdate);
  window.addEventListener("card-unlocked", handleQuestUpdate);

  const unsub = onSnapshot(
    q,
    (snap) => {
      const list: UserCollectedCard[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<UserCollectedCard, "id">) });
      });
      onCards(buildMergedList(list));
    },
    (err) => {
      console.warn("User cards subscription error:", err);
      onCards(buildMergedList([]));
    }
  );

  return () => {
    unsub();
    window.removeEventListener("colt-quest-updated", handleQuestUpdate);
    window.removeEventListener("card-unlocked", handleQuestUpdate);
  };
}

/** Fetch user collected cards once */
export async function fetchUserCards(userId: string): Promise<UserCollectedCard[]> {
  const path = "user_cards";
  const map = new Map<string, UserCollectedCard>();

  try {
    const q = query(collection(db, path), where("user_id", "==", userId));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const data = { id: d.id, ...(d.data() as Omit<UserCollectedCard, "id">) };
      map.set(data.card_id, data);
    });
  } catch (error) {
    console.warn("Could not fetch user_cards from remote:", error);
  }

  // Include retroactive completed quest cards
  const questCards = getCompletedQuestCardsForUser(userId);
  for (const qc of questCards) {
    const existing = map.get(qc.card_id);
    map.set(qc.card_id, {
      ...(existing || {}),
      ...qc,
      unlocked_at: existing?.unlocked_at || qc.unlocked_at,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.card_number - b.card_number);
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
      source_type: card.source_type || "quest",
      source_name: card.source_name || "משימה",
      unlocked_at: new Date().toISOString(),
    };

    // Save locally
    gameDataStore.set("user_cards", payload);

    // Save to Firestore
    await setDoc(doc(db, path, docId), payload).catch(() => {});

    // Dispatch global event for animated toast/reveal
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("card-unlocked", {
          detail: payload,
        })
      );
    }

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/** Save or update an album card definition (Admin/Owner) */
export async function saveAlbumCard(card: AlbumCard): Promise<void> {
  const path = "album_cards";
  const id = card.id || `card-${Date.now()}`;
  try {
    const payload = {
      ...card,
      id,
      created_at: card.created_at || new Date().toISOString(),
    };
    gameDataStore.set("album_cards", payload);
    await setDoc(doc(db, path, id), payload).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/** Delete an album card definition */
export async function deleteAlbumCard(cardId: string): Promise<void> {
  const path = "album_cards";
  try {
    gameDataStore.delete("album_cards", cardId);
    await deleteDoc(doc(db, path, cardId)).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
