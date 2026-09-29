// Granular permission model, layered in place of the old coarse
// ModuleAccess system. `module` reuses NAV_SECTIONS' own keys (see
// src/lib/nav.ts) rather than a separate enum, so the permission matrix,
// the sidebar and route gating (moduleForPath in modules.ts) all stay
// driven by the exact same list -- no risk of a module existing in one
// place but not the other.
export const PERMISSION_MODULES = [
  { key: "herd", label: "Animals" },
  { key: "breeding", label: "Breeding" },
  { key: "health", label: "Health & Vaccination" },
  { key: "milk", label: "Milk Production & Sale" },
  { key: "weight", label: "Animal Weight" },
  { key: "feed", label: "Feed & Inventory" },
  { key: "financial", label: "Financial" },
  { key: "team", label: "Team" },
  { key: "admin", label: "Admin" },
] as const;

export type PermissionModuleKey = (typeof PERMISSION_MODULES)[number]["key"];

export function isPermissionModule(value: string): value is PermissionModuleKey {
  return PERMISSION_MODULES.some((m) => m.key === value);
}

export const PERMISSION_ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT"] as const;
export type PermissionActionKey = (typeof PERMISSION_ACTIONS)[number];

export function isPermissionAction(value: string): value is PermissionActionKey {
  return (PERMISSION_ACTIONS as readonly string[]).includes(value);
}

/** "module:ACTION" key used inside the permission Set carried on LiveUser. */
export function permKey(module: string, action: PermissionActionKey): string {
  return `${module}:${action}`;
}
