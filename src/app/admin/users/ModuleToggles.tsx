"use client";

import { toggleModule } from "./actions";
import { MODULES, MODULE_LABELS, type ModuleName } from "@/lib/modules";

export default function ModuleToggles({ userId, granted }: { userId: string; granted: ModuleName[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MODULES.map((m) => {
        const has = granted.includes(m);
        return (
          <form key={m} action={toggleModule}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="module" value={m} />
            <input type="hidden" name="grant" value={(!has).toString()} />
            <button
              type="submit"
              title={has ? `Revoke ${MODULE_LABELS[m]}` : `Grant ${MODULE_LABELS[m]}`}
              className={`text-xs rounded px-2 py-0.5 border ${
                has ? "bg-green-50 border-green-300 text-green-800" : "bg-neutral-50 border-neutral-300 text-neutral-400"
              }`}
            >
              {MODULE_LABELS[m]}
            </button>
          </form>
        );
      })}
    </div>
  );
}
