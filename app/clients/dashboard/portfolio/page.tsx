"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import { AllocationPieChart, AssetAreaChart } from "@/components/charts/asset-charts";
import { PageShell } from "@/components/layout/page-shell";
import {
  DashCard,
  DashCardContent,
  DashCardDescription,
  DashCardHeader,
  DashCardTitle,
} from "@/components/ui/dash-card";
import { ClientEmptyState } from "@/components/ui/empty-state";
import { KpiItem, KpiStrip } from "@/components/ui/kpi-strip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CategoryPill,
  ColumnLabel,
  Table,
  TableBody,
  TableCell,
  TableFooterBar,
  TableHead,
  TableHeader,
  TableRow,
  bucketPillLabel,
  bucketPillTone,
  usePagedRows,
} from "@/components/ui/table";
import { H1, Muted, TextSmall } from "@/components/ui/typography";
import { useCurrency } from "@/lib/currency-context";
import { useJaPortfolio } from "@/lib/hooks/use-ja-portfolio";
import { cn } from "@/lib/utils";

function ChangeCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">N/A</span>;
  const Icon = value === 0 ? Minus : value > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 font-numeric text-xs font-medium",
      value > 0 && "text-brand-accent",
      value < 0 && "text-destructive",
      value === 0 && "text-muted-foreground"
    )}>
      <Icon className="size-3 shrink-0" />
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

/** "+4.2%" or "-1.1%": the sign follows the number, so a fall never shows as a gain. */
function signedPct(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(value).toFixed(1)}%`;
}

function trendOf(value: number): "up" | "down" | "neutral" {
  return value > 0 ? "up" : value < 0 ? "down" : "neutral";
}

export default function ClientPortfolioPage() {
  const { format } = useCurrency();
  const { data, allocationSlices, loading, error, empty } = useJaPortfolio();
  const bucketPage = usePagedRows(data?.buckets ?? []);

  if (loading) {
    return (
      <PageShell className="flex flex-col gap-(--spacing-section)">
        <header className="flex flex-col gap-1">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </header>

        <KpiStrip>
          <KpiItem label="Total Portfolio" value="" loading />
          <KpiItem label="Period Gain" value="" loading />
          <KpiItem label="Best Portfolio" value="" loading />
          <KpiItem label="Cash On Account" value="" loading />
        </KpiStrip>

        <div className="grid grid-cols-1 gap-(--spacing-grid) lg:grid-cols-3">
          <DashCard>
            <DashCardHeader>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="mt-2 h-3 w-48" />
            </DashCardHeader>
            <DashCardContent>
              <Skeleton className="mx-auto size-40 rounded-full" />
            </DashCardContent>
          </DashCard>
          <DashCard className="lg:col-span-2">
            <DashCardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-2 h-3 w-44" />
            </DashCardHeader>
            <DashCardContent>
              <Skeleton className="h-48 w-full rounded-lg" />
            </DashCardContent>
          </DashCard>
        </div>

        <DashCard>
          <DashCardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-3 w-52" />
          </DashCardHeader>
          <DashCardContent className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </DashCardContent>
        </DashCard>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell className="flex flex-col gap-(--spacing-section)">
        <H1>My Portfolio</H1>
        <Muted>Could not load portfolio. Try again shortly or contact your wealth manager.</Muted>
        <TextSmall className="text-destructive">{error}</TextSmall>
      </PageShell>
    );
  }

  if (empty) {
    return (
      <PageShell className="flex flex-col gap-(--spacing-section)">
        <header className="flex flex-col gap-1">
          <H1>My Portfolio</H1>
          <Muted>JA managed portfolios: Income, Growth, Venture, Treasury, and Cash on Account.</Muted>
        </header>
        <DashCard>
          <DashCardContent>
            <ClientEmptyState
              variant="allocation"
              title="No portfolio data yet"
              description="Get in touch with us or your wealth manager and we will add your portfolios, allocation, performance, and activity here."
            />
          </DashCardContent>
        </DashCard>
      </PageShell>
    );
  }

  const bestBucket = [...data.buckets]
    .filter((b) => b.ytdPct != null && b.id !== "coa")
    .sort((a, b) => (b.ytdPct ?? 0) - (a.ytdPct ?? 0))[0];

  return (
    <PageShell className="flex flex-col gap-(--spacing-section)">
      <header className="flex flex-col gap-1">
        <H1>My Portfolio</H1>
        <Muted>JA managed portfolios: Income, Growth, Venture, Treasury, and Cash on Account.</Muted>
      </header>

      <KpiStrip>
        <KpiItem
          label="Total Portfolio"
          value={format(data.totalUSD)}
          change={`${signedPct(data.periodReturnPct)} this period`}
          trend={trendOf(data.periodReturnPct)}
        />
        <KpiItem label="Period Gain" value={format(data.periodGainUsd)} change="Statement period" trend={data.periodGainUsd >= 0 ? "up" : "down"} />
        <KpiItem
          label="Best Portfolio"
          value={bestBucket?.label ?? "N/A"}
          change={bestBucket?.ytdPct != null ? `${signedPct(bestBucket.ytdPct)} YTD` : ""}
          trend={bestBucket?.ytdPct != null ? trendOf(bestBucket.ytdPct) : "neutral"}
        />
        <KpiItem label="Cash On Account" value={format(data.cashUSD ?? 0)} change="Uninvested cash" trend="neutral" />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-(--spacing-grid) lg:grid-cols-3">
        <DashCard>
          <DashCardHeader>
            <div>
              <DashCardTitle>Portfolio Allocation</DashCardTitle>
              <DashCardDescription>By JA bucket, % of total</DashCardDescription>
            </div>
          </DashCardHeader>
          <DashCardContent>
            <AllocationPieChart data={allocationSlices} />
          </DashCardContent>
        </DashCard>

        <DashCard className="lg:col-span-2">
          <DashCardHeader>
            <div>
              <DashCardTitle>Value Over Time</DashCardTitle>
              <DashCardDescription>Total portfolio trajectory</DashCardDescription>
            </div>
          </DashCardHeader>
          <DashCardContent>
            <AssetAreaChart
              data={data.history}
              color="#202356"
              gradientId="ja-portfolio-total"
              height={220}
              yAxisLabel="Value (USD)"
              seriesLabel="Portfolio value"
            />
          </DashCardContent>
        </DashCard>
      </div>

      <DashCard>
        <DashCardHeader>
          <DashCardTitle>Portfolio Buckets</DashCardTitle>
          <DashCardDescription>Current values and period performance</DashCardDescription>
        </DashCardHeader>
        <DashCardContent className="gap-0">
          <Table bleed className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead><ColumnLabel>Bucket</ColumnLabel></TableHead>
                <TableHead className="text-right"><ColumnLabel align="right">Value</ColumnLabel></TableHead>
                <TableHead className="text-right"><ColumnLabel align="right">Allocation</ColumnLabel></TableHead>
                <TableHead className="text-right"><ColumnLabel align="right">YTD</ColumnLabel></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bucketPage.rows.map((bucket) => (
                <TableRow key={bucket.id}>
                  <TableCell>
                    <CategoryPill tone={bucketPillTone(bucket.id)}>
                      {bucketPillLabel(bucket.id) || bucket.label}
                    </CategoryPill>
                  </TableCell>
                  <TableCell className="text-right font-numeric">{format(bucket.totalUSD)}</TableCell>
                  <TableCell className="text-right font-numeric">{bucket.allocationPct.toFixed(1)}%</TableCell>
                  <TableCell className="text-right"><ChangeCell value={bucket.ytdPct} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TableFooterBar
            className="-mx-3.5 w-[calc(100%+1.75rem)] sm:-mx-4 sm:w-[calc(100%+2rem)]"
            total={bucketPage.total}
            page={bucketPage.page}
            pageCount={bucketPage.pageCount}
            pageSize={bucketPage.pageSize}
            onPageChange={bucketPage.setPage}
            onPageSizeChange={bucketPage.setPageSize}
          />
        </DashCardContent>
      </DashCard>
    </PageShell>
  );
}
