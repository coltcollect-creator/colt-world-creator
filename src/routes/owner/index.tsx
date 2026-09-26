import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminSetUserRole, adminDeleteUser } from "@/lib/user-admin.functions";
import { sendSystemMessage } from "@/lib/system-messages.functions";
import { ImageUpload } from "@/components/owner/ImageUpload";
import { CharacterFitPreview } from "@/components/game/CharacterFitPreview";
import { ModelUpload } from "@/components/owner/ModelUpload";
import { FLOOR_TYPES } from "@/lib/floor-textures";
import { ExcelTools } from "@/components/owner/ExcelTools";
import { WheelsPanel } from "@/components/owner/WheelsPanel";
import { MysteryPanel } from "@/components/owner/MysteryPanel";
import { AuctionsPanel } from "@/components/owner/AuctionsPanel";
import { LiveRipsPanel } from "@/components/owner/LiveRipsPanel";
import { TreasuresPanel, CluesPanel } from "@/components/owner/TreasuresPanel";
import { importWooProducts } from "@/lib/woo.functions";
import { WooSyncSettings } from "@/components/owner/WooSyncSettings";
import { VendorProductsPanel } from "@/components/owner/VendorProductsPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";



export const Route = createFileRoute("/owner/")({ component: OwnerConsole });

type Tab =
  | "dashboard" | "messages" | "broadcast" | "maps" | "stores" | "products" | "vendorproducts" | "categories" | "cosmetics" | "characters" | "roles" | "npcs"
  | "wheels" | "mystery" | "auctions" | "liverips" | "treasures" | "clues"
  | "quests" | "titles" | "players" | "users" | "orders" | "transactions" | "packages"
  | "moderation" | "audit" | "settings";

const TABS: { key: Tab; i18n: string; icon: string; fallback?: string }[] = [
  { key: "dashboard", i18n: "owner.tab.dashboard", icon: "📊" },
  { key: "messages", i18n: "owner.tab.messages", icon: "💬" },
  { key: "broadcast", i18n: "owner.tab.broadcast", icon: "📢", fallback: "הודעות מערכת" },
  { key: "maps", i18n: "owner.tab.maps", icon: "🗺️" },
  { key: "stores", i18n: "owner.tab.stores", icon: "🏪" },
  { key: "products", i18n: "owner.tab.products", icon: "📦" },
  { key: "vendorproducts", i18n: "owner.tab.vendorproducts", icon: "🏪", fallback: "מוצרי ונדורים" },
  { key: "categories", i18n: "owner.tab.categories", icon: "🏷️" },
  { key: "cosmetics", i18n: "owner.tab.cosmetics", icon: "👕" },
  { key: "characters", i18n: "owner.tab.characters", icon: "🧍", fallback: "דמויות משחק" },
  { key: "roles", i18n: "owner.tab.roles", icon: "🎭", fallback: "תפקידים" },
  { key: "npcs", i18n: "owner.tab.npcs", icon: "🙋" },
  { key: "wheels", i18n: "owner.tab.wheels", icon: "🎡" },
  { key: "mystery", i18n: "owner.tab.mystery", icon: "🎁" },
  { key: "auctions", i18n: "owner.tab.auctions", icon: "🔨", fallback: "מכרזים" },
  { key: "liverips", i18n: "owner.tab.liverips", icon: "📦", fallback: "Live Rip" },
  { key: "treasures", i18n: "owner.tab.treasures", icon: "🧰", fallback: "תיבות אוצר" },
  { key: "clues", i18n: "owner.tab.clues", icon: "🧩", fallback: "רמזים" },
  { key: "quests", i18n: "owner.tab.quests", icon: "📜" },
  { key: "titles", i18n: "owner.tab.titles", icon: "🏆" },
  { key: "players", i18n: "owner.tab.players", icon: "👥" },
  { key: "users", i18n: "owner.tab.users", icon: "🔑" },
  { key: "orders", i18n: "owner.tab.orders", icon: "🧾" },
  { key: "transactions", i18n: "owner.tab.transactions", icon: "💸" },
  { key: "packages", i18n: "owner.tab.packages", icon: "💎" },
  { key: "moderation", i18n: "owner.tab.moderation", icon: "🛡️" },
  { key: "audit", i18n: "owner.tab.audit", icon: "🔍" },
  { key: "settings", i18n: "owner.tab.settings", icon: "⚙️" },
];



type FieldType = "text" | "textarea" | "number" | "boolean" | "select" | "json" | "image" | "model3d" | "multiselect_stores" | "select_category" | "select_subcategory" | "select_role" | "tags";
type Field = { key: string; label: string; type: FieldType; options?: string[]; default?: unknown; folder?: string };
type Schema = { table: string; cols: string[]; fields: Field[] };


const SCHEMAS: Record<string, Schema> = {
  maps: {
    table: "maps",
    cols: ["name", "slug", "dimension", "width", "height", "is_public_room", "is_active"],
    fields: [
      { key: "name", label: "שם", type: "text" },
      { key: "slug", label: "מזהה טקסטואלי (slug)", type: "text" },
      { key: "description", label: "תיאור", type: "textarea" },
      { key: "dimension", label: "סוג מפה (2d = דו-מימד, 3d = תלת-מימד)", type: "select", options: ["2d", "3d"], default: "2d" },
      { key: "width", label: "רוחב (ציר X)", type: "number", default: 2400 },
      { key: "height", label: "גובה 2D / עומק 3D (ציר Z)", type: "number", default: 760 },
      { key: "viewport_width", label: "רוחב תצוגה", type: "number", default: 1400 },
      { key: "viewport_height", label: "גובה תצוגה", type: "number", default: 760 },
      { key: "background_url", label: "תמונת רקע", type: "image", folder: "maps" },
      { key: "background_color", label: "צבע רקע", type: "text", default: "#c8ecff" },
      { key: "floor_type", label: "סוג רצפה (למפות תלת-מימד)", type: "select", options: FLOOR_TYPES.map((f) => f.key), default: "grass" },
      { key: "floor_color", label: "צבע רצפה (אופציונלי)", type: "text" },
      { key: "floor_texture_url", label: "תמונת רצפה מותאמת (כשסוג הרצפה = custom)", type: "image", folder: "floors" },
      { key: "is_public_room", label: "חדר ציבורי (Multiplayer)", type: "boolean", default: true },
      { key: "is_active", label: "פעילה", type: "boolean", default: true },
      { key: "is_archived", label: "בארכיון", type: "boolean", default: false },
    ],
  },
  stores: {
    table: "stores",
    cols: ["name", "slug", "store_type", "active"],
    fields: [
      { key: "name", label: "שם החנות", type: "text" },
      { key: "slug", label: "מזהה טקסטואלי (slug)", type: "text" },
      { key: "description", label: "תיאור", type: "textarea" },
      { key: "store_type", label: "סוג", type: "select", options: ["cosmetics", "products", "wheel", "mystery_box", "auction", "live_rip"], default: "cosmetics" },
      { key: "image_url", label: "תמונת חזית לחנות", type: "image", folder: "stores" },
      { key: "active", label: "פעיל", type: "boolean", default: true },
    ],
  },
  products: {
    table: "products",
    cols: ["image_url", "name", "sku", "category", "tags", "credit_price", "sale_credit_price", "stock", "active"],
    fields: [
      { key: "name", label: "שם מוצר", type: "text" },
      { key: "sku", label: "מק״ט (SKU)", type: "text" },
      { key: "description", label: "תיאור", type: "textarea" },
      { key: "category", label: "קטגוריה", type: "select_category" },
      { key: "subcategory", label: "תת קטגוריה", type: "select_subcategory" },
      { key: "brand", label: "מותג", type: "text" },
      { key: "tags", label: "תגיות (מופרדות בפסיק)", type: "tags" },
      { key: "store_id", label: "חנות ראשית", type: "multiselect_stores" },
      { key: "store_ids", label: "חנויות נוספות שיוצג בהן (בחירה מרובה)", type: "multiselect_stores" },
      { key: "product_type", label: "סוג", type: "select", options: ["cosmetic", "consumable", "bundle", "physical"], default: "physical" },
      { key: "credit_price", label: "מחיר בקרדיטים", type: "number", default: 100 },
      { key: "sale_credit_price", label: "מחיר מבצע בקרדיטים (ריק = ללא מבצע)", type: "number" },
      { key: "regular_price", label: "מחיר קטלוגי באתר (₪)", type: "number" },
      { key: "sale_price", label: "מחיר מבצע באתר (₪)", type: "number" },
      { key: "external_url", label: "קישור למוצר באתר", type: "text" },
      { key: "image_url", label: "תמונת מוצר", type: "image", folder: "products" },
      { key: "stock", label: "מלאי (ריק=∞)", type: "number" },
      { key: "unlimited_stock", label: "מלאי לא מוגבל", type: "boolean", default: false },
      { key: "active", label: "פעיל", type: "boolean", default: true },
    ],
  },


  cosmetics: {
    table: "cosmetics",
    cols: ["name", "layer_type", "is_free", "credit_price", "active"],
    fields: [
      { key: "name", label: "שם", type: "text" },
      { key: "layer_type", label: "מיקום על הדמות", type: "select", options: ["character", "hat", "necklace", "hand", "cape", "shirt", "hair", "face", "shoes", "background"], default: "hat" },
      { key: "layer_order", label: "סדר שכבה", type: "number", default: 10 },
      { key: "thumbnail_url", label: "תמונת תצוגה (חנות)", type: "image", folder: "cosmetics" },
      { key: "sprite_right_url", label: "תמונה בפנייה ימינה (רקע שקוף)", type: "image", folder: "cosmetics" },
      { key: "sprite_left_url", label: "תמונה בפנייה שמאלה (אופציונלי – יתהפך אוטומטית)", type: "image", folder: "cosmetics" },
      { key: "model_3d_url", label: "קובץ תלת-מימד לקוסמטיקה (GLB/GLTF — למפות 3D)", type: "model3d", folder: "cosmetics-3d" },
      { key: "offset_x", label: "היסט X על הדמות", type: "number", default: 0 },
      { key: "offset_y", label: "היסט Y על הדמות", type: "number", default: 0 },
      { key: "scale", label: "קנה מידה", type: "number", default: 1 },
      { key: "color_hex", label: "צבע (אופציונלי)", type: "text", default: "#ec4899" },
      { key: "rarity", label: "נדירות", type: "select", options: ["common", "rare", "epic", "legendary"], default: "common" },
      { key: "is_starter", label: "זמין ביצירת דמות", type: "boolean", default: false },
      { key: "store_id", label: "מוכר בחנות (UUID – השאירו ריק אם רק בהתחלה)", type: "text" },
      { key: "is_free", label: "חינמי", type: "boolean", default: false },
      { key: "credit_price", label: "מחיר בקרדיטים", type: "number", default: 0 },
      { key: "active", label: "פעיל", type: "boolean", default: true },
    ],
  },
  npcs: {
    table: "npcs",
    cols: ["name", "slug", "behavior", "movement_speed", "active"],
    fields: [
      { key: "name", label: "שם", type: "text" },
      { key: "slug", label: "מזהה טקסטואלי (slug)", type: "text" },
      { key: "behavior", label: "התנהגות", type: "select", options: ["patrol", "idle", "wander", "greeter"], default: "patrol" },
      { key: "movement_speed", label: "מהירות", type: "number", default: 1 },
      { key: "walk_range", label: "טווח הליכה", type: "number", default: 200 },
      { key: "action_type", label: "פעולה", type: "select", options: ["speak", "quest", "shop", "none"], default: "speak" },
      { key: "sprite_url", label: "תמונת דמות (מנוחה)", type: "image", folder: "npcs" },
      { key: "sprite_right_url", label: "פנייה ימינה", type: "image", folder: "npcs" },
      { key: "sprite_left_url", label: "פנייה שמאלה (אופציונלי – יתהפך אוטומטית)", type: "image", folder: "npcs" },
      { key: "sprite_jump_url", label: "קפיצה", type: "image", folder: "npcs" },
      { key: "thumbnail_url", label: "תמונה ממוזערת", type: "image", folder: "npcs" },
      { key: "width", label: "רוחב", type: "number", default: 48 },
      { key: "height", label: "גובה", type: "number", default: 72 },
      { key: "interaction_enabled", label: "אפשר אינטראקציה", type: "boolean", default: true },
      { key: "random_speech_enabled", label: "דיבור אקראי", type: "boolean", default: true },
      { key: "active", label: "פעיל", type: "boolean", default: true },
    ],
  },

  quests: {
    table: "quests",
    cols: ["name", "quest_type", "action_type", "target_amount", "credit_reward", "active"],
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "quest_type", label: "Type", type: "select", options: ["daily", "weekly", "monthly", "one_time"], default: "daily" },
      { key: "action_type", label: "Action", type: "select", options: ["login", "chat", "purchase", "explore", "visit_store", "custom"], default: "login" },
      { key: "target_amount", label: "Target", type: "number", default: 1 },
      { key: "credit_reward", label: "Credit reward", type: "number", default: 10 },
      { key: "xp_reward", label: "XP reward", type: "number", default: 5 },
      { key: "active", label: "Active", type: "boolean", default: true },
    ],
  },
  titles: {
    table: "titles",
    cols: ["name", "unlock_rule", "level_requirement", "active"],
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "unlock_rule", label: "Unlock rule", type: "select", options: ["level", "purchase", "manual", "quest"], default: "level" },
      { key: "level_requirement", label: "Level required", type: "number", default: 1 },
      { key: "color", label: "Color", type: "text", default: "#ec4899" },
      { key: "active", label: "Active", type: "boolean", default: true },
    ],
  },
  characters: {
    table: "characters",
    cols: ["name", "role_id", "is_starter", "is_free", "credit_price", "active"],
    fields: [
      { key: "name", label: "שם הדמות", type: "text" },
      { key: "description", label: "תיאור", type: "textarea" },
      { key: "role_id", label: "תפקיד", type: "select_role" },
      { key: "image_url", label: "תמונה ראשית (עמידה — בבחירת דמות)", type: "image", folder: "characters" },
      { key: "sprite_right_url", label: "תזוזה ימינה", type: "image", folder: "characters" },
      { key: "sprite_left_url", label: "תזוזה שמאלה (אופציונלי — יתהפך אוטומטית)", type: "image", folder: "characters" },
      { key: "sprite_jump_url", label: "קפיצה", type: "image", folder: "characters" },
      { key: "model_3d_url", label: "קובץ תלת-מימד לדמות (GLB/GLTF — למפות 3D)", type: "model3d", folder: "characters-3d" },
      { key: "is_starter", label: "זמין ביצירת דמות", type: "boolean", default: true },
      { key: "is_free", label: "חינמי", type: "boolean", default: true },
      { key: "credit_price", label: "מחיר בקרדיטים", type: "number", default: 0 },
      { key: "display_order", label: "סדר תצוגה", type: "number", default: 0 },
      { key: "active", label: "פעיל", type: "boolean", default: true },
    ],
  },
  character_roles: {
    table: "character_roles",
    cols: ["name", "icon", "display_order", "active"],
    fields: [
      { key: "name", label: "שם התפקיד (למשל: קוסם, אספן, לוחם)", type: "text" },
      { key: "description", label: "תיאור", type: "textarea" },
      { key: "icon", label: "אימוג׳י / אייקון (למשל 🧙)", type: "text" },
      { key: "display_order", label: "סדר תצוגה", type: "number", default: 0 },
      { key: "active", label: "פעיל", type: "boolean", default: true },
    ],
  },
};

// ---------------- Sortable table helpers ----------------

type SortConfig = { key: string; direction: "asc" | "desc" } | null;

function getSortValue(row: Record<string, unknown>, key: string): unknown {
  const parts = key.split(".");
  let cur: unknown = row;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return (a === b ? 0 : a ? -1 : 1);
  const aStr = String(a).trim();
  const bStr = String(b).trim();
  const aNum = Number(aStr);
  const bNum = Number(bStr);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aStr !== "" && bStr !== "") return aNum - bNum;
  return aStr.localeCompare(bStr, "he", { numeric: true });
}

function useSortableData<T extends Record<string, unknown>>(items: T[], defaultSort?: { key: string; direction: "asc" | "desc" }) {
  const [sort, setSort] = useState<SortConfig>(defaultSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return items;
    return [...items].sort((a, b) => {
      const cmp = compareValues(getSortValue(a, sort.key), getSortValue(b, sort.key));
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [items, sort]);
  const toggle = (key: string) => {
    setSort((cur) => {
      if (cur?.key === key) {
        if (cur.direction === "asc") return { key, direction: "desc" };
        return null;
      }
      return { key, direction: "asc" };
    });
  };
  const SortHeader = ({ label, sortKey, className = "" }: { label: string; sortKey: string; className?: string }) => {
    const active = sort?.key === sortKey;
    const dir = active ? sort.direction : null;
    return (
      <th
        onClick={() => toggle(sortKey)}
        className={`cursor-pointer select-none p-1 text-start hover:bg-muted/50 ${className}`}
        title="לחץ/י למיון"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="inline-block w-3 text-[10px] opacity-70">
            {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "⇅"}
          </span>
        </span>
      </th>
    );
  };
  return { sorted, sort, toggle, SortHeader };
}

const TAB_GROUPS: { label: string; icon: string; keys: Tab[] }[] = [
  { label: "סקירה", icon: "📊", keys: ["dashboard", "messages", "broadcast"] },
  { label: "עולם המשחק", icon: "🗺️", keys: ["maps", "stores", "npcs", "characters", "roles", "cosmetics"] },
  { label: "חנות ומוצרים", icon: "📦", keys: ["products", "vendorproducts", "categories", "packages"] },
  { label: "עמדות ומשחקים", icon: "🎡", keys: ["wheels", "mystery", "auctions", "liverips", "treasures", "clues"] },
  { label: "התקדמות שחקנים", icon: "📜", keys: ["quests", "titles"] },
  { label: "שחקנים והרשאות", icon: "👥", keys: ["players", "users", "moderation"] },
  { label: "מסחר ותנועות", icon: "🧾", keys: ["orders", "transactions"] },
  { label: "מערכת", icon: "⚙️", keys: ["audit", "settings"] },
];

function OwnerTabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { t } = useI18n();
  const { data: alerts } = useQuery({
    queryKey: ["owner-tab-alerts"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [msgs, orders] = await Promise.all([
        supabase.from("store_conversations").select("id", { count: "exact", head: true }).gt("unread_owner", 0),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("fulfillment_status", "awaiting_request"),
      ]);
      return { messages: msgs.count ?? 0, orders: orders.count ?? 0 };
    },
  });
  const badgeFor = (key: Tab) =>
    key === "messages" ? (alerts?.messages ?? 0) : key === "orders" ? (alerts?.orders ?? 0) : 0;
  const label = (tt: { i18n: string; fallback?: string }) =>
    tt.fallback ? (t(tt.i18n) === tt.i18n ? tt.fallback : t(tt.i18n)) : t(tt.i18n);
  const activeGroup = TAB_GROUPS.find((g) => g.keys.includes(tab));

  return (
    <div className="chrome-panel mb-3 p-2">
      <div className="relative flex flex-nowrap items-start gap-1 overflow-visible">
        {TAB_GROUPS.map((g) => {
          const items = g.keys.map((k) => TABS.find((tt) => tt.key === k)!).filter(Boolean);
          const groupAlert = g.keys.reduce((n, k) => n + badgeFor(k), 0);
          const isActiveGroup = activeGroup?.label === g.label;

          return (
          <div key={g.label} className="group relative shrink-0">
              <button
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActiveGroup
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-muted/40 text-foreground hover:bg-muted"
                }`}
              >
                <span>{g.icon}</span>
                <span>{g.label}</span>
                {groupAlert > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                  </span>
                )}
              </button>

              <div className="pointer-events-none absolute top-full z-30 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                <div className="h-2 w-full" />
                <div className="min-w-[10rem] rounded-xl border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur-sm">
                  {items.map((tt) => {
                    const count = badgeFor(tt.key);
                    const isActive = tab === tt.key;
                    return (
                      <button
                        key={tt.key}
                        onClick={() => setTab(tt.key)}
                        className={`relative flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm transition ${
                          isActive
                            ? "bg-primary/15 font-semibold text-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="opacity-80">{tt.icon}</span>
                          <span>{label(tt)}</span>
                        </span>
                        {count > 0 && (
                          <span className="grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-none text-destructive-foreground">
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OwnerConsole() {

  const [tab, setTab] = useState<Tab>("dashboard");
  const { t } = useI18n();
  return (
    <div className="min-h-screen p-3">
      <div className="chrome-panel mb-3 flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2 font-bold">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">C</div>
          {t("owner.title")}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <LanguageSwitcher />
          <Link to="/owner/map-editor" className="chrome-panel px-3 py-1 text-xs">🗺️ {t("owner.tab.mapEditor")}</Link>
          <Link to="/play" className="chrome-panel px-3 py-1 text-xs">{t("owner.enter")}</Link>
        </div>
      </div>
      <OwnerTabBar tab={tab} setTab={setTab} />

      {tab === "dashboard" && <Dashboard />}
      {tab === "messages" && <OwnerMessages />}
      {tab === "broadcast" && <BroadcastPanel />}
      {tab === "maps" && <ManagedTable schema={SCHEMAS.maps} title={t("owner.tab.maps")} />}
      {tab === "stores" && <ManagedTable schema={SCHEMAS.stores} title={t("owner.tab.stores")} />}
      {tab === "products" && <ProductsPanel />}
      {tab === "vendorproducts" && <VendorProductsPanel />}
      {tab === "categories" && <CategoriesPanel />}
      {tab === "cosmetics" && <ManagedTable schema={SCHEMAS.cosmetics} title={t("owner.tab.cosmetics")} />}
      {tab === "characters" && <ManagedTable schema={SCHEMAS.characters} title="דמויות משחק" />}
      {tab === "roles" && <ManagedTable schema={SCHEMAS.character_roles} title="תפקידים" />}


      {tab === "npcs" && <NpcsPanel />}
      {tab === "wheels" && <WheelsPanel />}
      {tab === "mystery" && <MysteryPanel />}
      {tab === "auctions" && <AuctionsPanel />}
      {tab === "liverips" && <LiveRipsPanel />}
      {tab === "treasures" && <TreasuresPanel />}
      {tab === "clues" && <CluesPanel />}
      {tab === "quests" && <ManagedTable schema={SCHEMAS.quests} title={t("owner.tab.quests")} />}
      {tab === "titles" && <ManagedTable schema={SCHEMAS.titles} title={t("owner.tab.titles")} />}
      {tab === "players" && <PlayersPanel />}
      {tab === "users" && <UsersPanel />}
      {tab === "orders" && <OrdersPanel />}
      {tab === "transactions" && <ReadTable title={t("owner.tab.transactions")} table="credit_transactions" cols={["transaction_type", "amount", "balance_after", "description", "created_at"]} />}
      {tab === "packages" && <PackagesPanel />}
      {tab === "moderation" && <Moderation />}
      {tab === "audit" && <ReadTable title={t("owner.tab.audit")} table="audit_logs" cols={["action_type", "entity_type", "reason", "created_at"]} />}
      {tab === "settings" && <SettingsPanel />}
    </div>
  );
}

function Dashboard() {
  const [activeOpen, setActiveOpen] = useState(false);
  const stats = useQuery({
    queryKey: ["owner-stats"],
    queryFn: async () => {
      const [players, verified, active, orders, quests, txSum, convs] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("email_verified", true),
        supabase.from("active_players").select("user_id", { count: "exact", head: true }).gt("last_seen", new Date(Date.now() - 5 * 60 * 1000).toISOString()),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("quests").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("credit_transactions").select("amount"),
        supabase.from("store_conversations").select("id", { count: "exact", head: true }).gt("unread_owner", 0),
      ]);
      const spent = (txSum.data ?? []).filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
      const granted = (txSum.data ?? []).filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      return {
        players: players.count ?? 0, verified: verified.count ?? 0, active: active.count ?? 0, orders: orders.count ?? 0,
        activeQuests: quests.count ?? 0, spent: -spent, granted, pending: convs.count ?? 0,
      };
    },
  });
  const activePlayers = useQuery({
    queryKey: ["owner-active-players-detail"],
    enabled: activeOpen,
    refetchInterval: activeOpen ? 5000 : false,
    queryFn: async () => {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: ap } = await supabase.from("active_players").select("user_id, map_id, x, y, last_seen").gt("last_seen", since);
      const ids = (ap ?? []).map((a) => a.user_id);
      if (!ids.length) return [];
      const [{ data: profiles }, { data: maps }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, level, xp, current_map_id, last_x, last_y, avatar_config").in("id", ids),
        supabase.from("maps").select("id, name"),
      ]);
      const mapById = Object.fromEntries((maps ?? []).map((m) => [m.id, m.name]));
      return (ap ?? []).map((a) => {
        const p = (profiles ?? []).find((pr) => pr.id === a.user_id);
        return {
          ...a,
          profile: p,
          mapName: (a.map_id ? mapById[a.map_id] : undefined) ?? (p?.current_map_id ? mapById[p.current_map_id] : undefined) ?? "—",
        };
      });
    },
  });
  const s = stats.data;
  const cards = [
    ["Total players", s?.players, "👥"],
    ["Verified (2FA)", s?.verified, "✅"],
    ["Unverified", s ? (s.players ?? 0) - (s.verified ?? 0) : undefined, "⚠️"],
    ["Active now (5m)", s?.active, "🟢", true],
    ["Pending messages", s?.pending, "💬"],
    ["Orders", s?.orders, "🧾"],
    ["Active quests", s?.activeQuests, "📜"],
    ["Credits granted", s?.granted, "💎"],
    ["Credits spent", s?.spent, "💸"],
  ] as const;
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        {cards.map(([label, val, icon, clickable]) => {
          const body = (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{label}</span><span className="text-lg">{icon}</span>
            </div>
          );
          const value = <div className="mt-1 text-3xl font-black">{val ?? "…"}</div>;
          return (
            <div
              key={label}
              onClick={clickable ? () => setActiveOpen(true) : undefined}
              className={`chrome-panel p-4 ${clickable ? "cursor-pointer transition hover:scale-[1.02] hover:shadow-lg" : ""}`}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
            >
              {body}
              {value}
            </div>
          );
        })}
      </div>
      <Dialog open={activeOpen} onOpenChange={setActiveOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>שחקנים פעילים כעת</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-2 py-2">
              {activePlayers.isLoading ? (
                <div className="text-center text-sm text-muted-foreground">טוען...</div>
              ) : !activePlayers.data?.length ? (
                <div className="text-center text-sm text-muted-foreground">אין שחקנים פעילים ב־5 הדקות האחרונות</div>
              ) : (
                activePlayers.data.map((row, idx) => {
                  const p = row.profile;
                  const name = p?.display_name || p?.username || "שחקן לא ידוע";
                  const since = new Date(row.last_seen).toLocaleTimeString("he-IL");
                  return (
                    <div key={`${row.user_id}-${row.map_id || ""}-${idx}`} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/20 text-lg">👤</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p ? `רמה ${p.level} • נקודות ${p.xp}` : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          מפה: <span className="font-medium text-foreground">{row.mapName}</span> • עודכן {since}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------- Managed CRUD table with add/edit modal ----------------

function QuickCell({ field, value, draft, onChange }: { field: Field; value: unknown; draft: Record<string, unknown>; onChange: (v: unknown) => void }) {
  const cls = "w-full min-w-[80px] rounded border-2 border-border bg-input px-1 py-0.5 text-xs";
  switch (field.type) {
    case "boolean":
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />;
    case "number":
      return <input type="number" value={value === null || value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={cls} />;
    case "select":
      return (
        <select value={value === null || value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value || null)} className={cls}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "select_category":
      return <CategoryPicker value={value as string | null} onChange={onChange} />;
    case "select_subcategory":
      return <CategoryPicker value={value as string | null} onChange={onChange} subOf={(draft.category as string | null) ?? null} />;
    case "multiselect_stores":
      return <StoresPicker value={value as string | null} onChange={onChange} multi={false} />;
    case "select_role":
      return <RolePicker value={value as string | null} onChange={onChange} />;
    case "tags":
      return <input value={Array.isArray(value) ? (value as string[]).join(", ") : ""} onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className={cls} />;
    default:
      return <input value={value === null || value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value)} className={cls} />;
  }
}

function ManagedTable({ schema, title, toolbar, extraColumns = [], selectable = false, quickEdit = false, bulkActions }: { schema: Schema; title: string; toolbar?: React.ReactNode; extraColumns?: { key: string; label: string; render: (row: Record<string, unknown>) => React.ReactNode }[]; selectable?: boolean; quickEdit?: boolean; bulkActions?: (ctx: { rows: Record<string, unknown>[]; ids: string[]; clear: () => void; selectAll: () => void; selectWhere: (fn: (row: Record<string, unknown>) => boolean) => void }) => React.ReactNode }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [quickId, setQuickId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [savingQuick, setSavingQuick] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["own", schema.table],
    queryFn: async () => (await (supabase.from(schema.table as never) as never as { select: (s: string) => Promise<{ data: Record<string, unknown>[] }> }).select("*")).data ?? [],
  });
  const { sorted, SortHeader } = useSortableData(data);

  const del = async (id: string) => {
    if (!confirm(t("owner.confirmDelete"))) return;
    const { error } = await (supabase.from(schema.table as never) as never as { delete: () => { eq: (c: string, v: string) => Promise<{ error: unknown }> } }).delete().eq("id", id);
    if (error) toast.error(String(error));
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["own", schema.table] }); }
  };

  const startQuick = (row: Record<string, unknown>) => {
    const base: Record<string, unknown> = {};
    for (const c of schema.cols) base[c] = row[c];
    setDraft(base);
    setQuickId(String(row.id));
  };

  const saveQuick = async () => {
    if (!quickId) return;
    setSavingQuick(true);
    const payload: Record<string, unknown> = {};
    for (const c of schema.cols) {
      const field = schema.fields.find((f) => f.key === c);
      if (!field || field.type === "image" || field.type === "model3d") continue;
      payload[c] = draft[c] === "" ? null : draft[c];
    }
    const { error } = await (supabase.from(schema.table as never) as never as { update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } })
      .update(payload).eq("id", quickId);
    setSavingQuick(false);
    if (error) { toast.error(String((error as { message?: string }).message ?? error)); return; }
    toast.success("נשמר");
    setQuickId(null);
    qc.invalidateQueries({ queryKey: ["own", schema.table] });
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  const allIds = data.map((r) => String(r.id));
  const allSelected = selected.length > 0 && selected.length === allIds.length;


  return (
    <div className="chrome-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title} ({data.length})</h2>
        <div className="flex items-center gap-1">
          {toolbar}
          <ExcelTools table={schema.table} fields={schema.fields} onImported={() => qc.invalidateQueries({ queryKey: ["own", schema.table] })} />
          <button onClick={() => setCreating(true)} className="btn-plastic text-xs">+ {t("owner.add")}</button>
        </div>
      </div>
      {selectable && bulkActions && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border-2 border-border bg-muted/40 p-2 text-xs">
          <span className="font-bold">נבחרו {selected.length}</span>
          {bulkActions({
            rows: sorted.filter((r) => selected.includes(String(r.id))),
            ids: selected,
            clear: () => setSelected([]),
            selectAll: () => setSelected(allIds),
            selectWhere: (fn) => setSelected(data.filter(fn).map((r) => String(r.id))),
          })}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-start text-muted-foreground">
            <tr>
              {selectable && (
                <th className="p-1">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? [] : allIds)}
                    className="h-4 w-4"
                  />
                </th>
              )}
              {schema.cols.map((c) => <SortHeader key={c} label={c} sortKey={c} />)}
              {extraColumns.map((c) => <SortHeader key={c.key} label={c.label} sortKey={c.key} />)}
              <th className="p-1 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isQuick = quickEdit && quickId === String(row.id);
              return (
              <tr key={String(row.id)} className="group border-t border-border hover:bg-muted/40">
                {selectable && (
                  <td className="p-1">
                    <input
                      type="checkbox"
                      checked={selected.includes(String(row.id))}
                      onChange={() => toggle(String(row.id))}
                      className="h-4 w-4"
                    />
                  </td>
                )}
                {schema.cols.map((c) => {
                  const field = schema.fields.find((f) => f.key === c);
                  const isImage = field?.type === "image";
                  return (
                    <td key={c} className="p-1">
                      {isImage ? (
                        row[c] ? (
                          <img src={String(row[c])} alt="" className="h-10 w-10 rounded border border-border bg-white object-contain" />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded border-2 border-dashed border-border bg-muted text-[10px] text-muted-foreground">—</div>
                        )
                      ) : isQuick && field ? (
                        <QuickCell
                          field={field}
                          value={draft[c]}
                          draft={draft}
                          onChange={(v) => setDraft((d) => ({ ...d, [c]: v }))}
                        />
                      ) : (
                        formatCell(row[c])
                      )}
                    </td>
                  );
                })}
                {extraColumns.map((c) => <td key={c.key} className="p-1">{c.render(row)}</td>)}
                <td className="p-1">
                  {isQuick ? (
                    <div className="flex gap-1">
                      <button onClick={() => void saveQuick()} disabled={savingQuick} className="rounded bg-primary px-2 py-0.5 font-bold text-primary-foreground disabled:opacity-40">💾 שמור</button>
                      <button onClick={() => setQuickId(null)} className="rounded bg-muted px-2 py-0.5">ביטול</button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {quickEdit && (
                        <button
                          onClick={() => startQuick(row)}
                          className="rounded bg-accent/30 px-2 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                          title="עריכה מהירה בשורה"
                        >
                          ✏️ עריכה מהירה
                        </button>
                      )}
                      <button onClick={() => setEditing(row)} className="rounded bg-primary/20 px-2 py-0.5 text-primary">{t("owner.edit")}</button>
                      <button onClick={() => del(String(row.id))} className="rounded bg-destructive/20 px-2 py-0.5 text-destructive">{t("owner.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
              );
            })}

            {!sorted.length && <tr><td colSpan={schema.cols.length + extraColumns.length + 1 + (selectable ? 1 : 0)} className="p-4 text-center text-muted-foreground">{t("owner.noRows")}</td></tr>}
          </tbody>
        </table>
      </div>
      {(creating || editing) && (
        <RowEditor
          schema={schema}
          row={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["own", schema.table] }); setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function RowEditor({ schema, row, onClose, onSaved }: { schema: Schema; row: Record<string, unknown> | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    if (row) return { ...row };
    const base: Record<string, unknown> = {};
    for (const f of schema.fields) if (f.default !== undefined) base[f.key] = f.default;
    return base;
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {};
    for (const f of schema.fields) {
      const v = form[f.key];
      if (v === undefined || v === "") { if (row) payload[f.key] = null; continue; }
      payload[f.key] = v;
    }
    let error;
    if (row?.id) {
      const res = await (supabase.from(schema.table as never) as never as { update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } })
        .update(payload).eq("id", String(row.id));
      error = res.error;
    } else {
      const res = await (supabase.from(schema.table as never) as never as { insert: (v: unknown) => Promise<{ error: unknown }> })
        .insert(payload);
      error = res.error;
    }
    setSaving(false);
    if (error) { toast.error(String((error as { message?: string })?.message ?? error)); return; }
    toast.success("Saved");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="chrome-panel w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">{row ? t("owner.edit") : t("owner.add")}</h3>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1">✕</button>
        </div>
        <div className="space-y-2">
          {schema.fields.map((f) => (
            <label key={f.key} className="block text-xs">
              <span className="mb-1 block font-semibold">{f.label}</span>
              {f.type === "textarea" ? (
                <textarea
                  value={String(form[f.key] ?? "")}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full rounded-xl border-2 border-border bg-input px-3 py-1"
                  rows={3}
                />
              ) : f.type === "boolean" ? (
                <div><input type="checkbox" checked={!!form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.checked }))} /></div>
              ) : f.type === "image" ? (
                <ImageUpload
                  value={form[f.key] as string | null | undefined}
                  folder={f.folder ?? "misc"}
                  onChange={(url) => setForm((s) => ({ ...s, [f.key]: url }))}
                />
              ) : f.type === "model3d" ? (
                <ModelUpload
                  value={form[f.key] as string | null | undefined}
                  folder={f.folder ?? "models"}
                  onChange={(url) => setForm((s) => ({ ...s, [f.key]: url }))}
                />
              ) : f.type === "select" ? (
                <select
                  value={String(form[f.key] ?? "")}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full rounded-xl border-2 border-border bg-input px-3 py-1"
                >
                  <option value="">—</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "multiselect_stores" ? (
                <StoresPicker
                  multi={f.key === "store_ids"}
                  value={form[f.key] as string | string[] | null | undefined}
                  onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                />
              ) : f.type === "select_category" ? (
                <CategoryPicker
                  value={form[f.key] as string | null | undefined}
                  onChange={(v) => setForm((s) => ({ ...s, [f.key]: v, subcategory: null }))}
                />
              ) : f.type === "select_subcategory" ? (

                <CategoryPicker
                  subOf={form.category as string | null | undefined}
                  value={form[f.key] as string | null | undefined}
                  onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                />
              ) : f.type === "select_role" ? (
                <RolePicker
                  value={form[f.key] as string | null | undefined}
                  onChange={(v: string | null) => setForm((s) => ({ ...s, [f.key]: v }))}
                />
              ) : f.type === "tags" ? (
                <input
                  type="text"
                  value={Array.isArray(form[f.key]) ? (form[f.key] as string[]).join(", ") : String(form[f.key] ?? "")}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))}
                  placeholder="למשל: פוקימון, נדיר, חדש"
                  className="w-full rounded-xl border-2 border-border bg-input px-3 py-1"
                />
              ) : (

                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={String(form[f.key] ?? "")}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value }))}
                  className="w-full rounded-xl border-2 border-border bg-input px-3 py-1"
                />
              )}
            </label>
          ))}
          {schema.table === "characters" && (
            <CharacterFitPreview imageUrl={(form.image_url as string | null) ?? (form.sprite_right_url as string | null)} />
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="chrome-panel px-4 py-2 text-sm">{t("owner.cancel")}</button>
          <button onClick={save} disabled={saving} className="btn-plastic">{saving ? "…" : t("owner.save")}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Read-only table (audit / transactions / orders) ----------------

function ReadTable({ title, table, cols }: { title: string; table: string; cols: string[] }) {
  const { data = [] } = useQuery({
    queryKey: ["own-r", table],
    queryFn: async () => (await (supabase.from(table as never) as never as { select: (s: string) => { order: (c: string, o: object) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] }> } } }).select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const { sorted, SortHeader } = useSortableData(data);
  return (
    <div className="chrome-panel p-4">
      <h2 className="mb-2 text-lg font-bold">{title} ({data.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-start text-muted-foreground"><tr>{cols.map((c) => <SortHeader key={c} label={c} sortKey={c} />)}</tr></thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={String(row.id)} className="border-t border-border">
                {cols.map((c) => <td key={c} className="p-1">{formatCell(row[c])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "✓" : "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

// ---------------- NPCs (with sub-tables) ----------------

function NpcsPanel() {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <ManagedTable
        schema={{
          table: "npc_appearances",
          cols: ["name", "sprite_url", "width", "height", "active"],
          fields: [
            { key: "name", label: "שם", type: "text" },
            { key: "sprite_url", label: "תמונת דמות (מנוחה)", type: "image", folder: "npcs" },
            { key: "sprite_right_url", label: "פנייה ימינה", type: "image", folder: "npcs" },
            { key: "sprite_left_url", label: "פנייה שמאלה (אופציונלי)", type: "image", folder: "npcs" },
            { key: "sprite_jump_url", label: "קפיצה", type: "image", folder: "npcs" },
            { key: "thumbnail_url", label: "תמונה ממוזערת", type: "image", folder: "npcs" },
            { key: "width", label: "רוחב", type: "number", default: 48 },
            { key: "height", label: "גובה", type: "number", default: 72 },
            { key: "active", label: "פעיל", type: "boolean", default: true },
          ],
        }}
        title="Character sprites"
      />
      <ManagedTable
        schema={{
          ...SCHEMAS.npcs,
          fields: [
            ...SCHEMAS.npcs.fields,
            { key: "appearance_id", label: "Appearance ID", type: "text" },
          ],
        }}
        title={t("owner.tab.npcs")}
      />
      <ManagedTable
        schema={{
          table: "npc_messages",
          cols: ["message", "enabled", "weight", "auto_speech", "interaction_only"],
          fields: [
            { key: "npc_id", label: "NPC ID", type: "text" },
            { key: "message", label: "Message", type: "textarea" },
            { key: "weight", label: "Weight", type: "number", default: 1 },
            { key: "enabled", label: "Enabled", type: "boolean", default: true },
            { key: "auto_speech", label: "Auto speech", type: "boolean", default: true },
            { key: "interaction_only", label: "Interaction only", type: "boolean", default: false },
          ],
        }}
        title="NPC messages"
      />
    </div>
  );
}


function PlayersPanel() {
  const { user: currentUser, refreshProfile } = useAuth();
  const deleteFn = useServerFn(adminDeleteUser);
  const [grantModal, setGrantModal] = useState<{ id: string; username: string; currentCredits: number } | null>(null);
  const [grantAmount, setGrantAmount] = useState<number>(100);
  const [grantReason, setGrantReason] = useState<string>("Manual owner adjustment");
  const [granting, setGranting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; username: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data = [], refetch } = useQuery({
    queryKey: ["own-players"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { sorted, SortHeader } = useSortableData(data);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUser?.id) { toast.error("אי אפשר למחוק את עצמך"); return; }
    setDeleting(true);
    try {
      await deleteFn({ data: { user_id: deleteTarget.id } });
      toast.success("המשתמש נמחק בהצלחה");
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה במחיקה");
    } finally {
      setDeleting(false);
    }
  };

  const executeGrant = async () => {
    if (!grantModal) return;
    const amt = Number(grantAmount);
    if (Number.isNaN(amt) || amt === 0) {
      toast.error("אנא הזינו כמות קרדיטים תקינה");
      return;
    }
    setGranting(true);
    try {
      const { data: p } = await supabase.from("profiles").select("credits").eq("id", grantModal.id).maybeSingle();
      const before = p?.credits ?? grantModal.currentCredits ?? 0;
      const after = Math.max(0, before + amt);
      const { error } = await supabase.from("profiles").update({ credits: after }).eq("id", grantModal.id);
      if (error) throw error;

      await supabase.from("credit_transactions").insert({
        user_id: grantModal.id,
        amount: amt,
        transaction_type: amt >= 0 ? "grant" : "deduct",
        balance_before: before,
        balance_after: after,
        description: grantReason || "Manual adjustment",
      });

      await supabase.from("audit_logs").insert({
        action_type: "credit_adjust",
        entity_type: "profile",
        entity_id: grantModal.id,
        previous_value: { credits: before },
        new_value: { credits: after },
        reason: grantReason || "Manual adjustment",
      });

      toast.success(`יתרת הקרדיטים עודכנה בהצלחה: 💎 ${after}`);
      window.dispatchEvent(new Event("credits-changed"));
      if (grantModal.id === currentUser?.id) {
        await refreshProfile();
      }
      setGrantModal(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בעדכון קרדיטים");
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="chrome-panel p-4">
      <h2 className="mb-2 text-lg font-bold">שחקנים ({sorted.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-start text-muted-foreground">
            <tr>
              <SortHeader label="Username" sortKey="username" />
              <SortHeader label="Verified (2FA)" sortKey="email_verified" />
              <SortHeader label="Level" sortKey="level" />
              <SortHeader label="Credits" sortKey="credits" />
              <SortHeader label="Muted" sortKey="is_muted" />
              <SortHeader label="Suspended" sortKey="is_suspended" />
              <th className="p-1 text-start">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-1 font-semibold">{p.username}</td>
                <td className="p-1">{p.email_verified ? <span className="text-green-600">✅ מאומת</span> : <span className="text-amber-600">⚠️ לא מאומת</span>}</td>
                <td className="p-1">{p.level}</td>
                <td className="p-1 font-bold">💎 {p.credits}</td>
                <td className="p-1">{p.is_muted ? "✓" : "—"}</td>
                <td className="p-1">{p.is_suspended ? "✓" : "—"}</td>
                <td className="flex gap-1 p-1">
                  <button
                    onClick={() => {
                      setGrantModal({ id: p.id, username: p.username, currentCredits: p.credits });
                      setGrantAmount(100);
                      setGrantReason("עדכון מנהל מערכת");
                    }}
                    className="rounded bg-primary px-2 py-0.5 font-bold text-primary-foreground hover:opacity-90"
                  >
                    credits±
                  </button>
                  <button
                    onClick={async () => {
                      await supabase.from("profiles").update({ is_muted: !p.is_muted }).eq("id", p.id);
                      toast.success(p.is_muted ? "בוטלה השתקה" : "השחקן הושתק");
                      refetch();
                    }}
                    className="rounded bg-muted px-2 py-0.5"
                  >
                    {p.is_muted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    onClick={async () => {
                      await supabase.from("profiles").update({ is_suspended: !p.is_suspended }).eq("id", p.id);
                      toast.success(p.is_suspended ? "בוטלה השעיה" : "השחקן הושעה");
                      refetch();
                    }}
                    className="rounded bg-muted px-2 py-0.5"
                  >
                    {p.is_suspended ? "Unsuspend" : "Suspend"}
                  </button>
                  {p.id !== currentUser?.id && (
                    <button
                      onClick={() => setDeleteTarget({ id: p.id, username: p.username })}
                      className="rounded bg-destructive/20 px-2 py-0.5 font-bold text-destructive hover:bg-destructive/30"
                    >
                      🗑 מחק
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Adjust Credits Modal */}
      {grantModal && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={() => setGrantModal(null)}>
          <div dir="rtl" className="chrome-panel w-full max-w-md p-5 text-right shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-black">💎 עדכון קרדיטים לשחקן</h3>
              <button onClick={() => setGrantModal(null)} className="grid h-7 w-7 place-items-center rounded-full bg-muted text-sm font-bold">✕</button>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-xl bg-muted/60 p-3">
                <div className="text-xs text-muted-foreground">שחקן: <span className="font-bold text-foreground">{grantModal.username}</span></div>
                <div className="mt-1 text-xs text-muted-foreground">יתרה נוכחית: <span className="font-black text-primary">💎 {grantModal.currentCredits}</span></div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">כמות להוספה או להפחתה (לדוגמה 100 או -50):</label>
                <input
                  type="number"
                  className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-base font-bold outline-none focus:border-primary"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(parseInt(e.target.value, 10) || 0)}
                />
              </div>

              {/* Quick adjustment buttons */}
              <div className="flex flex-wrap gap-1.5">
                {[50, 100, 250, 500, 1000, 5000].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGrantAmount(num)}
                    className="chrome-panel px-2.5 py-1 text-xs font-bold hover:bg-primary/20"
                  >
                    +{num}
                  </button>
                ))}
                {[-50, -100, -500].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGrantAmount(num)}
                    className="chrome-panel px-2.5 py-1 text-xs font-bold text-destructive hover:bg-destructive/20"
                  >
                    {num}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">סיבה / הערה לתיעוד:</label>
                <input
                  type="text"
                  className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="לדוגמה: בונוס אירוע, בדיקת מערכת, פיצוי"
                />
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs">
                יתרה לאחר העדכון: <span className="font-black text-primary">💎 {Math.max(0, (grantModal.currentCredits || 0) + grantAmount)}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-3">
              <button type="button" onClick={() => setGrantModal(null)} className="chrome-panel px-4 py-2 text-xs font-bold">ביטול</button>
              <button
                type="button"
                onClick={executeGrant}
                disabled={granting || grantAmount === 0}
                className="btn-plastic text-xs font-bold disabled:opacity-50"
              >
                {granting ? "מעדכן…" : "אישור וביצוע ✅"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={() => setDeleteTarget(null)}>
          <div dir="rtl" className="chrome-panel w-full max-w-sm p-5 text-right shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-destructive">⚠️ אישור מחיקת משתמש</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              האם למחוק לצמיתות את המשתמש <span className="font-bold text-foreground">"{deleteTarget.username}"</span>? פעולה זו תסיר את חשבונו מהמערכת.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="chrome-panel px-3 py-1.5 text-xs font-bold">ביטול</button>
              <button
                onClick={executeDelete}
                disabled={deleting}
                className="rounded-xl bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "מוחק…" : "כן, למחוק לצמיתות"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Moderation() {
  const { data = [], refetch } = useQuery({
    queryKey: ["own-chat"],
    queryFn: async () => (await supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { sorted, SortHeader } = useSortableData(data);
  const del = async (id: string) => {
    const { error } = await supabase.from("chat_messages").update({ deleted: true }).eq("id", id);
    if (error) toast.error(error.message); else refetch();
  };
  return (
    <div className="chrome-panel space-y-3 p-4">
      <h2 className="text-lg font-bold">Chat moderation ({sorted.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-start text-muted-foreground">
            <tr>
              <SortHeader label="Time" sortKey="created_at" />
              <SortHeader label="User" sortKey="user_id" />
              <SortHeader label="Message" sortKey="message" />
              <SortHeader label="Deleted" sortKey="deleted" />
              <th className="p-1 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="p-1">{new Date(m.created_at).toLocaleTimeString()}</td>
                <td className="p-1 font-mono">{m.user_id.slice(0, 8)}</td>
                <td className="p-1">{m.message}</td>
                <td className="p-1">{m.deleted ? "✓" : "—"}</td>
                <td className="p-1">{!m.deleted && <button onClick={() => del(m.id)} className="rounded bg-destructive/20 px-2 py-0.5 text-destructive">Delete</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const { data: settings, refetch } = useQuery({
    queryKey: ["game-settings"],
    queryFn: async () => (await supabase.from("game_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [form, setForm] = useState<Record<string, unknown>>({});
  if (!settings) return <div className="chrome-panel p-4">Loading…</div>;
  const cur = { ...settings, ...form };
  const save = async () => {
    const { error } = await supabase.from("game_settings").update(form as never).eq("id", 1);
    if (error) toast.error(error.message); else { toast.success("Saved"); refetch(); setForm({}); }
  };
  return (
    <div className="chrome-panel max-w-xl space-y-2 p-4">
      <h2 className="text-lg font-bold">Game settings</h2>
      {(["game_name", "starting_credits", "starting_level", "quest_timezone", "movement_speed", "jump_strength", "gravity", "current_event", "global_announcement"] as const).map((k) => (
        <label key={k} className="block text-xs">
          <span className="mb-1 block font-semibold">{k}</span>
          <input value={String(cur[k] ?? "")} onChange={(e) => setForm((f) => ({ ...f, [k]: typeof settings[k] === "number" ? Number(e.target.value) : e.target.value }))} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1" />
        </label>
      ))}
      <div className="mt-3 space-y-2 rounded-xl border-2 border-dashed border-primary/40 p-3">
        <div className="text-xs font-bold text-primary">📮 הגדרות משלוחים</div>
        <label className="block text-xs">
          <span className="mb-1 block font-semibold">כתובת לאיסוף עצמי (מוצגת ללקוחות)</span>
          <textarea value={String(cur.pickup_address ?? "")} onChange={(e) => setForm((f) => ({ ...f, pickup_address: e.target.value }))} rows={2} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1" />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-semibold">עלות משלוח בקרדיטים (💎)</span>
          <input type="number" value={String(cur.shipping_gems_cost ?? 0)} onChange={(e) => setForm((f) => ({ ...f, shipping_gems_cost: Number(e.target.value) }))} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1" />
        </label>
      </div>
      <div className="mt-3 space-y-2 rounded-xl border-2 border-dashed border-primary/40 p-3">
        <div className="text-xs font-bold text-primary">🏪 אזור הוונדורים</div>
        <label className="flex items-center gap-1 text-xs font-semibold">
          <input type="checkbox" checked={cur.vendor_program_enabled !== false} onChange={(e) => setForm((f) => ({ ...f, vendor_program_enabled: e.target.checked }))} />
          ההרשמה כוונדורים פתוחה
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-semibold">קישור לתקנון הוונדורים</span>
          <input value={String(cur.vendor_terms_url ?? "")} onChange={(e) => setForm((f) => ({ ...f, vendor_terms_url: e.target.value }))} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1" />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-semibold">נוסח התקנון שמוצג במסך ההצטרפות</span>
          <textarea value={String(cur.vendor_terms_text ?? "")} onChange={(e) => setForm((f) => ({ ...f, vendor_terms_text: e.target.value }))} rows={5} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["maintenance_mode", "registration_enabled", "credit_purchasing_enabled", "email_verification_required"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
            <input type="checkbox" checked={!!cur[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))} />
            {k === "email_verification_required" ? "🔐 דרוש אימות מייל בהרשמה" : k}
          </label>
        ))}
      </div>

      <button onClick={save} className="btn-plastic">Save settings</button>
    </div>
  );
}

// ---------------- Orders panel with fulfillment ----------------

type OwnerOrder = {
  id: string;
  order_number: number;
  shipment_number: number | null;
  user_id: string;
  order_type: string;
  status: string;
  fulfillment_status: string;
  credits_charged: number;
  shipping_method: string | null;
  delivery_address: string | null;
  delivered_at: string | null;
  created_at: string;
  quantity: number | null;
  products: { name: string; sku: string | null; image_url: string | null } | null;
  stores: { name: string } | null;
  profiles: { username: string } | null;
};

type OrderGroup = {
  key: string;
  shipmentNumber: number | null;
  status: string;
  createdAt: string;
  user: string;
  method: string | null;
  address: string | null;
  totalCredits: number;
  orders: OwnerOrder[];
};

function OrdersPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "awaiting_request" | "in_transit" | "delivered">("all");
  const [openGroup, setOpenGroup] = useState<OrderGroup | null>(null);

  const { data: allRows = [] } = useQuery<OwnerOrder[]>({
    queryKey: ["own-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, shipment_number, user_id, order_type, status, fulfillment_status, credits_charged, shipping_method, delivery_address, delivered_at, created_at, quantity, products(name, sku, image_url), stores(name)")
        .in("order_type", ["product", "wheel", "mystery_box", "auction", "live_rip"])
        .order("created_at", { ascending: false })
        .limit(500);
      const list = (data ?? []) as unknown as OwnerOrder[];
      const uids = Array.from(new Set(list.map((r) => r.user_id)));
      if (uids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, username").in("id", uids);
        const map = new Map((profs ?? []).map((p) => [p.id, p.username]));
        for (const r of list) r.profiles = { username: map.get(r.user_id) ?? "" };
      }
      return list;
    },
  });

  const filtered = filter === "all" ? allRows : allRows.filter((r) => r.fulfillment_status === filter);

  // Group: awaiting → per-order; otherwise → by shipment_number (fallback per-order)
  const groups: OrderGroup[] = (() => {
    const map = new Map<string, OrderGroup>();
    for (const o of filtered) {
      const key = o.shipment_number ? `s-${o.shipment_number}` : `o-${o.id}`;
      const g = map.get(key);
      if (g) {
        g.orders.push(o);
        g.totalCredits += o.credits_charged || 0;
      } else {
        map.set(key, {
          key,
          shipmentNumber: o.shipment_number,
          status: o.fulfillment_status,
          createdAt: o.created_at,
          user: o.profiles?.username ?? o.user_id.slice(0, 8),
          method: o.shipping_method,
          address: o.delivery_address,
          totalCredits: o.credits_charged || 0,
          orders: [o],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  })();

  const markDelivered = async (id: string) => {
    const { error } = await supabase.rpc("mark_order_delivered", { _order_id: id });
    if (error) toast.error(error.message);
    else { toast.success("סומן כנמסר"); qc.invalidateQueries({ queryKey: ["own-orders"] }); }
  };

  const markGroupDelivered = async (g: OrderGroup) => {
    for (const o of g.orders) {
      if (o.fulfillment_status === "in_transit") {
        await supabase.rpc("mark_order_delivered", { _order_id: o.id });
      }
    }
    toast.success("המשלוח סומן כנמסר");
    qc.invalidateQueries({ queryKey: ["own-orders"] });
    setOpenGroup(null);
  };

  const statusLabel = (s: string) => s === "awaiting_request" ? "ממתין" : s === "in_transit" ? "בדרך" : s === "delivered" ? "נמסר" : s;
  const statusColor = (s: string) => s === "delivered" ? "bg-green-500" : s === "in_transit" ? "bg-amber-500" : "bg-slate-400";

  const counts = {
    all: allRows.length,
    awaiting_request: allRows.filter((r) => r.fulfillment_status === "awaiting_request").length,
    in_transit: allRows.filter((r) => r.fulfillment_status === "in_transit").length,
    delivered: allRows.filter((r) => r.fulfillment_status === "delivered").length,
  };

  const { sorted: sortedGroups, SortHeader } = useSortableData(groups, { key: "createdAt", direction: "desc" });

  return (
    <div className="chrome-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-bold">📮 הזמנות ומשלוחים ({groups.length})</h2>
        <div className="flex gap-1 flex-wrap">
          {(["all", "awaiting_request", "in_transit", "delivered"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`chrome-panel px-2 py-1 text-[11px] ${filter === f ? "ring-2 ring-primary bg-primary/10" : ""}`}>
              {f === "all" ? "הכל" : statusLabel(f)} · {counts[f]}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-start text-muted-foreground">
            <tr>
              <SortHeader label="מספר" sortKey="shipmentNumber" />
              <SortHeader label="תאריך" sortKey="createdAt" />
              <SortHeader label="משתמש" sortKey="user" />
              <th className="p-1 text-start">פריטים</th>
              <SortHeader label="💎" sortKey="totalCredits" />
              <SortHeader label="שיטה" sortKey="method" />
              <SortHeader label="כתובת" sortKey="address" />
              <SortHeader label="סטטוס" sortKey="status" />
              <th className="p-1 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((g) => {
              const isShipment = g.shipmentNumber != null;
              const label = isShipment ? `משלוח #${g.shipmentNumber}` : `הזמנה #${g.orders[0].order_number}`;
              const itemsSummary = g.orders.length === 1
                ? (g.orders[0].products?.name ?? g.orders[0].order_type)
                : `${g.orders.length} פריטים`;
              return (
                <tr key={g.key} className="cursor-pointer border-t border-border hover:bg-muted/50" onClick={() => setOpenGroup(g)}>
                  <td className="p-1 font-mono font-bold text-primary">{label}</td>
                  <td className="p-1">{new Date(g.createdAt).toLocaleDateString()}</td>
                  <td className="p-1">{g.user}</td>
                  <td className="p-1">{itemsSummary}</td>
                  <td className="p-1 text-center">{g.totalCredits}</td>
                  <td className="p-1 text-center">{g.method === "pickup" ? "🏬" : g.method === "shipping" ? "📮" : "—"}</td>
                  <td className="p-1 max-w-[180px] truncate">{g.address ?? "—"}</td>
                  <td className="p-1 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${statusColor(g.status)}`}>{statusLabel(g.status)}</span>
                  </td>
                  <td className="p-1">
                    <button className="rounded bg-muted px-2 py-0.5 text-[10px]">פרטים ←</button>
                  </td>
                </tr>
              );
            })}
            {!groups.length && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">אין הזמנות.</td></tr>}
          </tbody>
        </table>
      </div>

      {openGroup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setOpenGroup(null)}>
          <div className="chrome-panel w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">
                  {openGroup.shipmentNumber != null ? "מספר משלוח" : "מספר הזמנה"}
                </div>
                <div className="text-2xl font-black font-mono text-primary">
                  {openGroup.shipmentNumber != null ? `#${openGroup.shipmentNumber}` : `#${openGroup.orders[0].order_number}`}
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${statusColor(openGroup.status)}`}>{statusLabel(openGroup.status)}</span>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <div className="chrome-panel p-2">
                <div className="text-muted-foreground">לקוח</div>
                <div className="font-bold">{openGroup.user}</div>
              </div>
              <div className="chrome-panel p-2">
                <div className="text-muted-foreground">תאריך בקשה</div>
                <div className="font-bold">{new Date(openGroup.createdAt).toLocaleString()}</div>
              </div>
              <div className="chrome-panel p-2">
                <div className="text-muted-foreground">שיטת מסירה</div>
                <div className="font-bold">
                  {openGroup.method === "pickup" ? "🏬 איסוף עצמי"
                    : openGroup.method === "shipping" ? "📮 משלוח"
                    : "טרם נבחר"}
                </div>
              </div>
              <div className="chrome-panel p-2">
                <div className="text-muted-foreground">סה״כ קרדיטים</div>
                <div className="font-bold">💎 {openGroup.totalCredits}</div>
              </div>
              {openGroup.address && (
                <div className="chrome-panel col-span-2 p-2">
                  <div className="text-muted-foreground">כתובת</div>
                  <div className="font-bold">{openGroup.address}</div>
                </div>
              )}
            </div>

            <div className="mb-2 text-sm font-bold">פריטים ({openGroup.orders.length})</div>
            <div className="space-y-2">
              {openGroup.orders.map((o) => (
                <div key={o.id} className="chrome-panel flex items-center gap-3 p-2">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-pink-100 to-purple-100">
                    {o.products?.image_url
                      ? <img src={o.products.image_url} alt="" className="h-full w-full object-contain p-1" />
                      : <div className="grid h-full w-full place-items-center text-lg">📦</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{o.products?.name ?? o.order_type}</div>
                    <div className="text-[11px] text-muted-foreground">
                      מק״ט: <span className="font-mono">{o.products?.sku ?? "—"}</span>
                      {" · "}הזמנה #<span className="font-mono">{o.order_number}</span>
                      {o.stores?.name && <> · חנות: {o.stores.name}</>}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="font-bold">💎 {o.credits_charged}</div>
                    <div className="text-muted-foreground">כמות: {o.quantity ?? 1}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {openGroup.status === "in_transit" && (
                <button onClick={() => markGroupDelivered(openGroup)} className="btn-plastic">
                  ✅ סמן את כל המשלוח כנמסר
                </button>
              )}
              {openGroup.status === "in_transit" && openGroup.orders.length > 1 && (
                <div className="basis-full text-[11px] text-muted-foreground">
                  ניתן גם לסמן פריט בודד כנמסר:
                </div>
              )}
              {openGroup.status === "in_transit" && openGroup.orders.length > 1 && openGroup.orders.map((o) => (
                <button key={o.id} onClick={() => markDelivered(o.id)} className="chrome-panel px-2 py-1 text-[11px]">
                  ✔ #{o.order_number}
                </button>
              ))}
              <button onClick={() => setOpenGroup(null)} className="chrome-panel px-4 py-2 text-sm">סגור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ---------------- Owner messages inbox ----------------

function BroadcastPanel() {
  const send = useServerFn(sendSystemMessage);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: players = [] } = useQuery({
    queryKey: ["broadcast-players"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, level")
        .order("username")
        .limit(1000);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) => p.username?.toLowerCase().includes(q) || (p.display_name ?? "").toLowerCase().includes(q),
    );
  }, [players, search]);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async () => {
    if (!selected.length) { toast.error("בחר/י לפחות משתמש אחד"); return; }
    if (!title.trim() || !body.trim()) { toast.error("נדרשת כותרת ותוכן"); return; }
    setBusy(true);
    try {
      const res = await send({ data: { user_ids: selected, title, body, link: link.trim() || null } });
      toast.success(`ההודעה נשלחה ל-${res.sent} משתמשים`);
      setTitle(""); setBody(""); setLink(""); setSelected([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שליחה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-[320px_1fr]" dir="rtl">
      <div className="chrome-panel p-3">
        <h2 className="mb-2 text-lg font-bold">בחירת נמענים</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם משתמש"
          className="mb-2 w-full rounded-full border-2 border-border bg-input px-4 py-2 text-sm"
        />
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-bold">נבחרו {selected.length}</span>
          <div className="flex gap-2">
            <button className="rounded-lg bg-muted px-2 py-1" onClick={() => setSelected(filtered.map((p) => p.id))}>בחר הכל</button>
            <button className="rounded-lg bg-muted px-2 py-1" onClick={() => setSelected([])}>נקה</button>
          </div>
        </div>
        <div className="max-h-[420px] space-y-1 overflow-y-auto">
          {filtered.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-sm hover:bg-muted">
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
              <span className="truncate">{p.display_name || p.username}</span>
              <span className="ms-auto text-[10px] text-muted-foreground">Lv {p.level}</span>
            </label>
          ))}
          {!filtered.length && <div className="p-2 text-xs text-muted-foreground">לא נמצאו משתמשים</div>}
        </div>
      </div>
      <div className="chrome-panel space-y-3 p-4">
        <h2 className="text-lg font-bold">📢 הודעה מהמערכת (חד-כיוונית)</h2>
        <p className="text-xs text-muted-foreground">
          ההודעה תופיע לנמענים בעמוד ההודעות תחת "הודעות מהמערכת" עם תג "הודעה מהמערכת". לא ניתן להשיב עליה.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="כותרת ההודעה"
          className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="תוכן ההודעה"
          rows={7}
          className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm"
        />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="קישור (אופציונלי)"
          className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm"
        />
        <button className="btn-plastic" disabled={busy} onClick={submit}>
          {busy ? "שולח..." : "שליחת הודעה"}
        </button>
      </div>
    </div>
  );
}

function OwnerMessages() {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState("");

  const { data: convs = [] } = useQuery({
    queryKey: ["owner-convs"],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data } = await supabase
        .from("store_conversations")
        .select("id, subject, status, unread_owner, last_message_at, user_id, store_id, npc_id")
        .order("last_message_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["owner-conv-messages", activeId],
    enabled: !!activeId,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", activeId!)
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: activeConv } = useQuery({
    queryKey: ["owner-conv-meta", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data: c } = await supabase.from("store_conversations").select("*, stores(name), npcs(name)").eq("id", activeId!).maybeSingle();
      if (!c) return null;
      const { data: prof } = await supabase.from("profiles").select("username").eq("id", c.user_id).maybeSingle();
      return { ...c, username: prof?.username };
    },
  });

  useEffect(() => {
    if (!activeId) return;
    supabase.from("store_conversations").update({ unread_owner: 0 }).eq("id", activeId).then(() => {
      qc.invalidateQueries({ queryKey: ["owner-convs"] });
    });
  }, [activeId, qc, messages.length]);

  const send = async () => {
    if (!user || !activeId || !body.trim()) return;
    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: activeId, sender_id: user.id, sender_role: "owner", body: body.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setBody("");
    qc.invalidateQueries({ queryKey: ["owner-conv-messages", activeId] });
    qc.invalidateQueries({ queryKey: ["owner-convs"] });
  };

  const setStatus = async (status: string) => {
    if (!activeId) return;
    await supabase.from("store_conversations").update({ status }).eq("id", activeId);
    qc.invalidateQueries({ queryKey: ["owner-convs"] });
  };

  return (
    <div className="grid gap-3 md:grid-cols-[320px_1fr]">
      <div className="chrome-panel p-3">
        <h2 className="mb-2 text-lg font-bold">{t("owner.tab.messages")}</h2>
        <div className="space-y-1">
          {convs.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full rounded-xl px-3 py-2 text-start text-sm ${activeId === c.id ? "bg-primary/15 font-semibold" : "hover:bg-muted"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{c.subject ?? (c.store_id ? "Store" : "NPC")}</span>
                {c.unread_owner > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">{c.unread_owner}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(c.last_message_at).toLocaleString()} · {c.status}
              </div>
            </button>
          ))}
          {!convs.length && <div className="p-2 text-xs text-muted-foreground">No pending messages.</div>}
        </div>
      </div>
      <div className="chrome-panel flex min-h-[60vh] flex-col p-3">
        {activeId ? (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2 text-xs">
              <div>
                <div className="font-bold">{(activeConv as never as { username?: string } | null)?.username ?? "Player"}</div>
                <div className="text-muted-foreground">
                  {(activeConv as never as { stores?: { name?: string }; npcs?: { name?: string } } | null)?.stores?.name
                    ?? (activeConv as never as { npcs?: { name?: string } } | null)?.npcs?.name
                    ?? "—"}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setStatus("closed")} className="chrome-panel px-2 py-1">{t("msg.close")}</button>
                <button onClick={() => setStatus("open")} className="chrome-panel px-2 py-1">{t("msg.reopen")}</button>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pb-2">
              {messages.map((m) => (
                <div key={m.id} className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${m.sender_role === "user" ? "bg-muted" : "ms-auto bg-primary text-primary-foreground"}`}>
                  {m.body}
                  <div className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={t("msg.reply")}
                className="flex-1 rounded-full border-2 border-border bg-input px-4 py-2 text-sm"
              />
              <button className="btn-plastic" onClick={send}>{t("play.send")}</button>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Select a conversation</div>
        )}
      </div>
    </div>
  );
}

function UsersPanel() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const createFn = useServerFn(adminCreateUser);
  const setRoleFn = useServerFn(adminSetUserRole);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"player" | "owner">("player");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, credits, level, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const ids = (profiles ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
      const rMap = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const arr = rMap.get(r.user_id) ?? [];
        arr.push(r.role);
        rMap.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({ ...p, roles: rMap.get(p.id) ?? [] }));
    },
  });

  const filtered = users.filter((u) =>
    !search ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(search.toLowerCase()),
  );
  const { sorted: sortedUsers, SortHeader } = useSortableData(filtered);

  const submit = async () => {
    if (!email || !password || !username) {
      toast.error("מלא/י מייל, סיסמה ושם משתמש");
      return;
    }
    setBusy(true);
    try {
      await createFn({ data: { email, password, username, role } });
      toast.success(role === "owner" ? "נוצר משתמש בעלים" : "נוצר משתמש");
      setEmail(""); setPassword(""); setUsername(""); setRole("player");
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "שגיאה ביצירת משתמש");
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (userId: string, newRole: "player" | "owner") => {
    if (userId === currentUser?.id && newRole !== "owner") {
      toast.error("אי אפשר להוריד את עצמך מבעלים");
      return;
    }
    try {
      await setRoleFn({ data: { user_id: userId, role: newRole } });
      toast.success("התפקיד עודכן");
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "שגיאה בעדכון תפקיד");
    }
  };

  return (
    <div className="space-y-4">
      <div className="chrome-panel p-4">
        <h2 className="mb-3 text-lg font-bold">➕ יצירת משתמש חדש</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          המשתמש ייווצר עם מייל מאומת (יוכל להתחבר מיד). בחר/י "בעלים" כדי לתת גישה מלאה לממשק הבעלים.
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">מייל</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="chrome-panel w-full px-3 py-2 text-sm" placeholder="user@example.com" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">שם משתמש (בתוך המשחק)</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              className="chrome-panel w-full px-3 py-2 text-sm" placeholder="username" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">סיסמה (מינ׳ 6 תווים)</span>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
              className="chrome-panel w-full px-3 py-2 text-sm" placeholder="password" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">תפקיד</span>
            <select value={role} onChange={(e) => setRole(e.target.value as "player" | "owner")}
              className="chrome-panel w-full px-3 py-2 text-sm">
              <option value="player">👤 שחקן</option>
              <option value="owner">👑 בעלים (גישה מלאה)</option>
            </select>
          </label>
        </div>
        <div className="mt-3">
          <button disabled={busy} onClick={submit} className="btn-plastic text-sm disabled:opacity-50">
            {busy ? "יוצר..." : "צור משתמש"}
          </button>
        </div>
      </div>

      <div className="chrome-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">👥 משתמשים קיימים ({users.length})</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש..." className="chrome-panel px-3 py-1.5 text-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-start text-xs text-muted-foreground">
              <tr>
                <SortHeader label="שם משתמש" sortKey="username" />
                <SortHeader label="רמה" sortKey="level" />
                <SortHeader label="💎" sortKey="credits" />
                <SortHeader label="תפקיד" sortKey="roles" />
                <th className="py-2 text-start">שינוי תפקיד</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u, idx) => {
                const isOwnerUser = u.roles.includes("owner");
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={`${u.id}-${idx}`} className="border-t border-border">
                    <td className="p-2">
                      <div className="font-semibold">{u.username}</div>
                      {u.display_name && <div className="text-xs text-muted-foreground">{u.display_name}</div>}
                    </td>
                    <td className="p-2">{u.level}</td>
                    <td className="p-2">{u.credits}</td>
                    <td className="p-2">
                      {isOwnerUser ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">👑 בעלים</span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">שחקן</span>
                      )}
                    </td>
                    <td className="p-2">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">(אתה)</span>
                      ) : isOwnerUser ? (
                        <button onClick={() => changeRole(u.id, "player")}
                          className="chrome-panel px-2 py-1 text-xs">⬇ הפוך לשחקן</button>
                      ) : (
                        <button onClick={() => changeRole(u.id, "owner")}
                          className="chrome-panel px-2 py-1 text-xs">⬆ הפוך לבעלים</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedUsers.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">אין משתמשים תואמים</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type Pack = {
  id: string;
  name: string;
  credit_amount: number;
  price: number;
  currency: string;
  featured: boolean;
  active: boolean;
  display_order: number;
};

function PackagesPanel() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["owner_packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_packages")
        .select("id, name, credit_amount, price, currency, featured, active, display_order")
        .order("display_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as Pack[];
    },
  });
  const { sorted: sortedRows, SortHeader } = useSortableData(rows, { key: "display_order", direction: "asc" });

  const [name, setName] = useState("");
  const [ratio, setRatio] = useState<number>(10); // gems per 1 ₪
  const [amountIls, setAmountIls] = useState<number>(20);
  const [featured, setFeatured] = useState(false);
  const [order, setOrder] = useState<number>(0);

  const gems = Math.max(0, Math.round(ratio * amountIls));
  const perCredit = gems > 0 ? amountIls / gems : 0;

  async function create() {
    if (!name.trim()) { toast.error("שם חבילה נדרש"); return; }
    if (ratio <= 0 || amountIls <= 0) { toast.error("ערכים לא תקינים"); return; }
    const { error } = await supabase.from("credit_packages").insert({
      name: name.trim(),
      credit_amount: gems,
      bonus_credits: 0,
      price: amountIls,
      currency: "ILS",
      featured,
      display_order: order,
      active: true,
      emoji: null,
      description: null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("חבילה נוצרה");
    setName(""); setRatio(10); setAmountIls(20); setFeatured(false); setOrder(0);
    qc.invalidateQueries({ queryKey: ["owner_packages"] });
    qc.invalidateQueries({ queryKey: ["packs"] });
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("credit_packages").update({ active: !active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["owner_packages"] });
    qc.invalidateQueries({ queryKey: ["packs"] });
  }
  async function toggleFeatured(id: string, featured: boolean) {
    const { error } = await supabase.from("credit_packages").update({ featured: !featured }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["owner_packages"] });
    qc.invalidateQueries({ queryKey: ["packs"] });
  }
  async function remove(id: string) {
    if (!confirm("למחוק את החבילה?")) return;
    const { error } = await supabase.from("credit_packages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["owner_packages"] });
    qc.invalidateQueries({ queryKey: ["packs"] });
  }

  return (
    <div className="chrome-panel p-4">
      <h2 className="mb-3 text-lg font-bold">💎 חבילות קרדיטים</h2>
      <div className="chrome-panel mb-4 grid gap-3 p-3 md:grid-cols-5">
        <label className="text-xs">
          <div className="mb-1 font-bold">שם חבילה</div>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded border px-2 py-1" placeholder="למשל: חבילת ארד" />
        </label>
        <label className="text-xs">
          <div className="mb-1 font-bold">קרדיטים לכל 1 ₪</div>
          <input type="number" min={1} value={ratio}
            onChange={(e) => setRatio(Number(e.target.value))}
            className="w-full rounded border px-2 py-1" />
        </label>
        <label className="text-xs">
          <div className="mb-1 font-bold">סכום בחבילה (₪)</div>
          <input type="number" min={1} value={amountIls}
            onChange={(e) => setAmountIls(Number(e.target.value))}
            className="w-full rounded border px-2 py-1" />
        </label>
        <label className="text-xs">
          <div className="mb-1 font-bold">סדר תצוגה</div>
          <input type="number" value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-full rounded border px-2 py-1" />
        </label>
        <label className="flex items-end gap-2 text-xs">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          <span>מומלץ (Featured)</span>
        </label>
        <div className="md:col-span-5 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
          <div className="text-sm">
            <span className="font-bold">מתקבל:</span>{" "}
            <span>{gems} קרדיטים תמורת {amountIls} ₪</span>
            {gems > 0 && (
              <span className="ms-2 text-muted-foreground">
                (₪{perCredit.toFixed(3)} לכל קרדיט)
              </span>
            )}
          </div>
          <button onClick={create} className="btn-plastic text-xs">➕ צור חבילה</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-start">
              <SortHeader label="שם" sortKey="name" />
              <SortHeader label="קרדיטים" sortKey="credit_amount" />
              <SortHeader label="מחיר" sortKey="price" />
              <th className="p-2 text-start">₪ / קרדיט</th>
              <SortHeader label="סדר" sortKey="display_order" />
              <SortHeader label="Featured" sortKey="featured" />
              <SortHeader label="פעיל" sortKey="active" />
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (<tr><td colSpan={8} className="p-4 text-center text-muted-foreground">טוען…</td></tr>)}
            {sortedRows.map((p) => {
              const per = p.credit_amount > 0 ? Number(p.price) / p.credit_amount : 0;
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">💎 {p.credit_amount}</td>
                  <td className="p-2">{Number(p.price).toFixed(2)} ₪</td>
                  <td className="p-2 text-muted-foreground">₪{per.toFixed(3)}</td>
                  <td className="p-2">{p.display_order}</td>
                  <td className="p-2">
                    <button onClick={() => toggleFeatured(p.id, p.featured)}
                      className="chrome-panel px-2 py-1 text-xs">{p.featured ? "★" : "☆"}</button>
                  </td>
                  <td className="p-2">
                    <button onClick={() => toggleActive(p.id, p.active)}
                      className="chrome-panel px-2 py-1 text-xs">{p.active ? "פעיל" : "כבוי"}</button>
                  </td>
                  <td className="p-2 text-end">
                    <button onClick={() => remove(p.id)} className="chrome-panel px-2 py-1 text-xs">🗑</button>
                  </td>
                </tr>
              );
            })}
            {!isLoading && sortedRows.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">אין חבילות</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- Stores picker (single or multi) ----------------

function StoresPicker({ value, onChange, multi }: { value: string | string[] | null | undefined; onChange: (v: string | string[] | null) => void; multi: boolean }) {
  const { data: stores = [] } = useQuery({
    queryKey: ["stores-picker"],
    queryFn: async () => (await supabase.from("stores").select("id,name").eq("active", true).order("name")).data ?? [],
  });
  if (multi) {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (id: string) => {
      const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
      onChange(next);
    };
    return (
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border-2 border-border bg-input p-2">
        {stores.length === 0 && <div className="text-[11px] text-muted-foreground">אין חנויות</div>}
        {stores.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
            {s.name}
          </label>
        ))}
      </div>
    );
  }
  const single = typeof value === "string" ? value : "";
  return (
    <select value={single} onChange={(e) => onChange(e.target.value || null)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1">
      <option value="">— ללא —</option>
      {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}

// ---------------- Character roles picker ----------------

function RolePicker({ value, onChange }: { value: string | null | undefined; onChange: (v: string | null) => void }) {
  const { data: roles = [] } = useQuery({
    queryKey: ["character-roles-picker"],
    queryFn: async () => (await supabase.from("character_roles").select("id,name,icon").eq("active", true).order("display_order")).data ?? [],
  });
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1">
      <option value="">— ללא תפקיד —</option>
      {roles.map((r) => <option key={r.id} value={r.id}>{r.icon ? `${r.icon} ` : ""}{r.name}</option>)}
    </select>
  );
}


// ---------------- Categories picker (from product_categories) ----------------

function CategoryPicker({ value, onChange, subOf }: { value: string | null | undefined; onChange: (v: string | null) => void; subOf?: string | null }) {
  const { data: cats = [] } = useQuery({
    queryKey: ["product-categories-picker"],
    queryFn: async () => (await supabase.from("product_categories").select("id,name,parent_id,active,display_order").eq("active", true).order("display_order")).data ?? [],
  });
  const filtered = subOf === undefined
    ? cats.filter((c) => !c.parent_id)
    : cats.filter((c) => {
        if (!subOf) return false;
        const parent = cats.find((p) => p.name === subOf);
        if (!parent) return false;
        return c.parent_id === parent.id;
      });
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1">
      <option value="">— ללא —</option>
      {filtered.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
    </select>
  );
}

// ---------------- Categories management panel ----------------

function ProductsPanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const runImport = useServerFn(importWooProducts);

  const { data: stores = [] } = useQuery({
    queryKey: ["own", "stores"],
    queryFn: async () => (await supabase.from("stores").select("id, name")).data ?? [],
  });
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id.slice(0, 6);

  const doImport = async () => {
    setImporting(true);
    try {
      const res = await runImport({ data: undefined as never });
      toast.success(`יובאו ${res.imported} מוצרים · דילוג על ${res.skipped} (קיימים) · נסרקו ${res.scanned}`);
      qc.invalidateQueries({ queryKey: ["own", "products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ייבוא נכשל");
    } finally {
      setImporting(false);
    }
  };

  const bulkDelete = async (ids: string[], clear: () => void) => {
    if (!ids.length) return;
    if (!confirm(`למחוק ${ids.length} מוצרים? הפעולה בלתי הפיכה.`)) return;
    setBusy(true);
    const { error } = await supabase.from("products").delete().in("id", ids);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`נמחקו ${ids.length} מוצרים`);
    clear();
    qc.invalidateQueries({ queryKey: ["own", "products"] });
  };

  const bulkAssignStore = async (ids: string[], storeId: string, clear: () => void) => {
    if (!ids.length) return;
    setBusy(true);
    const { error } = await supabase.from("products").update({ store_id: storeId }).in("id", ids);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} מוצרים שויכו ל${storeName(storeId)}`);
    clear();
    qc.invalidateQueries({ queryKey: ["own", "products"] });
  };

  const bulkSetActive = async (ids: string[], active: boolean, clear: () => void) => {
    if (!ids.length) return;
    setBusy(true);
    const { error } = await supabase.from("products").update({ active }).in("id", ids);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} מוצרים סומנו כ${active ? "פעילים" : "לא פעילים"}`);
    clear();
    qc.invalidateQueries({ queryKey: ["own", "products"] });
  };


  return (
    <>
    <WooSyncSettings />
    <ManagedTable
      schema={SCHEMAS.products}
      title={t("owner.tab.products")}
      toolbar={
        <button onClick={doImport} disabled={importing} className="chrome-panel px-2 py-1 text-xs disabled:opacity-40">
          {importing ? "⏳ מייבא…" : "🛒 ייבוא מ‑WooCommerce"}
        </button>
      }
      extraColumns={[
        {
          key: "stores",
          label: "חנויות",
          render: (row) => {
            const ids = [
              ...(row.store_id ? [String(row.store_id)] : []),
              ...(((row.store_ids as string[] | null) ?? []).filter((id) => id && id !== row.store_id)),
            ];
            if (!ids.length) return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">לא משויך</span>;
            return <span className="text-[11px]">{ids.map(storeName).join(", ")}</span>;
          },
        },
      ]}
      selectable
      quickEdit
      bulkActions={({ ids, rows, clear, selectAll, selectWhere }) => (
        <>
          <button onClick={selectAll} className="chrome-panel px-2 py-0.5">בחר הכל</button>
          <button
            onClick={() => selectWhere((r) => r.woo_product_id != null)}
            className="chrome-panel px-2 py-0.5"
          >
            בחר מוצרי WooCommerce
          </button>
          <button onClick={clear} className="chrome-panel px-2 py-0.5" disabled={!ids.length}>
            ניקוי בחירה
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <select
            value=""
            disabled={!ids.length}
            onChange={(e) => e.target.value && void bulkAssignStore(ids, e.target.value, clear)}
            className="rounded-xl border-2 border-border bg-input px-2 py-0.5 disabled:opacity-40"
          >
            <option value="">🏬 שיוך לחנות…</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={() => void bulkSetActive(ids, true, clear)}
            disabled={!ids.length || busy}
            className="rounded-xl bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-700 disabled:opacity-40"
          >
            ✅ סמן כפעיל
          </button>
          <button
            onClick={() => void bulkSetActive(ids, false, clear)}
            disabled={!ids.length || busy}
            className="rounded-xl bg-amber-500/20 px-2 py-0.5 font-bold text-amber-700 disabled:opacity-40"
          >
            ⏸️ סמן כלא פעיל
          </button>
          <button
            onClick={() => void bulkDelete(ids, clear)}
            disabled={!ids.length || busy}
            className="rounded-xl bg-destructive/20 px-2 py-0.5 font-bold text-destructive disabled:opacity-40"
          >
            🗑️ מחיקת {ids.length || ""} מוצרים
          </button>
          {rows.some((r) => r.woo_product_id != null) && (
            <span className="text-[11px] text-muted-foreground">כולל מוצרים מווקומרס</span>
          )}
        </>
      )}
    />
    </>
  );
}

function CategoriesPanel() {

  const qc = useQueryClient();
  const { data: cats = [] } = useQuery({
    queryKey: ["product-categories-manage"],
    queryFn: async () => (await supabase.from("product_categories").select("*").order("display_order")).data ?? [],
  });
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const parents = cats.filter((c) => !c.parent_id);
  const add = async () => {
    if (!name.trim()) return;
    const payload: Record<string, unknown> = { name: name.trim() };
    if (parentId) payload.parent_id = parentId;
    const { error } = await supabase.from("product_categories").insert(payload as never);
    if (error) { toast.error(error.message); return; }
    setName(""); setParentId("");
    qc.invalidateQueries({ queryKey: ["product-categories-manage"] });
    qc.invalidateQueries({ queryKey: ["product-categories-picker"] });
  };
  const del = async (id: string) => {
    if (!confirm("למחוק את הקטגוריה?")) return;
    const { error } = await supabase.from("product_categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["product-categories-manage"] }); qc.invalidateQueries({ queryKey: ["product-categories-picker"] }); }
  };
  return (
    <div className="chrome-panel space-y-4 p-4">
      <div>
        <h2 className="mb-2 text-lg font-bold">🏷️ קטגוריות ותת-קטגוריות</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            <span className="mb-1 block font-semibold">שם</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border-2 border-border bg-input px-3 py-1" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold">קטגוריית אב (אופציונלי – לתת-קטגוריה)</span>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="rounded-xl border-2 border-border bg-input px-3 py-1">
              <option value="">— קטגוריה ראשית —</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button onClick={add} className="btn-plastic text-xs">+ הוסף</button>
        </div>
      </div>
      <div className="space-y-2">
        {parents.map((p) => {
          const subs = cats.filter((c) => c.parent_id === p.id);
          return (
            <div key={p.id} className="chrome-panel p-3">
              <div className="flex items-center justify-between">
                <div className="font-bold">🏷️ {p.name}</div>
                <button onClick={() => del(p.id)} className="rounded bg-destructive/20 px-2 py-0.5 text-xs text-destructive">🗑️</button>
              </div>
              {subs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  {subs.map((s) => (
                    <span key={s.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      {s.name}
                      <button onClick={() => del(s.id)} className="text-destructive">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {parents.length === 0 && <div className="rounded bg-muted p-3 text-xs text-muted-foreground">אין קטגוריות עדיין. הוסיפו אחת למעלה.</div>}
      </div>
    </div>
  );
}

