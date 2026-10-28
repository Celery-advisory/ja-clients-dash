import { NextResponse } from "next/server";

import { generateInvestmentReportPdf } from "@/lib/reports/generate-pdf";
import { getReportDownloadUrl } from "@/lib/reports/service";
import { reportKindFromReference } from "@/lib/wealth/period-calendar";
import { getClientById, getReportById, markReportViewed } from "@/lib/wealth/queries";
import { canAccessClient, getApiSession } from "@/lib/wealth/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getApiSession();
    if (!session.ok) return session.response;

    const { id } = await params;
    const report = await getReportById(id);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const client = await getClientById(report.client_id);
    if (!client || !canAccessClient(session.profile, client.id, client.advisor_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isClient = session.profile.role === "client";
    // Drafts exist only for staff until they are published.
    if (isClient && report.status !== "published") {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    if (isClient) await markReportViewed(report.id).catch(() => undefined);

    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const filename = `${report.reference.replace(/\//g, "-")}.pdf`;

    try {
      const signedUrl = await getReportDownloadUrl(report.storage_path, 3600, {
        download: inline ? undefined : filename,
      });
      return NextResponse.redirect(signedUrl);
    } catch {
      const { buffer } = await generateInvestmentReportPdf(
        report.client_id,
        report.period_id,
        reportKindFromReference(report.reference),
        null,
        { coverImageId: report.cover_image_id },
      );
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
