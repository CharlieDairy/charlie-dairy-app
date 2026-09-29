"use client";

import { useState } from "react";
import { PERMISSION_MODULES, PERMISSION_ACTIONS } from "@/lib/permissions";

function permKey(module: string, action: string): string {
  return `${module}:${action}`;
}

// Real, enforced permission editor -- every checkbox here becomes a hidden
// perm_<module>_<action> field on submit, read by readGrantsFromForm() in
// ../actions.ts, and every server action across the app checks these exact
// (module, action) pairs via requirePermission(). Nothing here is decorative.
export default function RolePermissionMatrix({ initialGrants = [] }: { initialGrants?: string[] }) {
  const [grants, setGrants] = useState<Set<string>>(new Set(initialGrants));

  const has = (module: string, action: string) => grants.has(permKey(module, action));

  function toggle(module: string, action: string) {
    setGrants((prev) => {
      const next = new Set(prev);
      const k = permKey(module, action);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleColumn(action: string) {
    setGrants((prev) => {
      const allOn = PERMISSION_MODULES.every((m) => prev.has(permKey(m.key, action)));
      const next = new Set(prev);
      for (const m of PERMISSION_MODULES) {
        const k = permKey(m.key, action);
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  function toggleRow(module: string) {
    setGrants((prev) => {
      const allOn = PERMISSION_ACTIONS.every((a) => prev.has(permKey(module, a)));
      const next = new Set(prev);
      for (const a of PERMISSION_ACTIONS) {
        const k = permKey(module, a);
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  function selectAll() {
    const next = new Set<string>();
    for (const m of PERMISSION_MODULES) for (const a of PERMISSION_ACTIONS) next.add(permKey(m.key, a));
    setGrants(next);
  }

  function clearAll() {
    setGrants(new Set());
  }

  const total = PERMISSION_MODULES.length * PERMISSION_ACTIONS.length;

  return (
    <div className="flex flex-col gap-3">
      {Array.from(grants).map((g) => {
        const [module, action] = g.split(":");
        return <input key={g} type="hidden" name={`perm_${module}_${action}`} value="on" />;
      })}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={selectAll} className="text-xs rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 font-medium">
          Select all
        </button>
        <button type="button" onClick={clearAll} className="text-xs rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 font-medium">
          Clear all
        </button>
        <span className="text-xs text-neutral-400 hidden sm:inline">Click a column header or a module checkbox to toggle a whole column or row.</span>
        <span className="ml-auto text-xs font-semibold rounded-full bg-green-50 text-green-700 px-3 py-1.5 border border-green-200">
          {grants.size} of {total} selected
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-green-900 text-white">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Module</th>
              {PERMISSION_ACTIONS.map((a) => (
                <th
                  key={a}
                  className="px-3 py-2.5 font-medium text-center cursor-pointer select-none hover:bg-green-800"
                  onClick={() => toggleColumn(a)}
                  title={`Toggle ${a} for every module`}
                >
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((m) => (
              <tr key={m.key} className="border-t border-neutral-100">
                <td className="px-4 py-2.5 font-medium">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={PERMISSION_ACTIONS.every((a) => has(m.key, a))}
                      onChange={() => toggleRow(m.key)}
                      title={`Toggle every permission for ${m.label}`}
                    />
                    {m.label}
                  </label>
                </td>
                {PERMISSION_ACTIONS.map((a) => (
                  <td key={a} className="px-3 py-2.5 text-center">
                    <input type="checkbox" checked={has(m.key, a)} onChange={() => toggle(m.key, a)} aria-label={`${a} on ${m.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
