import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ActivePlayer = {
  user_id: string;
  x?: number;
  y?: number;
  last_seen?: string;
  username: string;
  level: number;
  isReal?: boolean;
};

// Community player names pool for active convention atmosphere
const SIMULATED_PLAYERS_POOL = [
  "DragonSlayer99", "PixelKnight", "CyberSamurai", "ShadowWalker",
  "CardMaster_IL", "PokeChamp_Eli", "NeonRider", "GoldenChocobo",
  "GamerGuy_23", "MysticMage", "RetroPlayer", "SilverArrow",
  "NoobMaster69", "GalacticTrader", "VortexGamer", "AlphaWolf_IL",
  "QueenOfCards", "ZeroCool", "IronGolem", "PhoenixDown",
  "Starlight88", "HyperDrive", "NightCrawler", "CosmicVoyager",
  "RogueTrader", "PixelArtisan", "LegendaryDave", "DiamondHands_IL",
  "CryptoKnight", "OasisSeeker", "TitaniumRex", "EchoHunter",
  "RuneSmith", "BladeRunner_IL", "DarkKnight92", "SolarFlare",
  "ThunderBolt", "ZenMaster", "FrostBite", "FireStorm_IL",
  "GlitchMob", "ShadowFax", "ApexPredator", "StormBreaker",
  "VelvetCrow", "AeroPilot", "QuantumLeap", "CobaltStrike",
  "EmeraldDream", "RubyRose_IL", "SapphireSky", "TopazCollector",
  "AmethystKnight", "OnyxShadow", "CrystalGazer", "MarbleArch",
  "BronzeBeast", "SilverSurfer", "GoldDigger_IL", "PlatinumPulse",
  "NovaPrime", "NebulaDrifter", "StarGazer_01", "LunarEclipse",
  "Solaris_IL", "CometRider", "MeteorStrike", "AsteroidBelt",
  "PulsarWave", "QuasarGamer", "BigBang_IL", "SuperNova99",
  "GravityWell", "EventHorizon", "BlackHoleSun", "DarkMatter_IL",
  "Antimatter", "TimeLord_99", "Chronos_IL", "WarpSpeed",
  "HyperSpace", "DimensionJumper", "ParallelWorld", "InfinityGauntlet",
  "OmegaWeapon", "FinalFantasy_Fan", "ZeldaMaster", "MarioKartPro",
  "SonicSpeed_IL", "PokemonMaster", "DigimonKing", "YuGiOh_God",
  "MagicTheGathering", "CardCaptor", "DeckBuilder_IL", "TopDecker",
];

export function ActivePlayers() {
  const [realPlayers, setRealPlayers] = useState<ActivePlayer[]>([]);
  const [baseCount] = useState(() => Math.floor(Math.random() * 15) + 84); // 84-98 players
  const [fluctuation, setFluctuation] = useState(0);

  // Poll real active players from active_players table
  useEffect(() => {
    let cancelled = false;
    const loadReal = async () => {
      try {
        const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("active_players")
          .select("user_id,x,y,last_seen")
          .gt("last_seen", cutoff)
          .limit(100);

        if (cancelled || !data) return;

        const uniqueMap = new Map<string, any>();
        for (const d of data) {
          if (!uniqueMap.has(d.user_id)) {
            uniqueMap.set(d.user_id, d);
          }
        }
        const uniqueList = Array.from(uniqueMap.values());
        const ids = uniqueList.map((d) => d.user_id);
        const { data: ps } = ids.length
          ? await supabase.from("profiles").select("id, username, level").in("id", ids)
          : { data: [] };

        if (cancelled) return;

        const map = new Map((ps ?? []).map((p) => [p.id, p]));
        const formatted: ActivePlayer[] = uniqueList.map((d) => ({
          user_id: d.user_id,
          x: d.x,
          y: d.y,
          last_seen: d.last_seen,
          username: map.get(d.user_id)?.username || `שחקן-${String(d.user_id).slice(0, 4)}`,
          level: map.get(d.user_id)?.level ?? 1,
          isReal: true,
        }));

        setRealPlayers(formatted);
      } catch (err) {
        console.warn("ActivePlayers real load error:", err);
      }
    };

    loadReal();
    const interval = setInterval(loadReal, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Periodic subtle fluctuation (+- 2-3 players) to keep live lobby dynamic
  useEffect(() => {
    const timer = setInterval(() => {
      setFluctuation(Math.floor(Math.random() * 5) - 2);
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  // Build the blended simulated + real active players list
  const allActivePlayers = useMemo(() => {
    const realUsernames = new Set(realPlayers.map((p) => p.username.toLowerCase()));
    const simulated: ActivePlayer[] = [];

    // Filter out names matching any real logged in players
    const availableSimulated = SIMULATED_PLAYERS_POOL.filter(
      (name) => !realUsernames.has(name.toLowerCase())
    );

    // Seed consistent levels based on name hash
    for (let i = 0; i < availableSimulated.length && simulated.length < 35; i++) {
      const name = availableSimulated[i];
      let hash = 0;
      for (let j = 0; j < name.length; j++) {
        hash = (hash << 5) - hash + name.charCodeAt(j);
      }
      const lvl = (Math.abs(hash) % 45) + 3; // level 3 to 48
      simulated.push({
        user_id: `sim_${i}`,
        username: name,
        level: lvl,
        isReal: false,
      });
    }

    return [...realPlayers, ...simulated];
  }, [realPlayers]);

  const displayTotal = Math.max(realPlayers.length, baseCount + fluctuation + (realPlayers.length > 0 ? realPlayers.length - 1 : 0));

  return (
    <div className="chrome-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>שחקנים מחוברים ({displayTotal})</span>
        </div>
      </div>

      <ul className="space-y-1 text-sm max-h-64 overflow-y-auto pr-1 scrollbar-thin">
        {allActivePlayers.map((p, idx) => (
          <li
            key={`${p.user_id}-${idx}`}
            className="flex items-center justify-between py-1 px-1.5 rounded transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full shrink-0 bg-emerald-400 shadow-[0_0_6px_#10b981]" />
              <span className="truncate text-xs font-medium text-foreground">
                {p.username}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
              Lv {p.level}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
