import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ActivePlayer = { user_id: string; x: number; y: number; last_seen: string; username?: string; level?: number };

const FAKE_NAMES = [
  "ShadowHunter", "CryptoKid", "NeonRider", "PixelKnight", "GoldFang", "IronWolf", "StormCaller", "MysticSage",
  "BlazeRunner", "FrostByte", "ThunderPaw", "SolarFlare", "MidnightOwl", "RubyPhoenix", "SilverArrow", "JadeTiger",
  "CosmicDrifter", "StarGazer", "MoonWalker", "SunChaser", "NightHawk", "DayBreaker", "DuskFall", "DawnSeeker",
  "RavenCloak", "WolfSpirit", "BearClaw", "EagleEye", "FoxTail", "LionHeart", "SnakeBite", "SharkTooth",
  "DragonScale", "GriffinWing", "PhoenixAsh", "UnicornDust", "MermaidTide", "CentaurGallop", "MinotaurRage", "SphinxRiddle",
  "CyberPunk", "TechnoMage", "DigitalGhost", "QuantumLeap", "BinaryStar", "PixelPirate", "GlitchLord", "CodeBreaker",
  "MysticRose", "CrystalHeart", "AmberFlame", "SapphireSky", "EmeraldPath", "OpalDream", "PearlDiver", "TopazSun",
  "IronForge", "SteelHammer", "BronzeShield", "CopperWire", "TitaniumWave", "PlatinumStar", "PalladiumMoon", "MercuryRun",
  "ThunderStrike", "LightningBolt", "RainDancer", "SnowFall", "WindWhisper", "FireStarter", "EarthShaker", "WaterBearer",
  "NoctuneKing", "MelodyQueen", "RhythmMaster", "HarmonySoul", "BassKing", "TrebleClef", "VinylRider", "SoundWave",
  "ArcaneMist", "SpellBinder", "RuneMaster", "ElixirBrewer", "PotionMixer", "ScrollKeeper", "TomeReader", "WandBearer",
  "GhostRider", "SoulSeeker", "SpiritWalker", "ShadowDancer", "DreamWeaver", "NightmareKing", "TwilightRose", "EternalFlame",
  "KingCobra", "QueenBee", "PrinceCharm", "PrincessLuna", "DukeOfNight", "LadyOfDawn", "BaronRed", "CountessBlack",
  "MysticFox", "CleverCat", "SwiftHare", "BraveDog", "WiseOwl", "SlyRaven", "GentleDeer", "FierceLynx",
];

// Deterministic seed for the day so refreshes look consistent
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pickFakeUsers(count: number, seed: number) {
  const rand = seededRandom(seed);
  const shuffled = [...FAKE_NAMES].sort(() => rand() - 0.5);
  return shuffled.slice(0, count).map((name) => ({
    name,
    level: Math.floor(rand() * 45) + 5,
  }));
}

export function ActivePlayers() {
  const [players, setPlayers] = useState<ActivePlayer[]>([]);
  const [fakeCount, setFakeCount] = useState<number>(() => 80 + Math.floor(Math.random() * 21));
  const [fakeSeed, setFakeSeed] = useState<number>(() => Math.floor(Date.now() / (1000 * 60 * 60 * 24)));

  useEffect(() => {
    const load = async () => {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase.from("active_players").select("user_id,x,y,last_seen").gt("last_seen", cutoff).limit(50);
      if (!data) return;
      const ids = data.map((d) => d.user_id);
      const { data: ps } = ids.length ? await supabase.rpc("get_public_profiles", { _ids: ids }) : { data: [] };
      const map = new Map((ps ?? []).map((p) => [p.id, p]));
      setPlayers(data.map((d) => ({ ...(d as ActivePlayer), username: map.get(d.user_id)?.username, level: map.get(d.user_id)?.level })));
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setFakeCount((prev) => {
        const delta = Math.floor(Math.random() * 11) - 5; // -5..+5
        const next = prev + delta;
        return Math.max(80, Math.min(100, next));
      });
      setFakeSeed((s) => s + 1);
    }, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const fakePlayers = useMemo(() => pickFakeUsers(fakeCount, fakeSeed), [fakeCount, fakeSeed]);

  const realNames = new Set(players.map((p) => p.username).filter(Boolean));
  const shownFake = fakePlayers.filter((f) => !realNames.has(f.name));
  const total = players.length + shownFake.length;

  return (
    <div className="chrome-panel p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active players ({total})</div>
      <ul className="space-y-1 text-sm max-h-64 overflow-y-auto">
        {players.map((p, idx) => (
          <li key={`${p.user_id}-${idx}`} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold">{p.username ?? "…"}</span>
            <span className="text-xs text-muted-foreground">Lv {p.level ?? "?"}</span>
          </li>
        ))}
        {shownFake.map((f) => (
          <li key={`fake-${f.name}`} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold">{f.name}</span>
            <span className="text-xs text-muted-foreground">Lv {f.level}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
