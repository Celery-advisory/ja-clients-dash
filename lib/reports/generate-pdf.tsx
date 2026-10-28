import { renderToBuffer } from "@react-pdf/renderer";

import { assembleInvestmentReportData } from "@/lib/reports/assemble-report-data";
import { resolveCoverImage } from "@/lib/reports/cover-images";
import { registerReportFonts } from "@/lib/reports/pdf/report-fonts";
import { InvestmentReportDocument } from "@/lib/reports/pdf/investment-report-document";
import type { InvestmentReportData } from "@/lib/reports/types";
import type { ReportKind } from "@/lib/wealth/period-calendar";
import type { ReportSectionKey } from "@/lib/wealth/wm-types";

export async function renderInvestmentReportPdf(
  data: InvestmentReportData,
): Promise<Buffer> {
  registerReportFonts();
  const buffer = await renderToBuffer(<InvestmentReportDocument data={data} />);
  return Buffer.from(buffer);
}

export async function generateInvestmentReportPdf(
  clientId: string,
  periodId: string,
  kind: ReportKind = "monthly",
  sections?: ReportSectionKey[] | null,
  options?: { coverImageId?: string | null },
): Promise<{ buffer: Buffer; data: InvestmentReportData; coverImageId: string | null }> {
  const [data, cover] = await Promise.all([
    assembleInvestmentReportData(clientId, periodId, new Date(), kind, sections),
    resolveCoverImage(options?.coverImageId),
  ]);
  data.coverImageSrc = cover.src;
  const buffer = await renderInvestmentReportPdf(data);
  return { buffer, data, coverImageId: cover.id };
}
