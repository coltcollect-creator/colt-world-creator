import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  fetchAllAlbumCards,
  subscribeUserCards,
  type AlbumCard,
  type UserCollectedCard,
} from "@/lib/album-cards";
import { DigitalAlbum } from "@/components/album/DigitalAlbum";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Trophy, ShoppingBag, Shirt, Diamond, Star, Award, Shield } from "lucide-react";
import { getLevelProgress } from "@/lib/progression";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "הפרופיל שלי ואלבום הכנס | COLT Market World" },
      {
        name: "description",
        content: "צפו בפרופיל האישי, רמת השחקן, פריטי האספנות והאלבום הדיגיטלי של כנס COLT.",
      },
    ],
  }),
});

function ProfilePage() {
  const { profile, user, isOwner } = useAuth();
  const [allCards, setAllCards] = useState<AlbumCard[]>([]);
  const [userCards, setUserCards] = useState<UserCollectedCard[]>([]);
  const [loadingAlbum, setLoadingAlbum] = useState(true);

  // Load all available album cards definition
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cards = await fetchAllAlbumCards();
        if (!cancelled) setAllCards(cards);
      } catch (err) {
        console.error("Failed to load album cards:", err);
      } finally {
        if (!cancelled) setLoadingAlbum(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time subscription to user's collected cards
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeUserCards(user.id, (cards) => {
      setUserCards(cards);
    });
    return () => {
      unsubscribe();
    };
  }, [user]);

  const { data: cos = [] } = useQuery({
    queryKey: ["my-cos", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("player_cosmetics")
          .select("cosmetic_id, cosmetics(name, layer_type)")
          .eq("user_id", user!.id)
      ).data ?? [],
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("orders")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(10)
      ).data ?? [],
  });

  if (!profile) return null;

  return (
    <div className="space-y-4">
      {/* Player Header Card */}
      <div className="chrome-panel overflow-hidden p-0">
        <div className="relative bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-700 p-6 text-white">
          <div className="relative z-10 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative grid h-24 w-24 place-items-center rounded-2xl bg-white/20 text-4xl shadow-inner backdrop-blur border-2 border-white/40">
                👤
                {isOwner && (
                  <span
                    title="מנהל / בעלים"
                    className="absolute -bottom-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-slate-950 font-black shadow-md border-2 border-white text-xs"
                  >
                    👑
                  </span>
                )}
              </div>

              <div className="text-center sm:text-right">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl font-black md:text-3xl">{profile.username}</h1>
                  {isOwner && (
                    <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black text-slate-950 shadow">
                      מנהל ראשי
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                  <span className="rounded-full bg-white/20 px-3 py-1 font-bold backdrop-blur">
                    ⭐ רמה {profile.level} ({profile.xp} XP)
                  </span>
                  <span className="rounded-full bg-white/20 px-3 py-1 font-bold backdrop-blur">
                    💎 {profile.credits} ג'מים
                  </span>
                  <span className="rounded-full bg-white/20 px-3 py-1 font-bold backdrop-blur">
                    🃏 {userCards.length} / {allCards.length} קלפים באלבום
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur border border-white/20 min-w-[90px]">
                <div className="text-lg font-black">{cos.length}</div>
                <div className="text-[10px] text-white/80">פריטי לבוש</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur border border-white/20 min-w-[90px]">
                <div className="text-lg font-black">{orders.length}</div>
                <div className="text-[10px] text-white/80">הזמנות</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* XP Level Progress Card */}
      {(() => {
        const prog = getLevelProgress(profile.xp || 0);
        return (
          <div className="chrome-panel rounded-3xl p-4 sm:p-5 bg-card/90 border border-primary/25 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-primary text-primary-foreground font-black text-lg shadow-md shadow-primary/20">
                  Lv {profile.level}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base text-foreground">רמה {profile.level}</span>
                    <span className="text-xs font-bold text-muted-foreground font-mono">({profile.xp.toLocaleString()} XP)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {prog.isMaxLevel ? "🏆 הגעת לרמה המקסימלית במשחק!" : `עוד ${prog.remainingXp.toLocaleString()} XP לעלייה לרמה ${prog.nextMilestone?.level}`}
                  </p>
                </div>
              </div>

              {!prog.isMaxLevel && prog.nextMilestone?.reward_label && (
                <div className="rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary flex items-center gap-1.5 shadow-sm">
                  <span>🎁 פרס ברמה {prog.nextMilestone.level}:</span>
                  <span className="text-foreground">{prog.nextMilestone.reward_label}</span>
                </div>
              )}
            </div>

            {/* Progress track */}
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/80 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-primary to-yellow-400 transition-all duration-700 shadow-sm"
                style={{ width: `${prog.progressPercent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>{prog.currentLevelXp.toLocaleString()} XP (רמה {prog.currentLevel})</span>
              <span className="font-bold text-primary">{prog.progressPercent}% לקראת רמה {prog.nextMilestone?.level ?? prog.currentLevel}</span>
              <span>{prog.nextLevelXp.toLocaleString()} XP</span>
            </div>
          </div>
        );
      })()}

      {/* Main Tabs: Digital Album vs Orders */}
      <Tabs defaultValue="album" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted p-1">
          <TabsTrigger value="album" className="rounded-xl font-bold flex items-center justify-center gap-1.5">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span>אלבום כנס ומדבקות ({userCards.length}/{allCards.length})</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl font-bold flex items-center justify-center gap-1.5">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <span>היסטוריית הזמנות ({orders.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="album" className="mt-4">
          <div className="chrome-panel p-4 md:p-6">
            {loadingAlbum ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                טוען את אלבום הכנס והקלפים...
              </div>
            ) : (
              <DigitalAlbum
                allCards={allCards}
                userCards={userCards}
                username={profile.username}
                isOwnerView={isOwner}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <div className="chrome-panel p-6">
            <h2 className="mb-3 text-lg font-bold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span>הזמנות אחרונות</span>
            </h2>
            <ul className="divide-y divide-border text-sm">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-semibold">{o.order_type}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                    {o.status}
                  </span>
                </li>
              ))}
              {!orders.length && (
                <li className="py-6 text-center text-xs text-muted-foreground">
                  אין הזמנות עדיין בחשבונך.
                </li>
              )}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
