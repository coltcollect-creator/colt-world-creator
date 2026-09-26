import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, writeBatch } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const SUPABASE_URL = "https://vyfnbstbfekoxkcoctpd.supabase.co/rest/v1/";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Zm5ic3RiZmVrb3hrY29jdHBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDMyMjgzNiwiZXhwIjoyMTA1ODk4ODM2fQ.d8nBSRaJlXfwtLT5nbRWyOWC17yqmOQIHDBxQX2WcIQ";

const TABLES = [
  "game_settings",
  "profiles",
  "user_roles",
  "maps",
  "map_versions",
  "map_objects",
  "stores",
  "products",
  "characters",
  "character_roles",
  "npcs",
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
];

async function fetchTable(tableName: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}${tableName}?select=*`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    console.warn(`Could not fetch ${tableName}: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function migrate() {
  console.log("🚀 Starting migration from Supabase to Firebase Firestore...");
  let totalRecords = 0;

  for (const table of TABLES) {
    try {
      const records = await fetchTable(table);
      console.log(`📥 Fetched ${records.length} records from '${table}'`);
      if (records.length === 0) continue;

      // Write in batches of 400
      const BATCH_SIZE = 400;
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const chunk = records.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const row of chunk) {
          const docId = String(row.id || row.user_id || `${table}_${Math.random().toString(36).substring(2)}`);
          const docRef = doc(db, table, docId);
          // Clean undefined values
          const cleanRow: Record<string, any> = {};
          for (const [k, v] of Object.entries(row)) {
            if (v !== undefined) {
              cleanRow[k] = v;
            }
          }
          batch.set(docRef, cleanRow, { merge: true });
        }

        await batch.commit();
        totalRecords += chunk.length;
        console.log(`  ✅ Wrote batch of ${chunk.length} to Firestore '${table}'`);
      }
    } catch (err: any) {
      console.error(`❌ Error migrating table '${table}':`, err.message);
    }
  }

  // Also setup admin records for owner
  try {
    const ownerRoles = await fetchTable("user_roles");
    for (const r of ownerRoles) {
      if (r.role === "owner" || r.role === "admin") {
        await setDoc(doc(db, "admins", r.user_id), {
          user_id: r.user_id,
          role: r.role,
          created_at: new Date().toISOString(),
        }, { merge: true });
      }
    }
  } catch (e: any) {
    console.warn("Error setting admins:", e.message);
  }

  console.log(`🎉 Migration completed successfully! Total imported records: ${totalRecords}`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
