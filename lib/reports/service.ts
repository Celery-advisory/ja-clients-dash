import { createAdminClient } from "@/lib/supabase/admin";
import { queryDb } from "@/lib/supabase/db";
import { generateInvestmentReportPdf } from "@/lib/reports/generate-pdf";
import { buildReportSummary } from "@/lib/reports/summary";
import { insertReport } from "@/lib/wealth/queries";
import type { ReportKind } from "@/lib/wealth/period-calendar";
import type { ReportSectionKey } from "@/lib/wealth/wm-types";

export async function createAndStoreReport(
  clientId: string,
  periodId: string,
  generatedBy?: string | null,
  kind: ReportKind = "monthly",
  options?: {
    templateKey?: string | null;
    sections?: ReportSectionKey[] | null;
    coverImageId?: string | null;
  },
) {
  const { buffer, data, coverImageId } = await generateInvestmentReportPdf(
    clientId,
    periodId,
    kind,
    options?.sections,
    { coverImageId: options?.coverImageId },
  );
  const fileName = `${data.reference.replace(/\//g, "-")}.pdf`;
  let storagePath = `${clientId}/${periodId}/${kind}/${fileName}`;
  let storedInBucket = false;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from("reports")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    storagePath = `generated/${clientId}/${periodId}/${kind}/${fileName}`;
  } else {
    storedInBucket = true;
  }

  const report = await insertReport({
    clientId,
    periodId,
    reference: data.reference,
    title: `${data.reportKindTitle} | ${data.statementPeriodLabel}`,
    storagePath,
    fileSizeBytes: buffer.length,
    generatedBy,
    templateKey: options?.templateKey ?? null,
    sections: data.includedSections,
    coverImageId,
    summary: buildReportSummary(data),
  });

  return { report, data, storedInBucket };
}

/** A signed link to the stored PDF. Pass `download` (a file name) to save it rather than open it in the browser. */
export async function getReportDownloadUrl(
  storagePath: string,
  expiresIn = 3600,
  options?: { download?: string },
) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("reports")
    .createSignedUrl(
      storagePath,
      expiresIn,
      options?.download ? { download: options.download } : undefined,
    );

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not create download URL");
  }
  return data.signedUrl;
}

export async function getUserProfile(userId: string) {
  const rows = await queryDb<{
    role: string;
    client_id: string | null;
    advisor_id: string | null;
  }>(
    `SELECT role, client_id, advisor_id FROM wealth.profiles WHERE id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}
