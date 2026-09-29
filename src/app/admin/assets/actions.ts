"use server";

import { prisma } from "@/lib/prisma";
import { saveUploadedImage, deleteUploadedImage } from "@/lib/uploadImage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess, runAction } from "@/lib/access";
import { reqId, reqNum, reqText, optDate, optNum } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

export async function addAsset(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addAssetImpl(_prev, formData));
}

async function addAssetImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess({ module: "FINANCIAL" });
  const assetClass = reqText(formData, "assetClass", "Asset class", { max: 100 });
  const details = reqText(formData, "details", "Details", { max: 200 });
  const qty = reqNum(formData, "qty", "Quantity", { positive: true, max: 1_000_000 });
  const currentValue = reqNum(formData, "currentValue", "Current value", { max: 10_000_000_000 });
  const photoField = formData.get("photo");
  const photo = photoField instanceof File ? photoField : null;

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
  return runAction(() => updateAssetImpl(_prev, formData));
}

async function updateAssetImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess({ module: "FINANCIAL" });
  const id = reqId(formData, "id", "Asset");
  const assetClass = reqText(formData, "assetClass", "Asset class", { max: 100 });
  const details = reqText(formData, "details", "Details", { max: 200 });
  const qty = reqNum(formData, "qty", "Quantity", { positive: true, max: 1_000_000 });
  const value = reqNum(formData, "value", "Value", { max: 10_000_000_000 });
  const currentValue = reqNum(formData, "currentValue", "Current value", { max: 10_000_000_000 });
  const depreciationPct = optNum(formData, "depreciationPct", "Depreciation %", { max: 100 }) ?? 0;
  const yearLived = optNum(formData, "yearLived", "Years lived", { max: 200, decimals: 0 }) ?? 0;
  const valuationDate = optDate(formData, "valuationDate", "Valuation date");
  const photoField = formData.get("photo");
  const photo = photoField instanceof File ? photoField : null;
  const removePhoto = formData.get("removePhoto") === "on";

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
      depreciationPct,
      yearLived,
      valuationDate,
      photoUrl,
    },
  });

  revalidatePath("/admin/assets");
  revalidatePath(`/admin/assets/${id}`);
  return { success: true, message: "Asset updated." };
}

export async function deleteAsset(formData: FormData): Promise<void> {
  await requireAccess({ module: "FINANCIAL" });
  const id = reqId(formData, "id", "Asset");
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
  return runAction(() => deleteAssetInlineImpl(_prev, formData));
}

async function deleteAssetInlineImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess({ module: "FINANCIAL" });
  const id = reqId(formData, "id", "Asset");

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
  return runAction(() => deleteAssetsImpl(_prev, formData));
}

async function deleteAssetsImpl(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  await requireAccess({ module: "FINANCIAL" });
  await requireAccess({ admin: true });

  const ids = formData.getAll("assetIds") as string[];
  if (ids.length === 0) return { success: false, message: "No assets selected." };

  const assets = await prisma.asset.findMany({ where: { id: { in: ids } } });
  await Promise.all(assets.map((a) => deleteUploadedImage(a.photoUrl)));
  const { count } = await prisma.asset.deleteMany({ where: { id: { in: ids } } });

  revalidatePath("/admin/assets");
  return { success: true, message: `Deleted ${count} asset${count === 1 ? "" : "s"}.` };
}
