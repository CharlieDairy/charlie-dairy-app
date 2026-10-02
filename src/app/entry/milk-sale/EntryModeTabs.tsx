"use client";

import { useState, type ReactNode } from "react";

// Milk Sale Entry is the only page that records milk leaving the farm --
// a customer sale or internal use (calf/farm/employee), never both split
// across pages. This just toggles which of the two forms is visible;
// both stay mounted so in-progress input in one isn't lost by switching.
export default function EntryModeTabs({ sale, use }: { sale: ReactNode; use: ReactNode }) {
  const [tab, setTab] = useState<"sale" | "use">("sale");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("sale")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "sale" ? "bg-primary text-white" : "border border-border bg-white text-text-muted hover:bg-primary-light"}`}
        >
          Record a Sale
        </button>
        <button
          type="button"
          onClick={() => setTab("use")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "use" ? "bg-primary text-white" : "border border-border bg-white text-text-muted hover:bg-primary-light"}`}
        >
          Record Calf / Farm / Employee Use
        </button>
      </div>
      <div className={tab === "sale" ? "" : "hidden"}>{sale}</div>
      <div className={tab === "use" ? "" : "hidden"}>{use}</div>
    </div>
  );
}
