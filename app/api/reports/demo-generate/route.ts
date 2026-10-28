import { NextResponse } from "next/server";

import {
  assembleDemoInvestmentReport,
  type DemoSnapshotInput,
} from "@/lib/reports/assemble-demo-report";
import { generateInvestmentReportPdf } from "@/lib/reports/generate-pdf";
import { resolveReportClientId } from "@/lib/reports/resolve-report-client";
import { ALL_BUCKETS } from "@/lib/wealth/constants";
import {
  getLatestPeriodForClient,
  getStatementPeriod,
  upsertSnapshots,
} from "@/lib/wealth/queries";
import { isAdvisorRole } from "@/lib/auth/dashboard-routes";
import { canAccessClient, getAdvisorApiSession, getApiSession } from "@/lib/wealth/session";

function pdfResponse(buffer: Buffer, reference: string) {
  const fileName = `${reference.replace(/\//g, "-")}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

async function upsertDraftSnapshots(
  clientId: string,
  periodId: string,
  snapshots: DemoSnapshotInput[],
) {
  const byBucket = new Map(snapshots.map((row) => [row.bucket, row]));
  const rows = ALL_BUCKETS.map((bucket) => {
    const snap = byBucket.get(bucket);
    const previous = Number(snap?.previous_value_usd ?? 0);
    const current = Number(snap?.current_value_usd ?? 0);
    const changePct =
      snap?.period_change_pct ??
      (bucket === "coa" || previous === 0 ? null : ((current - previous) / previous) * 100);
    return {
      bucket,
      previous_value_usd: previous,
      current_value_usd: current,
      period_change_pct: changePct,
      ytd_pct: snap?.ytd_pct ?? changePct,
      inception_gain_usd: snap?.inception_gain_usd ?? (current - previous),
      inception_pct: snap?.inception_pct ?? changePct,
      annualized_return_pct: snap?.annualized_return_pct ?? changePct,
    };
  });
  await upsertSnapshots(clientId, periodId, rows);
}

async function generateFromDatabase(
  slugOrId: string,
  options?: { periodId?: string; snapshots?: DemoSnapshotInput[] },
) {
  const clientId = await resolveReportClientId(slugOrId);
  if (!clientId) throw new Error("Client not found");

  const period = options?.periodId
    ? await getStatementPeriod(options.periodId)
    : await getLatestPeriodForClient(clientId);
  if (!period || period.client_id !== clientId) {
    throw new Error("No statement period for this client");
  }

  if (options?.snapshots) {
    await upsertDraftSnapshots(clientId, period.id, options.snapshots);
  }

  return generateInvestmentReportPdf(clientId, period.id);
}

export async function GET(request: Request) {
  const session = await getApiSession();
  if (!session.ok) return session.response;

  const clientId = new URL(request.url).searchParams.get("clientId") ?? "john-doe";
  try {
    const dbClientId = await resolveReportClientId(clientId);
    // Clients only get live data for their own account; anything else falls back to the static sample.
    const canUseDatabase =
      dbClientId !== null &&
      (isAdvisorRole(session.profile.role) || canAccessClient(session.profile, dbClientId));
    if (canUseDatabase) {
      const { buffer, data } = await generateFromDatabase(clientId);
      return pdfResponse(buffer, data.reference);
    }

    const data = assembleDemoInvestmentReport(clientId);
    const { renderInvestmentReportPdf } = await import("@/lib/reports/generate-pdf");
    const buffer = await renderInvestmentReportPdf(data);
    return pdfResponse(buffer, data.reference);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  // POST can overwrite stored snapshots, so it is limited to the advisory team.
  const session = await getAdvisorApiSession();
  if (!session.ok) return session.response;

  try {
    const body = await request.json().catch(() => ({}));
    const clientId = (body.clientId as string | undefined) ?? "john-doe";
    const snapshots = body.snapshots as DemoSnapshotInput[] | undefined;
    const periodId = body.periodId as string | undefined;

    const dbClientId = await resolveReportClientId(clientId);
    if (dbClientId) {
      const { buffer, data } = await generateFromDatabase(clientId, { periodId, snapshots });
      return pdfResponse(buffer, data.reference);
    }

    const data = assembleDemoInvestmentReport(clientId, snapshots);
    const { renderInvestmentReportPdf } = await import("@/lib/reports/generate-pdf");
    const buffer = await renderInvestmentReportPdf(data);
    return pdfResponse(buffer, data.reference);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
