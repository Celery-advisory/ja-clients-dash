import type { InvestmentReportData } from "@/lib/reports/types";

/** Headline numbers stored with each report, for the client portal and the report-ready email. */
export type ReportSummary = {
  kindTitle: string;
  periodLabel: string;
  asOfDate: string;
  totalValueUsd: number;
  periodGainUsd: number;
  periodReturnPct: number | null;
  sinceStartGainUsd: number | null;
  sinceStartPct: number | null;
};

/** Totals behind the Cumulative Performance table: gain since inception against invested capital, cash excluded. */
export function cumulativeTotals(data: InvestmentReportData) {
  const totalAmount = data.overviewRows.reduce((s, r) => s + r.currentValueUsd, 0);
  const investedAmount = data.overviewRows
    .filter((r) => r.bucket !== "coa")
    .reduce((s, r) => s + r.currentValueUsd, 0);
  const hasGain = data.performanceRows.some((r) => r.inceptionGainUsd != null);
  const totalGain = data.performanceRows.reduce((s, r) => s + (r.inceptionGainUsd ?? 0), 0);
  const investedCapital = investedAmount - totalGain;
  const totalPct = investedCapital > 0 ? (totalGain / investedCapital) * 100 : null;
  return { totalAmount, totalGain: hasGain ? totalGain : null, totalPct };
}

export function buildReportSummary(data: InvestmentReportData): ReportSummary {
  const { totalGain, totalPct } = cumulativeTotals(data);
  return {
    kindTitle: data.reportKindTitle,
    periodLabel: data.statementPeriodLabel,
    asOfDate: data.periodEnd,
    totalValueUsd: data.totalPortfolioValueUsd,
    periodGainUsd: data.periodGainUsd,
    periodReturnPct: Number.isFinite(data.periodReturnPct) ? data.periodReturnPct : null,
    sinceStartGainUsd: totalGain,
    sinceStartPct: totalPct,
  };
}

export function isReportSummary(value: unknown): value is ReportSummary {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ReportSummary).totalValueUsd === "number" &&
    typeof (value as ReportSummary).periodLabel === "string"
  );
}
