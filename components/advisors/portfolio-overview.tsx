"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Plus } from "lucide-react";

import { ComplianceAuditPanel } from "@/components/advisors/compliance-audit-panel";
import { PortfolioQuickUpdate } from "@/components/advisors/portfolio-quick-update";
import { TrackAssetPanel } from "@/components/advisors/track-asset-panel";
import { advisorSurface } from "@/components/advisors/advisor-surface";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  type PillTone,
} from "@/components/ui/table";
import { Muted, Numeric, TextSmall } from "@/components/ui/typography";
import type { JaPortfolioSummary } from "@/lib/api/domain/wealth-portfolio";
import { formatChartCompactUsd, formatChartUsd } from "@/lib/chart-format";
import { TRACKABLE_ASSETS } from "@/lib/market/trackable-assets";
import type { TrackedAsset } from "@/lib/market/value-holdings";
import {
  BUCKET_COLORS,
  BUCKET_LABELS,
  formatCompactUsd,
  formatUsd,
} from "@/lib/wealth/constants";
import type {
  PortfolioBucket,
  PortfolioSnapshot,
  StatementPeriod,
  WealthTransaction,
} from "@/lib/wealth/types";
import { cn } from "@/lib/utils";

const RANGES = ["1M", "3M", "6M", "YTD", "1Y", "All"] as const;
type RangeId = (typeof RANGES)[number];
type ChartMode = "value" | "return" | "flows";
type AllocationBasis = "portfolio" | "assetClass";
type ValuationKind = "market" | "advisor" | "statement" | "manual" | "estimated";

function sliceTone(id: string): PillTone {
  const tones: Record<string, PillTone> = {
    equities: "indigo",
    bonds: "amber",
    property: "orange",
    cash: "sky",
    alternatives: "violet",
    other: "slate",
  };
  return tones[id] ?? bucketPillTone(id);
}

const SHORT_BUCKET: Record<PortfolioBucket, string> = {
  income: "Income",
  growth: "Growth",
  venture: "Venture",
  treasury: "Treasury",
  coa: "Cash",
};

const ASSET_CLASSES: {
  id: string;
  name: string;
  color: string;
  buckets: PortfolioBucket[];
}[] = [
  { id: "equities", name: "Equities", color: "#202356", buckets: ["growth"] },
  { id: "bonds", name: "Bonds", color: "#b2936b", buckets: ["income", "treasury"] },
  { id: "property", name: "Property", color: "#8a6f45", buckets: [] },
  { id: "cash", name: "Cash", color: "#c4b5a0", buckets: ["coa"] },
  { id: "alternatives", name: "Alternatives", color: "#829850", buckets: ["venture"] },
  { id: "other", name: "Other", color: "#484848", buckets: [] },
];

const VALUATION_LABEL: Record<ValuationKind, string> = {
  market: "Market price",
  advisor: "Advisor valuation",
  statement: "Statement value",
  manual: "Manual value",
  estimated: "Estimated value",
};

type HistoryPoint = { month: string; value: number; recordedOn?: string };

type AllocSlice = {
  id: string;
  name: string;
  valueUsd: number;
  pct: number;
  color: string;
  buckets: PortfolioBucket[];
};

type BreakdownRow = AllocSlice & {
  changeUsd: number | null;
  periodPct: number | null;
};

type ChartRow = {
  month: string;
  value: number;
  flow: number;
  returnPct: number;
};

type PerfFigure = {
  gain: number;
  pct: number | null;
  flows: number;
  adjusted: boolean;
};

function formatStatementDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function holdingKind(ticker: string): "Stock" | "ETF" | null {
  const match = TRACKABLE_ASSETS.find((asset) => asset.symbol === ticker.trim().toUpperCase());
  return match?.kind ?? null;
}

function gainPct(asset: TrackedAsset): number | null {
  if (asset.costBasisUsd <= 0) return null;
  return ((asset.marketValueUsd - asset.costBasisUsd) / asset.costBasisUsd) * 100;
}

function quantityLabel(asset: TrackedAsset): string {
  if (asset.quantity == null || asset.quantity <= 0) return "Quantity not set";
  const qty = asset.quantity.toLocaleString("en-US", { maximumFractionDigits: 4 });
  const kind = holdingKind(asset.ticker);
  if (kind === "Stock") return `${qty} ${asset.quantity === 1 ? "share" : "shares"}`;
  return `${qty} ${asset.quantity === 1 ? "unit" : "units"}`;
}

function signedPct(value: number | null): string {
  if (value == null) return "n/a";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function toneClass(value: number | null | undefined) {
  if (value == null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-emerald-700" : "text-destructive";
}

function isExternalFlow(tx: WealthTransaction) {
  return (
    tx.transaction_type === "deposit" ||
    tx.transaction_type === "drawdown" ||
    tx.transaction_type === "transfer"
  );
}

function cashFlowsBetween(
  transactions: WealthTransaction[],
  start: string,
  end: string,
  inclusiveStart: boolean,
) {
  return transactions.reduce((sum, tx) => {
    if (!isExternalFlow(tx) || tx.bucket == null || tx.bucket === "coa") return sum;
    const day = tx.occurred_on.slice(0, 10);
    const afterStart = inclusiveStart ? day >= start : day > start;
    if (afterStart && day <= end) return sum + tx.amount_usd;
    return sum;
  }, 0);
}

function windowStart(endIso: string, range: Exclude<RangeId, "All">): string {
  const end = new Date(`${endIso}T12:00:00`);
  if (range === "YTD") return `${end.getFullYear()}-01-01`;
  const months = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 }[range];
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${start.getFullYear()}-${month}-${day}`;
}

function sliceHistory(history: HistoryPoint[], range: RangeId): HistoryPoint[] {
  const dated = history.filter((point) => point.recordedOn);
  if (range === "All") return dated.length > 0 ? dated : history;
  if (dated.length === 0) return [];
  const end = dated[dated.length - 1].recordedOn;
  if (!end) return dated;
  const start = windowStart(end, range);
  return dated.filter((point) => (point.recordedOn ?? "") >= start);
}

function rangePerformance(
  history: HistoryPoint[],
  transactions: WealthTransaction[],
  range: RangeId,
): PerfFigure | null {
  const points = sliceHistory(history, range);
  if (points.length < 2) return null;
  const start = points[0];
  const end = points[points.length - 1];
  const valueChange = end.value - start.value;
  if (!start.recordedOn || !end.recordedOn) {
    return {
      gain: valueChange,
      pct: start.value > 0 ? (valueChange / start.value) * 100 : null,
      flows: 0,
      adjusted: false,
    };
  }
  const flows = cashFlowsBetween(transactions, start.recordedOn, end.recordedOn, false);
  const gain = valueChange - flows;
  return {
    gain,
    pct: start.value > 0 ? (gain / start.value) * 100 : null,
    flows,
    adjusted: true,
  };
}

function statementPerformance(
  portfolio: JaPortfolioSummary | null,
  period: StatementPeriod | null,
  transactions: WealthTransaction[],
): PerfFigure | null {
  if (!portfolio) return null;
  const flows =
    period == null
      ? 0
      : cashFlowsBetween(
          transactions,
          period.period_start.slice(0, 10),
          period.period_end.slice(0, 10),
          true,
        );
  const gain = portfolio.periodGainUsd - flows;
  const previous =
    portfolio.periodReturnPct !== 0
      ? portfolio.periodGainUsd / (portfolio.periodReturnPct / 100)
      : null;
  const pct =
    previous != null && previous > 0
      ? (gain / previous) * 100
      : flows === 0
        ? portfolio.periodReturnPct
        : null;
  return { gain, pct, flows, adjusted: period != null };
}

function buildChartRows(
  history: HistoryPoint[],
  transactions: WealthTransaction[],
  range: RangeId,
): ChartRow[] {
  const points = sliceHistory(history, range);
  if (points.length === 0) return [];
  const startValue = points[0].value;
  let cumulativeFlows = 0;
  return points.map((point, index) => {
    const date = point.recordedOn ?? "";
    const prev = points[index - 1]?.recordedOn ?? "";
    const flow =
      index > 0 && prev && date ? cashFlowsBetween(transactions, prev, date, false) : 0;
    cumulativeFlows += flow;
    const investmentValue = point.value - cumulativeFlows;
    const returnPct =
      startValue > 0 ? ((investmentValue - startValue) / startValue) * 100 : 0;
    return { month: point.month, value: point.value, flow, returnPct };
  });
}

function buildPortfolioSlices(
  portfolio: JaPortfolioSummary | null,
  snapshots: PortfolioSnapshot[],
): AllocSlice[] {
  const rows: AllocSlice[] = portfolio
    ? portfolio.buckets.map((bucket) => ({
        id: bucket.id,
        name: bucket.id === "coa" ? "Cash" : bucket.label,
        valueUsd: bucket.totalUSD,
        pct: bucket.allocationPct,
        color: BUCKET_COLORS[bucket.id],
        buckets: [bucket.id],
      }))
    : snapshots.map((row) => {
        const total = snapshots.reduce((sum, item) => sum + item.current_value_usd, 0);
        return {
          id: row.bucket,
          name: row.bucket === "coa" ? "Cash" : BUCKET_LABELS[row.bucket],
          valueUsd: row.current_value_usd,
          pct: total > 0 ? (row.current_value_usd / total) * 100 : 0,
          color: BUCKET_COLORS[row.bucket],
          buckets: [row.bucket],
        };
      });
  return [...rows].sort((a, b) => b.valueUsd - a.valueUsd);
}

function buildAssetClassSlices(portfolios: AllocSlice[]): AllocSlice[] {
  const byBucket = new Map(portfolios.map((slice) => [slice.buckets[0], slice]));
  const total = portfolios.reduce((sum, slice) => sum + slice.valueUsd, 0);
  return ASSET_CLASSES.map((assetClass) => {
    const valueUsd = assetClass.buckets.reduce(
      (sum, bucket) => sum + (byBucket.get(bucket)?.valueUsd ?? 0),
      0,
    );
    return {
      id: assetClass.id,
      name: assetClass.name,
      valueUsd,
      pct: total > 0 ? (valueUsd / total) * 100 : 0,
      color: assetClass.color,
      buckets: assetClass.buckets,
    };
  }).filter((slice) => slice.valueUsd > 0);
}

function buildBreakdown(slices: AllocSlice[], snapshots: PortfolioSnapshot[]): BreakdownRow[] {
  return slices.map((slice) => {
    const bucket = slice.buckets[0];
    const snap = bucket ? snapshots.find((row) => row.bucket === bucket) : undefined;
    if (!snap) return { ...slice, changeUsd: null, periodPct: null };
    const changeUsd = snap.current_value_usd - snap.previous_value_usd;
    const periodPct =
      snap.period_change_pct ??
      (snap.previous_value_usd > 0 ? (changeUsd / snap.previous_value_usd) * 100 : null);
    return { ...slice, changeUsd, periodPct };
  });
}

function activityMeta(tx: WealthTransaction): { label: string; tone: "in" | "out" | "neutral" } {
  if (tx.transaction_type === "deposit") return { label: "Contribution", tone: "in" };
  if (tx.transaction_type === "drawdown") return { label: "Withdrawal", tone: "out" };
  if (tx.transaction_type === "transfer") return { label: "Transfer", tone: "neutral" };
  if (tx.transaction_type === "fee") return { label: "Fee", tone: "out" };
  const text = tx.description.toLowerCase();
  if (/\bsale\b|\bsold\b/.test(text)) return { label: "Investment sale", tone: "in" };
  if (/\bpurchase\b|\bbought\b|\bbuy\b/.test(text)) return { label: "Investment purchase", tone: "out" };
  return tx.amount_usd < 0
    ? { label: "Withdrawal", tone: "out" }
    : { label: "Contribution", tone: "in" };
}

function valuationFor(asset: TrackedAsset, statementDate: string | null): {
  kind: ValuationKind;
  updated: string;
} {
  const dated = statementDate ? `Updated ${statementDate}` : "Saved value";
  if (asset.live) return { kind: "market", updated: "Updated just now" };
  if (asset.priceError) return { kind: "statement", updated: dated };
  if ((asset.quantity == null || asset.quantity <= 0) && asset.marketValueUsd > 0) {
    return { kind: "manual", updated: dated };
  }
  return { kind: "statement", updated: dated };
}

function SectionBlock({
  title,
  description,
  action,
  children,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="border-t border-border/60 pt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className={advisorSurface.sectionTitle}>{title}</h3>
          {description ? <Muted className="mt-0.5 max-w-xl text-[13px]">{description}</Muted> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted/60 p-0.5" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors active:translate-y-px",
              active
                ? "bg-background text-brand-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ValuationSource({ kind, updated }: { kind: ValuationKind; updated: string }) {
  return (
    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0",
          kind === "market" && "rounded-full bg-emerald-600",
          kind === "advisor" && "rotate-45 bg-[#b2936b]",
          kind !== "market" && kind !== "advisor" && "rounded-full border border-current",
        )}
      />
      <span>
        {VALUATION_LABEL[kind]}
        <span className="text-muted-foreground/80"> · {updated}</span>
      </span>
    </span>
  );
}

function PerfStat({
  label,
  gain,
  pct,
}: {
  label: string;
  gain: number | null;
  pct: number | null;
}) {
  return (
    <div>
      <Muted className="text-[11px] tracking-wide uppercase">{label}</Muted>
      {gain == null ? (
        <p className={cn("mt-1 font-numeric text-lg font-semibold", toneClass(pct))}>
          {signedPct(pct)}
        </p>
      ) : (
        <>
          <p className={cn("mt-1 font-numeric text-lg font-semibold", toneClass(gain))}>
            {formatCompactUsd(gain, true)}
          </p>
          <p className={cn("font-numeric text-sm", toneClass(pct))}>{signedPct(pct)}</p>
        </>
      )}
    </div>
  );
}

function AllocationPanel({
  slices,
  selectedId,
  onSelect,
}: {
  slices: AllocSlice[];
  selectedId: string | null;
  onSelect: (slice: AllocSlice | null) => void;
}) {
  const [basis, setBasis] = useState<AllocationBasis>("portfolio");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const visible = basis === "portfolio" ? slices : buildAssetClassSlices(slices);
  const chartSlices = visible.filter((slice) => slice.valueUsd > 0);
  const focus = chartSlices.find((slice) => slice.id === (hoverId ?? selectedId)) ?? null;
  const chartConfig = {
    value: { label: "Value" },
    ...Object.fromEntries(
      chartSlices.map((slice) => [slice.name, { label: slice.name, color: slice.color }]),
    ),
  } satisfies ChartConfig;

  return (
    <SectionBlock
      title="Asset allocation"
      description="Portfolio is the strategy sleeve. Asset class rolls those sleeves into equities, bonds, cash, and alternatives."
      action={
        <Segmented
          label="Allocation basis"
          value={basis}
          onChange={(next) => {
            setBasis(next);
            setHoverId(null);
          }}
          options={[
            { id: "portfolio", label: "By portfolio" },
            { id: "assetClass", label: "By asset class" },
          ]}
        />
      }
    >
      {chartSlices.length === 0 ? (
        <Muted className="py-6 text-sm">No allocation yet. Add a statement period to see the split.</Muted>
      ) : (
        <div className="grid items-center gap-8 md:grid-cols-[200px_minmax(0,1fr)]">
          <div className="relative mx-auto size-[200px]">
            <ChartContainer config={chartConfig} className="aspect-auto size-[200px]">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      nameKey="name"
                      hideLabel
                      formatter={(value, name) => (
                        <span className="font-numeric">
                          {name}: {formatUsd(Number(value))}
                        </span>
                      )}
                    />
                  }
                />
                <Pie
                  data={chartSlices}
                  dataKey="valueUsd"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={2}
                  strokeWidth={0}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={(_, index) => {
                    const slice = chartSlices[index];
                    if (!slice) return;
                    onSelect(selectedId === slice.id ? null : slice);
                  }}
                >
                  {chartSlices.map((slice) => {
                    const dimmed =
                      (selectedId != null || hoverId != null) && slice.id !== (hoverId ?? selectedId);
                    return (
                      <Cell
                        key={slice.id}
                        fill={slice.color}
                        fillOpacity={dimmed ? 0.28 : 1}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHoverId(slice.id)}
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <span className="font-numeric text-lg font-semibold text-brand-primary">
                {focus
                  ? `${focus.pct.toFixed(0)}%`
                  : formatCompactUsd(slices.reduce((sum, slice) => sum + slice.valueUsd, 0))}
              </span>
              <span className="text-[11px] text-muted-foreground">{focus ? focus.name : "Total"}</span>
            </div>
          </div>
          <ul className="divide-y divide-border/50">
            {visible.map((slice) => {
              const active = slice.id === selectedId;
              return (
                <li key={slice.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onMouseEnter={() => setHoverId(slice.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => onSelect(active ? null : slice)}
                    className={cn(
                      "flex w-full items-center gap-3 py-2.5 text-left active:translate-y-px",
                      active && "bg-muted/40",
                    )}
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{slice.name}</span>
                    <span className="font-numeric text-sm">{formatCompactUsd(slice.valueUsd)}</span>
                    <span className="w-12 text-right font-numeric text-sm text-muted-foreground">
                      {slice.pct.toFixed(1)}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectionBlock>
  );
}

function PerformanceChart({
  clientId,
  rows,
  range,
  onRangeChange,
  mode,
  onModeChange,
  hasDates,
  historyCount,
}: {
  clientId: string;
  rows: ChartRow[];
  range: RangeId;
  onRangeChange: (range: RangeId) => void;
  mode: ChartMode;
  onModeChange: (mode: ChartMode) => void;
  hasDates: boolean;
  historyCount: number;
}) {
  const chartConfig = {
    value: { label: "Portfolio value", color: "#202356" },
    returnPct: { label: "Return", color: "#202356" },
    flow: { label: "Cash flow", color: "#b2936b" },
  } satisfies ChartConfig;
  const windowGain =
    rows.length >= 2 ? rows[rows.length - 1].value - rows[0].value - rows.reduce((sum, row) => sum + row.flow, 0) : null;
  const windowReturn = rows.length >= 2 ? rows[rows.length - 1].returnPct : null;
  const netFlow = rows.reduce((sum, row) => sum + row.flow, 0);

  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Muted className="text-xs">
            {mode === "value" && "Portfolio value"}
            {mode === "return" && "Investment return"}
            {mode === "flows" && "Contributions and withdrawals"}
          </Muted>
          <p className={cn("font-numeric text-xl font-semibold text-brand-primary", mode !== "value" && toneClass(mode === "return" ? windowReturn : netFlow))}>
            {mode === "value" && (rows.length > 0 ? formatCompactUsd(rows[rows.length - 1].value) : "n/a")}
            {mode === "return" && (windowGain == null ? "n/a" : `${formatCompactUsd(windowGain, true)} · ${signedPct(windowReturn)}`)}
            {mode === "flows" && formatCompactUsd(netFlow, true)}
          </p>
          <Muted className="mt-0.5 text-xs">
            {mode === "return"
              ? hasDates
                ? "Excludes contributions and withdrawals in this window."
                : "This history has no dates, so cash flows could not be removed."
              : mode === "flows"
                ? "Bars are cash flow. The line is portfolio value, which includes those flows."
                : "Value includes contributions and withdrawals. Use Return to see investment performance."}
          </Muted>
        </div>
        <Segmented
          label="Chart series"
          value={mode}
          onChange={onModeChange}
          options={[
            { id: "value", label: "Portfolio value" },
            { id: "return", label: "Return" },
            { id: "flows", label: "Contributions & withdrawals" },
          ]}
        />
      </div>

      {rows.length < 2 ? (
        <Muted className="py-10 text-sm">
          {historyCount < 2
            ? "Portfolio trends appear once two statement periods are saved."
            : "Not enough statement history in this window."}
        </Muted>
      ) : (
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`perf-${clientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#202356" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#202356" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
            <YAxis
              yAxisId="main"
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value) =>
                mode === "return" ? `${Number(value).toFixed(0)}%` : formatChartCompactUsd(Number(value))
              }
            />
            {mode === "flows" ? (
              <YAxis
                yAxisId="flow"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(value) => formatChartCompactUsd(Number(value))}
              />
            ) : null}
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const amount = Number(value);
                    if (name === "returnPct" || name === "Return") return `${amount.toFixed(1)}%`;
                    return formatChartUsd(amount);
                  }}
                />
              }
            />
            {mode === "flows" ? (
              <Bar yAxisId="flow" dataKey="flow" radius={[2, 2, 0, 0]} maxBarSize={18}>
                {rows.map((row, index) => (
                  <Cell key={`${row.month}-${index}`} fill={row.flow >= 0 ? "#829850" : "#c45c57"} />
                ))}
              </Bar>
            ) : null}
            {mode === "return" ? (
              <Line
                yAxisId="main"
                type="monotone"
                dataKey="returnPct"
                stroke="var(--color-returnPct)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-returnPct)", strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ) : (
              <Area
                yAxisId="main"
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                fill={mode === "value" ? `url(#perf-${clientId})` : "transparent"}
                dot={{ r: 3, fill: "var(--color-value)", strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
          </ComposedChart>
        </ChartContainer>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-1">
        {RANGES.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={item === range}
            onClick={() => onRangeChange(item)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium active:translate-y-px",
              item === range
                ? "bg-brand-primary text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PortfolioOverview({
  clientId,
  portfolio,
  snapshots,
  latestPeriod,
  onRefresh,
}: {
  clientId: string;
  portfolio: JaPortfolioSummary | null;
  snapshots: PortfolioSnapshot[];
  latestPeriod: StatementPeriod | null;
  onRefresh?: () => void;
}) {
  const statementHref = `/advisors/dashboard/clients/${clientId}/statement`;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusBuckets, setFocusBuckets] = useState<PortfolioBucket[] | null>(null);
  const [focusLabel, setFocusLabel] = useState<string | null>(null);
  const [range, setRange] = useState<RangeId>("All");
  const [chartMode, setChartMode] = useState<ChartMode>("value");
  const [holdingOpen, setHoldingOpen] = useState(false);
  const [holdingFormKey, setHoldingFormKey] = useState(0);
  const [valuesOpen, setValuesOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [transactions, setTransactions] = useState<WealthTransaction[]>([]);
  const [assetRefresh, setAssetRefresh] = useState(0);
  const [assetState, setAssetState] = useState<{
    clientId: string;
    refresh: number;
    assets: TrackedAsset[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/transactions`)
      .then((res) => res.json())
      .then((data) => setTransactions(data.transactions ?? []))
      .catch(() => undefined);
  }, [clientId]);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = assetRefresh;
    fetch(`/api/portfolio/assets?clientId=${encodeURIComponent(clientId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load holdings");
        setAssetState({
          clientId,
          refresh,
          assets: (data.assets ?? []) as TrackedAsset[],
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAssetState({
          clientId,
          refresh,
          assets: [],
          error: err instanceof Error ? err.message : "Could not load holdings",
        });
      });
    return () => controller.abort();
  }, [clientId, assetRefresh]);

  const slices = useMemo(() => buildPortfolioSlices(portfolio, snapshots), [portfolio, snapshots]);
  const breakdown = useMemo(() => buildBreakdown(slices, snapshots), [slices, snapshots]);
  const total = portfolio?.totalUSD ?? slices.reduce((sum, slice) => sum + slice.valueUsd, 0);
  const history = portfolio?.history ?? [];
  const periodPerf = useMemo(
    () => statementPerformance(portfolio, latestPeriod, transactions),
    [portfolio, latestPeriod, transactions],
  );
  const ytdPerf = useMemo(
    () => rangePerformance(history, transactions, "YTD"),
    [history, transactions],
  );
  const chartRows = useMemo(
    () => buildChartRows(history, transactions, range),
    [history, transactions, range],
  );
  const assetsReady =
    assetState != null && assetState.clientId === clientId && assetState.refresh === assetRefresh;
  const assets = assetsReady ? assetState.assets : [];
  const assetsLoading = !assetsReady;
  const assetsError = assetsReady ? assetState.error : null;
  const visibleAssets = focusBuckets
    ? assets.filter((asset) => focusBuckets.includes(asset.bucket))
    : assets;
  const sortedVisibleAssets = useMemo(
    () => [...visibleAssets].sort((a, b) => b.marketValueUsd - a.marketValueUsd),
    [visibleAssets],
  );
  const valuePage = usePagedRows(breakdown, { resetKey: String(breakdown.length) });
  const assetPage = usePagedRows(sortedVisibleAssets, { resetKey: focusLabel ?? "all" });
  const statementDate = latestPeriod ? formatStatementDate(latestPeriod.period_end) : null;
  const lastUpdated =
    history.filter((point) => point.recordedOn).at(-1)?.recordedOn ?? latestPeriod?.period_end ?? null;
  const activity = [...transactions].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const visibleActivity = activityExpanded ? activity : activity.slice(0, 5);
  const returnsAdjusted = Boolean(periodPerf?.adjusted || ytdPerf?.adjusted);
  // The statement's YTD figure is the one on the Overview and in the PDF, so it wins here too.
  // A YTD worked out from history without dated cash flows counts deposits as growth.
  const ytdPct = portfolio?.ytdPct ?? ytdPerf?.pct ?? null;
  const ytdGain = ytdPerf?.adjusted ? ytdPerf.gain : null;

  function focusSlice(slice: AllocSlice | null) {
    if (!slice) {
      setSelectedId(null);
      setFocusBuckets(null);
      setFocusLabel(null);
      return;
    }
    setSelectedId(slice.id);
    setFocusBuckets(slice.buckets.length > 0 ? slice.buckets : null);
    setFocusLabel(slice.name);
    document.getElementById("tracked-investments")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openAddHolding() {
    setHoldingFormKey((value) => value + 1);
    setHoldingOpen(true);
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={advisorSurface.pageTitle}>Portfolio</h2>
          <Muted className="mt-1 text-[13px]">
            {latestPeriod
              ? `${latestPeriod.label} · ${formatStatementDate(latestPeriod.period_start)} to ${formatStatementDate(latestPeriod.period_end)}`
              : "No statement period yet"}
          </Muted>
          <Muted className="text-[13px]">
            {lastUpdated ? `Last updated ${formatStatementDate(lastUpdated)}` : "Not updated yet"}
          </Muted>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={statementHref} className="text-sm font-medium text-brand-primary hover:underline">
            Statement data
          </Link>
          <Button type="button" variant="outline" size="sm" onClick={() => setValuesOpen(true)}>
            Edit statement values
          </Button>
        </div>
      </header>

      <section>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,1fr)] lg:items-end">
          <div>
            <Muted className="text-xs">Total portfolio value</Muted>
            <Numeric className="mt-1 block text-[2.75rem] text-brand-primary sm:text-5xl">
              {formatCompactUsd(total)}
            </Numeric>
            {periodPerf ? (
              <p className={cn("mt-2 font-numeric text-sm font-medium", toneClass(periodPerf.gain))}>
                {formatCompactUsd(periodPerf.gain, true)}
                <span className="mx-1.5 text-muted-foreground">·</span>
                {signedPct(periodPerf.pct)} this period
              </p>
            ) : (
              <Muted className="mt-2 text-sm">Add a statement period to show performance.</Muted>
            )}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <PerfStat label="Period return" gain={periodPerf?.gain ?? null} pct={periodPerf?.pct ?? null} />
            <PerfStat
              label="YTD return"
              gain={ytdGain}
              pct={ytdPct}
            />
          </div>
        </div>
        <Muted className="mt-3 max-w-2xl text-xs">
          {returnsAdjusted
            ? "Returns exclude contributions and withdrawals. Those cash flows are in the chart and the timeline below."
            : "Returns follow the statement change in value. Cash flows are listed separately once they are recorded."}
        </Muted>

        <PerformanceChart
          clientId={clientId}
          rows={chartRows}
          range={range}
          onRangeChange={setRange}
          mode={chartMode}
          onModeChange={setChartMode}
          hasDates={history.some((point) => point.recordedOn)}
          historyCount={history.length}
        />
      </section>

      <AllocationPanel slices={slices} selectedId={selectedId} onSelect={focusSlice} />

      {breakdown.length > 0 ? (
        <SectionBlock
          title="Portfolio values"
          description={
            statementDate
              ? `Statement value as of ${statementDate}. Select a portfolio to see its investments.`
              : "Select a portfolio to see its investments."
          }
        >
          <div>
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead><ColumnLabel>Portfolio</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">Value</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">Return</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">Change</ColumnLabel></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuePage.rows.map((row) => {
                  const active = row.id === selectedId;
                  return (
                    <TableRow key={row.id} data-state={active ? "selected" : undefined}>
                      <TableCell>
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left active:translate-y-px"
                          onClick={() => focusSlice(active ? null : row)}
                        >
                          <CategoryPill tone={sliceTone(row.id)}>{row.name}</CategoryPill>
                        </button>
                      </TableCell>
                      <TableCell className="text-right font-numeric font-medium">
                        {formatCompactUsd(row.valueUsd)}
                      </TableCell>
                      <TableCell className={cn("text-right font-numeric", toneClass(row.periodPct))}>
                        {signedPct(row.periodPct)}
                      </TableCell>
                      <TableCell className={cn("text-right font-numeric", toneClass(row.changeUsd))}>
                        {row.changeUsd == null ? "n/a" : formatCompactUsd(row.changeUsd, true)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TableFooterBar
              total={valuePage.total}
              page={valuePage.page}
              pageCount={valuePage.pageCount}
              pageSize={valuePage.pageSize}
              onPageChange={valuePage.setPage}
              onPageSizeChange={valuePage.setPageSize}
            />
          </div>
        </SectionBlock>
      ) : null}

      <SectionBlock
        id="tracked-investments"
        title="Tracked investments"
        description={
          focusLabel
            ? `Showing investments in ${focusLabel}.`
            : "Listed securities priced from the market. Other holdings stay on the statement."
        }
        action={
          <Button type="button" size="sm" onClick={openAddHolding}>
            <Plus className="size-4" />
            Add investment
          </Button>
        }
      >
        {focusLabel ? (
          <button
            type="button"
            onClick={() => focusSlice(null)}
            className="mb-3 text-xs font-medium text-brand-primary hover:underline"
          >
            Show all portfolios
          </button>
        ) : null}
        {assetsLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : assetsError ? (
          <Muted>{assetsError}</Muted>
        ) : assets.length === 0 ? (
          <div className="py-2">
            <TextSmall className="font-medium">No tracked investments yet</TextSmall>
            <Muted className="mt-1 max-w-md text-sm">
              Add a listed security to follow its market price. Property, private funds, and cash stay as statement values.
            </Muted>
          </div>
        ) : visibleAssets.length === 0 ? (
          <Muted className="text-sm">
            No market-priced investments in {focusLabel}. This portfolio&apos;s value is the statement total.
          </Muted>
        ) : (
          <div>
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead><ColumnLabel>Asset</ColumnLabel></TableHead>
                  <TableHead><ColumnLabel>Ticker</ColumnLabel></TableHead>
                  <TableHead><ColumnLabel>Portfolio</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">Quantity</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">Current value</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">Cost basis</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">Gain / loss</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">Return</ColumnLabel></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetPage.rows.map((asset) => {
                  const gain =
                    asset.costBasisUsd > 0 ? asset.marketValueUsd - asset.costBasisUsd : null;
                  const source = valuationFor(asset, statementDate);
                  return (
                    <TableRow key={asset.id} className="align-top">
                      <TableCell className="whitespace-normal">
                        <span className="font-medium">{asset.name}</span>
                        <ValuationSource kind={source.kind} updated={source.updated} />
                      </TableCell>
                      <TableCell>
                        <CategoryPill tone="sky">{asset.ticker}</CategoryPill>
                      </TableCell>
                      <TableCell>
                        <CategoryPill tone={bucketPillTone(asset.bucket)}>
                          {bucketPillLabel(asset.bucket)}
                        </CategoryPill>
                      </TableCell>
                      <TableCell className="text-right font-numeric">{quantityLabel(asset)}</TableCell>
                      <TableCell className="text-right font-numeric font-medium">
                        {formatUsd(asset.marketValueUsd)}
                      </TableCell>
                      <TableCell className="text-right font-numeric text-muted-foreground">
                        {asset.costBasisUsd > 0 ? formatUsd(asset.costBasisUsd) : "n/a"}
                      </TableCell>
                      <TableCell className={cn("text-right font-numeric", toneClass(gain))}>
                        {gain == null ? "n/a" : formatCompactUsd(gain, true)}
                      </TableCell>
                      <TableCell className={cn("text-right font-numeric", toneClass(gainPct(asset)))}>
                        {signedPct(gainPct(asset))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TableFooterBar
              total={assetPage.total}
              page={assetPage.page}
              pageCount={assetPage.pageCount}
              pageSize={assetPage.pageSize}
              onPageChange={assetPage.setPage}
              onPageSizeChange={assetPage.setPageSize}
            />
          </div>
        )}
      </SectionBlock>

      <SectionBlock
        title="Contributions & withdrawals"
        description="Cash moving into and out of the portfolio. This is not investment performance."
        action={
          activity.length > 5 && !activityExpanded ? (
            <button
              type="button"
              onClick={() => setActivityExpanded(true)}
              className="text-sm font-medium text-brand-primary hover:underline"
            >
              View all
            </button>
          ) : (
            <Link href={statementHref} className="text-sm font-medium text-brand-primary hover:underline">
              Edit in statement data
            </Link>
          )
        }
      >
        {visibleActivity.length === 0 ? (
          <Muted className="text-sm">No contributions or withdrawals recorded yet.</Muted>
        ) : (
          <ol className="relative">
            {visibleActivity.map((tx) => {
              const meta = activityMeta(tx);
              return (
                <li key={tx.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border-b border-border/50 py-3 last:border-0">
                  <span
                    className={cn(
                      "mt-1.5 size-2 rounded-full",
                      meta.tone === "in" && "bg-emerald-600",
                      meta.tone === "out" && "bg-destructive/80",
                      meta.tone === "neutral" && "bg-[#b2936b]",
                    )}
                  />
                  <span className="min-w-0">
                    <TextSmall className="font-medium">{tx.description}</TextSmall>
                    <Muted className="text-xs">
                      {formatStatementDate(tx.occurred_on)}
                      {" · "}
                      {meta.label}
                      {tx.bucket ? ` · ${SHORT_BUCKET[tx.bucket]}` : ""}
                    </Muted>
                  </span>
                  <span className={cn("font-numeric text-sm font-medium", toneClass(tx.amount_usd))}>
                    {formatCompactUsd(tx.amount_usd, true)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </SectionBlock>

      <Sheet open={holdingOpen} onOpenChange={setHoldingOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-border/60">
            <SheetTitle>Add investment</SheetTitle>
            <SheetDescription>
              Search for a listed security. Current value follows the market price.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {holdingOpen ? (
              <TrackAssetPanel
                key={holdingFormKey}
                clientId={clientId}
                embedded
                onSaved={(result) => {
                  setAssetRefresh((value) => value + 1);
                  if (!result?.warning) setHoldingOpen(false);
                  onRefresh?.();
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={valuesOpen} onOpenChange={setValuesOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="border-b border-border/60">
            <SheetTitle>Edit statement values</SheetTitle>
            <SheetDescription>
              For property, private funds, cash, and anything without a market price. The reason is written to the audit trail.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <button
              type="button"
              className="mb-4 text-sm font-medium text-brand-primary hover:underline"
              onClick={() => setAuditOpen(true)}
            >
              View audit history
            </button>
            {valuesOpen ? (
              <PortfolioQuickUpdate
                clientId={clientId}
                snapshots={snapshots}
                periodEnd={latestPeriod?.period_end}
                embedded
                onSaved={() => {
                  setValuesOpen(false);
                  onRefresh?.();
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={auditOpen} onOpenChange={setAuditOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-border/60">
            <SheetTitle>Audit history</SheetTitle>
            <SheetDescription>Recorded portfolio updates for this client.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {auditOpen ? <ComplianceAuditPanel clientId={clientId} /> : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
