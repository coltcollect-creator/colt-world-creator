import baselineData from "./gameDataBaseline.json";

// In-memory data store for resilient, instant offline-first game data
type Row = Record<string, any>;
const store: Record<string, Row[]> = {};

// Initialize from baseline
const baseline = baselineData as Record<string, Row[]>;
for (const [key, rows] of Object.entries(baseline)) {
  store[key] = Array.isArray(rows) ? [...rows] : [];
}

// Ensure essential tables exist
const requiredTables = [
  "game_settings",
  "profiles",
  "user_roles",
  "admins",
  "maps",
  "map_versions",
  "map_objects",
  "stores",
  "products",
  "characters",
  "character_roles",
  "npcs",
  "npc_appearances",
  "cosmetics",
  "player_cosmetics",
  "quests",
  "player_quests",
  "wheel_configs",
  "wheel_spins",
  "mystery_boxes",
  "auctions",
  "auction_bids",
  "credit_transactions",
  "orders",
  "player_notifications",
  "store_conversations",
  "store_messages",
  "vendors",
  "titles",
  "player_titles",
  "music_tracks",
  "album_cards",
  "user_cards",
  "credit_packages",
];

for (const t of requiredTables) {
  if (!store[t]) store[t] = [];
}

// Load persisted local overrides and deletions from localStorage
const LOCAL_STORAGE_KEY = "colt_world_db_overrides_v2";
const LOCAL_STORAGE_DELETED_KEY = "colt_world_db_deleted_ids_v2";

const deletedIdsMap: Record<string, Set<string>> = {};

function loadPersistedOverrides() {
  if (typeof window === "undefined") return;
  try {
    // Purge legacy v1 cache if found to eliminate obsolete dummy accounts
    try {
      localStorage.removeItem("colt_world_db_overrides_v1");
      localStorage.removeItem("colt_world_db_deleted_ids_v1");
    } catch {}

    const rawDeleted = localStorage.getItem(LOCAL_STORAGE_DELETED_KEY);
    if (rawDeleted) {
      const parsed = JSON.parse(rawDeleted);
      for (const [table, ids] of Object.entries(parsed)) {
        if (Array.isArray(ids)) {
          deletedIdsMap[table] = new Set(ids.map(String));
        }
      }
    }

    // Ensure essential baseline maps and version IDs are never mistakenly blocked
    if (deletedIdsMap["maps"]) {
      deletedIdsMap["maps"].delete("colt-grand-expo-2.5d");
      deletedIdsMap["maps"].delete("f5bb3160-7415-4f62-b72c-f04d1fcbd1a9");
      deletedIdsMap["maps"].delete("54cd9d02-e7a0-48a7-b4fb-8356c6bb8ef7");
    }
    if (deletedIdsMap["map_versions"]) {
      deletedIdsMap["map_versions"].delete("ver-colt-grand-expo-v1");
    }

    // Purge any baseline items that were previously marked deleted
    for (const [table, idsSet] of Object.entries(deletedIdsMap)) {
      if (store[table]) {
        store[table] = store[table].filter((r) => !idsSet.has(String(r.id)) && (!r.user_id || !idsSet.has(String(r.user_id))));
      }
    }

    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const overrides = JSON.parse(raw);
    for (const [table, rows] of Object.entries(overrides)) {
      if (!Array.isArray(rows)) continue;
      if (!store[table]) store[table] = [];
      const idsSet = deletedIdsMap[table];
      for (const row of rows as Row[]) {
        if (idsSet && (idsSet.has(String(row.id)) || (row.user_id && idsSet.has(String(row.user_id))))) {
          continue;
        }
        const idx = store[table].findIndex((r) => String(r.id) === String(row.id));
        if (idx >= 0) {
          store[table][idx] = { ...store[table][idx], ...row };
        } else {
          store[table].push(row);
        }
      }
    }
  } catch (err) {
    console.warn("Failed to load local DB overrides:", err);
  }
}

// Persist table changes to localStorage
const dirtyTables = new Set<string>();
let saveTimer: any = null;

function scheduleSave(tableName: string) {
  dirtyTables.add(tableName);
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const persistable = [
        "profiles",
        "orders",
        "player_cosmetics",
        "player_quests",
        "credit_transactions",
        "wheel_spins",
        "store_conversations",
        "store_messages",
        "auction_bids",
        "user_roles",
        "admins",
        "map_objects",
        "map_versions",
        "maps",
        "game_settings",
        "music_tracks",
        "album_cards",
        "user_cards",
        "credit_packages",
      ];
      const payload: Record<string, Row[]> = {};
      for (const t of persistable) {
        if (store[t]) {
          payload[t] = store[t];
        }
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));

      const deletedPayload: Record<string, string[]> = {};
      for (const [t, set] of Object.entries(deletedIdsMap)) {
        if (set.size > 0) {
          deletedPayload[t] = Array.from(set);
        }
      }
      localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(deletedPayload));
    } catch (e) {
      console.warn("LocalStorage save error:", e);
    }
  }, 100);
}

loadPersistedOverrides();

export const gameDataStore = {
  getTable(tableName: string): Row[] {
    if (!store[tableName]) store[tableName] = [];
    const delSet = deletedIdsMap[tableName];
    if (delSet && delSet.size > 0) {
      return store[tableName].filter((r) => !delSet.has(String(r.id)) && (!r.user_id || !delSet.has(String(r.user_id))));
    }
    return store[tableName];
  },

  getAll(tableName: string): Row[] {
    return this.getTable(tableName);
  },

  getById(tableName: string, id: string | number): Row | null {
    const table = this.getTable(tableName);
    return table.find((r) => String(r.id) === String(id)) || null;
  },

  isDeleted(tableName: string, id: string | number): boolean {
    return !!deletedIdsMap[tableName]?.has(String(id));
  },

  set(tableName: string, row: Row): Row {
    return this.upsertRow(tableName, row);
  },

  delete(tableName: string, id: string | number): boolean {
    return this.deleteRow(tableName, id);
  },

  upsertRow(tableName: string, row: Row): Row {
    const table = store[tableName] || (store[tableName] = []);
    const id = row.id != null
      ? String(row.id)
      : (tableName === "active_players" && row.user_id != null ? String(row.user_id) : crypto.randomUUID());
    
    // If it was previously marked deleted, un-delete if explicitly upserted with new data
    if (deletedIdsMap[tableName]?.has(id)) {
      deletedIdsMap[tableName].delete(id);
    }

    const dataToSave = {
      ...row,
      id,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const idx = table.findIndex(
      (r) => String(r.id) === id || (tableName === "active_players" && r.user_id && r.user_id === row.user_id)
    );
    if (idx >= 0) {
      table[idx] = { ...table[idx], ...dataToSave };
    } else {
      table.push(dataToSave);
    }
    scheduleSave(tableName);
    return dataToSave;
  },

  updateRow(tableName: string, id: string | number, updates: Partial<Row>): Row | null {
    const table = store[tableName] || (store[tableName] = []);
    const idx = table.findIndex((r) => String(r.id) === String(id));
    if (idx >= 0) {
      table[idx] = { ...table[idx], ...updates, updated_at: new Date().toISOString() };
      scheduleSave(tableName);
      return table[idx];
    }
    return null;
  },

  deleteRow(tableName: string, id: string | number): boolean {
    const table = store[tableName] || (store[tableName] = []);
    const sid = String(id);
    if (!deletedIdsMap[tableName]) {
      deletedIdsMap[tableName] = new Set<string>();
    }
    deletedIdsMap[tableName].add(sid);

    const idx = table.findIndex((r) => String(r.id) === sid || (tableName === "active_players" && r.user_id && String(r.user_id) === sid));
    if (idx >= 0) {
      table.splice(idx, 1);
    }
    scheduleSave(tableName);
    return true;
  },
};
