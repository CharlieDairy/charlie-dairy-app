"use client";

import { useState } from "react";
import MilkSaleForm from "@/app/entry/milk-sale/MilkSaleForm";

export default function AddSaleToggle({
  buyers,
  customerRates,
}: {
  buyers: string[];
  customerRates: { name: string; agreedRate: number }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-green-800"
      >
        {open ? "Close" : "+ Add Sale"}
      </button>
      {open && <MilkSaleForm buyers={buyers} customerRates={customerRates} />}
    </div>
  );
}
