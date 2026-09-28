import { useState, useEffect, useCallback } from "react";

export type DeviceType = "ios" | "android" | "desktop";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePwaDevice() {
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect if running in standalone mode (already installed as PWA)
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: window-controls-overlay)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");
      setIsInstalled(!!isStandalone);
    };

    checkInstalled();

    // 2. Detect device type
    const ua = (window.navigator.userAgent || "").toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);

    if (isIOS) {
      setDeviceType("ios");
    } else if (isAndroid) {
      setDeviceType("android");
    } else {
      setDeviceType("desktop");
    }

    // 3. Capture beforeinstallprompt (Chromium / Android / Desktop Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
    } catch (e) {
      console.warn("PWA install prompt error:", e);
    }
    return false;
  }, [deferredPrompt]);

  return {
    deviceType,
    isInstalled,
    isInstallable: !!deferredPrompt,
    promptInstall,
  };
}
