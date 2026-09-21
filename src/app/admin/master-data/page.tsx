import { prisma } from "@/lib/prisma";
import { MASTER_CATEGORIES } from "@/lib/masterData";
import LabelEditor from "./LabelEditor";
import MasterActiveToggle from "./MasterActiveToggle";
import AddItemForm from "./AddItemForm";

export default async function MasterDataPage() {
  const items = await prisma.masterDataItem.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  const byCategory = new Map<string, typeof items>();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Master Data</h1>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Rename how statuses and categories are displayed across the app, or hide ones you don&apos;t
        use. &ldquo;Fixed list&rdquo; categories can be renamed and hidden but not added to — their
        codes are tied to logic elsewhere (e.g. breeding rules check for the <code>SOLD</code>/
        <code>DEAD</code> cow status). Open lists can have new entries added freely.
      </p>

      <div className="flex flex-col gap-4">
        {MASTER_CATEGORIES.map((cat) => {
          const catItems = byCategory.get(cat.key) ?? [];
          return (
            <details key={cat.key} className="bg-white border border-neutral-200 rounded-lg">
              <summary className="cursor-pointer select-none px-4 py-3 font-medium text-neutral-900 flex items-center gap-2">
                {cat.label}
                <span className={`text-xs font-normal px-1.5 py-0.5 rounded ${cat.locked ? "bg-neutral-100 text-neutral-500" : "bg-green-50 text-green-700"}`}>
                  {cat.locked ? "fixed list" : "open list"}
                </span>
              </summary>
              <div className="px-4 pb-4 border-t border-neutral-100 pt-3 flex flex-col gap-3">
                <p className="text-xs text-neutral-500">{cat.description}</p>
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-2 py-1">Code</th>
                      <th className="text-left px-2 py-1">Label</th>
                      <th className="text-left px-2 py-1">Status</th>
                      <th className="text-left px-2 py-1">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((item) => (
                      <tr key={item.id} className="border-t border-neutral-100">
                        <td className="px-2 py-2 font-mono text-xs text-neutral-500">{item.code}</td>
                        <td className="px-2 py-2">
                          <LabelEditor id={item.id} label={item.label} />
                        </td>
                        <td className="px-2 py-2">
                          <span className={item.active ? "text-green-700" : "text-neutral-400"}>
                            {item.active ? "Active" : "Hidden"}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <MasterActiveToggle id={item.id} active={item.active} />
                        </td>
                      </tr>
                    ))}
                    {catItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-3 text-neutral-400 text-sm">
                          No items yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {!cat.locked && (
                  <div className="pt-2 border-t border-neutral-100">
                    <AddItemForm category={cat.key} />
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
