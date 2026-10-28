import { isReportSummary, type ReportSummary } from "@/lib/reports/summary";
import { getReportsForClient } from "@/lib/wealth/queries";
import type { WealthReport } from "@/lib/wealth/types";

export type ReportDoc = {
  id: string;
  name: string;
  date: string;
  sizeKb: number;
  /** Draft until published; for clients, New until they first open it. */
  status: "draft" | "new" | "viewed";
  publishedAt: string | null;
  firstViewedAt: string | null;
  viewCount: number;
  summary: ReportSummary | null;
  downloadUrl: string;
  readUrl: string;
};

/** Pass `forClient` when the caller is the client: drafts are left out. */
export async function getClientReports(
  clientId: string,
  options?: { forClient?: boolean },
): Promise<ReportDoc[]> {
  const reports = await getReportsForClient(clientId, { publishedOnly: options?.forClient });
  return reports.map((r) => toReportDoc(r));
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toReportDoc(report: WealthReport): ReportDoc {
  const downloadUrl = `/api/reports/${report.id}/download`;
  return {
    id: report.id,
    name: report.title,
    date: formatDate(report.published_at ?? report.generated_at),
    sizeKb: report.file_size_bytes ? Math.round(report.file_size_bytes / 1024) : 0,
    status:
      report.status !== "published" ? "draft" : report.first_viewed_at ? "viewed" : "new",
    publishedAt: report.published_at ?? null,
    firstViewedAt: report.first_viewed_at ?? null,
    viewCount: report.view_count ?? 0,
    summary: isReportSummary(report.summary) ? report.summary : null,
    downloadUrl,
    readUrl: `${downloadUrl}?inline=1`,
  };
}

export async function getAllReports(): Promise<(ReportDoc & { clientName: string; clientId: string })[]> {
  const { queryDb } = await import("@/lib/supabase/db");
  const rows = await queryDb<WealthReport & { client_name: string }>(
    `SELECT r.id, r.client_id, r.period_id, r.reference, r.title,
            r.generated_at::text, r.storage_path, r.file_size_bytes, r.status::text,
            r.sent_at::text, r.published_at::text, r.summary,
            r.first_viewed_at::text, r.last_viewed_at::text, r.view_count,
            c.full_name AS client_name
     FROM wealth.reports r
     JOIN wealth.clients c ON c.id = r.client_id
     ORDER BY (r.status = 'draft') DESC, r.generated_at DESC`,
  );
  return rows.map((r) => ({
    ...toReportDoc(r),
    clientName: r.client_name,
    clientId: r.client_id,
  }));
}
