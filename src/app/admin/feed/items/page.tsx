import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import AddItemForm from "./AddItemForm";
import ItemActiveToggle from "./ItemActiveToggle";

export default async function FeedItemsPage() {
  const items = await prisma.feedItem.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Feed Master" />
      <p className="text-sm text-neutral-500 max-w-2xl">
        The feed type catalog used by Feed Entry and Feed Overview. Set a reorder level to have Feed Overview flag a
        feed type as low stock once its balance on hand drops to or below it.
      </p>
      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <AddItemForm />
      </div>
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Feed Item</th>
              <th className="text-left px-3 py-2">Unit</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-right px-3 py-2">Reorder Level</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2">{item.unit}</td>
                <td className="px-3 py-2">{item.category ?? "—"}</td>
                <td className="px-3 py-2 text-right">{item.reorderLevel ?? "—"}</td>
                <td className="px-3 py-2">{item.active ? "Active" : "Hidden"}</td>
                <td className="px-3 py-2">
                  <ItemActiveToggle id={item.id} active={item.active} />
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">No feed items defined yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
