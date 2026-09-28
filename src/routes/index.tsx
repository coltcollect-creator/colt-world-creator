import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import coltLogo from "@/assets/colt-logo.webp.asset.json";
import { LiveConventionPreview } from "@/components/game/LiveConventionPreview";
import { PwaInstallButton } from "@/components/pwa/PwaInstallModal";

const SHARE_IMAGE =
  "https://live.colt-collectibles.com/__l5e/assets-v1/c393c7ad-d9de-42aa-a853-094116140f08/colt-share.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "COLT-A-CON — אספו. סחרו. שחקו." },
      { name: "description", content: "COLT-A-CON. כנס חי לאספני קלפים ואספנים מכל הארץ." },
      { property: "og:title", content: "COLT-A-CON — הכנס הוירטואלי הראשון מסוגו" },
      { property: "og:description", content: "כנס אספנות חי 24/7. חנויות, גלגל מזל, מכרזים וקהילה." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://live.colt-collectibles.com/" },
      { property: "og:image", content: SHARE_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: SHARE_IMAGE },
    ],
    links: [{ rel: "canonical", href: "https://live.colt-collectibles.com/" }],
  }),
  component: Landing,
});

function Landing() {
  const { user, isOwner, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/play" });
  }, [loading, user, navigate]);

  return (
    <div dir="rtl" className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <img src={coltLogo.url} alt="COLT" className="h-12 w-auto md:h-14" />
        <nav className="flex items-center gap-3">
          <PwaInstallButton />
          <Link
            to="/auth"
            className="btn-plastic text-xs md:text-sm bg-primary text-primary-foreground font-bold"
          >
            התחברות והרשמה
          </Link>
        </nav>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 pb-24 pt-4 lg:grid-cols-12 items-start">
        <div className="space-y-6 lg:col-span-5">
          <span className="chrome-panel inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> מתחם חי פעיל עכשיו
          </span>
          <h1 className="text-4xl font-black leading-tight md:text-5xl">
            הקומיק-קון של עולם ה<span className="text-primary">אספנות</span>.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            טיילו בכיכר פסטל-כרום. בקרו בחנויות אספנות פרימיום. סובבו את גלגל המזל.
            פתחו קוסמטיקות ותארים. צברו קרדיטים. שוחחו עם הקהילה.
          </p>

          <div className="chrome-panel space-y-4 p-6">
            <h2 className="text-xl md:text-2xl font-black">הצטרפו ל־COLT-A-CON</h2>
            <p className="text-sm text-muted-foreground">כנס חי 24/7 לקלפי אספנות, מכירות פומביות וקהילת אספנים.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth"
                className="btn-plastic flex-1 text-center text-base font-black bg-primary text-primary-foreground shadow-lg hover:brightness-110"
              >
                ✨ כניסה ליריד / פתיחת חשבון
              </Link>
              <div className="flex-1">
                <PwaInstallButton className="w-full btn-plastic flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-base py-2.5 shadow-md hover:brightness-110" />
              </div>
            </div>
            {isOwner && (
              <Link to="/owner" className="block text-center text-sm font-semibold text-primary">
                ← ממשק בעלים
              </Link>
            )}
          </div>

          <ul className="grid gap-2 pt-2 text-sm text-muted-foreground">
            <li>• עולם דו-ממדי אינטראקטיבי עם חנויות קלפים, מכרזים ו-NPCs</li>
            <li>• התאמה אישית מלאה של הדמות וקוסמטיקות פרימיום</li>
            <li>• קרדיטים, משימות יומיות, XP, תארים וגלגל המזל</li>
          </ul>
        </div>

        {/* Live Convention Spectator Preview Box */}
        <div className="lg:col-span-7">
          <LiveConventionPreview />
        </div>
      </main>
    </div>
  );
}

