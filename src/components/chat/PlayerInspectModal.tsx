import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllAlbumCards, fetchUserCards, type AlbumCard, type UserCollectedCard } from "@/lib/album-cards";
import { DigitalAlbum } from "@/components/album/DigitalAlbum";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Store, Shield, Sparkles, MessageCircle, Trophy, User } from "lucide-react";
import { CharacterFitPreview } from "@/components/game/CharacterFitPreview";

type Props = {
  playerId: string | null;
  initialUsername?: string;
  onClose: () => void;
  onStartChat?: (playerId: string, username: string) => void;
};

type InspectedProfile = {
  id: string;
  username: string;
  display_name: string | null;
  level: number;
  xp: number;
  role_id: string | null;
  character_id: string | null;
  avatar_config: Record<string, string>;
  is_vendor?: boolean;
  vendor_store_name?: string | null;
};

export function PlayerInspectModal({ playerId, initialUsername, onClose, onStartChat }: Props) {
  const [profile, setProfile] = useState<InspectedProfile | null>(null);
  const [allCards, setAllCards] = useState<AlbumCard[]>([]);
  const [playerCards, setPlayerCards] = useState<UserCollectedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Fetch basic profile
        const { data: profData } = await supabase
          .from("profiles")
          .select("id, username, display_name, level, xp, role_id, character_id, avatar_config")
          .eq("id", playerId)
          .maybeSingle();

        // Check if user has a vendor store or role
        const [{ data: storeData }, { data: roleData }] = await Promise.all([
          supabase.from("stores").select("name").eq("owner_id", playerId).eq("active", true).limit(1),
          supabase.from("user_roles").select("role").eq("user_id", playerId),
        ]);

        const isVendor =
          (storeData && storeData.length > 0) ||
          (roleData ?? []).some((r: { role: string }) => r.role === "vendor" || r.role === "owner");

        // Fetch cards
        const [cardsCatalog, userCollected] = await Promise.all([
          fetchAllAlbumCards(),
          fetchUserCards(playerId),
        ]);

        if (cancelled) return;

        setProfile({
          id: playerId,
          username: profData?.username || initialUsername || "משתתף",
          display_name: profData?.display_name || null,
          level: profData?.level || 1,
          xp: profData?.xp || 0,
          role_id: profData?.role_id || null,
          character_id: profData?.character_id || null,
          avatar_config: (profData?.avatar_config as Record<string, string>) || {},
          is_vendor: isVendor,
          vendor_store_name: storeData?.[0]?.name || null,
        });

        setAllCards(cardsCatalog);
        setPlayerCards(userCollected);
      } catch (err) {
        console.error("Failed to inspect player profile:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId, initialUsername]);

  if (!playerId) return null;

  return (
    <Dialog open={!!playerId} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border-4 border-white shadow-2xl">
        <div className="relative bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-700 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute end-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/40 text-white font-bold backdrop-blur"
          >
            ✕
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative grid h-20 w-20 place-items-center rounded-2xl bg-white/10 border-2 border-white/30 backdrop-blur shadow-inner text-3xl">
              👤
              {profile?.is_vendor && (
                <div
                  title="סוחר מורשה"
                  className="absolute -bottom-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-slate-950 font-black shadow-md border-2 border-white text-xs"
                >
                  🏪
                </div>
              )}
            </div>

            <div className="text-center sm:text-right flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl font-black">{profile?.username || initialUsername || "משתתף"}</h2>
                {profile?.is_vendor && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black text-slate-950 shadow">
                    <Store className="h-3 w-3" />
                    <span>סוחר מורשה (Vendor)</span>
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-white/90">
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-bold">
                  ⭐ רמה {profile?.level ?? 1} ({profile?.xp ?? 0} XP)
                </span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-bold">
                  🃏 {playerCards.length} קלפים באלבום
                </span>
                {profile?.vendor_store_name && (
                  <span className="text-amber-200 font-semibold">
                    דוכן: {profile.vendor_store_name}
                  </span>
                )}
              </div>
            </div>

            {onStartChat && (
              <button
                type="button"
                onClick={() => {
                  onStartChat(playerId, profile?.username || initialUsername || "משתתף");
                  onClose();
                }}
                className="btn-plastic flex items-center gap-1.5 text-xs !bg-gradient-to-r !from-amber-400 !to-yellow-500 font-black"
              >
                <MessageCircle className="h-4 w-4" />
                <span>שלח הודעה</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="mb-3">
            <h3 className="text-base font-black flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span>האלבום הדיגיטלי וההישגים של {profile?.username}</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              ראו אילו קלפי כנס והישגים השחקן הצליח להשיג עד כה בעולם המשחק:
            </p>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              טוען את פרופיל והישגי השחקן...
            </div>
          ) : (
            <DigitalAlbum
              allCards={allCards}
              userCards={playerCards}
              username={profile?.username || "השחקן"}
              isOwnerView={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
