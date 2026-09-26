import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import coltLogo from "@/assets/colt-logo.webp.asset.json";

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
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <img src={coltLogo.url} alt="COLT" className="h-12 w-auto md:h-14" />
        <nav className="flex items-center gap-3">
          <Link to="/auth" className="btn-plastic">התחברות</Link>
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-6 pb-24 pt-10 lg:grid-cols-2">
        <div className="space-y-6">
          <span className="chrome-panel inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-primary" /> פתוח עכשיו
          </span>
          <h1 className="text-5xl font-black leading-tight md:text-6xl">
            הקומיק-קון של עולם ה<span className="text-primary">אספנות</span>.
          </h1>
          <p className="text-lg text-muted-foreground">
            טיילו בכיכר פסטל-כרום. בקרו בחנויות אספנות פרימיום. סובבו את גלגל המזל.
            פתחו קוסמטיקות ותארים. צברו קרדיטים. שוחחו עם הקהילה. התקדמות שנשמרת לאורך זמן.
          </p>

          <div className="chrome-panel space-y-4 p-6">
            <h2 className="text-2xl font-black">הצטרפו ל־COLT-A-CON</h2>
            <p className="text-sm text-muted-foreground">כנס חי לקלפי אספנות ואספנים מכל הארץ.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/play"
                className="btn-plastic flex-1 text-center text-base font-bold bg-primary text-primary-foreground shadow-lg hover:brightness-110"
              >
                🎮 כניסה מיידית ליריד
              </Link>
              <Link
                to="/auth"
                search={{ mode: "register" } as never}
                className="btn-plastic flex-1 text-center text-base"
              >
                יצירת חשבון
              </Link>
              <Link
                to="/auth"
                className="btn-plastic flex-1 text-center text-base"
                style={{ background: "var(--color-secondary)", color: "var(--color-secondary-foreground)" }}
              >
                התחברות
              </Link>
            </div>
            {isOwner && (
              <Link to="/owner" className="block text-center text-sm font-semibold text-primary">
                ← ממשק בעלים
              </Link>
            )}
          </div>

          <ul className="grid gap-2 pt-2 text-sm text-muted-foreground">
            <li>• עולם דו-ממדי עם פיזיקה אמיתית, קפיצות ודמויות NPC</li>
            <li>• התאמה אישית של דמות וקוסמטיקות פרימיום</li>
            <li>• קרדיטים, משימות, XP, תארים, קופסאות מסתורין וגלגל המזל</li>
          </ul>
        </div>

        <div className="chrome-panel relative min-h-[440px] overflow-hidden p-4">
          <div className="absolute inset-4 rounded-2xl bg-gradient-to-b from-[oklch(0.94_0.08_340)] via-[oklch(0.93_0.1_200)] to-[oklch(0.95_0.1_100)]">
            <div className="absolute inset-0 grid place-items-center">
              <img src={coltLogo.url} alt="COLT" className="w-3/4 max-w-sm drop-shadow-2xl" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-[oklch(0.82_0.09_310)]" />
            <div className="absolute right-8 top-8 chrome-panel px-3 py-2 text-xs">
              💬 <span className="font-semibold">ברוכים הבאים ל־COLT-A-CON</span>
            </div>
            <div className="absolute left-8 bottom-32 chrome-panel px-3 py-2 text-xs">
              🎡 סובבו את הגלגל היום
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
