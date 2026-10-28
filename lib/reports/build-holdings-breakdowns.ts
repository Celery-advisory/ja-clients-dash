import type { ReportHoldingsBreakdown } from "@/lib/reports/types";
import { BUCKET_LABELS } from "@/lib/wealth/constants";
import type { PortfolioBucket, PortfolioHolding } from "@/lib/wealth/types";

/** The template only breaks down the growth portfolio; income and venture appear in the overview tables. */
const BREAKDOWN_BUCKETS: ReadonlySet<PortfolioBucket> = new Set(["growth"]);

export function buildHoldingsBreakdowns(holdings: PortfolioHolding[]): ReportHoldingsBreakdown[] {
  const byBucket = new Map<PortfolioBucket, PortfolioHolding[]>();

  for (const row of holdings) {
    if (!BREAKDOWN_BUCKETS.has(row.bucket)) continue;
    const bucketRows = byBucket.get(row.bucket) ?? [];
    bucketRows.push(row);
    byBucket.set(row.bucket, bucketRows);
  }

  return [...byBucket.entries()].map(([bucket, rows]) => ({
    bucket,
    label: `${BUCKET_LABELS[bucket]} Breakdown`,
    rows: rows.map((row) => ({
      id: row.id,
      bucket: row.bucket,
      name: row.investment_name,
      ticker: row.ticker,
      originalValueUsd: row.original_value_usd,
      marketValueUsd: row.market_value_usd,
    })),
  }));
}
