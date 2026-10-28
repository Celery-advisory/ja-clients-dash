import { NextResponse } from "next/server";

import { createAndStoreReport } from "@/lib/reports/service";
import { getLatestPeriodForClient, getClientById } from "@/lib/wealth/queries";
import { getAdvisorApiSession } from "@/lib/wealth/session";
import { isReportKind } from "@/lib/wealth/period-calendar";
import { ALL_REPORT_SECTIONS, REPORT_TEMPLATES, type ReportSectionKey } from "@/lib/wealth/wm-types";

export async function POST(request: Request) {
  const session = await getAdvisorApiSession();
  if (!session.ok) return session.response;

  const body = await request.json().catch(() => ({}));
  const clientIds = Array.isArray(body.clientIds)
    ? (body.clientIds as string[]).filter(Boolean)
    : [];

  if (clientIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "Select at least one client. Reports are only generated when you choose to, not for the whole book automatically.",
      },
      { status: 400 },
    );
  }

  const templateKey = String(body.templateKey ?? "standard_monthly");
  const template = REPORT_TEMPLATES[templateKey];
  const allowed = new Set(ALL_REPORT_SECTIONS);
  const sections = (
    Array.isArray(body.sections) ? (body.sections as string[]) : template?.sections ?? []
  ).filter((key): key is ReportSectionKey => allowed.has(key as ReportSectionKey));

  const kind = isReportKind(body.kind)
    ? body.kind
    : templateKey === "quarterly_deep_dive"
      ? "quarterly"
      : "monthly";

  const coverImageId = typeof body.coverImageId === "string" ? body.coverImageId : null;

  const results: Array<{ clientId: string; ok: boolean; error?: string; reportId?: string }> = [];

  for (const clientId of clientIds) {
    try {
      const client = await getClientById(clientId);
      if (!client) {
        results.push({ clientId, ok: false, error: "Client not found" });
        continue;
      }
      const period = await getLatestPeriodForClient(clientId);
      if (!period) {
        results.push({ clientId, ok: false, error: "No statement period" });
        continue;
      }
      const { report } = await createAndStoreReport(
        clientId,
        period.id,
        session.userId,
        kind,
        { templateKey, sections, coverImageId },
      );
      results.push({ clientId, ok: true, reportId: report.id });
    } catch (err) {
      results.push({
        clientId,
        ok: false,
        error: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  return NextResponse.json({ results, template: template?.label ?? templateKey });
}
