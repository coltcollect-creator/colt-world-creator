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
];

for (const t of requiredTables) {
  if (!store[t]) store[t] = [];
}

// Load persisted local overrides from localStorage
const LOCAL_STORAGE_KEY = "colt_world_db_overrides_v1";

function loadPersistedOverrides() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const overrides = JSON.parse(raw);
    for (const [table, rows] of Object.entries(overrides)) {
      if (!Array.isArray(rows)) continue;
      if (!store[table]) store[table] = [];
      for (const row of rows as Row[]) {
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
      // We only persist tables that users mutate directly to avoid storage bloat
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
      ];
      const payload: Record<string, Row[]> = {};
      for (const t of persistable) {
        if (store[t]) {
          payload[t] = store[t];
        }
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("LocalStorage save error:", e);
    }
  }, 100);
}

loadPersistedOverrides();

export const gameDataStore = {
  getTable(tableName: string): Row[] {
    if (!store[tableName]) store[tableName] = [];
    return store[tableName];
  },

  getById(tableName: string, id: string | number): Row | null {
    const table = this.getTable(tableName);
    return table.find((r) => String(r.id) === String(id)) || null;
  },

  upsertRow(tableName: string, row: Row): Row {
    const table = this.getTable(tableName);
    const id = row.id != null ? String(row.id) : crypto.randomUUID();
    const dataToSave = {
      ...row,
      id,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const idx = table.findIndex((r) => String(r.id) === id);
    if (idx >= 0) {
      table[idx] = { ...table[idx], ...dataToSave };
    } else {
      table.push(dataToSave);
    }
    scheduleSave(tableName);
    return dataToSave;
  },

  updateRow(tableName: string, id: string | number, updates: Partial<Row>): Row | null {
    const table = this.getTable(tableName);
    const idx = table.findIndex((r) => String(r.id) === String(id));
    if (idx >= 0) {
      table[idx] = { ...table[idx], ...updates, updated_at: new Date().toISOString() };
      scheduleSave(tableName);
      return table[idx];
    }
    return null;
  },

  deleteRow(tableName: string, id: string | number): boolean {
    const table = this.getTable(tableName);
    const idx = table.findIndex((r) => String(r.id) === String(id));
    if (idx >= 0) {
      table.splice(idx, 1);
      scheduleSave(tableName);
      return true;
    }
    return false;
  },
};
