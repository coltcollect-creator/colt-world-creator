import { useEffect, useRef, useState } from "react";
import { PLAYER_H, PLAYER_W } from "@/lib/avatar-layout";
import { paintAvatarCanvas, type AvatarLook } from "@/lib/avatar-canvas";
import { instantiateGlb, fitModel } from "@/lib/glb-loader";

type Props = {
  look: AvatarLook;
  /** Optional 3D model for the base character (used inside 3D maps). */
  modelUrl?: string | null;
  /** Optional 3D models for equipped cosmetics. */
  cosmeticModelUrls?: string[];
  height?: number;
  /** "2d" = flat sprite composite, "3d" = rotatable scene. */
  mode?: "2d" | "3d";
  onModeChange?: (m: "2d" | "3d") => void;
};

/**
 * Avatar preview with a 2D sprite mode and a rotatable 3D mode.
 * 3D uses the character's GLB model when one exists, otherwise a billboard.
 */
export function Avatar3DPreview({
  look, modelUrl, cosmeticModelUrls = [], height = 380,
  mode = "3d", onModeChange,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const flatRef = useRef<HTMLCanvasElement>(null);
  const yawRef = useRef(0);
  const spinRef = useRef(true);
  const lookRef = useRef(look);
  const repaintRef = useRef<(() => void) | null>(null);
  const [spin, setSpin] = useState(true);
  const [is3D, setIs3D] = useState(false);
  const [facing, setFacing] = useState<"left" | "right">("right");

  lookRef.current = look;
  spinRef.current = spin;

  useEffect(() => { repaintRef.current?.(); }, [look]);

  // ---- flat 2D composite
  useEffect(() => {
    if (mode !== "2d") return;
    const canvas = flatRef.current;
    if (!canvas) return;
    const paint = () => paintAvatarCanvas(canvas, lookRef.current, facing);
    paint();
    const id = window.setInterval(paint, 250);
    return () => window.clearInterval(id);
  }, [mode, facing, look]);

  const modelKey = [modelUrl ?? "", ...cosmeticModelUrls].join("|");

  useEffect(() => {
    if (mode !== "3d") return;
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let raf = 0;
    const cleanups: Array<() => void> = [];

    (async () => {
      const THREE = await import("three");
      if (disposed || !hostRef.current) return;

      const w = host.clientWidth || 320;
      const scene = new THREE.Scene();
      scene.background = null;
      const camera = new THREE.PerspectiveCamera(38, w / height, 1, 4000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, height, false);
      const dom = renderer.domElement;
      dom.style.width = "100%";
      dom.style.height = `${height}px`;
      dom.style.display = "block";
      dom.style.cursor = "grab";
      dom.style.touchAction = "none";
      host.appendChild(dom);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x9bbcd8, 1.2));
      const key = new THREE.DirectionalLight(0xfff4e0, 1.1);
      key.position.set(120, 240, 200);
      scene.add(key);

      const pivot = new THREE.Group();
      scene.add(pivot);

      // pedestal
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(PLAYER_W * 0.75, PLAYER_W * 0.85, 10, 40),
        new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.5, metalness: 0.2 }),
      );
      disc.position.y = -5;
      pivot.add(disc);

      // sprite billboard fallback
      const canvas = document.createElement("canvas");
      canvas.width = PLAYER_W * 3;
      canvas.height = PLAYER_H * 3;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(PLAYER_W, PLAYER_H),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
      );
      plane.position.y = PLAYER_H / 2;
      pivot.add(plane);

      let front: "left" | "right" = "right";
      const repaint = () => {
        paintAvatarCanvas(canvas, lookRef.current, front);
        tex.needsUpdate = true;
      };
      repaintRef.current = repaint;
      repaint();
      const interval = window.setInterval(repaint, 400);
      cleanups.push(() => window.clearInterval(interval));

      // real 3D model when available
      if (modelUrl) {
        const m = await instantiateGlb(modelUrl);
        if (m && !disposed) {
          await fitModel(m, PLAYER_H);
          pivot.add(m);
          plane.visible = false;
          setIs3D(true);
          for (const url of cosmeticModelUrls) {
            const cm = await instantiateGlb(url);
            if (cm && !disposed) { await fitModel(cm, PLAYER_H); pivot.add(cm); }
          }
        }
      }

      camera.position.set(0, PLAYER_H * 0.72, PLAYER_H * 2.25);
      camera.lookAt(0, PLAYER_H * 0.5, 0);

      let dragging = false;
      let startX = 0;
      let startYaw = 0;
      const onDown = (e: PointerEvent) => {
        dragging = true; startX = e.clientX; startYaw = yawRef.current;
        dom.style.cursor = "grabbing";
        dom.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        yawRef.current = startYaw + (e.clientX - startX) * 0.012;
      };
      const onUp = () => { dragging = false; dom.style.cursor = "grab"; };
      dom.addEventListener("pointerdown", onDown);
      dom.addEventListener("pointermove", onMove);
      dom.addEventListener("pointerup", onUp);
      cleanups.push(() => {
        dom.removeEventListener("pointerdown", onDown);
        dom.removeEventListener("pointermove", onMove);
        dom.removeEventListener("pointerup", onUp);
      });

      const resize = () => {
        const nw = host.clientWidth || w;
        renderer.setSize(nw, height, false);
        camera.aspect = nw / height;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", resize);
      cleanups.push(() => window.removeEventListener("resize", resize));

      const tick = () => {
        if (disposed) return;
        if (!dragging && spinRef.current) yawRef.current += 0.012;
        pivot.rotation.y = yawRef.current;
        const f = Math.cos(yawRef.current) >= 0 ? "right" : "left";
        if (f !== front) { front = f; repaint(); }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      cleanups.push(() => {
        cancelAnimationFrame(raf);
        renderer.dispose();
        dom.remove();
      });
    })();

    return () => {
      disposed = true;
      repaintRef.current = null;
      cleanups.forEach((f) => f());
    };
  }, [modelKey, height, mode]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => onModeChange?.("2d")}
          className={`chrome-panel flex-1 px-2 py-1 font-bold ${mode === "2d" ? "ring-2 ring-primary bg-primary/10" : ""}`}
        >
          🖼️ דו-מימד
        </button>
        <button
          type="button"
          onClick={() => onModeChange?.("3d")}
          className={`chrome-panel flex-1 px-2 py-1 font-bold ${mode === "3d" ? "ring-2 ring-primary bg-primary/10" : ""}`}
        >
          🧊 תלת-מימד
        </button>
      </div>

      {mode === "3d" ? (
        <div ref={hostRef} className="overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 to-pink-100" />
      ) : (
        <div className="grid place-items-center overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 to-pink-100" style={{ height }}>
          <canvas
            ref={flatRef}
            width={PLAYER_W * 3}
            height={PLAYER_H * 3}
            style={{ height: height - 20, width: "auto" }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs">
        {mode === "3d" ? (
          <>
            <button type="button" onClick={() => setSpin((s) => !s)} className="chrome-panel px-3 py-1 font-bold">
              {spin ? "⏸️ עצור סיבוב" : "🔄 סובב אוטומטית"}
            </button>
            <button type="button" onClick={() => { yawRef.current = 0; }} className="chrome-panel px-3 py-1 font-bold">
              ↩️ אפס זווית
            </button>
            <span className="text-muted-foreground">{is3D ? "מודל תלת-מימד" : "גררו לסיבוב"}</span>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setFacing((f) => (f === "right" ? "left" : "right"))}
              className="chrome-panel px-3 py-1 font-bold"
            >
              🔁 {facing === "right" ? "הפוך לשמאל" : "הפוך לימין"}
            </button>
            <span className="text-muted-foreground">תצוגת ספרייט דו-מימד</span>
          </>
        )}
      </div>
    </div>
  );
}
