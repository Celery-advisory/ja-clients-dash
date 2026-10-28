import { NextResponse } from "next/server";

import { createAndStoreReport, getUserProfile } from "@/lib/reports/service";
import { isReportKind } from "@/lib/wealth/period-calendar";
import { getClientById, getLatestPeriodForClient } from "@/lib/wealth/queries";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getUserProfile(user.id);
    if (profile?.role !== "advisor" && profile?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const clientId = body.clientId as string | undefined;
    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const client = await getClientById(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const periodId =
      (body.periodId as string | undefined) ??
      (await getLatestPeriodForClient(clientId))?.id;
    if (!periodId) {
      return NextResponse.json(
        { error: "Enter at least one month of statement data first" },
        { status: 400 },
      );
    }

    const kind = isReportKind(body.kind) ? body.kind : "monthly";
    const { report } = await createAndStoreReport(clientId, periodId, user.id, kind, {
      coverImageId: typeof body.coverImageId === "string" ? body.coverImageId : null,
    });

    return NextResponse.json({
      id: report.id,
      title: report.title,
      reference: report.reference,
      generatedAt: report.generated_at,
      fileSizeBytes: report.file_size_bytes,
      status: report.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
