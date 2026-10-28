"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  ClipboardList,
  FileText,
  Landmark,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

import { ActionRequiredPanel } from "@/components/advisors/action-required-panel";
import {
  AdvisorPageHeader,
  AdvisorSectionHeader,
  MetricCard,
  SurfaceCard,
  advisorPrimaryAction,
  advisorSecondaryAction,
  advisorSurface,
} from "@/components/advisors/advisor-surface";
import { BookAumChart } from "@/components/charts/book-aum-chart";
import { buttonVariants } from "@/components/ui/button";
import {
  CategoryPill,
  ColumnLabel,
  StatusMark,
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
import { H3, Muted, TextSmall } from "@/components/ui/typography";
import { BUCKET_COLORS, formatUsd } from "@/lib/wealth/constants";
import type { PortfolioBucket } from "@/lib/wealth/types";
import type {
  AttentionGroup,
  BookActivityItem,
  BookAllocationSlice,
  BookAumHistoryPoint,
  ClientListExtended,
  WmSession,
} from "@/lib/wealth/wm-types";
import { cn } from "@/lib/utils";


function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatCompactAum(value: number) {
  if (!Number.isFinite(value)) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return formatUsd(value);
}

function formatReturn(pct: number | null) {
  if (pct == null) return "N/A";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function bookStatus(client: ClientListExtended): {
  label: string;
  tone: "healthy" | "attention" | "urgent" | "neutral";
} {
  if (client.status === "review_due") {
    return { label: "Attention", tone: "urgent" };
  }
  if (client.has_open_request) {
    return { label: "Attention", tone: "attention" };
  }
  if (client.status === "active") {
    return { label: "Healthy", tone: "healthy" };
  }
  if (client.status === "onboarding") {
    return { label: "Onboarding", tone: "neutral" };
  }
  return { label: "Inactive", tone: "neutral" };
}

function parseTimestamp(iso: string) {
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const candidate = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(candidate);
  if (!Number.isNaN(date.getTime())) return date;
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function relativeActivity(iso: string | null) {
  if (!iso) return "N/A";
  const date = parseTimestamp(iso);
  if (!date) return "N/A";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startToday.getTime() - startDate.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function sessionWhen(iso: string | null) {
  if (!iso) return "TBD";
  const date = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startDate.getTime() - startToday.getTime()) / 86_400_000,
  );
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (diffDays === 0) return `Today · ${time}`;
  if (diffDays === 1) return `Tomorrow · ${time}`;
  const day = date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${day} · ${time}`;
}

function activityLabel(item: BookActivityItem) {
  const kind = item.kind.toLowerCase();
  if (kind === "portfolio") return "Portfolio updated";
  if (kind === "report") return "Report generated";
  if (kind === "note") return item.title;
  if (kind === "transaction") return "Transaction recorded";
  if (kind === "invite") return "Client invitation sent";
  return item.title;
}

export function AdvisorOverview({
  firstName,
  clients,
  primaryBuckets,
  aumHistory,
  allocation,
  attentionTotal,
  attentionBreakdown,
  attentionGroups,
  upcomingSessions,
  recentActivity,
  ytdPct,
}: {
  firstName: string;
  clients: ClientListExtended[];
  primaryBuckets: Record<string, PortfolioBucket>;
  aumHistory: BookAumHistoryPoint[];
  allocation: BookAllocationSlice[];
  attentionTotal: number;
  attentionBreakdown: string;
  attentionGroups: AttentionGroup[];
  upcomingSessions: WmSession[];
  recentActivity: BookActivityItem[];
  ytdPct: number | null;
}) {
  const hour = new Date().getHours();
  const totalAum = clients.reduce((sum, c) => sum + c.aum, 0);
  const activeCount = clients.filter((c) => c.status === "active").length;
  const sortedClients = [...clients].sort((a, b) => b.aum - a.aum);
  const clientPage = usePagedRows(sortedClients);
  const chartData = aumHistory.map((p) => ({ month: p.month, value: p.value }));
  const firstHistory = aumHistory[0];
  const lastHistory = aumHistory[aumHistory.length - 1];
  // The headline card already shows today's total, so the chart describes the change it plots.
  const aumChangeLabel =
    firstHistory && lastHistory && aumHistory.length > 1 && firstHistory.value > 0
      ? `${lastHistory.value >= firstHistory.value ? "Up" : "Down"} ${formatUsd(
          Math.abs(lastHistory.value - firstHistory.value),
        )} (${formatReturn(((lastHistory.value - firstHistory.value) / firstHistory.value) * 100)}) since ${firstHistory.month}`
      : "Book value by statement month";
  const ytdPositive = ytdPct != null && ytdPct >= 0;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <AdvisorPageHeader
        title={`${greetingForHour(hour)}, ${firstName}`}
        description="Here's what's happening across your book today."
        actions={
          <>
            <Link href="/advisors/dashboard/clients/new" className={advisorPrimaryAction()}>
              <UserPlus className="size-3.5" />
              Add Client
            </Link>
            <Link href="/advisors/dashboard/reports" className={advisorSecondaryAction()}>
              <FileText className="size-3.5" />
              Generate Report
            </Link>
            <Link
              href="/advisors/dashboard/clients"
              className={cn(buttonVariants({ variant: "ghost", size: "xs" }))}
            >
              <Users className="size-3.5" />
              All Clients
            </Link>
          </>
        }
      />

      {/* Book metrics */}
      <section
        aria-label="Book metrics"
        className="grid grid-cols-2 gap-2.5 xl:grid-cols-4"
      >
        <MetricCard
          label="Total AUM"
          value={formatUsd(totalAum)}
          detail={`${clients.length} clients`}
          tone="navy"
          icon={<Landmark className="size-3.5" />}
        />
        <MetricCard
          label="Clients"
          value={String(clients.length)}
          detail={`${activeCount} active`}
          tone="gold"
          icon={<Users className="size-3.5" />}
        />
        <MetricCard
          label="YTD Performance"
          value={ytdPct == null ? "N/A" : formatReturn(ytdPct)}
          detail="Book-weighted return"
          tone="sage"
          icon={<TrendingUp className="size-3.5" />}
          valueClassName={
            ytdPct == null
              ? undefined
              : ytdPositive
                ? "text-emerald-800"
                : "text-destructive"
          }
        />
        <MetricCard
          label="Action Required"
          value={String(attentionTotal)}
          detail={attentionBreakdown || "All clear"}
          tone="warm"
          icon={<AlertTriangle className="size-3.5" />}
        />
      </section>

      {/* Book performance cards */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[1.35fr_1fr]">
        <SurfaceCard>
          <AdvisorSectionHeader
            title="AUM over time"
            subtitle={aumChangeLabel}
            className="mb-2.5"
          />
          <BookAumChart data={chartData} height={250} />
        </SurfaceCard>

        <SurfaceCard>
          <AdvisorSectionHeader
            title="Portfolio allocation"
            subtitle="Five portfolios across the book"
            className="mb-2.5"
          />
          <ul className="flex flex-col divide-y divide-border/70">
            {allocation.map((slice) => (
              <li key={slice.bucket} className="flex items-center gap-3 py-3 first:pt-1">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: BUCKET_COLORS[slice.bucket] }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <TextSmall className="text-[13px] font-medium">{slice.shortLabel}</TextSmall>
                    <span className="font-numeric text-[13px] font-medium tabular-nums">
                      {formatCompactAum(slice.value)}
                      <span className="ml-2 inline-block w-11 text-right text-[12px] font-normal text-muted-foreground">
                        {slice.pct.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(slice.pct > 0 ? 2 : 0, slice.pct))}%`,
                        backgroundColor: BUCKET_COLORS[slice.bucket],
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </section>

      {/* Client book card */}
      <SurfaceCard className="overflow-hidden p-0 sm:p-0">
        <div className="flex flex-col gap-0.5 border-b border-border/60 px-4 py-3.5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <H3 className={advisorSurface.sectionTitle}>
              Client Book
            </H3>
            <Muted className="mt-0.5 text-[12px]">
              A quick view of your clients and their portfolios.
            </Muted>
          </div>
          <Link
            href="/advisors/dashboard/clients"
            className="text-[12px] font-medium text-brand-primary/85 transition-colors hover:text-brand-primary"
          >
            View all clients →
          </Link>
        </div>

        {sortedClients.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Muted>No clients yet. Add your first client to get started.</Muted>
            <div className="mt-3">
              <Link
                href="/advisors/dashboard/clients/new"
                className={cn(buttonVariants({ size: "xs" }))}
              >
                Add Client
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <Table className="min-w-180">
              <TableHeader>
                <TableRow>
                  <TableHead><ColumnLabel>Client</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">AUM</ColumnLabel></TableHead>
                  <TableHead className="text-right"><ColumnLabel align="right">YTD</ColumnLabel></TableHead>
                  <TableHead><ColumnLabel>Portfolio</ColumnLabel></TableHead>
                  <TableHead><ColumnLabel>Status</ColumnLabel></TableHead>
                  <TableHead><ColumnLabel>Last activity</ColumnLabel></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientPage.rows.map((client) => {
                  const status = bookStatus(client);
                  const bucket = primaryBuckets[client.id];
                  const ytd = client.period_return_pct;
                  const href = `/advisors/dashboard/clients/${client.id}`;
                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link href={href} className="font-medium text-foreground">
                          {client.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-numeric tabular-nums">
                        <Link href={href}>{formatCompactAum(client.aum)}</Link>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-numeric tabular-nums",
                          ytd == null
                            ? "text-muted-foreground"
                            : ytd >= 0
                              ? "text-emerald-700"
                              : "text-destructive",
                        )}
                      >
                        <Link href={href}>{formatReturn(ytd)}</Link>
                      </TableCell>
                      <TableCell>
                        <Link href={href}>
                          {bucket ? (
                            <CategoryPill tone={bucketPillTone(bucket)}>
                              {bucketPillLabel(bucket)}
                            </CategoryPill>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={href}>
                          <StatusMark
                            tone={
                              status.tone === "healthy"
                                ? "open"
                                : status.tone === "urgent"
                                  ? "closed"
                                  : status.tone === "attention"
                                    ? "attention"
                                    : "neutral"
                            }
                          >
                            {status.label}
                          </StatusMark>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <Link href={href}>{relativeActivity(client.last_contact_date)}</Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TableFooterBar
              total={clientPage.total}
              page={clientPage.page}
              pageCount={clientPage.pageCount}
              pageSize={clientPage.pageSize}
              onPageChange={clientPage.setPage}
              onPageSizeChange={clientPage.setPageSize}
            />
          </div>
        )}
      </SurfaceCard>

      {/* Bottom cards */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_0.95fr_0.95fr]">
        <SurfaceCard tint="bg-[#fff8f0]">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-[#b2936b]/20 text-[#8a6f45]">
                <ClipboardList className="size-3.5" />
              </span>
              <H3 className={advisorSurface.sectionTitle}>
                Action Required
              </H3>
            </div>
            <span className="rounded-full bg-[#b2936b]/20 px-2 py-0.5 font-numeric text-[12px] font-semibold tabular-nums text-[#8a6f45]">
              {attentionTotal}
            </span>
          </div>
          <Muted className="mb-3 text-[12px]">Grouped by type across your book</Muted>
          <ActionRequiredPanel total={attentionTotal} groups={attentionGroups} />
        </SurfaceCard>

        <SurfaceCard>
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-[#202356]/10 text-brand-primary">
                <Calendar className="size-3.5" />
              </span>
              <H3 className={advisorSurface.sectionTitle}>
                Upcoming Sessions
              </H3>
            </div>
            <Link
              href="/advisors/dashboard/sessions"
              className="text-[11px] font-medium text-brand-primary/85 hover:text-brand-primary"
            >
              View →
            </Link>
          </div>
          <Muted className="mb-3 text-[12px]">Next confirmed meetings</Muted>
          {upcomingSessions.length === 0 ? (
            <div className="rounded-lg bg-[#202356]/5 px-3 py-3.5">
              <Muted className="text-[12px]">No upcoming sessions scheduled.</Muted>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {upcomingSessions.map((session) => (
                <li
                  key={session.id}
                  className="rounded-lg bg-[#202356]/5 px-2.5 py-2"
                >
                  <TextSmall className="text-[12px] font-medium">
                    {session.client_name ?? "Client"}
                  </TextSmall>
                  <Muted className="mt-0.5 text-[11px]">
                    {sessionWhen(session.scheduled_at)}
                  </Muted>
                  <TextSmall className="mt-0.5 text-[11px] text-brand-primary/80">
                    {session.title || "Session"}
                  </TextSmall>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <div className="mb-0.5 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-[#829850]/15 text-[#5f7340]">
              <Briefcase className="size-3.5" />
            </span>
            <H3 className={advisorSurface.sectionTitle}>
              Recent Activity
            </H3>
          </div>
          <Muted className="mb-3 text-[12px]">Latest events across the book</Muted>
          {recentActivity.length === 0 ? (
            <div className="rounded-lg bg-muted/50 px-3 py-3.5">
              <Muted className="text-[12px]">No recent activity to show.</Muted>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {recentActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-lg bg-[#829850]/8 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <TextSmall className="text-[12px] font-medium leading-snug">
                      {activityLabel(item)}
                    </TextSmall>
                    <Muted className="text-[11px]">{item.clientName}</Muted>
                  </div>
                  <Muted className="shrink-0 text-[10px]">
                    {relativeActivity(item.createdAt)}
                  </Muted>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </section>
    </div>
  );
}

