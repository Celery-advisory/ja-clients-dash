import React from "react";
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";

import type {
  InvestmentReportData,
  ReportHoldingsBreakdown,
  ReportTransactionRow,
} from "@/lib/reports/types";
import { formatPct, formatUsd } from "@/lib/wealth/constants";
import { ALLOCATION_DESK, JA_REPORT_LOGO_DARK } from "@/lib/reports/pdf/report-assets";
import { AllocationChart } from "@/lib/reports/pdf/report-charts";
import { cumulativeTotals } from "@/lib/reports/summary";
import {
  BackCoverPage,
  CoverPage,
  GridTable,
  OrdinalDate,
  ReportPageShell,
  type TableColumn,
  type TableRowSpec,
} from "@/lib/reports/pdf/report-layout";
import { reportStyles, TABLE_TEXT_SIZE } from "@/lib/reports/pdf/report-theme";

const NOT_APPLICABLE = "Not applicable";

/** Row heights from the template, in points on the A4 page. */
const SUMMARY_ROW_HEIGHT = 42.4;
const HOLDING_ROW_HEIGHT = 23.6;

const DISCLAIMER_PARAGRAPH_STARTS = [
  "The portfolio valuations, as well as stock market",
  "Portfolio valuations are based on prices",
  "The client is requested to check",
];

function disclaimerParagraphs(body: string): string[] {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  if (/\n\s*\n/.test(normalized)) {
    return normalized
      .split(/\n\s*\n/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  let rest = normalized.replace(/\s+/g, " ");
  const paragraphs: string[] = [];
  for (const marker of DISCLAIMER_PARAGRAPH_STARTS) {
    const index = rest.indexOf(marker);
    if (index <= 0) continue;
    paragraphs.push(rest.slice(0, index).trim());
    rest = rest.slice(index).trim();
  }
  if (rest) paragraphs.push(rest);
  return paragraphs;
}

function ordinalDayLabel(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const rest = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `${day}${suffix} ${rest}`;
}

function holdingGainPct(original: number, market: number): number | null {
  if (original <= 0) return null;
  return ((market - original) / original) * 100;
}

/** Holdings show two decimals, as on the template breakdown page. */
function formatHoldingPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return NOT_APPLICABLE;
  const formatted = `${Math.abs(value).toFixed(2)}%`;
  if (value === 0) return formatted;
  return value > 0 ? `+ ${formatted}` : `- ${formatted}`;
}

function signedOrNotApplicable(value: number | null | undefined, format: (v: number) => string) {
  return value == null || value === 0 ? NOT_APPLICABLE : format(value);
}

function OverviewTable({ data }: { data: InvestmentReportData }) {
  const invested = data.overviewRows.filter((r) => r.bucket !== "coa");
  const totalPrevious = data.overviewRows.reduce((s, r) => s + r.previousValueUsd, 0);
  const totalCurrent = data.overviewRows.reduce((s, r) => s + r.currentValueUsd, 0);
  const totalChange = invested.reduce((s, r) => s + r.periodChangeUsd, 0);

  const columns: TableColumn[] = [
    { width: 133, header: "Asset Class" },
    {
      width: 147.6,
      header: (
        <>
          Previous Statement Value{"\n"}(
          <OrdinalDate label={data.previousStatementLabel} size={TABLE_TEXT_SIZE} />)
        </>
      ),
    },
    {
      width: 142.2,
      header: (
        <>
          Current Statement Value{"\n"}(
          <OrdinalDate label={data.currentStatementLabel} size={TABLE_TEXT_SIZE} />)
        </>
      ),
    },
    { width: 94.1, header: "Change During\nPeriod" },
    { width: 84.9, header: "% Change\nYear to Date +" },
  ];

  const rows: TableRowSpec[] = data.overviewRows.map((row, i) => ({
    key: row.bucket,
    height: SUMMARY_ROW_HEIGHT,
    striped: i % 2 === 1,
    cells: [
      row.label,
      formatUsd(row.previousValueUsd),
      formatUsd(row.currentValueUsd),
      row.bucket === "coa"
        ? NOT_APPLICABLE
        : signedOrNotApplicable(row.periodChangeUsd, (v) => formatUsd(v, true)),
      row.bucket === "coa"
        ? NOT_APPLICABLE
        : signedOrNotApplicable(row.ytdPct, (v) => formatPct(v, true)),
    ],
  }));

  rows.push({
    key: "total",
    height: SUMMARY_ROW_HEIGHT,
    total: true,
    cells: [
      "Total",
      formatUsd(totalPrevious),
      formatUsd(totalCurrent),
      formatUsd(totalChange, true),
      formatPct(data.periodReturnPct, true),
    ],
  });

  return <GridTable columns={columns} rows={rows} />;
}

function CumulativePerformanceTable({ data }: { data: InvestmentReportData }) {
  const performance = new Map(data.performanceRows.map((row) => [row.bucket, row]));
  const { totalAmount, totalPct } = cumulativeTotals(data);

  const columns: TableColumn[] = [
    { width: 154.5, header: "Asset Class" },
    { width: 171.8, header: "Amount" },
    { width: 165.4, header: "% Change Since Inception" },
    { width: 109.1, header: "% Annualized Return" },
  ];

  const rows: TableRowSpec[] = data.overviewRows.map((row, i) => {
    const perf = row.bucket === "coa" ? undefined : performance.get(row.bucket);
    return {
      key: row.bucket,
      height: SUMMARY_ROW_HEIGHT,
      striped: i % 2 === 1,
      cells: [
        row.label,
        formatUsd(row.currentValueUsd),
        signedOrNotApplicable(perf?.inceptionPct, (v) => formatPct(v, true)),
        signedOrNotApplicable(perf?.annualizedReturnPct, (v) => formatPct(v, true)),
      ],
    };
  });

  rows.push({
    key: "total",
    height: SUMMARY_ROW_HEIGHT,
    total: true,
    cells: [
      "Total",
      formatUsd(totalAmount),
      signedOrNotApplicable(totalPct, (v) => formatPct(v, true)),
      "",
    ],
  });

  return <GridTable columns={columns} rows={rows} />;
}

function HoldingsBreakdownTable({ breakdown }: { breakdown: ReportHoldingsBreakdown }) {
  const totalOriginal = breakdown.rows.reduce((s, r) => s + r.originalValueUsd, 0);
  const totalMarket = breakdown.rows.reduce((s, r) => s + r.marketValueUsd, 0);

  const columns: TableColumn[] = [
    // Full content width: at print size the template's narrower grid wraps fund names.
    { width: 146, header: "Investment Name" },
    { width: 86, header: "Ticker" },
    { width: 92, header: "Original Value" },
    { width: 92, header: "Market Value" },
    { width: 110, header: "Unrealised Gain/Loss" },
    { width: 75, header: "% Gain/Loss" },
  ];

  const rows: TableRowSpec[] = breakdown.rows.map((row, i) => ({
    key: row.id,
    height: HOLDING_ROW_HEIGHT,
    striped: i % 2 === 0,
    cells: [
      row.name,
      row.ticker,
      formatUsd(row.originalValueUsd),
      formatUsd(row.marketValueUsd),
      formatUsd(row.marketValueUsd - row.originalValueUsd, true),
      formatHoldingPct(holdingGainPct(row.originalValueUsd, row.marketValueUsd)),
    ],
  }));

  rows.push({
    key: "total",
    height: SUMMARY_ROW_HEIGHT,
    total: true,
    totalFill: true,
    cells: [
      "Total",
      "",
      formatUsd(totalOriginal),
      formatUsd(totalMarket),
      formatUsd(totalMarket - totalOriginal, true),
      formatHoldingPct(holdingGainPct(totalOriginal, totalMarket)),
    ],
  });

  return <GridTable columns={columns} rows={rows} />;
}

const LEDGER_COLUMN_WIDTH = 193.9;

function TransactionsTable({
  rows,
  emptyMessage,
}: {
  rows: ReportTransactionRow[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <Text style={reportStyles.emptyRow}>{emptyMessage}</Text>;
  }

  return (
    <View style={[reportStyles.table, { width: LEDGER_COLUMN_WIDTH * 3, marginTop: 24 }]}>
      <View style={reportStyles.ledgerHeaderRow} wrap={false}>
        {["Date", "Amount", "Description"].map((label) => (
          <Text key={label} style={[reportStyles.tableHeaderCell, { width: LEDGER_COLUMN_WIDTH }]}>
            {label}
          </Text>
        ))}
      </View>
      {rows.map((tx) => (
        <View key={tx.id} style={reportStyles.ledgerRow} wrap={false}>
          <View style={[reportStyles.ledgerCell, { width: LEDGER_COLUMN_WIDTH }]}>
            <OrdinalDate
              label={ordinalDayLabel(tx.date)}
              size={TABLE_TEXT_SIZE}
              style={reportStyles.ledgerCellText}
            />
          </View>
          <View style={[reportStyles.ledgerCell, { width: LEDGER_COLUMN_WIDTH }]}>
            <Text style={reportStyles.ledgerCellText}>{formatUsd(tx.amountUsd)}</Text>
          </View>
          <View style={[reportStyles.ledgerCell, { width: LEDGER_COLUMN_WIDTH }]}>
            <Text style={reportStyles.ledgerCellText}>{tx.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function AllocationPage({ data }: { data: InvestmentReportData }) {
  return (
    <Page size="A4" orientation="landscape" style={reportStyles.allocationPage}>
      <Image src={ALLOCATION_DESK} style={reportStyles.allocationPhoto} />
      <View style={reportStyles.allocationPanel}>
        <Text style={reportStyles.allocationTitle}>Portfolio Allocation</Text>
        <View style={reportStyles.allocationRule} />
        <View style={{ marginTop: 88 }}>
          <AllocationChart slices={data.allocationSlices} />
        </View>
        <View style={reportStyles.allocationFooterRule} />
        <Image src={JA_REPORT_LOGO_DARK} style={reportStyles.allocationFooterLogo} />
      </View>
    </Page>
  );
}

export function InvestmentReportDocument({ data }: { data: InvestmentReportData }) {
  const shellProps = {
    clientName: data.clientName,
    clientNumber: data.clientNumber,
    reference: data.reference,
  };

  return (
    <Document title={`${data.clientName} | ${data.reportKindTitle}`} author="JA Wealth">
      <CoverPage data={data} />

      <ReportPageShell {...shellProps} pageTitle="Disclaimer">
        <Text style={reportStyles.disclaimerIntro}>{data.disclaimerTitle}</Text>
        {disclaimerParagraphs(data.disclaimerBody).map((paragraph) => (
          <Text key={paragraph.slice(0, 48)} style={reportStyles.disclaimerParagraph}>
            {paragraph}
          </Text>
        ))}
      </ReportPageShell>

      <ReportPageShell {...shellProps} pageTitle="Portfolio Overview">
        <OverviewTable data={data} />
        <Text style={reportStyles.footnote}>
          + Percentage change only reflects returns on invested capital and ignores the cash held
          on account.
        </Text>
      </ReportPageShell>

      <ReportPageShell {...shellProps} pageTitle="Cumulative Performance">
        <CumulativePerformanceTable data={data} />
      </ReportPageShell>

      {data.holdingsBreakdowns.map((breakdown) => (
        <ReportPageShell key={breakdown.bucket} {...shellProps} pageTitle={breakdown.label}>
          <HoldingsBreakdownTable breakdown={breakdown} />
        </ReportPageShell>
      ))}

      <AllocationPage data={data} />

      <ReportPageShell {...shellProps} pageTitle="Recent Transactions">
        <TransactionsTable
          rows={data.transactions}
          emptyMessage="No transactions recorded for this statement period."
        />
        {data.transactionsNote ? (
          <Text style={reportStyles.footnote}>{data.transactionsNote}</Text>
        ) : null}
      </ReportPageShell>

      <BackCoverPage />
    </Document>
  );
}
