"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium"
    >
      Print / Save as PDF
    </button>
  );
}
