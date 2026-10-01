"use client";

import { useState, type ReactNode } from "react";

export default function EntryTabs({ individual, group }: { individual: ReactNode; group: ReactNode }) {
  const [tab, setTab] = useState<"individual" | "group">("individual");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("individual")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "individual" ? "bg-primary text-white" : "border border-border bg-white text-text-muted hover:bg-primary-light"}`}
        >
          Individual Entry
        </button>
        <button
          type="button"
          onClick={() => setTab("group")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "group" ? "bg-primary text-white" : "border border-border bg-white text-text-muted hover:bg-primary-light"}`}
        >
          Herd / Group Total
        </button>
      </div>
      <div className={tab === "individual" ? "max-w-xl" : "hidden"}>{individual}</div>
      <div className={tab === "group" ? "max-w-xl" : "hidden"}>{group}</div>
    </div>
  );
}
