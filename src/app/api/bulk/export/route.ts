import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exportCsv } from "@/lib/bulk/export";
import { getBulkTypeMeta } from "@/lib/bulk/registry";
import type { BulkTypeKey } from "@/lib/bulk/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("type") as BulkTypeKey | null;
  const meta = key ? getBulkTypeMeta(key) : undefined;
  if (!key || !meta) {
    return NextResponse.json({ error: "Unknown or missing data type" }, { status: 400 });
  }

  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const templateOnly = searchParams.get("template") === "1";

  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;
  if ((fromRaw && Number.isNaN(from?.getTime())) || (toRaw && Number.isNaN(to?.getTime()))) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const { filename, csv } = await exportCsv(key, { from, to, templateOnly });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
