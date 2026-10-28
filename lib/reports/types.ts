import type { PortfolioBucket, TransactionType } from "@/lib/wealth/types";
import type { ReportSectionKey } from "@/lib/wealth/wm-types";

export interface ReportAddress {
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  country: string;
}

export interface ReportSnapshotRow {
  bucket: PortfolioBucket;
  label: string;
  previousValueUsd: number;
  currentValueUsd: number;
  periodChangeUsd: number;
  periodChangePct: number | null;
  ytdPct: number | null;
}

export interface ReportPerformanceRow {
  bucket: PortfolioBucket;
  label: string;
  inceptionGainUsd: number | null;
  inceptionPct: number | null;
  annualizedReturnPct: number | null;
}

export interface ReportAllocationSlice {
  bucket: PortfolioBucket;
  label: string;
  valueUsd: number;
  allocationPct: number;
  color: string;
}

export interface ReportTransactionRow {
  id: string;
  date: string;
  amountUsd: number;
  description: string;
  transactionType: TransactionType;
}

export interface ReportAdvisor {
  fullName: string;
  email: string;
  phone: string | null;
  title: string | null;
}

export interface ReportHistoryPoint {
  date: string;
  valueUsd: number;
}

export interface ReportHoldingRow {
  id: string;
  bucket: PortfolioBucket;
  name: string;
  ticker: string;
  originalValueUsd: number;
  marketValueUsd: number;
}

export interface ReportHoldingsBreakdown {
  bucket: PortfolioBucket;
  label: string;
  rows: ReportHoldingRow[];
}

export interface InvestmentReportData {
  clientName: string;
  clientNumber: string;
  referenceCode: string;
  reference: string;
  preparedOn: string;
  reportKindTitle: string;
  statementPeriodLabel: string;
  periodStart: string;
  periodEnd: string;
  previousStatementLabel: string;
  currentStatementLabel: string;
  address: ReportAddress;
  currency: string;
  totalPortfolioValueUsd: number;
  periodGainUsd: number;
  periodReturnPct: number;
  overviewRows: ReportSnapshotRow[];
  performanceRows: ReportPerformanceRow[];
  allocationSlices: ReportAllocationSlice[];
  holdingsBreakdowns: ReportHoldingsBreakdown[];
  historyPoints: ReportHistoryPoint[];
  transactions: ReportTransactionRow[];
  contributions: ReportTransactionRow[];
  withdrawals: ReportTransactionRow[];
  otherActivity: ReportTransactionRow[];
  transactionsNote: string | null;
  executiveSummary: string;
  importantNotices: string[];
  advisor: ReportAdvisor | null;
  disclaimerTitle: string;
  disclaimerBody: string;
  includedSections: ReportSectionKey[];
  totalPages: number;
  /** Cover photo bytes or path; the bundled skyline is used when absent. */
  coverImageSrc?: string | { data: Buffer; format: "jpg" | "png" };
}
