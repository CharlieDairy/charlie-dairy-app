"use client";

import { useState } from "react";
import AddVendorForm from "./AddVendorForm";

export default function AddVendorToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="self-end bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-green-800"
      >
        {open ? "Close" : "+ Add Vendor"}
      </button>
      {open && <AddVendorForm />}
    </div>
  );
}
