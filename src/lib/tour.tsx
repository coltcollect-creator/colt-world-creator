import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

export type TourStep = {
  /** CSS selector of the element to highlight. Falls back to a centered card. */
  target?: string;
  title: string;
  body: string;
  /** Big designed welcome card instead of a tooltip. */
  welcome?: boolean;
  /** Route to navigate to before showing this step. */
  route?: string;
  /** Broadcast action id — pages listen with useTourAction(). */
  action?: string;
};

export const TOUR_ACTION_EVENT = "colt:tour-action";

/** Steps of the big onboarding tour. */
const MAIN_TOUR: TourStep[] = [
  {
    welcome: true,
    route: "/play",
    title: "ברוכים הבאים ל־COLT-A-CON",
    body: "זה המדריך הקצר שלכם. כמה שלבים פשוטים ואתם מתחילים לשוטט בכנס, לפגוש אספנים ולאסוף פריטים.",
  },
  {
    route: "/play",
    target: '[data-tour="game-viewport"]',
    title: "חלונית המשחק",
    body: "זה מרחב הכנס — כאן מסתובבים עם הדמות שלכם, פוגשים חברים שמסתובבים איתכם בזמן אמת ונכנסים לדוכנים ולעמדות המיוחדות.",
  },
  {
    route: "/play",
    action: "open-chat",
    target: '[data-tour="global-chat"]',
    title: "הצ׳אט הכללי",
    body: "כאן כותבים הודעה שכולם בכנס רואים. ההודעה גם מופיעה כבועה מעל הדמות שלכם במפה.",
  },
  {
    route: "/play",
    target: '[data-tour="nav"]',
    title: "התפריט הראשי",
    body: "מכאן מגיעים לכל האזורים של הפלטפורמה. נעבור עליהם אחד־אחד בקצרה.",
  },
  {
    route: "/play",
    target: '[data-tour="nav-/profile"]',
    title: "פרופיל",
    body: "הכרטיס האישי שלכם: רמה, XP, תארים והתקדמות. משם רואים איפה אתם עומדים מול שאר האספנים.",
  },
  {
    route: "/play",
    target: '[data-tour="nav-/customize"]',
    title: "התאמה אישית",
    body: "כאן מלבישים את הדמות בפריטים שהשגתם — כובעים, חולצות, גלימות ועוד. בהתחלה הארון ריק ומתמלא ממה שתרוויחו או תרכשו.",
  },
  {
    route: "/play",
    target: '[data-tour="nav-/inventory"]',
    title: "מלאי",
    body: "כל המוצרים שזכיתם בהם או רכשתם נמצאים פה. מהמלאי בוחרים משלוח לכתובת או איסוף עצמי.",
  },
  {
    route: "/play",
    target: '[data-tour="nav-/quests"]',
    title: "משימות",
    body: "משימות יומיות ומתמשכות שמזכות אתכם ב־XP ובג׳מס. שם גם נאספים הרמזים לתיבות האוצר שמפוזרות בכנס.",
  },
  {
    route: "/play",
    target: '[data-tour="nav-/messages"]',
    title: "הודעות",
    body: "השיחות שלכם עם בעלי הדוכנים ועם דמויות הכנס. תשובות והתראות מגיעות לכאן.",
  },
  {
    route: "/play",
    target: '[data-tour="nav-/credits"]',
    title: "קרדיטים (ג׳מס)",
    body: "כאן קונים ג׳מס — המטבע של הכנס. נגיע לזה בהרחבה בסוף הסיור.",
  },
  {
    route: "/play",
    target: '[data-tour="nav-/history"]',
    title: "היסטוריה",
    body: "כל התנועות שלכם: רכישות, זכיות, הצעות במכרזים וחיובי ג׳מס — הכל שקוף ומתועד.",
  },
  {
    route: "/play",
    target: '[data-tour="nav-/settings"]',
    title: "הגדרות",
    body: "שפה, פרטי חשבון, סיסמה והעדפות תצוגה.",
  },
  {
    route: "/play",
    action: "open-store-marketplace",
    target: '[data-tour="store-modal"]',
    title: "COLT MARKETPLACE",
    body: "לחיצה על עמדה במפה פותחת את החנות שלה. זו חנות המוצרים הראשית — כאן מוצגים הפריטים שאפשר להשיג.",
  },
  {
    route: "/play",
    target: '[data-tour="store-modal"]',
    title: "מוצרים ומחיר בג׳מס",
    body: "לכל מוצר יש מחיר ב־💎 ג׳מס. לחיצה על כפתור הרכישה מורידה את הג׳מס מהיתרה שלכם ומוסיפה את המוצר למלאי.",
  },
  {
    route: "/play",
    action: "open-store-wheel",
    target: '[data-tour="store-modal"]',
    title: "גלגל המזל",
    body: "בעמדות כמו גלגל הסינגלים משלמים סיבוב וזוכים בפרס — מוצר, ג׳מס, קוסמטיקה או סיבוב חינם שלא עולה לכם כלום.",
  },
  {
    route: "/play",
    action: "open-store-auction",
    target: '[data-tour="store-modal"]',
    title: "מכרזי COLT",
    body: "במכרז רואים מה עולה למכירה, מי מוביל ומה ההצעה הבאה. ההצעה יורדת מהג׳מס שלכם, ואם עוקפים אתכם — הסכום חוזר אליכם מיד.",
  },
  {
    route: "/play",
    title: "מה זה ג׳מס?",
    body: "ג׳מס (💎) הם המטבע של הכנס. אפשר להרוויח אותם ממשימות, גלגלים ותיבות אוצר — ואפשר גם לרכוש אותם בכסף אמיתי כדי לרכוש מוצרים ולהשתתף במכרזים.",
  },
  {
    route: "/credits",
    target: '[data-tour="credit-packs"]',
    title: "רכישת ג׳מס",
    body: "בוחרים חבילה, לוחצים רכישה ומשלמים בצורה מאובטחת. הג׳מס נכנסים ליתרה אוטומטית מיד בסיום התשלום. זה הכל — נתראה בכנס! 🎉",
  },
];

/** Short per-page tours, keyed by route path. */
const PAGE_TOURS: Record<string, TourStep[]> = {
  "/play": [
    {
      target: '[data-tour="game-viewport"]',
      title: "מרחב הכנס",
      body: "מזיזים את הדמות עם החצים/WASD, ובנייד עם הג׳ויסטיק שבפינה. מתקרבים לעמדה ולוחצים עליה כדי להיכנס.",
    },
    {
      target: '[data-tour="active-players"]',
      title: "מי נמצא כאן",
      body: "רשימת האספנים שמסתובבים בכנס ברגע זה. הם מופיעים גם במפה עצמה בזמן אמת.",
    },
    {
      action: "open-chat",
      target: '[data-tour="global-chat"]',
      title: "צ׳אט כללי",
      body: "כותבים לכולם, וההודעה מופיעה גם כבועה מעל הדמות שלכם.",
    },
  ],
  "/profile": [
    { target: '[data-tour="page"]', title: "הפרופיל שלכם", body: "כאן רואים את הרמה, ה־XP והתואר הפעיל. XP נאסף ממשימות, רכישות ופעילות בכנס." },
  ],
  "/customize": [
    { target: '[data-tour="preview"]', title: "תצוגה מקדימה", body: "רואים את הדמות בדו־ממד או בתלת־ממד, ואפשר לסובב אותה כדי לבדוק איך הפריטים יושבים." },
    { target: '[data-tour="items"]', title: "הארון שלכם", body: "רק פריטים שהשגתם מופיעים כאן. לחיצה על פריט מלבישה אותו מיד על הדמות." },
    { target: '[data-tour="enter-con"]', title: "כניסה לכנס", body: "כשמסיימים, הכפתור הקבוע שלמעלה מחזיר אתכם ישר לכנס האספנים." },
  ],
  "/inventory": [
    { target: '[data-tour="page"]', title: "המלאי שלכם", body: "כל מה שרכשתם או זכיתם בו נמצא כאן. לכל פריט אפשר לבחור משלוח לכתובת (בעלות ג׳מס) או איסוף עצמי." },
  ],
  "/quests": [
    { target: '[data-tour="quests"]', title: "משימות", body: "כל משימה מציגה את ההתקדמות והפרס. הפרסים נכנסים אוטומטית כשמשלימים." },
    { target: '[data-tour="clues"]', title: "רמזים ותיבות אוצר", body: "הרמזים שאספתם מסודרים לפי התיבה שהם מובילים אליה — כשיש לכם את כולם התיבה נפתחת." },
  ],
  "/messages": [
    { target: '[data-tour="page"]', title: "ההודעות שלכם", body: "כל שיחה עם דוכן או דמות נשמרת כאן, כולל תשובות של בעלי החנויות." },
  ],
  "/credits": [
    { target: '[data-tour="credit-packs"]', title: "חבילות ג׳מס", body: "בוחרים חבילה ומשלמים בצורה מאובטחת; הג׳מס מזוכים אוטומטית ליתרה." },
  ],
  "/history": [
    { target: '[data-tour="page"]', title: "היסטוריית פעילות", body: "כל תנועת ג׳מס ורכישה מתועדת כאן עם תאריך וסכום, כדי שתמיד תדעו לאן הלכו הג׳מס." },
  ],
  "/settings": [
    { target: '[data-tour="page"]', title: "הגדרות", body: "שינוי שפה (עברית/אנגלית), פרטי חשבון וסיסמה." },
  ],
};

const SEEN_KEY = "colt.tour.main.seen";

type TourContextValue = {
  active: boolean;
  hasPageTour: boolean;
  startMainTour: () => void;
  startPageTour: () => void;
  stop: () => void;
};

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour outside TourProvider");
  return ctx;
}

/** Register a handler for tour actions such as opening a store modal. */
export function useTourAction(handler: (action: string) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (e: Event) => ref.current((e as CustomEvent<string>).detail);
    window.addEventListener(TOUR_ACTION_EVENT, fn);
    return () => window.removeEventListener(TOUR_ACTION_EVENT, fn);
  }, []);
}

export function TourProvider({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);

  const pageTour = PAGE_TOURS[loc.pathname] ?? null;

  const stop = useCallback(() => {
    setSteps(null);
    setIndex(0);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  }, []);

  const startMainTour = useCallback(() => { setIndex(0); setSteps(MAIN_TOUR); }, []);
  const startPageTour = useCallback(() => {
    if (!pageTour) return;
    setIndex(0);
    setSteps(pageTour);
  }, [pageTour]);

  // Auto-start once for brand new players.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loc.pathname !== "/play") return;
    let seen = "1";
    try { seen = localStorage.getItem(SEEN_KEY) ?? ""; } catch { /* ignore */ }
    if (seen) return;
    const id = setTimeout(() => startMainTour(), 1200);
    return () => clearTimeout(id);
  }, [loc.pathname, startMainTour]);

  const step = steps?.[index] ?? null;

  // Navigate + fire the step's action whenever the step changes.
  useEffect(() => {
    if (!step) return;
    if (step.route && loc.pathname !== step.route) navigate({ to: step.route });
    if (step.action) {
      const id = setTimeout(() => {
        window.dispatchEvent(new CustomEvent(TOUR_ACTION_EVENT, { detail: step.action }));
      }, 120);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const value = useMemo<TourContextValue>(
    () => ({ active: !!steps, hasPageTour: !!pageTour, startMainTour, startPageTour, stop }),
    [steps, pageTour, startMainTour, startPageTour, stop],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {step && (
        <TourLayer
          step={step}
          index={index}
          total={steps!.length}
          onNext={() => (index + 1 >= steps!.length ? stop() : setIndex(index + 1))}
          onBack={() => setIndex((i) => Math.max(0, i - 1))}
          onClose={stop}
        />
      )}
    </TourContext.Provider>
  );
}

type Rect = { top: number; left: number; width: number; height: number };

function TourLayer({
  step,
  index,
  total,
  onNext,
  onBack,
  onClose,
}: {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(180);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [step, rect]);

  useEffect(() => {
    if (!step.target || step.welcome) { setRect(null); return; }
    let raf = 0;
    let scrolled = false;
    const tick = () => {
      const el = document.querySelector(step.target!) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 4 && r.height > 4) {
          if (!scrolled) {
            scrolled = true;
            const outside = r.top < 60 || r.bottom > window.innerHeight - 60;
            if (outside) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        } else setRect(null);
      } else setRect(null);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "Enter") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext]);

  const pad = 8;
  const spot = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  // Card placement: below the target when there is room, otherwise above.
  let cardStyle: React.CSSProperties = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };
  if (spot) {
    const below = spot.top + spot.height + 12;
    const fitsBelow = below + cardHeight < window.innerHeight - 12;
    const top = fitsBelow ? below : Math.max(12, spot.top - cardHeight - 12);
    const centerX = spot.left + spot.width / 2;
    const width = Math.min(400, window.innerWidth - 24);
    const left = Math.min(Math.max(12, centerX - width / 2), window.innerWidth - width - 12);
    cardStyle = { top, left, width };
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-[9999]">
      {/* Backdrop + spotlight */}
      {spot ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-4 ring-primary transition-all duration-300"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgba(10,8,20,0.68)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(10,8,20,0.72)] backdrop-blur-sm" />
      )}

      {step.welcome ? (
        <div className="absolute inset-0 grid place-items-center p-4">
          <div
            ref={cardRef}
            className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border-4 border-white bg-gradient-to-br from-amber-100 via-white to-sky-100 p-8 text-center shadow-2xl"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber-300/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-sky-300/40 blur-3xl" />
            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary shadow-sm">
                ✨ מדריך ✨
              </div>
              <h2 className="bg-gradient-to-br from-amber-500 via-yellow-600 to-orange-500 bg-clip-text text-4xl font-black leading-tight text-transparent md:text-5xl">
                {step.title}
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-relaxed text-foreground/80">{step.body}</p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <button className="btn-plastic" onClick={onNext}>מתחילים 🚀</button>
                <button className="chrome-panel px-4 py-2 text-xs font-bold" onClick={onClose}>דלגו</button>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">{total} שלבים קצרים · תמיד אפשר לחזור לזה עם כפתור ה־i</div>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={cardRef}
          className="absolute w-[min(400px,calc(100vw-24px))] rounded-3xl border-4 border-white bg-background p-4 shadow-2xl"
          style={cardStyle}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-black">{step.title}</h3>
            <button aria-label="סגירת המדריך" onClick={onClose} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs">✕</button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-primary" : "w-1.5 bg-muted"}`} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button className="chrome-panel px-3 py-1.5 text-xs font-bold" onClick={onBack}>חזרה</button>
              )}
              <button className="btn-plastic text-xs" onClick={onNext}>
                {index + 1 >= total ? "סיום" : "הבא"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small "i" button — always available, top corner of the header. */
export function TourButton() {
  const { startMainTour, startPageTour, hasPageTour } = useTour();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        aria-label="מדריך"
        onClick={() => setOpen((v) => !v)}
        className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-gradient-to-b from-sky-300 to-sky-500 text-xs font-black text-white shadow-md active:scale-95"
      >
        i
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div dir="rtl" className="absolute end-0 top-9 z-50 w-56 rounded-2xl border-2 border-border bg-background p-2 shadow-2xl">
            <div className="px-2 pb-1 text-[11px] font-bold text-muted-foreground">מדריך</div>
            <button
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-xs font-bold hover:bg-muted"
              onClick={() => { setOpen(false); startMainTour(); }}
            >
              🎯 הסיור המלא בכנס
            </button>
            {hasPageTour && (
              <button
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-xs font-bold hover:bg-muted"
                onClick={() => { setOpen(false); startPageTour(); }}
              >
                📍 מה יש בעמוד הזה
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
