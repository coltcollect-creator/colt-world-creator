import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from "firebase/auth";
import { db, auth, googleProvider, metaProvider, appleProvider } from "@/lib/firebase";
import { gameDataStore } from "@/lib/gameDataStore";
import { calculateLevel, checkAndApplyLevelUp, addPlayerXp } from "@/lib/progression";

export function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        res[k] = cleanForFirestore(v);
      }
    }
    return res;
  }
  return obj;
}

const SHARED_FIRESTORE_TABLES = new Set([
  "active_players",
  "products",
  "vendors",
  "orders",
  "chat_messages",
  "store_conversations",
  "conversation_messages",
  "auction_bids",
  "game_settings",
  "maps",
  "map_versions",
  "map_objects",
  "profiles",
  "admins",
  "user_roles",
  "treasure_boxes",
  "clues",
  "wheel_configs",
  "mystery_boxes",
  "player_notifications",
  "characters",
  "character_roles",
]);

const lastFirestoreFetchTime: Record<string, number> = {};

export interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

export interface Session {
  access_token: string;
  user: User;
}

// In-memory channel registry for realtime broadcast simulation
const activeChannels = new Map<string, Array<(payload: any) => void>>();

type TableListener = {
  table: string;
  event: string;
  filter?: string;
  callback: (payload: any) => void;
};
const tableChangeListeners: TableListener[] = [];

export function notifyTableChange(table: string, event: "INSERT" | "UPDATE" | "DELETE", newRow: any, oldRow?: any) {
  const payload = {
    schema: "public",
    table,
    commit_timestamp: new Date().toISOString(),
    eventType: event,
    new: newRow,
    old: oldRow,
    errors: null,
  };

  // 1. Notify table change listeners
  for (const l of tableChangeListeners) {
    if (l.table === table || l.table === "*") {
      if (l.event === "*" || l.event === event) {
        if (l.filter) {
          const match = l.filter.match(/^([^=]+)=eq\.(.+)$/);
          if (match) {
            const field = match[1];
            const targetVal = match[2];
            const checkVal = newRow ? String(newRow[field]) : "";
            if (checkVal !== targetVal) continue;
          }
        }
        try {
          l.callback(payload);
        } catch (e) {
          console.warn("Table listener error:", e);
        }
      }
    }
  }

  // 2. Dispatch custom event for window
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("colt_table_change", { detail: payload }));
  }
}

function mapFirebaseUser(user: FirebaseUser | null): User | null {
  if (!user) return null;
  return {
    id: user.uid,
    email: user.email ?? undefined,
    user_metadata: {
      username: user.displayName || (user.email ? user.email.split("@")[0] : "Player"),
    },
    app_metadata: {},
  };
}

const LOCAL_SESSION_KEY = "colt_auth_session_v1";

function getLocalStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setLocalStoredUser(user: User | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {}
}

// Ensure active player profile exists with proper starter settings
function ensureLocalProfile(uid: string, email?: string, username?: string) {
  const isOwnerEmail =
    email?.toLowerCase() === "coltcollect@gmail.com" ||
    email?.toLowerCase() === "astratego@colt.market";

  const originalOwnerProf = gameDataStore.getById("profiles", "d0aa9385-36c0-41eb-b8fc-ae43248c3556");
  const existing = gameDataStore.getById("profiles", uid);
  const finalUsername = isOwnerEmail ? "ColtCollect" : (username || (email ? email.split("@")[0] : "Colt"));
  const defaultCredits = isOwnerEmail ? (originalOwnerProf?.credits ?? 9845) : 5;
  const defaultXp = isOwnerEmail ? (originalOwnerProf?.xp ?? 225) : 0;
  
  // Default to modern character, never force the deleted legacy ninja
  const defaultCharId = "adventurer-orion";
  const finalCharId = existing?.character_id && existing.character_id !== "d14fed03-b2c5-4205-b2ff-a151345151ee"
    ? existing.character_id
    : (isOwnerEmail && originalOwnerProf?.character_id && originalOwnerProf.character_id !== "d14fed03-b2c5-4205-b2ff-a151345151ee"
        ? originalOwnerProf.character_id
        : defaultCharId);
  
  let profileRow: any;
  if (!existing) {
    profileRow = {
      id: uid,
      username: finalUsername,
      display_name: isOwnerEmail ? "ColtCollect" : finalUsername,
      avatar_config: isOwnerEmail ? (originalOwnerProf?.avatar_config || { _initialized: true }) : { _initialized: true },
      character_id: finalCharId,
      credits: defaultCredits,
      level: calculateLevel(defaultXp),
      xp: defaultXp,
      active_title_id: null,
      current_map_id: "f5bb3160-7415-4f62-b72c-f04d1fcbd1a9", // מפה ראשית
      last_x: isOwnerEmail ? 8524 : 1816,
      last_y: 576,
      is_suspended: false,
      is_muted: false,
      email_verified: true,
      settings: {},
    };
    gameDataStore.upsertRow("profiles", profileRow);
  } else {
    // If existing profile was empty or uninitialized or owner got downgraded
    const isOldNinja = existing.character_id === "d14fed03-b2c5-4205-b2ff-a151345151ee";
    const needsOwnerRestore = isOwnerEmail && (existing.credits < 1000 || existing.credits == null || existing.username === "Player" || existing.username?.startsWith("guest_"));
    const calculatedLvl = calculateLevel(existing.xp || defaultXp);
    const needsLevelFix = (existing.level || 1) < calculatedLvl;

    if (needsOwnerRestore || isOldNinja || needsLevelFix) {
      const updates: any = {};
      if (needsOwnerRestore) {
        updates.username = "ColtCollect";
        updates.display_name = "ColtCollect";
        updates.credits = originalOwnerProf?.credits ?? 9845;
        updates.xp = originalOwnerProf?.xp ?? 225;
        updates.level = calculateLevel(updates.xp);
        updates.email_verified = true;
      }
      if (needsLevelFix && !updates.level) {
        updates.level = calculatedLvl;
      }
      if (isOldNinja) {
        updates.character_id = defaultCharId;
      }
      profileRow = gameDataStore.updateRow("profiles", uid, updates);
    } else {
      profileRow = existing;
    }
  }

  // Grant admin & owner if email matches owner
  if (isOwnerEmail) {
    const adminRec = { id: uid, user_id: uid, email: email || "coltcollect@gmail.com" };
    const ownerRec = { id: `owner_${uid}`, user_id: uid, role: "owner" };
    const adminRoleRec = { id: `admin_${uid}`, user_id: uid, role: "admin" };
    gameDataStore.upsertRow("admins", adminRec);
    gameDataStore.upsertRow("user_roles", ownerRec);
    gameDataStore.upsertRow("user_roles", adminRoleRec);

    if (typeof window !== "undefined" && db) {
      try {
        setDoc(doc(db, "admins", uid), cleanForFirestore(adminRec), { merge: true }).catch(() => {});
        setDoc(doc(db, "user_roles", `owner_${uid}`), cleanForFirestore(ownerRec), { merge: true }).catch(() => {});
        setDoc(doc(db, "user_roles", `admin_${uid}`), cleanForFirestore(adminRoleRec), { merge: true }).catch(() => {});
      } catch {}
    }
  } else {
    const playerRoleRec = { id: `player_${uid}`, user_id: uid, role: "player" };
    gameDataStore.upsertRow("user_roles", playerRoleRec);
    if (typeof window !== "undefined" && db) {
      try {
        setDoc(doc(db, "user_roles", `player_${uid}`), cleanForFirestore(playerRoleRec), { merge: true }).catch(() => {});
      } catch {}
    }
  }

  // Sync profile to Firestore so live and owner interfaces share identical database state
  if (typeof window !== "undefined" && db && profileRow) {
    try {
      setDoc(doc(db, "profiles", uid), cleanForFirestore(profileRow), { merge: true }).catch(() => {});
    } catch {}
  }
}

class QueryBuilder {
  private colName: string;
  private opType: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private payload: any = null;
  private selectFields: string = "*";
  private selectOptions?: { count?: "exact" | "planned" | "estimated"; head?: boolean };
  private filters: Array<{ field: string; op: string; value: any }> = [];
  private orConditions: string[] = [];
  private orderField?: string;
  private orderDirection: "asc" | "desc" = "asc";
  private limitCount?: number;
  private rangeFrom?: number;
  private rangeTo?: number;

  constructor(colName: string) {
    this.colName = colName;
  }

  select(_fields = "*", options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    this.selectFields = _fields;
    this.selectOptions = options;
    if (this.opType !== "insert" && this.opType !== "upsert" && this.opType !== "update" && this.opType !== "delete") {
      this.opType = "select";
    }
    return this;
  }

  insert(recordOrRecords: any | any[]) {
    this.opType = "insert";
    this.payload = recordOrRecords;
    return this;
  }

  upsert(recordOrRecords: any | any[]) {
    this.opType = "upsert";
    this.payload = recordOrRecords;
    return this;
  }

  update(updates: any) {
    this.opType = "update";
    this.payload = updates;
    return this;
  }

  delete() {
    this.opType = "delete";
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, op: "==", value });
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push({ field, op: "!=", value });
    return this;
  }

  gt(field: string, value: any) {
    this.filters.push({ field, op: ">", value });
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push({ field, op: ">=", value });
    return this;
  }

  lt(field: string, value: any) {
    this.filters.push({ field, op: "<", value });
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push({ field, op: "<=", value });
    return this;
  }

  in(field: string, values: any[]) {
    if (values && Array.isArray(values)) {
      this.filters.push({ field, op: "in", value: values });
    }
    return this;
  }

  is(field: string, value: any) {
    this.filters.push({ field, op: "is", value });
    return this;
  }

  like(field: string, value: any) {
    this.filters.push({ field, op: "like", value: String(value).replace(/%/g, "") });
    return this;
  }

  ilike(field: string, value: any) {
    this.filters.push({ field, op: "ilike", value: String(value).replace(/%/g, "") });
    return this;
  }

  contains(field: string, value: any) {
    this.filters.push({ field, op: "contains", value });
    return this;
  }

  cs(field: string, value: any) {
    return this.contains(field, value);
  }

  cd(field: string, value: any) {
    return this.contains(field, value);
  }

  overlaps(field: string, value: any) {
    this.filters.push({ field, op: "overlaps", value });
    return this;
  }

  not(field: string, op: string, value: any) {
    this.filters.push({ field, op: `not_${op}`, value });
    return this;
  }

  or(filterString: string) {
    if (filterString && typeof filterString === "string") {
      this.orConditions.push(filterString);
    }
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}) {
    this.orderField = field;
    this.orderDirection = options.ascending === false ? "desc" : "asc";
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  private async execute(): Promise<{ data: any | null; count?: number; error: Error | null }> {
    try {
      if (this.opType === "insert" || this.opType === "upsert") {
        const records = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted: any[] = [];
        for (const rec of records) {
          const saved = gameDataStore.upsertRow(this.colName, rec);
          inserted.push(saved);
          notifyTableChange(this.colName, "INSERT", saved);

          if (SHARED_FIRESTORE_TABLES.has(this.colName)) {
            try {
              const docRef = doc(db, this.colName, String(saved.id));
              await setDoc(docRef, cleanForFirestore(saved), { merge: true });
            } catch (err) {
              console.warn(`Firestore sync error on ${this.colName}:`, err);
            }
          }
        }
        return { data: Array.isArray(this.payload) ? inserted : inserted[0], count: inserted.length, error: null };
      }

      if (this.opType === "delete") {
        const idFilter = this.filters.find((f) => f.field === "id" && f.op === "==");
        if (idFilter && idFilter.value != null) {
          const directId = String(idFilter.value);
          gameDataStore.deleteRow(this.colName, directId);
          notifyTableChange(this.colName, "DELETE", null, { id: directId });
          if (SHARED_FIRESTORE_TABLES.has(this.colName)) {
            try {
              await deleteDoc(doc(db, this.colName, directId));
            } catch (err) {
              console.warn(`Firestore deleteDoc error on ${this.colName}/${directId}:`, err);
            }
          }
        }

        const { data: matched } = await this.fetchDocs();
        if (matched && matched.length > 0) {
          for (const item of matched) {
            const itemId = String(item.id);
            gameDataStore.deleteRow(this.colName, itemId);
            notifyTableChange(this.colName, "DELETE", null, item);
            if (SHARED_FIRESTORE_TABLES.has(this.colName)) {
              try {
                await deleteDoc(doc(db, this.colName, itemId));
              } catch (err) {
                console.warn(`Firestore deleteDoc error on ${this.colName}/${itemId}:`, err);
              }
            }
          }
        }
        return { data: null, count: (matched?.length || 0) + (idFilter ? 1 : 0), error: null };
      }

      if (this.opType === "update") {
        if (this.colName === "profiles" && this.payload && typeof this.payload === "object") {
          if (this.payload.xp !== undefined && this.payload.level === undefined) {
            this.payload.level = calculateLevel(Number(this.payload.xp) || 0);
          }
        }

        const idFilter = this.filters.find((f) => f.field === "id" && f.op === "==");
        if (idFilter && idFilter.value != null) {
          const directId = String(idFilter.value);
          if (this.colName === "profiles" && this.payload?.xp !== undefined) {
            try {
              void checkAndApplyLevelUp(directId, Number(this.payload.xp));
            } catch {}
          }
          const updated = gameDataStore.updateRow(this.colName, directId, this.payload);
          notifyTableChange(this.colName, "UPDATE", updated || { id: directId, ...this.payload });
          if (SHARED_FIRESTORE_TABLES.has(this.colName)) {
            try {
              const docRef = doc(db, this.colName, directId);
              await setDoc(
                docRef,
                cleanForFirestore({
                  ...this.payload,
                  id: directId,
                  updated_at: new Date().toISOString(),
                }),
                { merge: true }
              );
            } catch (err) {
              console.warn(`Firestore direct update sync error on ${this.colName}:`, err);
            }
          }
        }

        const { data: matched } = await this.fetchDocs();
        if (matched && matched.length > 0) {
          for (const item of matched) {
            const updated = gameDataStore.updateRow(this.colName, item.id, this.payload);
            notifyTableChange(this.colName, "UPDATE", updated, item);
            if (SHARED_FIRESTORE_TABLES.has(this.colName)) {
              try {
                const docRef = doc(db, this.colName, String(item.id));
                await setDoc(
                  docRef,
                  cleanForFirestore({
                    ...item,
                    ...this.payload,
                    updated_at: new Date().toISOString(),
                  }),
                  { merge: true }
                );
              } catch (err) {
                console.warn(`Firestore update sync error on ${this.colName}:`, err);
              }
            }
          }
        }
        return { data: this.payload, count: matched?.length || (idFilter ? 1 : 0), error: null };
      }

      // Default select
      return await this.fetchDocs();
    } catch (err) {
      console.warn(`[LocalStore ${this.opType} on ${this.colName}]`, err);
      return { data: null, count: 0, error: err as Error };
    }
  }

  private async fetchDocs(): Promise<{ data: any[] | null; count: number; error: Error | null }> {
    try {
      // Sync from shared Firestore collection if applicable
      if (typeof window !== "undefined" && SHARED_FIRESTORE_TABLES.has(this.colName)) {
        const lastFetch = lastFirestoreFetchTime[this.colName] || 0;
        const ttl = this.colName === "active_players" ? 2000 : 4000;
        if (Date.now() - lastFetch > ttl) {
          lastFirestoreFetchTime[this.colName] = Date.now();
          try {
            const snap = await getDocs(collection(db, this.colName));
            if (!snap.empty) {
              for (const d of snap.docs) {
                if (!gameDataStore.isDeleted(this.colName, d.id)) {
                  const row = { ...d.data(), id: d.id };
                  gameDataStore.upsertRow(this.colName, row);
                }
              }
            }
          } catch (e) {
            console.warn(`Firestore read sync error on ${this.colName}:`, e);
          }
        }

        // When fetching products or queries needing vendors, also ensure vendors are synced
        if (this.colName === "products" || (this.selectFields && this.selectFields.includes("vendors"))) {
          const lastVendorFetch = lastFirestoreFetchTime["vendors"] || 0;
          if (Date.now() - lastVendorFetch > 4000) {
            lastFirestoreFetchTime["vendors"] = Date.now();
            try {
              const vSnap = await getDocs(collection(db, "vendors"));
              if (!vSnap.empty) {
                for (const d of vSnap.docs) {
                  gameDataStore.upsertRow("vendors", { ...d.data(), id: d.id });
                }
              }
            } catch (e) {
              console.warn("Firestore vendors read sync error:", e);
            }
          }
        }
      }

      // Get complete array from local resilient store
      const allRows = gameDataStore.getTable(this.colName);
      let list = [...allRows];

      // Apply standard filters
      for (const f of this.filters) {
        list = list.filter((docItem: any) => {
          const val = docItem[f.field];
          switch (f.op) {
            case "==":
              return val == f.value;
            case "!=":
              return val != f.value;
            case ">":
              return val > f.value;
            case ">=":
              return val >= f.value;
            case "<":
              return val < f.value;
            case "<=":
              return val <= f.value;
            case "in":
              return Array.isArray(f.value) && f.value.includes(val);
            case "is":
              return f.value === null ? val == null : val === f.value;
            case "like":
            case "ilike":
              return String(val ?? "").toLowerCase().includes(String(f.value).toLowerCase());
            case "contains":
              if (Array.isArray(val)) {
                return Array.isArray(f.value) ? f.value.every((x) => val.includes(x)) : val.includes(f.value);
              }
              return String(val ?? "").includes(String(f.value));
            case "overlaps":
              if (Array.isArray(val) && Array.isArray(f.value)) {
                return f.value.some((x) => val.includes(x));
              }
              return false;
            default:
              return true;
          }
        });
      }

      // Apply OR conditions
      for (const orStr of this.orConditions) {
        const parts = orStr.split(",");
        list = list.filter((docItem: any) => {
          return parts.some((p) => {
            const segments = p.trim().split(".");
            if (segments.length < 3) return false;
            const field = segments[0];
            const op = segments[1];
            let rawVal = segments.slice(2).join(".");
            rawVal = rawVal.replace(/^\{|\}$/g, "");

            const docVal = docItem[field];
            if (op === "eq") {
              return String(docVal) === rawVal || docVal == rawVal;
            }
            if (op === "neq") {
              return String(docVal) !== rawVal;
            }
            if (op === "cs" || op === "contains") {
              if (Array.isArray(docVal)) return docVal.includes(rawVal);
              return String(docVal ?? "").includes(rawVal);
            }
            if (op === "is") {
              return rawVal === "null" ? docVal == null : String(docVal) === rawVal;
            }
            if (op === "ilike" || op === "like") {
              return String(docVal ?? "").toLowerCase().includes(rawVal.toLowerCase());
            }
            return false;
          });
        });
      }

      // Apply ordering
      if (this.orderField) {
        const ofield = this.orderField;
        const dir = this.orderDirection === "desc" ? -1 : 1;
        list.sort((a: any, b: any) => {
          const va = a[ofield];
          const vb = b[ofield];
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
          return String(va).localeCompare(String(vb)) * dir;
        });
      }

      const totalMatching = list.length;

      // Apply range & limit
      if (typeof this.rangeFrom === "number" && typeof this.rangeTo === "number") {
        list = list.slice(this.rangeFrom, this.rangeTo + 1);
      } else if (this.limitCount) {
        list = list.slice(0, this.limitCount);
      }

      // Auto-populate nested relations if requested in selectFields
      if (this.selectFields && this.selectFields !== "*") {
        if (this.selectFields.includes("products(") || this.selectFields.includes("products.")) {
          for (const item of list) {
            if (item.product_id && !item.products) {
              const pData = gameDataStore.getById("products", item.product_id);
              if (pData) {
                item.products = { name: pData.name, sku: pData.sku || null, image_url: pData.image_url || null };
              }
            }
          }
        }

        if (this.selectFields.includes("cosmetics(") || this.selectFields.includes("cosmetics.")) {
          for (const item of list) {
            if (item.cosmetic_id && !item.cosmetics) {
              const cData = gameDataStore.getById("cosmetics", item.cosmetic_id);
              if (cData) {
                item.cosmetics = {
                  name: cData.name,
                  layer_type: cData.layer_type,
                  image_url: cData.image_url || null,
                  thumbnail_url: cData.thumbnail_url || null,
                };
              }
            }
          }
        }

        if (this.selectFields.includes("npc_appearances(") || this.selectFields.includes("npc_appearances.")) {
          for (const item of list) {
            if (item.appearance_id && !item.npc_appearances) {
              const aData = gameDataStore.getById("npc_appearances", item.appearance_id);
              if (aData) {
                item.npc_appearances = aData;
              }
            }
          }
        }

        if (this.selectFields.includes("vendors(") || this.selectFields.includes("vendors.")) {
          for (const item of list) {
            if (item.vendor_id && !item.vendors) {
              const vData = gameDataStore.getById("vendors", item.vendor_id);
              if (vData) {
                item.vendors = { id: vData.id, shop_name: vData.shop_name || "ונדור", user_id: vData.user_id };
              } else {
                item.vendors = { id: item.vendor_id, shop_name: "ונדור רשום", user_id: "" };
              }
            }
          }
        }
      }

      if (this.selectOptions?.head) {
        return { data: null, count: totalMatching, error: null };
      }

      return { data: list, count: totalMatching, error: null };
    } catch (err) {
      console.warn(`[LocalStore fetchDocs on ${this.colName}]`, err);
      return { data: [], count: 0, error: err as Error };
    }
  }

  async maybeSingle(): Promise<{ data: any | null; count?: number; error: Error | null }> {
    this.limitCount = 1;
    const res = await this.execute();
    if (res.error) return { data: null, count: 0, error: res.error };
    const arr = Array.isArray(res.data) ? res.data : [res.data];
    return { data: arr && arr.length > 0 ? arr[0] : null, count: res.count, error: null };
  }

  async single(): Promise<{ data: any | null; count?: number; error: Error | null }> {
    this.limitCount = 1;
    const res = await this.execute();
    if (res.error) return { data: null, count: 0, error: res.error };
    const arr = Array.isArray(res.data) ? res.data : [res.data];
    if (!arr || arr.length === 0 || !arr[0]) return { data: null, count: 0, error: new Error("No rows found") };
    return { data: arr[0], count: res.count, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any | null; count?: number; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// Current active auth state
let currentAuthUser: User | null = getLocalStoredUser();
const authListeners = new Set<(event: string, session: Session | null) => void>();

function notifyAuthChange(event: string, session: Session | null) {
  for (const listener of authListeners) {
    try {
      listener(event, session);
    } catch {}
  }
}

// Listen to Firebase auth changes when possible
if (typeof window !== "undefined") {
  try {
    onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const mapped = mapFirebaseUser(fbUser)!;
        currentAuthUser = mapped;
        setLocalStoredUser(mapped);
        ensureLocalProfile(mapped.id, mapped.email, mapped.user_metadata?.username);
        const token = await fbUser.getIdToken().catch(() => "local-token");
        notifyAuthChange("SIGNED_IN", { access_token: token, user: mapped });
      } else {
        const local = getLocalStoredUser();
        if (local) {
          currentAuthUser = local;
          ensureLocalProfile(local.id, local.email, local.user_metadata?.username);
          notifyAuthChange("SIGNED_IN", { access_token: "local-token", user: local });
        } else {
          currentAuthUser = null;
          notifyAuthChange("SIGNED_OUT", null);
        }
      }
    });
  } catch {}
}

export const supabase = {
  from(tableName: string) {
    return new QueryBuilder(tableName);
  },

  async rpc(funcName: string, params: Record<string, any> = {}): Promise<{ data: any; error: Error | null }> {
    try {
      const activeUser = currentAuthUser || getLocalStoredUser();

      if (funcName === "get_public_profiles") {
        const ids: string[] = Array.isArray(params._ids) ? params._ids : [];
        if (ids.length === 0) return { data: [], error: null };
        const results = await Promise.all(
          ids.map(async (uid) => {
            let d = gameDataStore.getById("profiles", uid);
            if (!d) {
              try {
                const snap = await getDoc(doc(db, "profiles", uid));
                if (snap.exists()) {
                  d = { ...snap.data(), id: uid };
                  gameDataStore.upsertRow("profiles", d);
                }
              } catch {}
            }
            if (d) {
              const playerXp = Number(d.xp) || 0;
              const playerLvl = d.level ? Math.max(Number(d.level) || 1, calculateLevel(playerXp)) : calculateLevel(playerXp);
              return {
                id: uid,
                username: d.username || "Player",
                display_name: d.display_name || d.username || "Player",
                avatar_config: d.avatar_config || {},
                character_id: d.character_id || null,
                level: playerLvl,
                xp: playerXp,
                active_title_id: d.active_title_id || null,
              };
            }
            return { id: uid, username: "Player", display_name: "Player", avatar_config: {}, character_id: null, level: 1, xp: 0 };
          })
        );
        return { data: results, error: null };
      }

      if (funcName === "get_my_clue_progress") {
        return { data: [], error: null };
      }

      if (funcName === "has_role") {
        const uid = params._user_id || activeUser?.id;
        const role = params._role;
        if (!uid || !role) return { data: false, error: null };
        if (role === "admin" || role === "owner") {
          const adm = gameDataStore.getById("admins", uid);
          if (adm) return { data: true, error: null };
        }
        const roles = gameDataStore.getTable("user_roles").filter((r) => String(r.user_id) === String(uid));
        const has = roles.some((r) => r.role === role);
        return { data: has, error: null };
      }

      if (!activeUser) return { data: null, error: new Error("Not authenticated") };

      if (funcName === "progress_quest") {
        const action = params._action_type;
        const amount = params._amount || 1;
        const allQuests = gameDataStore.getTable("quests").filter((q) => q.active !== false);
        const matching = allQuests.filter((q) => {
          const act = (q.action_type || "").toLowerCase();
          const slug = (q.slug || "").toLowerCase();
          const name = (q.name || "").toLowerCase();
          if (action === "visit_store" || action === "visit_stores") {
            return act === "visit_store" || slug.includes("store") || name.includes("חנות") || name.includes("חנויות");
          }
          if (action === "visit_npc") {
            return act === "visit_npc" || slug.includes("npc") || name.includes("npc") || name.includes("מדריך");
          }
          if (action === "login") {
            return act === "login" || slug.includes("login") || name.includes("התחברות");
          }
          if (action === "spin_wheel") {
            return act === "spin_wheel" || slug.includes("spin") || name.includes("גלגל");
          }
          if (action === "chat" || action === "send_chat") {
            return act === "chat" || slug.includes("chat") || name.includes("שלום") || name.includes("צ'אט");
          }
          return act === action || q.id === action;
        });

        for (const q of matching) {
          const qId = q.id;
          const pqId = `${activeUser.id}_${qId}`;
          const existing = gameDataStore.getById("player_quests", pqId);
          const prev = Number(existing?.progress) || 0;
          const target = Number(q.target_amount) || 1;
          const next = Math.min(target, prev + amount);
          gameDataStore.upsertRow("player_quests", {
            id: pqId,
            user_id: activeUser.id,
            quest_id: qId,
            progress: next,
            period_key: q.quest_type === "daily" ? new Date().toISOString().slice(0, 10) : "once",
            updated_at: new Date().toISOString(),
          });
        }
        return { data: { ok: true }, error: null };
      }

      if (funcName === "claim_quest_reward") {
        const questId = params._quest_id;
        const qData = gameDataStore.getById("quests", questId);
        const creditReward = Number(qData?.credit_reward || qData?.gems_reward || 50);
        const xpReward = Number(qData?.xp_reward || 20);

        const prof = gameDataStore.getById("profiles", activeUser.id) || { credits: 500, xp: 0, level: 1 };
        const newCredits = (prof.credits || 0) + creditReward;
        gameDataStore.updateRow("profiles", activeUser.id, { credits: newCredits });

        // Add XP and trigger level up logic, rewards and events
        await addPlayerXp(activeUser.id, xpReward, `פרס משימה: ${qData?.name || "משימה"}`);

        gameDataStore.upsertRow("player_quests", {
          id: `${activeUser.id}_${questId}`,
          user_id: activeUser.id,
          quest_id: questId,
          claimed_at: new Date().toISOString(),
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("credits-changed"));
        }
        return { data: { ok: true }, error: null };
      }

      if (funcName === "get_auction_bid_feed") {
        const aId = params._auction_id;
        if (!aId) return { data: [], error: null };
        const bids = gameDataStore
          .getTable("auction_bids")
          .filter((b) => b.auction_id === aId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, params._limit || 10);
        return { data: bids, error: null };
      }

      if (funcName === "place_auction_bid") {
        const aId = params._auction_id;
        const aData = gameDataStore.getById("auctions", aId);
        const nextBid = (aData?.current_highest_bid || aData?.starting_bid || 10) + (aData?.min_increment || 5);

        const prof = gameDataStore.getById("profiles", activeUser.id) || { credits: 500 };
        if ((prof.credits || 0) < nextBid) return { data: null, error: new Error("Insufficient credits") };

        const newBal = (prof.credits || 0) - nextBid;
        gameDataStore.updateRow("profiles", activeUser.id, { credits: newBal });

        const bidId = crypto.randomUUID();
        gameDataStore.upsertRow("auction_bids", {
          id: bidId,
          auction_id: aId,
          user_id: activeUser.id,
          bid_amount: nextBid,
          created_at: new Date().toISOString(),
        });

        gameDataStore.updateRow("auctions", aId, {
          current_highest_bid: nextBid,
          highest_bidder_id: activeUser.id,
          bid_count: (aData?.bid_count || 0) + 1,
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("credits-changed"));
        }
        return { data: { ok: true, bid_amount: nextBid }, error: null };
      }

      if (funcName === "buy_and_equip_cosmetic" || funcName === "purchase_cosmetic") {
        const cosmeticId = params._cosmetic_id;
        const cosmetic = gameDataStore.getById("cosmetics", cosmeticId);
        const price = cosmetic?.credit_price || 0;

        const prof = gameDataStore.getById("profiles", activeUser.id) || { credits: 500 };
        const currentCredits = prof.credits || 0;

        if (currentCredits < price) {
          return { data: null, error: new Error("אין מספיק קרדיטים לרכישה") };
        }

        const newBal = currentCredits - price;
        const avatarConfig = { ...(prof.avatar_config || {}), [cosmetic?.layer_type || "hat"]: cosmeticId };

        gameDataStore.updateRow("profiles", activeUser.id, { credits: newBal, avatar_config: avatarConfig });
        gameDataStore.upsertRow("player_cosmetics", {
          id: `${activeUser.id}_${cosmeticId}`,
          user_id: activeUser.id,
          cosmetic_id: cosmeticId,
          source: "purchase",
          created_at: new Date().toISOString(),
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("credits-changed"));
        }
        return { data: { ok: true, new_balance: newBal, avatar_config: avatarConfig }, error: null };
      }

      if (funcName === "spin_wheel") {
        const wheelId = params._wheel_id;
        const wheel = gameDataStore.getById("wheel_configs", wheelId) || { spin_cost_credits: 50, rewards: [] };
        const cost = wheel.spin_cost_credits || 0;

        const prof = gameDataStore.getById("profiles", activeUser.id) || { credits: 500 };
        const currentCredits = prof.credits || 0;

        if (currentCredits < cost) {
          return { data: null, error: new Error("אין מספיק קרדיטים לסיבוב זה") };
        }

        const rewards = Array.isArray(wheel.rewards) && wheel.rewards.length > 0
          ? wheel.rewards
          : [{ type: "credits", amount: 100, label: "100 קרדיטים", weight: 10 }];

        // Weighted random selection
        const totalWeight = rewards.reduce((sum: number, r: any) => sum + (Number(r.weight) || 1), 0);
        let rand = Math.random() * totalWeight;
        let chosenIndex = 0;
        let pick = rewards[0];
        for (let i = 0; i < rewards.length; i++) {
          const w = Number(rewards[i].weight) || 1;
          if (rand < w) {
            chosenIndex = i;
            pick = rewards[i];
            break;
          }
          rand -= w;
        }

        let newBal = currentCredits - cost;

        // Process reward
        if (pick.type === "credits") {
          newBal += Number(pick.amount) || 0;
        } else if (pick.type === "product" || pick.product_id) {
          const pid = pick.product_id || pick.id;
          let prodName = pick.name || pick.label || "מוצר יריד";
          let prodSku = pick.sku || null;
          let prodImage = pick.image_url || null;

          if (pid) {
            const pData = gameDataStore.getById("products", pid);
            if (pData) {
              prodName = pData.name || prodName;
              prodSku = pData.sku || prodSku;
              prodImage = pData.image_url || prodImage;
              if (!pData.unlimited_stock) {
                const currentStock = typeof pData.stock === "number" ? pData.stock : 1;
                gameDataStore.updateRow("products", pid, { stock: Math.max(0, currentStock - 1) });
              }
            }
          }

          const orderId = crypto.randomUUID();
          const orderNumber = Math.floor(100000 + Math.random() * 900000);
          gameDataStore.upsertRow("orders", {
            id: orderId,
            user_id: activeUser.id,
            product_id: pid || null,
            order_number: orderNumber,
            order_type: "wheel",
            status: "completed",
            fulfillment_status: "awaiting_request",
            credits_charged: cost,
            shipping_method: null,
            delivery_address: null,
            products: { name: prodName, sku: prodSku, image_url: prodImage },
            created_at: new Date().toISOString(),
          });
        } else if (pick.type === "cosmetic" || pick.cosmetic_id) {
          const cid = pick.cosmetic_id || pick.id;
          if (cid) {
            gameDataStore.upsertRow("player_cosmetics", {
              id: `${activeUser.id}_${cid}`,
              user_id: activeUser.id,
              cosmetic_id: cid,
              source: "wheel",
              acquired_at: new Date().toISOString(),
            });
          }
        }

        gameDataStore.updateRow("profiles", activeUser.id, { credits: newBal });

        // Record spin
        gameDataStore.upsertRow("wheel_spins", {
          id: crypto.randomUUID(),
          user_id: activeUser.id,
          wheel_id: wheelId,
          credits_spent: cost,
          reward: pick,
          created_at: new Date().toISOString(),
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("credits-changed"));
        }
        return { data: { ok: true, reward: pick, index: chosenIndex, new_balance: newBal }, error: null };
      }

      if (funcName === "open_mystery_box") {
        const boxId = params._box_id;
        const box = gameDataStore.getById("mystery_boxes", boxId) || { credit_price: 50, items: [] };
        const price = box.credit_price || 0;

        const prof = gameDataStore.getById("profiles", activeUser.id) || { credits: 500 };
        if ((prof.credits || 0) < price) return { data: null, error: new Error("אין מספיק קרדיטים לתיבה זו") };

        const items = Array.isArray(box.items) && box.items.length > 0
          ? box.items
          : [{ type: "credits", amount: price * 2, label: "בונוס קרדיטים", weight: 10 }];

        const totalWeight = items.reduce((sum: number, r: any) => sum + (Number(r.weight) || 1), 0);
        let rand = Math.random() * totalWeight;
        let pick = items[0];
        for (let i = 0; i < items.length; i++) {
          const w = Number(items[i].weight) || 1;
          if (rand < w) {
            pick = items[i];
            break;
          }
          rand -= w;
        }

        let newBal = (prof.credits || 0) - price;

        if (pick.type === "credits") {
          newBal += Number(pick.amount) || 0;
        } else if (pick.type === "product" || pick.product_id) {
          const pid = pick.product_id || pick.id;
          let prodName = pick.name || pick.label || "מוצר מסתורין";
          let prodSku = pick.sku || null;
          let prodImage = pick.image_url || null;

          if (pid) {
            const pData = gameDataStore.getById("products", pid);
            if (pData) {
              prodName = pData.name || prodName;
              prodSku = pData.sku || prodSku;
              prodImage = pData.image_url || prodImage;
              if (!pData.unlimited_stock) {
                const currentStock = typeof pData.stock === "number" ? pData.stock : 1;
                gameDataStore.updateRow("products", pid, { stock: Math.max(0, currentStock - 1) });
              }
            }
          }

          const orderId = crypto.randomUUID();
          const orderNumber = Math.floor(100000 + Math.random() * 900000);
          gameDataStore.upsertRow("orders", {
            id: orderId,
            user_id: activeUser.id,
            product_id: pid || null,
            order_number: orderNumber,
            order_type: "mystery_box",
            status: "completed",
            fulfillment_status: "awaiting_request",
            credits_charged: price,
            products: { name: prodName, sku: prodSku, image_url: prodImage },
            created_at: new Date().toISOString(),
          });
        } else if (pick.type === "cosmetic" || pick.cosmetic_id) {
          const cid = pick.cosmetic_id || pick.id;
          if (cid) {
            gameDataStore.upsertRow("player_cosmetics", {
              id: `${activeUser.id}_${cid}`,
              user_id: activeUser.id,
              cosmetic_id: cid,
              source: "mystery_box",
              acquired_at: new Date().toISOString(),
            });
          }
        }

        gameDataStore.updateRow("profiles", activeUser.id, { credits: newBal });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("credits-changed"));
        }
        return { data: { ok: true, reward: pick, new_balance: newBal }, error: null };
      }

      if (funcName === "purchase_product") {
        const prodId = params._product_id;
        const prod = gameDataStore.getById("products", prodId);
        const price = prod?.credit_price || 0;

        if (!prod) return { data: null, error: new Error("המוצר לא נמצא") };
        if (!prod.unlimited_stock && typeof prod.stock === "number" && prod.stock <= 0) {
          return { data: null, error: new Error("המוצר אזל מהמלאי") };
        }

        const prof = gameDataStore.getById("profiles", activeUser.id) || { credits: 500 };
        const currentCredits = prof.credits || 0;

        if (currentCredits < price) return { data: null, error: new Error("אין מספיק קרדיטים לרכישה") };
        const newBal = currentCredits - price;
        gameDataStore.updateRow("profiles", activeUser.id, { credits: newBal });

        // Decrement product stock
        if (!prod.unlimited_stock) {
          const nextStock = Math.max(0, (typeof prod.stock === "number" ? prod.stock : 1) - 1);
          gameDataStore.updateRow("products", prodId, { stock: nextStock });
        }

        const orderId = crypto.randomUUID();
        const orderNumber = Math.floor(100000 + Math.random() * 900000);
        gameDataStore.upsertRow("orders", {
          id: orderId,
          user_id: activeUser.id,
          product_id: prodId,
          order_number: orderNumber,
          order_type: "product",
          status: "completed",
          credits_charged: price,
          fulfillment_status: "awaiting_request",
          products: {
            name: prod.name,
            sku: prod.sku || null,
            image_url: prod.image_url || null,
          },
          created_at: new Date().toISOString(),
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("credits-changed"));
        }
        return { data: { ok: true, new_balance: newBal, order_id: orderId }, error: null };
      }

      if (funcName === "request_bulk_delivery") {
        const orderIds: string[] = Array.isArray(params._order_ids) ? params._order_ids : [];
        const method = params._method || "pickup";
        const address = params._address || "";
        const shipmentNumber = Math.floor(100000 + Math.random() * 900000);
        for (const oid of orderIds) {
          gameDataStore.updateRow("orders", oid, {
            fulfillment_status: "in_transit",
            shipping_method: method,
            delivery_address: address,
            shipment_number: shipmentNumber,
          });
        }
        return { data: { ok: true, updated: orderIds.length }, error: null };
      }

      if (funcName === "mark_order_delivered") {
        const oId = params._order_id;
        if (oId) {
          gameDataStore.updateRow("orders", oId, { fulfillment_status: "delivered", status: "completed" });
        }
        return { data: { ok: true }, error: null };
      }

      if (funcName.startsWith("get_") || funcName.includes("feed") || funcName.includes("list")) {
        return { data: [], error: null };
      }

      return { data: { ok: true }, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  },

  auth: {
    async signInAsGuest() {
      return {
        data: { user: null, session: null },
        error: new Error("כניסה כאורח מבוטלת. יש להתחבר או ליצור חשבון כדי לשחק."),
      };
    },

    async signInWithOAuth(params?: { provider?: string }) {
      const p = (params?.provider || "google").toLowerCase();
      let selectedProvider: any = googleProvider;
      if (p === "facebook" || p === "meta") {
        selectedProvider = metaProvider;
      } else if (p === "apple" || p === "apple.com") {
        selectedProvider = appleProvider;
      }

      try {
        const cred = await signInWithPopup(auth, selectedProvider);
        const mapped = mapFirebaseUser(cred.user)!;
        currentAuthUser = mapped;
        setLocalStoredUser(mapped);
        ensureLocalProfile(mapped.id, mapped.email, mapped.user_metadata?.username);
        const token = await cred.user.getIdToken();
        notifyAuthChange("SIGNED_IN", { access_token: token, user: mapped });

        return {
          data: { user: mapped, session: { access_token: token, user: mapped } },
          error: null,
        };
      } catch (err: any) {
        console.warn(`OAuth sign-in popup error for ${p}:`, err);
        const code = String(err?.code || "");
        const message = String(err?.message || "");
        const isNotAllowed =
          code === "auth/operation-not-allowed" ||
          code === "auth/unauthorized-domain" ||
          code === "auth/admin-restricted-operation" ||
          message.includes("operation-not-allowed") ||
          message.includes("unauthorized");

        return {
          data: { user: null, session: null },
          error: {
            ...err,
            code: err?.code || (isNotAllowed ? "auth/operation-not-allowed" : "auth/unknown"),
            message: err?.message || "OAuth login failed",
            isNotAllowed,
            provider: p,
          },
        };
      }
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const isOwnerLogin =
        email.toLowerCase() === "coltcollect@gmail.com" ||
        email.toLowerCase() === "coltcollect" ||
        email.toLowerCase() === "astratego@colt.market";

      try {
        const loginEmail = email.includes("@") ? email : `${email}@colt.local`;
        const cred = await signInWithEmailAndPassword(auth, loginEmail, password);
        const mapped = mapFirebaseUser(cred.user)!;
        currentAuthUser = mapped;
        setLocalStoredUser(mapped);
        ensureLocalProfile(mapped.id, mapped.email, isOwnerLogin ? "ColtCollect" : mapped.user_metadata?.username);
        const token = await cred.user.getIdToken();
        notifyAuthChange("SIGNED_IN", { access_token: token, user: mapped });

        return {
          data: { user: mapped, session: { access_token: token, user: mapped } },
          error: null,
        };
      } catch (err) {
        return { data: { user: null, session: null }, error: err as Error };
      }
    },

    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { username?: string } } }) {
      const username = options?.data?.username || email.split("@")[0];
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const mapped = mapFirebaseUser(cred.user)!;
        currentAuthUser = mapped;
        setLocalStoredUser(mapped);
        ensureLocalProfile(mapped.id, email, username);
        const token = await cred.user.getIdToken();
        notifyAuthChange("SIGNED_IN", { access_token: token, user: mapped });

        return {
          data: { user: mapped, session: { access_token: token, user: mapped } },
          error: null,
        };
      } catch (err) {
        // Fallback local sign up
        const localId = "user_" + Math.random().toString(36).substring(2, 9);
        const localUser: User = { id: localId, email, user_metadata: { username } };
        currentAuthUser = localUser;
        setLocalStoredUser(localUser);
        ensureLocalProfile(localId, email, username);
        notifyAuthChange("SIGNED_IN", { access_token: "local-token", user: localUser });
        return {
          data: { user: localUser, session: { access_token: "local-token", user: localUser } },
          error: null,
        };
      }
    },

    async signOut() {
      try {
        await fbSignOut(auth).catch(() => {});
      } catch {}
      currentAuthUser = null;
      setLocalStoredUser(null);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(LOCAL_SESSION_KEY);
          sessionStorage.clear();
        } catch {}
      }
      notifyAuthChange("SIGNED_OUT", null);
      return { error: null };
    },

    async getSession() {
      const fbUser = auth.currentUser;
      if (fbUser) {
        const mapped = mapFirebaseUser(fbUser)!;
        const token = await fbUser.getIdToken().catch(() => "local-token");
        return { data: { session: { access_token: token, user: mapped } }, error: null };
      }
      const local = currentAuthUser || getLocalStoredUser();
      if (local) {
        return { data: { session: { access_token: "local-token", user: local } }, error: null };
      }
      return { data: { session: null }, error: null };
    },

    async getUser() {
      const fbUser = auth.currentUser;
      if (fbUser) {
        return { data: { user: mapFirebaseUser(fbUser) }, error: null };
      }
      const local = currentAuthUser || getLocalStoredUser();
      return { data: { user: local }, error: null };
    },

    async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
      try {
        await sendPasswordResetEmail(auth, email);
        return { data: {}, error: null };
      } catch (err) {
        return { data: {}, error: null };
      }
    },

    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
      authListeners.add(callback);

      // Provide current state immediately
      setTimeout(() => {
        const current = currentAuthUser || getLocalStoredUser();
        if (current) {
          callback("SIGNED_IN", { access_token: "local-token", user: current });
        } else {
          callback("SIGNED_OUT", null);
        }
      }, 0);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },

  channel(channelName: string, _opts?: any) {
    const chObj = {
      on(event: string, filterOrCb: any, callback?: (payload: any) => void) {
        if (event === "postgres_changes") {
          const opts = typeof filterOrCb === "object" ? filterOrCb : {};
          const cb = typeof filterOrCb === "function" ? filterOrCb : callback;
          if (cb) {
            const listener: TableListener = {
              table: opts.table || "*",
              event: opts.event || "*",
              filter: opts.filter,
              callback: cb,
            };
            tableChangeListeners.push(listener);
          }
          return chObj;
        }
        const cb = typeof filterOrCb === "function" ? filterOrCb : callback;
        if (cb) {
          let list = activeChannels.get(channelName);
          if (!list) {
            list = [];
            activeChannels.set(channelName, list);
          }
          list.push(cb);
        }
        return chObj;
      },
      subscribe(callback?: (status: string) => void) {
        if (callback) setTimeout(() => callback("SUBSCRIBED"), 0);
        return chObj;
      },
      unsubscribe() {
        return chObj;
      },
      send(payload: any) {
        const list = activeChannels.get(channelName) ?? [];
        for (const cb of list) {
          try {
            cb(payload);
          } catch {}
        }
        return Promise.resolve("ok");
      },
      track(_state: any) {
        return Promise.resolve("ok");
      },
      untrack() {
        return Promise.resolve("ok");
      },
    };
    return chObj;
  },

  removeChannel(_channel: any) {},

  storage: {
    from(bucketName: string) {
      return {
        async upload(filePath: string, file: any, _options?: any) {
          try {
            let dataUrl = "";
            if (file instanceof Blob || (typeof File !== "undefined" && file instanceof File)) {
              dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
            } else if (typeof file === "string") {
              dataUrl = file;
            }
            if (dataUrl) {
              try {
                sessionStorage.setItem(`storage_${bucketName}_${filePath}`, dataUrl);
              } catch {}
            }
            return { data: { path: filePath, fullPath: `${bucketName}/${filePath}` }, error: null };
          } catch (err: any) {
            return { data: null, error: err };
          }
        },
        async createSignedUrl(filePath: string, _expiresIn?: number) {
          let url = "";
          try {
            url = sessionStorage.getItem(`storage_${bucketName}_${filePath}`) || "";
          } catch {}
          if (!url) {
            url = filePath.startsWith("http") || filePath.startsWith("data:")
              ? filePath
              : `https://live.colt-collectibles.com/${filePath}`;
          }
          return { data: { signedUrl: url }, error: null };
        },
        async createSignedUrls(paths: string[], _expiresIn?: number) {
          const data = paths.map((p) => {
            let url = "";
            try {
              url = sessionStorage.getItem(`storage_${bucketName}_${p}`) || "";
            } catch {}
            return {
              error: null,
              path: p,
              signedUrl: url || (p.startsWith("http") ? p : `https://live.colt-collectibles.com/${p}`),
            };
          });
          return { data, error: null };
        },
        getPublicUrl(filePath: string) {
          let url = "";
          try {
            url = sessionStorage.getItem(`storage_${bucketName}_${filePath}`) || "";
          } catch {}
          if (!url) {
            url = filePath.startsWith("http") || filePath.startsWith("data:")
              ? filePath
              : `https://live.colt-collectibles.com/${filePath}`;
          }
          return { data: { publicUrl: url } };
        },
        async remove(paths: string[]) {
          paths.forEach((p) => {
            try {
              sessionStorage.removeItem(`storage_${bucketName}_${p}`);
            } catch {}
          });
          return { data: paths.map((p) => ({ name: p })), error: null };
        },
        async list(_folder?: string, _options?: any) {
          return { data: [], error: null };
        },
      };
    },
  },
};
