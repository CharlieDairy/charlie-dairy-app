"use client";
import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    }
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (!prompt || dismissed) return null;
  return <aside className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-lg" aria-label="Install Charlie Dairy">
    <button className="rounded-lg bg-green-900 px-4 py-2 text-sm font-semibold text-white" onClick={async () => {
      try { await prompt.prompt(); await prompt.userChoice; } finally { setPrompt(null); }
    }}>Install Charlie Dairy</button>
    <button className="px-3 py-2 text-sm text-neutral-600" onClick={() => setDismissed(true)}>Not now</button>
  </aside>;
}
