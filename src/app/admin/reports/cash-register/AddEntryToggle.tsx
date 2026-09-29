"use client";

import { useState } from "react";
import CashForm from "@/app/entry/cash/CashForm";

export default function AddEntryToggle({ categories, vendorNames }: { categories: string[]; vendorNames: string[] }) {
  const [open, setOpen] = useState<"IN" | "OUT" | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="self-end flex gap-2">
        <button
          onClick={() => setOpen((v) => (v === "IN" ? null : "IN"))}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium ${
            open === "IN" ? "bg-green-800 text-white" : "bg-green-700 text-white hover:bg-green-800"
          }`}
        >
          + Cash In
        </button>
        <button
          onClick={() => setOpen((v) => (v === "OUT" ? null : "OUT"))}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium ${
            open === "OUT" ? "bg-red-700 text-white" : "bg-red-600 text-white hover:bg-red-700"
          }`}
        >
          − Cash Out
        </button>
      </div>
      {open && <CashForm categories={categories} vendorNames={vendorNames} direction={open} />}
    </div>
  );
}
