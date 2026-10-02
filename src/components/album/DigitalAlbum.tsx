import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { type AlbumCard, type UserCollectedCard, type CardRarity } from "@/lib/album-cards";
import { Sparkles, Lock, CheckCircle2, Trophy, Share2, Eye, ShieldCheck, Flame } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  allCards: AlbumCard[];
  userCards: UserCollectedCard[];
  username?: string;
  isOwnerView?: boolean;
  onEditCard?: (card: AlbumCard) => void;
};

const RARITY_CONFIG: Record<CardRarity, { label: string; border: string; bg: string; text: string; glow: string }> = {
  common: {
    label: "נפוץ",
    border: "border-slate-300 dark:border-slate-600",
    bg: "from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900",
    text: "text-slate-600 dark:text-slate-300",
    glow: "shadow-slate-300/40",
  },
  rare: {
    label: "נדיר",
    border: "border-sky-400 dark:border-sky-500",
    bg: "from-sky-50 to-blue-100 dark:from-sky-950 dark:to-blue-900",
    text: "text-sky-600 dark:text-sky-300",
    glow: "shadow-sky-400/50",
  },
  epic: {
    label: "אפי",
    border: "border-purple-500 dark:border-purple-600",
    bg: "from-purple-50 to-fuchsia-100 dark:from-purple-950 dark:to-fuchsia-900",
    text: "text-purple-600 dark:text-purple-300",
    glow: "shadow-purple-500/60",
  },
  legendary: {
    label: "אגדי",
    border: "border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/40",
    bg: "from-amber-50 via-yellow-100 to-orange-100 dark:from-amber-950 dark:via-yellow-950 dark:to-orange-950",
    text: "text-amber-700 dark:text-amber-300",
    glow: "shadow-amber-400/70",
  },
};

export function DigitalAlbum({
  allCards,
  userCards,
  username = "משתתף",
  isOwnerView = false,
  onEditCard,
}: Props) {
  const [selectedRarity, setSelectedRarity] = useState<string>("all");
  const [inspectCard, setInspectCard] = useState<{
    card: AlbumCard;
    unlocked: boolean;
    collectedData?: UserCollectedCard;
  } | null>(null);

  const ownedMap = useMemo(() => {
    const map = new Map<string, UserCollectedCard>();
    for (const uc of userCards) {
      if (uc.card_id) map.set(uc.card_id, uc);
      if (uc.card_number != null) map.set(`num-${uc.card_number}`, uc);
      if (uc.id) map.set(uc.id, uc);
      if (uc.source_name) map.set(`src-${uc.source_name}`, uc);
    }
    return map;
  }, [userCards]);

  const filteredCards = useMemo(() => {
    if (selectedRarity === "all") return allCards;
    return allCards.filter((c) => c.rarity === selectedRarity);
  }, [allCards, selectedRarity]);

  const totalCards = allCards.length;

  // Calculate unique collected cards against totalCards
  const collectedCount = useMemo(() => {
    let count = 0;
    for (const card of allCards) {
      const isOwned =
        ownedMap.has(card.id) ||
        ownedMap.has(`num-${card.card_number}`) ||
        (card.source_id ? ownedMap.has(`quest-${card.source_id}`) || ownedMap.has(card.source_id) : false) ||
        (card.source_name ? ownedMap.has(`src-${card.source_name}`) : false);
      if (isOwned) count++;
    }
    return Math.max(count, userCards.length);
  }, [allCards, ownedMap, userCards]);

  const percentage = totalCards > 0 ? Math.min(100, Math.round((collectedCount / totalCards) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Album Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border-4 border-white bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-800 p-5 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-300">
              <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
              אלבום מדבקות וקלפים דיגיטלי · Digital Event Album
            </div>
            <h2 className="mt-1 text-2xl font-black md:text-3xl">
              אלבום הכנס של {username}
            </h2>
            <p className="mt-1 text-xs text-white/80 max-w-xl">
              השלימו משימות, פתחו תיבות אוצר והשתתפו בפעילויות הכנס כדי לאסוף את כל הקלפים וההישגים הנדירים!
            </p>
          </div>

          {/* Progress gauge */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/10 p-3.5 backdrop-blur-md border border-white/20 min-w-[170px]">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-amber-300">{collectedCount}</span>
              <span className="text-sm font-semibold text-white/70">/ {totalCards}</span>
            </div>
            <div className="mt-1 text-[11px] font-bold text-pink-200">
              {percentage}% הושלמו
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-pink-500 transition-all duration-700"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Background glow circle */}
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -top-10 -left-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      {/* Rarity & Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setSelectedRarity("all")}
            className={`rounded-full px-3 py-1.5 font-bold transition-all ${
              selectedRarity === "all"
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            הכל ({allCards.length})
          </button>
          {(["common", "rare", "epic", "legendary"] as CardRarity[]).map((r) => {
            const count = allCards.filter((c) => c.rarity === r).length;
            const conf = RARITY_CONFIG[r];
            return (
              <button
                key={r}
                onClick={() => setSelectedRarity(r)}
                className={`rounded-full px-3 py-1.5 font-bold transition-all ${
                  selectedRarity === r
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md scale-105"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {conf.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground">
          לחיצה על קלף פותחת פרטים והנחיות פתיחה
        </div>
      </div>

      {/* Cards Grid Album Binder */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {filteredCards.map((card) => {
          const collected =
            ownedMap.get(card.id) ||
            ownedMap.get(`num-${card.card_number}`) ||
            (card.source_id ? ownedMap.get(`quest-${card.source_id}`) || ownedMap.get(card.source_id) : null) ||
            (card.source_name ? ownedMap.get(`src-${card.source_name}`) : null);
          const isUnlocked = !!collected;
          const conf = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.common;

          return (
            <div
              key={card.id}
              onClick={() =>
                setInspectCard({ card, unlocked: isUnlocked, collectedData: collected })
              }
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 p-2.5 transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-xl ${
                isUnlocked
                  ? `${conf.border} bg-gradient-to-b ${conf.bg} shadow-md ${conf.glow}`
                  : "border-dashed border-slate-300 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-900/60 opacity-75 hover:opacity-100"
              }`}
            >
              {/* Card Number & Rarity Header */}
              <div className="flex items-center justify-between text-[10px] font-black">
                <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-white">
                  #{String(card.card_number).padStart(2, "0")}
                </span>
                {isUnlocked ? (
                  <span className={`font-bold ${conf.text}`}>{conf.label}</span>
                ) : (
                  <span className="flex items-center gap-0.5 text-slate-500">
                    <Lock className="h-3 w-3" /> נעול
                  </span>
                )}
              </div>

              {/* Card Image or Locked Silhouette */}
              <div className="relative my-2 aspect-[3/4] w-full overflow-hidden rounded-xl bg-black/10">
                {isUnlocked ? (
                  <>
                    <img
                      src={card.image_url}
                      alt={card.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Gloss foil shimmer overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </>
                ) : (
                  <div className="grid h-full w-full place-items-center bg-slate-200 dark:bg-slate-800 text-slate-400">
                    <div className="text-center p-2">
                      <Lock className="mx-auto h-7 w-7 opacity-40 mb-1" />
                      <div className="text-[10px] font-bold opacity-60">קלף נעול</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Title & Clue */}
              <div>
                <div className="truncate text-xs font-black" title={card.title}>
                  {card.title}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {isUnlocked
                    ? `נאסף ב-${new Date(collected!.unlocked_at).toLocaleDateString("he-IL")}`
                    : card.source_name || "משימה סודית"}
                </div>
              </div>

              {/* Owner edit trigger */}
              {isOwnerView && onEditCard && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCard(card);
                  }}
                  className="mt-2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white hover:bg-black"
                >
                  ערוך קלף
                </button>
              )}
            </div>
          );
        })}
      </div>

      {filteredCards.length === 0 && (
        <div className="chrome-panel grid place-items-center p-8 text-center text-sm text-muted-foreground">
          אין קלפים בקטגוריה שנבחרה.
        </div>
      )}

      {/* Inspect Card Modal */}
      {inspectCard && (
        <Dialog open={!!inspectCard} onOpenChange={() => setInspectCard(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-4 border-white shadow-2xl">
            <div
              className={`p-6 text-center ${
                inspectCard.unlocked
                  ? `bg-gradient-to-b ${RARITY_CONFIG[inspectCard.card.rarity].bg}`
                  : "bg-slate-100 dark:bg-slate-900"
              }`}
            >
              <div className="inline-block rounded-full bg-black/60 px-3 py-1 text-xs font-black text-white mb-2">
                קלף כנס #{String(inspectCard.card.card_number).padStart(2, "0")} ·{" "}
                {RARITY_CONFIG[inspectCard.card.rarity].label}
              </div>

              <div className="relative mx-auto my-3 aspect-[3/4] w-48 overflow-hidden rounded-2xl border-4 border-white shadow-2xl">
                {inspectCard.unlocked ? (
                  <img
                    src={inspectCard.card.image_url}
                    alt={inspectCard.card.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-slate-300 dark:bg-slate-800 text-slate-500">
                    <div>
                      <Lock className="mx-auto h-12 w-12 opacity-50" />
                      <div className="mt-2 text-xs font-bold">קלף נעול</div>
                    </div>
                  </div>
                )}
              </div>

              <DialogHeader>
                <DialogTitle className="text-xl font-black">
                  {inspectCard.card.title}
                </DialogTitle>
              </DialogHeader>

              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {inspectCard.card.description}
              </p>

              <div className="mt-4 rounded-xl border border-border bg-white/70 dark:bg-black/40 p-3 text-xs">
                {inspectCard.unlocked ? (
                  <div className="flex items-center justify-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>קלף זה פתוח באלבום שלך!</span>
                  </div>
                ) : (
                  <div className="text-amber-800 dark:text-amber-300 font-semibold">
                    💡 כיצד לפתוח: {inspectCard.card.source_name || "השלימו משימה או מצאו תיבת אוצר ברחבי העולם!"}
                  </div>
                )}
                {inspectCard.collectedData?.unlocked_at && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    תאריך השגה: {new Date(inspectCard.collectedData.unlocked_at).toLocaleString("he-IL")}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setInspectCard(null)}
                className="btn-plastic mt-4 w-full text-xs font-bold"
              >
                סגור
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
