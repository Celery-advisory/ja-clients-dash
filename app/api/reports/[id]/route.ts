import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDraftReport, getReportById } from "@/lib/wealth/queries";
import { getAdvisorApiSession } from "@/lib/wealth/session";

/** Discards a draft report and its file. Published reports cannot be removed here. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdvisorApiSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const existing = await getReportById(id);
  if (!existing) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Only drafts can be discarded. Published reports stay on the client's record." },
      { status: 409 },
    );
  }

  const deleted = await deleteDraftReport(id);
  if (!deleted) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  await createAdminClient()
    .storage.from("reports")
    .remove([deleted.storage_path])
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
