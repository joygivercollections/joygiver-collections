import { useEffect, useState } from "react";

interface OwnerInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function addOwnerMetadata(tag: "link" | "meta", attributes: Record<string, string>) {
  const element = document.createElement(tag);
  element.dataset.ownerPwa = "true";
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  document.head.appendChild(element);
}

export function OwnerInstall() {
  const [installPrompt, setInstallPrompt] = useState<OwnerInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);

    addOwnerMetadata("link", { rel: "manifest", href: "/owner.webmanifest" });
    addOwnerMetadata("link", { rel: "apple-touch-icon", href: "/icons/owner-192.png" });
    addOwnerMetadata("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    addOwnerMetadata("meta", { name: "apple-mobile-web-app-title", content: "Joygiver Owner" });

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/owner-sw.js", { scope: "/owner/" });
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as OwnerInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      document.head.querySelectorAll('[data-owner-pwa="true"]').forEach((element) => element.remove());
    };
  }, []);

  if (installed) return null;

  if (installPrompt) {
    return (
      <div className="owner-install">
        <span>Open this dashboard like an app.</span>
        <button type="button" onClick={async () => {
          await installPrompt.prompt();
          const choice = await installPrompt.userChoice;
          if (choice.outcome === "accepted") setInstallPrompt(null);
        }}>Install owner app</button>
      </div>
    );
  }

  if (isIos) {
    return (
      <details className="owner-install owner-install--ios">
        <summary>Install owner app</summary>
        <p>In Safari, tap Share, choose Add to Home Screen, turn on Open as Web App, then tap Add.</p>
      </details>
    );
  }

  return null;
}
