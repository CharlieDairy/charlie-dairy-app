"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { saveUploadedImage, deleteUploadedImage } from "@/lib/uploadImage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormState = { success: boolean; message: string } | undefined;

export async function addAsset(_prev: FormState, formData: FormData): Promise<FormState> {
  const assetClass = (formData.get("assetClass") as string | null)?.trim();
  const details = (formData.get("details") as string | null)?.trim();
  const qty = parseFloat((formData.get("qty") as string | null) ?? "");
  const currentValue = parseFloat((formData.get("currentValue") as string | null) ?? "");
  const photo = formData.get("photo") as File | null;

  if (!assetClass || !details || Number.isNaN(qty) || Number.isNaN(currentValue)) {
    return { success: false, message: "Asset class, details, quantity and current value are required." };
  }

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    const uploaded = await saveUploadedImage(photo, "assets");
    if (uploaded.error) return { success: false, message: uploaded.error };
    photoUrl = uploaded.url;
  }

  await prisma.asset.create({
    data: {
      assetClass,
      details,
      qty,
      value: currentValue,
      currentValue,
      valuationDate: new Date(),
      photoUrl,
    },
  });

  revalidatePath("/admin/assets");
  return { success: true, message: `Asset "${details}" added.` };
}

export async function updateAsset(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id") as string | null;
  const assetClass = (formData.get("assetClass") as string | null)?.trim();
  const details = (formData.get("details") as string | null)?.trim();
  const qty = parseFloat((formData.get("qty") as string | null) ?? "");
  const value = parseFloat((formData.get("value") as string | null) ?? "");
  const currentValue = parseFloat((formData.get("currentValue") as string | null) ?? "");
  const depreciationPct = parseFloat((formData.get("depreciationPct") as string | null) ?? "0");
  const yearLived = parseInt((formData.get("yearLived") as string | null) ?? "0", 10);
  const valuationDateRaw = formData.get("valuationDate") as string | null;
  const photo = formData.get("photo") as File | null;
  const removePhoto = formData.get("removePhoto") === "on";

  if (!id || !assetClass || !details || Number.isNaN(qty) || Number.isNaN(value) || Number.isNaN(currentValue)) {
    return { success: false, message: "Asset class, details, value and current value are required." };
  }

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Asset not found." };

  let photoUrl = existing.photoUrl;
  if (photo && photo.size > 0) {
    const uploaded = await saveUploadedImage(photo, "assets");
    if (uploaded.error) return { success: false, message: uploaded.error };
    if (uploaded.url) {
      await deleteUploadedImage(existing.photoUrl);
      photoUrl = uploaded.url;
    }
  } else if (removePhoto) {
    await deleteUploadedImage(existing.photoUrl);
    photoUrl = null;
  }

  await prisma.asset.update({
    where: { id },
    data: {
      assetClass,
      details,
      qty,
      value,
      currentValue,
      depreciationPct: Number.isNaN(depreciationPct) ? 0 : depreciationPct,
      yearLived: Number.isNaN(yearLived) ? 0 : yearLived,
      valuationDate: valuationDateRaw ? new Date(valuationDateRaw) : null,
      photoUrl,
    },
  });

  revalidatePath("/admin/assets");
  revalidatePath(`/admin/assets/${id}`);
  return { success: true, message: "Asset updated." };
}

export async function deleteAsset(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (asset) {
    await deleteUploadedImage(asset.photoUrl);
    await prisma.asset.delete({ where: { id } });
  }
  revalidatePath("/admin/assets");
  redirect("/admin/assets");
}

// Same inline-list delete as deleteAsset, but returns state instead of
// redirecting -- used from the Assets list row itself, which is already on
// /admin/assets, so a redirect there would just be a no-op reload.
export async function deleteAssetInline(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id") as string | null;
  if (!id) return { success: false, message: "Missing asset id." };

  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return { success: false, message: "Asset not found." };

  await deleteUploadedImage(asset.photoUrl);
  await prisma.asset.delete({ where: { id } });

  revalidatePath("/admin/assets");
  return { success: true, message: `Deleted "${asset.details}".` };
}

export type BulkDeleteState = { success: boolean; message: string } | undefined;

// Admin-only: deletes every selected asset (and its uploaded photo). No
// "safe subset" guard like the Animal List's bulk delete -- an asset has no
// dependent transactional history elsewhere in the schema, so there's
// nothing to protect against.
export async function deleteAssets(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return { success: false, message: "Only Admin can bulk-delete assets." };
  }

  const ids = formData.getAll("assetIds") as string[];
  if (ids.length === 0) return { success: false, message: "No assets selected." };

  const assets = await prisma.asset.findMany({ where: { id: { in: ids } } });
  await Promise.all(assets.map((a) => deleteUploadedImage(a.photoUrl)));
  const { count } = await prisma.asset.deleteMany({ where: { id: { in: ids } } });

  revalidatePath("/admin/assets");
  return { success: true, message: `Deleted ${count} asset${count === 1 ? "" : "s"}.` };
}
