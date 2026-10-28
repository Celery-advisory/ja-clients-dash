import { NextResponse } from "next/server";

import { isReportSummary } from "@/lib/reports/summary";
import { notifyClient } from "@/lib/wealth/client-service";
import { markReportSent, publishReport } from "@/lib/wealth/queries";
import { getAdvisorApiSession } from "@/lib/wealth/session";

const MAX_REPORTS = 100;

/**
 * Publishes draft reports to the client portal. By default each client is notified
 * in the portal and by email with the report's headline numbers.
 */
export async function POST(request: Request) {
  const session = await getAdvisorApiSession();
  if (!session.ok) return session.response;

  const body = await request.json().catch(() => ({}));
  const reportIds = Array.isArray(body.reportIds)
    ? [...new Set((body.reportIds as unknown[]).filter((id): id is string => typeof id === "string"))]
    : [];
  if (reportIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one report to publish" }, { status: 400 });
  }
  if (reportIds.length > MAX_REPORTS) {
    return NextResponse.json(
      { error: `Publish at most ${MAX_REPORTS} reports at a time` },
      { status: 400 },
    );
  }
  const notify = body.notify !== false;

  const results: Array<{ reportId: string; ok: boolean; emailed?: boolean; error?: string }> = [];

  for (const reportId of reportIds) {
    try {
      const report = await publishReport(reportId, session.userId);
      if (!report) {
        results.push({ reportId, ok: false, error: "Not a draft, or no longer exists" });
        continue;
      }

      const summary = isReportSummary(report.summary) ? report.summary : null;
      const { emailed } = await notifyClient({
        clientId: report.client_id,
        kind: "report",
        title: "Your new report is ready",
        body: `${report.title} is ready to read in Reports.`,
        createdBy: session.userId,
        email: notify,
        report: summary
          ? {
              kindTitle: summary.kindTitle,
              periodLabel: summary.periodLabel,
              asOfDate: summary.asOfDate,
              totalValueUsd: summary.totalValueUsd,
              periodGainUsd: summary.periodGainUsd,
              periodReturnPct: summary.periodReturnPct,
              sinceStartGainUsd: summary.sinceStartGainUsd,
              sinceStartPct: summary.sinceStartPct,
            }
          : undefined,
      });
      if (emailed) await markReportSent(reportId);
      results.push({ reportId, ok: true, emailed });
    } catch (error) {
      results.push({
        reportId,
        ok: false,
        error: error instanceof Error ? error.message : "Could not publish",
      });
    }
  }

  return NextResponse.json({ results });
}
