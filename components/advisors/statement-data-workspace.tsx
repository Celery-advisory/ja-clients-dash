"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  TrendingUp,
} from "lucide-react";

import { PortfolioHoldingsEditor } from "@/components/advisors/portfolio-holdings-editor";
import { GenerateReportButton } from "@/components/reports/generate-report-button";
import { Button } from "@/components/ui/button";
import {
  BUCKET_DOT,
  BUCKET_SHORT,
  FigureField,
  figureTone,
  figureToneClass,
  moneyDisplay,
  pctDisplay,
} from "@/components/advisors/statement-figures";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ColumnLabel,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableFooterBar,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Muted } from "@/components/ui/typography";
import {
  ALL_BUCKETS,
  BUCKET_LABELS,
  formatCompactUsd,
  formatUsd,
  TRANSACTION_TYPE_LABELS,
} from "@/lib/wealth/constants";
import {
  MONTH_SHORT,
  periodCoveringMonth,
  quarterOfMonth,
  yearFromPeriodEnd,
} from "@/lib/wealth/period-calendar";
import type {
  PortfolioBucket,
  PortfolioHolding,
  PortfolioSnapshot,
  StatementPeriod,
  TransactionType,
  WealthTransaction,
} from "@/lib/wealth/types";
import { cn } from "@/lib/utils";


function formatStatementDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type DraftSnapshot = {
  bucket: PortfolioBucket;
  previous_value_usd: string;
  current_value_usd: string;
  period_change_pct: string;
  ytd_pct: string;
  inception_gain_usd: string;
  inception_pct: string;
  annualized_return_pct: string;
};

function toDraft(snapshots: PortfolioSnapshot[]): DraftSnapshot[] {
  const map = new Map(snapshots.map((s) => [s.bucket, s]));
  return ALL_BUCKETS.map((bucket) => {
    const s = map.get(bucket);
    return {
      bucket,
      previous_value_usd: String(s?.previous_value_usd ?? 0),
      current_value_usd: String(s?.current_value_usd ?? 0),
      period_change_pct: s?.period_change_pct == null ? "" : String(s.period_change_pct),
      ytd_pct: s?.ytd_pct == null ? "" : String(s.ytd_pct),
      inception_gain_usd: s?.inception_gain_usd == null ? "" : String(s.inception_gain_usd),
      inception_pct: s?.inception_pct == null ? "" : String(s.inception_pct),
      annualized_return_pct:
        s?.annualized_return_pct == null ? "" : String(s.annualized_return_pct),
    };
  });
}

function num(value: string) {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sumField(rows: DraftSnapshot[], key: "previous_value_usd" | "current_value_usd") {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

const QUARTERS = [
  { quarter: 1 as const, months: [0, 1, 2] },
  { quarter: 2 as const, months: [3, 4, 5] },
  { quarter: 3 as const, months: [6, 7, 8] },
  { quarter: 4 as const, months: [9, 10, 11] },
];

function monthIndexFromPeriod(period: StatementPeriod | null): number | null {
  if (!period) return null;
  const month = Number(period.period_end.slice(5, 7)) - 1;
  return Number.isFinite(month) && month >= 0 && month <= 11 ? month : null;
}

function formatDayMonth(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function txDirection(type: TransactionType, amount: number): {
  label: string;
  text: string;
  className: string;
  Icon: typeof ArrowUp;
} {
  const abs = formatUsd(Math.abs(amount));
  if (type === "deposit") {
    return { label: TRANSACTION_TYPE_LABELS[type], text: `+${abs}`, className: "text-emerald-800", Icon: ArrowUp };
  }
  if (type === "drawdown") {
    return { label: TRANSACTION_TYPE_LABELS[type], text: `-${abs}`, className: "text-red-700", Icon: ArrowDown };
  }
  if (type === "fee") {
    return { label: TRANSACTION_TYPE_LABELS[type], text: `-${abs}`, className: "text-amber-800", Icon: ArrowDown };
  }
  return {
    label: TRANSACTION_TYPE_LABELS[type],
    text: abs,
    className: "text-foreground",
    Icon: ArrowLeftRight,
  };
}

export function StatementDataWorkspace({
  clientId,
  clientName,
  periods,
  initialPeriodId,
  initialSnapshots,
  initialHoldings = [],
  onChanged,
}: {
  clientId: string;
  clientName: string;
  periods: StatementPeriod[];
  initialPeriodId: string | null;
  initialSnapshots: PortfolioSnapshot[];
  initialHoldings?: PortfolioHolding[];
  onChanged: (keepPeriodId?: string) => void;
}) {
  const [periodId, setPeriodId] = useState(initialPeriodId ?? periods[0]?.id ?? "");
  const [draft, setDraft] = useState<DraftSnapshot[]>(toDraft(initialSnapshots));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Off by default: clients hear about new figures when their report is published, after review.
  const [notify, setNotify] = useState(false);
  const [creatingMonth, setCreatingMonth] = useState<string | null>(null);
  const [tx, setTx] = useState({
    occurredOn: "",
    amountUsd: "",
    description: "",
    bucket: "income" as PortfolioBucket,
    transactionType: "drawdown" as TransactionType,
  });
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(15);
  const [txTotal, setTxTotal] = useState(0);
  const [txRows, setTxRows] = useState<WealthTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [showTxForm, setShowTxForm] = useState(false);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(initialHoldings);

  const selectedPeriod = periods.find((period) => period.id === periodId) ?? null;
  const txPageCount = Math.max(1, Math.ceil(txTotal / txPageSize));
  const [viewYear, setViewYear] = useState(() => yearFromPeriodEnd(selectedPeriod));
  const [viewQuarter, setViewQuarter] = useState<1 | 2 | 3 | 4>(() => {
    const month = monthIndexFromPeriod(selectedPeriod);
    return month == null ? quarterOfMonth(new Date().getMonth()) : quarterOfMonth(month);
  });
  const lastPeriodId = useRef(periodId);

  useEffect(() => {
    if (!periodId && initialPeriodId) {
      setPeriodId(initialPeriodId);
    }
  }, [initialPeriodId, periodId]);

  useEffect(() => {
    if (!periodId || initialPeriodId === periodId) {
      setDraft(toDraft(initialSnapshots));
      setHoldings(initialHoldings);
    }
  }, [initialSnapshots, initialHoldings, initialPeriodId, periodId]);

  useEffect(() => {
    if (lastPeriodId.current === periodId) return;
    lastPeriodId.current = periodId;
    const period = periods.find((p) => p.id === periodId);
    if (period) {
      setViewYear(yearFromPeriodEnd(period));
      const month = monthIndexFromPeriod(period);
      if (month != null) setViewQuarter(quarterOfMonth(month));
    }
  }, [periodId, periods]);

  const loadTransactions = useCallback(
    async (page = 1) => {
      if (!periodId) {
        setTxRows([]);
        setTxTotal(0);
        setTxPage(1);
        return;
      }

      setTxLoading(true);
      try {
        const params = new URLSearchParams({
          periodId,
          page: String(page),
          limit: String(txPageSize),
        });
        const res = await fetch(`/api/clients/${clientId}/transactions?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load transactions");
        setTxRows(data.transactions ?? []);
        setTxTotal(data.total ?? 0);
        setTxPage(data.page ?? page);
      } catch {
        setTxRows([]);
        setTxTotal(0);
      } finally {
        setTxLoading(false);
      }
    },
    [clientId, periodId, txPageSize],
  );

  useEffect(() => {
    loadTransactions(1);
  }, [loadTransactions]);

  const totals = useMemo(() => {
    const previous = sumField(draft, "previous_value_usd");
    const current = sumField(draft, "current_value_usd");
    const gain = current - previous;
    const periodPct = previous > 0 ? (gain / previous) * 100 : 0;
    return { previous, current, gain, periodPct };
  }, [draft]);

  async function loadPeriod(nextId: string) {
    setPeriodId(nextId);
    setTxPage(1);
    const res = await fetch(`/api/clients/${clientId}/portfolio?periodId=${nextId}`);
    const data = await res.json();
    setDraft(toDraft(data.snapshots ?? []));
    setHoldings(data.holdings ?? []);
  }

  async function saveStatementData() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/portfolio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId,
          notifyClient: notify,
          snapshots: draft.map((row) => ({
            bucket: row.bucket,
            previous_value_usd: Number(row.previous_value_usd || 0),
            current_value_usd: Number(row.current_value_usd || 0),
            period_change_pct: num(row.period_change_pct),
            ytd_pct: num(row.ytd_pct),
            inception_gain_usd: num(row.inception_gain_usd),
            inception_pct: num(row.inception_pct),
            annualized_return_pct: num(row.annualized_return_pct),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage("Statement data saved.");
      onChanged(periodId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addTransaction(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch(`/api/clients/${clientId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...tx,
        amountUsd: Number(tx.amountUsd),
        notifyClient: notify,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Could not add transaction");
      return;
    }
    setTx({ ...tx, amountUsd: "", description: "" });
    setMessage("Transaction recorded.");
    await loadTransactions(txPage);
    onChanged(periodId);
  }

  async function selectOrCreateMonth(year: number, monthIndex0: number) {
    const existing = periodCoveringMonth(periods, year, monthIndex0);
    if (existing) {
      if (existing.id !== periodId) await loadPeriod(existing.id);
      return;
    }

    const key = `${year}-${monthIndex0}`;
    setCreatingMonth(key);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/periods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month: monthIndex0 + 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open this month");
      setMessage(`Opened ${data.period?.label ?? "month"} for data entry.`);
      if (data.period?.id) {
        onChanged(data.period.id);
        await loadPeriod(data.period.id);
      } else {
        onChanged();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open this month");
    } finally {
      setCreatingMonth(null);
    }
  }

  const holdingsMarket = holdings.reduce((sum, row) => sum + Number(row.market_value_usd || 0), 0);
  const portfolioHref = `/advisors/dashboard/clients/${clientId}?tab=Portfolio`;
  const openMonth = monthIndexFromPeriod(selectedPeriod);
  const openQuarter = openMonth == null ? null : quarterOfMonth(openMonth);
  const visibleMonths = QUARTERS.find((item) => item.quarter === viewQuarter)?.months ?? [0, 1, 2];
  const periodTitle = selectedPeriod
    ? `Q${openQuarter} ${yearFromPeriodEnd(selectedPeriod)}`
    : "Select a month";
  const periodRange = selectedPeriod
    ? `${formatDayMonth(selectedPeriod.period_start)} to ${formatDayMonth(selectedPeriod.period_end)}`
    : null;

  return (
    <div className="flex flex-col gap-8 pb-28">
      <h2 className="sr-only">Statement for {clientName}</h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-primary uppercase">
            Statement
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-brand-primary">
            {periodTitle}
          </p>
          {periodRange ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{periodRange}</p>
          ) : null}
          <Muted className="mt-1.5 max-w-xl">
            Enter values for one month at a time. Quarterly and annual PDFs roll those months up.
          </Muted>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={portfolioHref}>
            <Button variant="outline" size="sm">
              <TrendingUp className="size-4" />
              View trends
            </Button>
          </Link>
          <GenerateReportButton
            clientId={clientId}
            periodId={periodId || undefined}
            buttonVariant="outline"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Previous year"
              onClick={() => setViewYear((year) => year - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-14 text-center font-heading text-lg font-semibold tracking-tight text-brand-primary">
              {viewYear}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Next year"
              onClick={() => setViewYear((year) => year + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1" role="tablist" aria-label="Quarter">
            {QUARTERS.map((item) => {
              const active = item.quarter === viewQuarter;
              return (
                <button
                  key={item.quarter}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setViewQuarter(item.quarter)}
                  className={cn(
                    "h-8 rounded-md px-3 text-sm transition-colors",
                    active
                      ? "bg-brand-primary/10 font-semibold text-brand-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Q{item.quarter}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Month">
          {visibleMonths.map((monthIndex) => {
            const name = MONTH_SHORT[monthIndex];
            const covering = periodCoveringMonth(periods, viewYear, monthIndex);
            const selected = covering?.id === periodId;
            const hasData = Boolean(covering);
            const creating = creatingMonth === `${viewYear}-${monthIndex}`;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={creatingMonth !== null}
                onClick={() => selectOrCreateMonth(viewYear, monthIndex)}
                className={cn(
                  "flex h-8 min-w-14 items-center justify-center rounded-md px-3 text-sm transition-colors duration-150",
                  selected && "bg-brand-primary font-medium text-white",
                  !selected && hasData && "text-foreground hover:bg-muted",
                  !selected && !hasData && "text-muted-foreground hover:bg-muted/70",
                  creatingMonth !== null && "opacity-70",
                )}
              >
                {creating ? <Loader2 className="size-3.5 animate-spin" /> : name}
              </button>
            );
          })}
        </div>
        <Muted>
          {selectedPeriod
            ? `Entering ${selectedPeriod.label}. A filled month already has values. An empty month starts a new one.`
            : "Pick a month to enter values. New months copy the latest figures so you can edit from there."}
        </Muted>
      </div>

      {message ? <Muted>{message}</Muted> : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border/70 bg-card px-4 py-4">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Current NAV
          </p>
          <p className="mt-2 font-numeric text-2xl font-semibold tracking-tight text-brand-primary">
            {formatCompactUsd(totals.current)}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>Previous {formatCompactUsd(totals.previous)}</span>
            <span className={cn("font-numeric", figureToneClass(figureTone(totals.periodPct)))}>
              {totals.periodPct > 0 ? "+" : ""}
              {totals.periodPct.toFixed(1)}%
            </span>
          </p>
        </article>
        <article className="rounded-xl border border-border/70 bg-card px-4 py-4">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Period gain
          </p>
          <p className={cn("mt-2 font-numeric text-2xl font-semibold tracking-tight", figureToneClass(figureTone(totals.gain)))}>
            {formatCompactUsd(totals.gain, true)}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">vs previous period</p>
        </article>
        <article className="rounded-xl border border-border/70 bg-card px-4 py-4">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Return
          </p>
          <p className={cn("mt-2 font-numeric text-2xl font-semibold tracking-tight", figureToneClass(figureTone(totals.periodPct)))}>
            {totals.periodPct > 0 ? "+" : ""}
            {totals.periodPct.toFixed(1)}%
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">{periodTitle}</p>
        </article>
        <article className="rounded-xl border border-border/70 bg-card px-4 py-4">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Holdings
          </p>
          <p className="mt-2 font-numeric text-2xl font-semibold tracking-tight text-brand-primary">
            {holdings.length}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {formatCompactUsd(holdingsMarket)} market value
          </p>
        </article>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-semibold tracking-[0.16em] text-brand-primary uppercase">
              Bucket values
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Portfolio performance by allocation bucket
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{ALL_BUCKETS.length} buckets</span>
            {ALL_BUCKETS.map((bucket) => (
              <span key={bucket} className="inline-flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", BUCKET_DOT[bucket])} aria-hidden />
                {BUCKET_SHORT[bucket]}
              </span>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead><ColumnLabel>Bucket</ColumnLabel></TableHead>
                <TableHead className="text-right"><ColumnLabel align="right">Previous</ColumnLabel></TableHead>
                <TableHead className="text-right"><ColumnLabel align="right">Current</ColumnLabel></TableHead>
                <TableHead className="text-right"><ColumnLabel align="right">Period %</ColumnLabel></TableHead>
                <TableHead className="text-right"><ColumnLabel align="right">YTD %</ColumnLabel></TableHead>
                <TableHead className="text-right"><ColumnLabel align="right">Inception gain</ColumnLabel></TableHead>
                <TableHead className="text-right"><ColumnLabel align="right">Inception %</ColumnLabel></TableHead>
                <TableHead className="text-right"><ColumnLabel align="right">Annualised %</ColumnLabel></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.map((row, index) => {
                const previous = Number(row.previous_value_usd || 0);
                const current = Number(row.current_value_usd || 0);
                const change = current - previous;
                const previousMoney = moneyDisplay(row.previous_value_usd);
                const currentMoney = moneyDisplay(row.current_value_usd);
                const period = pctDisplay(row.period_change_pct);
                const ytd = pctDisplay(row.ytd_pct);
                const inceptionGain = moneyDisplay(row.inception_gain_usd, true);
                const inceptionPct = pctDisplay(row.inception_pct);
                const annualised = pctDisplay(row.annualized_return_pct);
                const patch = (
                  key:
                    | "previous_value_usd"
                    | "current_value_usd"
                    | "period_change_pct"
                    | "ytd_pct"
                    | "inception_gain_usd"
                    | "inception_pct"
                    | "annualized_return_pct",
                  value: string,
                ) => {
                  setDraft((rows) =>
                    rows.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, [key]: value } : item,
                    ),
                  );
                };
                return (
                  <TableRow key={row.bucket}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className={cn("size-1.5 rounded-full", BUCKET_DOT[row.bucket])} aria-hidden />
                        {BUCKET_SHORT[row.bucket]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <FigureField
                        ariaLabel={`${BUCKET_SHORT[row.bucket]} previous value`}
                        value={row.previous_value_usd}
                        display={previousMoney.text}
                        onChange={(value) => patch("previous_value_usd", value)}
                      />
                    </TableCell>
                    <TableCell>
                      <FigureField
                        ariaLabel={`${BUCKET_SHORT[row.bucket]} current value`}
                        value={row.current_value_usd}
                        display={currentMoney.text}
                        emphasis="primary"
                        onChange={(value) => patch("current_value_usd", value)}
                      />
                      {previous !== 0 || current !== 0 ? (
                        <p className={cn("px-1 text-right text-xs font-numeric", figureToneClass(figureTone(change)))}>
                          {formatCompactUsd(change, true)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <FigureField
                        ariaLabel={`${BUCKET_SHORT[row.bucket]} period percent`}
                        value={row.period_change_pct}
                        display={period.text}
                        tone={period.tone}
                        onChange={(value) => patch("period_change_pct", value)}
                      />
                    </TableCell>
                    <TableCell>
                      <FigureField
                        ariaLabel={`${BUCKET_SHORT[row.bucket]} year to date percent`}
                        value={row.ytd_pct}
                        display={ytd.text}
                        tone={ytd.tone}
                        onChange={(value) => patch("ytd_pct", value)}
                      />
                    </TableCell>
                    <TableCell>
                      <FigureField
                        ariaLabel={`${BUCKET_SHORT[row.bucket]} inception gain`}
                        value={row.inception_gain_usd}
                        display={inceptionGain.text}
                        tone={inceptionGain.tone}
                        onChange={(value) => patch("inception_gain_usd", value)}
                      />
                    </TableCell>
                    <TableCell>
                      <FigureField
                        ariaLabel={`${BUCKET_SHORT[row.bucket]} inception percent`}
                        value={row.inception_pct}
                        display={inceptionPct.text}
                        tone={inceptionPct.tone}
                        onChange={(value) => patch("inception_pct", value)}
                      />
                    </TableCell>
                    <TableCell>
                      <FigureField
                        ariaLabel={`${BUCKET_SHORT[row.bucket]} annualised percent`}
                        value={row.annualized_return_pct}
                        display={annualised.text}
                        tone={annualised.tone}
                        onChange={(value) => patch("annualized_return_pct", value)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell className="text-right font-numeric text-muted-foreground">
                  {formatCompactUsd(totals.previous)}
                </TableCell>
                <TableCell className="text-right font-numeric font-semibold text-brand-primary">
                  {formatCompactUsd(totals.current)}
                </TableCell>
                <TableCell className={cn("text-right font-numeric", figureToneClass(figureTone(totals.periodPct)))}>
                  {totals.periodPct > 0 ? "+" : ""}
                  {totals.periodPct.toFixed(1)}%
                </TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <Muted>Select a figure to edit it. The period change under current value is calculated from previous and current.</Muted>
      </section>

      <PortfolioHoldingsEditor
        clientId={clientId}
        periodId={periodId || null}
        holdings={holdings}
        onSaved={setHoldings}
        onMessage={setMessage}
      />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-semibold tracking-[0.16em] text-brand-primary uppercase">
              Transactions
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedPeriod
                ? `Activity recorded during ${selectedPeriod.label}`
                : "Select a month to view transactions."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {txTotal} {txTotal === 1 ? "transaction" : "transactions"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTxForm((open) => !open)}
            >
              <Plus className="size-4" />
              Record transaction
              <ChevronDown
                className={cn("size-4 transition-transform", showTxForm && "rotate-180")}
              />
            </Button>
          </div>
        </div>

        {showTxForm ? (
          <form onSubmit={addTransaction} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tx-date">Date</Label>
                  <Input
                    id="tx-date"
                    type="date"
                    required
                    value={tx.occurredOn}
                    onChange={(e) => setTx({ ...tx, occurredOn: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tx-amount">Amount (USD)</Label>
                  <Input
                    id="tx-amount"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={tx.amountUsd}
                    onChange={(e) => setTx({ ...tx, amountUsd: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tx-bucket">Bucket</Label>
                  <Select
                    id="tx-bucket"
                    value={tx.bucket}
                    onChange={(e) => setTx({ ...tx, bucket: e.target.value as PortfolioBucket })}
                  >
                    {ALL_BUCKETS.map((b) => (
                      <option key={b} value={b}>
                        {BUCKET_LABELS[b]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tx-type">Type</Label>
                  <Select
                    id="tx-type"
                    value={tx.transactionType}
                    onChange={(e) =>
                      setTx({ ...tx, transactionType: e.target.value as TransactionType })
                    }
                  >
                    <option value="drawdown">Drawdown</option>
                    <option value="deposit">Deposit</option>
                    <option value="transfer">Transfer</option>
                    <option value="fee">Fee</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tx-desc">Description</Label>
                <Input
                  id="tx-desc"
                  required
                  placeholder="Income Portfolio Drawdown"
                  value={tx.description}
                  onChange={(e) => setTx({ ...tx, description: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  <Plus className="size-4" />
                  Add transaction
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTxForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
        ) : null}

        {!periodId ? (
          <Muted>Pick a month to record and review transactions.</Muted>
        ) : txLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading transactions...
          </div>
        ) : txRows.length === 0 ? (
          <Muted>No transactions recorded for this period yet.</Muted>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead><ColumnLabel>Date</ColumnLabel></TableHead>
                  <TableHead><ColumnLabel>Description</ColumnLabel></TableHead>
                  <TableHead><ColumnLabel>Bucket</ColumnLabel></TableHead>
                  <TableHead><ColumnLabel>Type</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">Amount</ColumnLabel></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txRows.map((item) => {
                  const direction = txDirection(item.transaction_type, item.amount_usd);
                  const DirectionIcon = direction.Icon;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">
                        {formatStatementDate(item.occurred_on)}
                      </TableCell>
                      <TableCell className="max-w-[18rem] whitespace-normal font-medium">
                        {item.description}
                      </TableCell>
                      <TableCell>
                        {item.bucket ? (
                          <span className="inline-flex items-center gap-2">
                            <span className={cn("size-1.5 rounded-full", BUCKET_DOT[item.bucket])} aria-hidden />
                            {BUCKET_SHORT[item.bucket]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase", direction.className)}>
                          <DirectionIcon className="size-3" aria-hidden />
                          {direction.label}
                        </span>
                      </TableCell>
                      <TableCell className={cn("text-right font-numeric font-medium", direction.className)}>
                        {direction.text}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TableFooterBar
              total={txTotal}
              page={txPage}
              pageCount={txPageCount}
              pageSize={txPageSize}
              onPageChange={(next) => loadTransactions(next)}
              onPageSizeChange={setTxPageSize}
            />
          </div>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="size-4 accent-primary"
            />
            Also email the client now (their report is emailed when you publish it)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChanged(periodId)}
              disabled={saving || !periodId}
            >
              Cancel
            </Button>
            <Button onClick={saveStatementData} disabled={saving || !periodId}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save statement data
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
