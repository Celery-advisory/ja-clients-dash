"use client";

import Link from "next/link";
import {
  Calendar,
  Check,
  FileUp,
  Plus,
  Target,
} from "lucide-react";

import { DesignedEmptyState } from "@/components/advisors/designed-empty-state";
import { SectionLabel } from "@/components/advisors/section-label";
import { AllocationPieChart, AssetAreaChart } from "@/components/charts/asset-charts";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DashCard,
  DashCardContent,
  DashCardDescription,
  DashCardHeader,
  DashCardTitle,
} from "@/components/ui/dash-card";
import { KpiItem, KpiStrip } from "@/components/ui/kpi-strip";
import { Muted, TextSmall } from "@/components/ui/typography";
import { formatUsd } from "@/lib/wealth/constants";
import { cn } from "@/lib/utils";
import type { JaPortfolioSummary } from "@/lib/api/domain/wealth-portfolio";
import type { ClientGoal, ClientUpdate, WealthClient } from "@/lib/wealth/types";

type Tab = "Overview" | "Profile" | "Goals" | "Portfolio" | "Sessions" | "Documents" | "Messages" | "Reports" | "Notes";

type SetupStep = {
  id: string;
  label: string;
  done: boolean;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
};

function firstName(fullName: string) {
  return fullName.split(" ").filter(Boolean)[0] ?? fullName;
}

function formatMonthYear(value: string) {
  const iso = value.includes("T") ? value : `${value}T12:00:00`;
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function formatDayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function buildActivity(
  client: WealthClient,
  updates: ClientUpdate[],
  advisorName: string | null,
): { id: string; day: string; title: string; at: string }[] {
  if (updates.length > 0) {
    return updates.slice(0, 8).map((item) => ({
      id: item.id,
      day: formatDayLabel(item.created_at),
      title: item.title,
      at: item.created_at,
    }));
  }

  const synthetic: { id: string; day: string; title: string; at: string }[] = [];
  if (client.invited_at) {
    synthetic.push({
      id: "invite",
      day: formatDayLabel(client.invited_at),
      title: "Portal invitation sent",
      at: client.invited_at,
    });
  }
  if (client.created_at) {
    synthetic.push({
      id: "created",
      day: formatDayLabel(client.created_at),
      title: "Client profile created",
      at: client.created_at,
    });
  }
  if (advisorName && client.created_at) {
    synthetic.push({
      id: "assigned",
      day: formatDayLabel(client.created_at),
      title: `${client.full_name} assigned to ${advisorName}`,
      at: client.created_at,
    });
  }
  return synthetic;
}

export function ClientOverviewTab({
  client,
  portfolio,
  periodsCount,
  goals,
  updates,
  nextSession,
  advisorName,
  slices,
  onOpenTab,
  onActivate,
  onInvite,
}: {
  client: WealthClient;
  portfolio: JaPortfolioSummary | null;
  periodsCount: number;
  goals: ClientGoal[];
  updates: ClientUpdate[];
  nextSession: string | null;
  advisorName: string | null;
  slices: { name: string; value: number; color: string }[];
  onOpenTab: (tab: Tab) => void;
  onActivate: () => void;
  onInvite: () => void;
}) {
  const givenName = firstName(client.full_name);
  const statementHref = `/advisors/dashboard/clients/${client.id}/statement`;
  const hasHistory = Boolean(portfolio && portfolio.history.length > 1);
  const hasAllocation = slices.length > 0;
  const hasStatement = periodsCount > 0;
  const hasGoals = goals.length > 0;
  const hasReview = Boolean(client.next_review_date || nextSession);
  const portalReady = Boolean(client.invited_at || client.auth_user_id);

  const setupSteps: SetupStep[] = [
    { id: "profile", label: "Client profile", done: true },
    { id: "portal", label: "Portal invitation sent", done: portalReady, actionLabel: "Invite", onAction: onInvite },
    {
      id: "statement",
      label: "Add statement data",
      done: hasStatement,
      actionLabel: "Add",
      href: statementHref,
    },
    {
      id: "goals",
      label: "Create financial goals",
      done: hasGoals,
      actionLabel: "Add",
      onAction: () => onOpenTab("Goals"),
    },
    {
      id: "review",
      label: "Schedule first review",
      done: hasReview,
      actionLabel: "Schedule",
      onAction: () => onOpenTab("Sessions"),
    },
  ];

  const doneCount = setupSteps.filter((step) => step.done).length;
  const nextStep = setupSteps.find((step) => !step.done);
  const setupComplete = doneCount === setupSteps.length;
  const showOnboarding = client.status === "onboarding";
  const showReviewBanner = client.status === "review_due";
  const showArchivedBanner = client.status === "inactive";
  const showQuickActions = !showOnboarding || setupComplete;
  const activity = buildActivity(client, updates, advisorName);
  const totalValue = portfolio?.totalUSD ?? 0;
  const periodGain = portfolio?.periodGainUsd ?? 0;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <section className="flex flex-col gap-3">
        <SectionLabel>Client snapshot</SectionLabel>
        <div className="grid grid-cols-1 divide-y divide-border/70 overflow-hidden rounded-(--radius-card) border border-border/60 bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <SnapshotCell
            label="Next review"
            value={
              client.next_review_date
                ? new Date(`${client.next_review_date}T12:00:00`).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })
                : "Not scheduled"
            }
            hint={
              client.review_cadence
                ? client.review_cadence.replace("_", " ")
                : "No cadence"
            }
            action={
              !client.next_review_date ? (
                <button
                  type="button"
                  onClick={() => onOpenTab("Profile")}
                  className="text-[11px] font-medium text-brand-primary hover:underline"
                >
                  Set cadence
                </button>
              ) : null
            }
          />
          <SnapshotCell
            label="Next session"
            value={
              nextSession
                ? new Date(nextSession).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })
                : "None scheduled"
            }
            hint={
              nextSession
                ? new Date(nextSession).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "No upcoming meeting"
            }
            action={
              !nextSession ? (
                <button
                  type="button"
                  onClick={() => onOpenTab("Sessions")}
                  className="text-[11px] font-medium text-brand-primary hover:underline"
                >
                  Schedule
                </button>
              ) : null
            }
          />
        </div>
      </section>

      {showArchivedBanner ? (
        <div className="rounded-(--radius-card) border border-border/60 bg-muted/40 px-4 py-3">
          <TextSmall className="font-medium">This client is archived</TextSmall>
          <Muted className="text-[13px]">
            Restore them from the menu to resume portfolio management.
          </Muted>
        </div>
      ) : null}

      {showReviewBanner ? (
        <div className="rounded-(--radius-card) border border-destructive/20 bg-destructive/5 px-4 py-3">
          <TextSmall className="font-medium">Review is due</TextSmall>
          <Muted className="text-[13px]">
            Schedule a session or update the next review date on the profile.
          </Muted>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onOpenTab("Sessions")}>
              Schedule session
            </Button>
            <Button size="sm" variant="outline" onClick={() => onOpenTab("Profile")}>
              Update review date
            </Button>
          </div>
        </div>
      ) : null}

      {showOnboarding ? (
        <section className="flex flex-col gap-3">
          <SectionLabel>
            {setupComplete ? "Client setup" : "Client onboarding"}
          </SectionLabel>
          <div className="rounded-(--radius-card) border border-border/60 bg-card px-5 py-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <TextSmall className="font-semibold">
                  {setupComplete
                    ? `${givenName} is ready to manage`
                    : `Complete ${givenName}'s onboarding`}
                </TextSmall>
                <Muted className="text-[13px]">
                  {setupComplete
                    ? "Setup is finished. Mark this client as active to switch into a performance view."
                    : "This is why the dashboard is empty, and what needs to happen next."}
                </Muted>
              </div>
              <Muted className="text-[11px] font-medium uppercase tracking-[0.12em]">
                {doneCount} of {setupSteps.length} complete
              </Muted>
            </div>

            <div className="mt-4 flex items-center gap-1.5" aria-hidden>
              {setupSteps.map((step, index) => (
                <div key={step.id} className="flex flex-1 items-center gap-1.5">
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      step.done ? "bg-brand-accent" : "bg-border",
                    )}
                  />
                  {index < setupSteps.length - 1 ? (
                    <span
                      className={cn(
                        "h-px w-full",
                        step.done ? "bg-brand-accent/50" : "bg-border",
                      )}
                    />
                  ) : null}
                </div>
              ))}
            </div>

            <ul className="mt-5 flex flex-col">
              {setupSteps.map((step) => (
                <li
                  key={step.id}
                  className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 last:border-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full",
                        step.done
                          ? "bg-brand-primary text-primary-foreground"
                          : "border border-border bg-background",
                      )}
                    >
                      {step.done ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <TextSmall className={cn(step.done && "text-muted-foreground")}>
                      {step.label}
                    </TextSmall>
                  </div>
                  {!step.done && (step.href || step.onAction) ? (
                    step.href ? (
                      <Link
                        href={step.href}
                        className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                      >
                        {step.actionLabel}
                      </Link>
                    ) : (
                      <Button size="xs" variant="outline" onClick={step.onAction}>
                        {step.actionLabel}
                      </Button>
                    )
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex justify-end">
              {setupComplete ? (
                <Button size="sm" onClick={onActivate}>
                  Mark as active
                </Button>
              ) : nextStep?.href ? (
                <Link href={nextStep.href} className={cn(buttonVariants({ size: "sm" }))}>
                  Continue setup
                </Link>
              ) : (
                <Button size="sm" onClick={nextStep?.onAction}>
                  Continue setup
                </Button>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionLabel>Financial overview</SectionLabel>
        <KpiStrip>
          <KpiItem
            label="Portfolio value"
            value={formatUsd(totalValue)}
            subline={hasStatement ? "Latest statement total" : "No portfolio data recorded"}
            emphasis="primary"
          />
          <KpiItem
            label="Period gain"
            value={formatUsd(periodGain)}
            subline={hasStatement ? "Invested capital this period" : "No gain recorded"}
            trend={hasStatement ? (periodGain >= 0 ? "up" : "down") : "neutral"}
          />
          <KpiItem
            label="YTD return"
            value={`${(portfolio?.ytdPct ?? 0).toFixed(1)}%`}
            subline="Statement YTD"
          />
          <KpiItem
            label="Active goals"
            value={String(goals.length)}
            subline={hasGoals ? "On the client plan" : "Create a goal"}
            onClick={() => onOpenTab("Goals")}
          />
        </KpiStrip>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Portfolio insights</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <DashCard className="lg:col-span-2" padding="sm">
            <DashCardHeader className="mb-2">
              <div>
                <DashCardTitle className="text-base">Portfolio allocation</DashCardTitle>
                <DashCardDescription>
                  How {givenName}&apos;s portfolio is distributed
                </DashCardDescription>
              </div>
            </DashCardHeader>
            <DashCardContent>
              {hasAllocation ? (
                <AllocationPieChart data={slices} />
              ) : (
                <DesignedEmptyState
                  variant="allocation"
                  title="No portfolio data yet"
                  description={`Add statement data to see how ${givenName}'s investments are allocated.`}
                  action={
                    <Link href={statementHref} className={cn(buttonVariants({ size: "sm" }))}>
                      Add statement data
                    </Link>
                  }
                />
              )}
            </DashCardContent>
          </DashCard>
          <DashCard className="lg:col-span-3" padding="sm">
            <DashCardHeader className="mb-2">
              <div>
                <DashCardTitle className="text-base">Value over time</DashCardTitle>
                <DashCardDescription>Track portfolio growth over time</DashCardDescription>
              </div>
            </DashCardHeader>
            <DashCardContent>
              {hasHistory ? (
                <AssetAreaChart
                  data={portfolio!.history}
                  color="#202356"
                  gradientId={`hist-${client.id}`}
                  height={220}
                  yAxisLabel="Value (USD)"
                  seriesLabel="Portfolio value"
                />
              ) : (
                <DesignedEmptyState
                  variant="trend"
                  title="No portfolio history yet"
                  description="Portfolio trends will appear here once statement periods have been added."
                  action={
                    <Link
                      href={statementHref}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Add statement
                    </Link>
                  }
                />
              )}
            </DashCardContent>
          </DashCard>
        </div>
      </section>

      {showQuickActions ? (
        <section className="flex flex-col gap-3">
          <SectionLabel>Quick actions</SectionLabel>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <QuickAction
              href={statementHref}
              icon={Plus}
              title="Add statement"
              hint="Enter portfolio data"
            />
            <QuickAction
              icon={Target}
              title="Create goal"
              hint="Add a financial target"
              onClick={() => onOpenTab("Goals")}
            />
            <QuickAction
              icon={Calendar}
              title="Schedule session"
              hint="Book the next meeting"
              onClick={() => onOpenTab("Sessions")}
            />
            <QuickAction
              icon={FileUp}
              title="Upload document"
              hint="Add to the vault"
              onClick={() => onOpenTab("Documents")}
            />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionLabel
          action={
            activity.length > 0 ? (
              <button
                type="button"
                onClick={() => onOpenTab("Notes")}
                className="text-[11px] font-medium text-brand-primary hover:underline"
              >
                View all
              </button>
            ) : null
          }
        >
          Recent activity
        </SectionLabel>
        <div className="rounded-(--radius-card) border border-border/60 bg-card">
          {activity.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Muted>No activity yet. Setup steps and portfolio updates will appear here.</Muted>
            </div>
          ) : (
            <ul>
              {activity.map((item, index) => (
                <li
                  key={item.id}
                  className={cn(
                    "grid grid-cols-[5.5rem_1fr] items-baseline gap-3 px-5 py-3",
                    index < activity.length - 1 && "border-b border-border/50",
                  )}
                >
                  <Muted className="text-[11px] uppercase tracking-[0.08em]">{item.day}</Muted>
                  <TextSmall>{item.title}</TextSmall>
                </li>
              ))}
            </ul>
          )}
        </div>
        {client.inception_date || client.created_at ? (
          <Muted className="text-[12px]">
            Client since {formatMonthYear((client.inception_date ?? client.created_at) as string)}
            {advisorName ? `. Wealth manager: ${advisorName}` : null}
          </Muted>
        ) : null}
      </section>
    </div>
  );
}

function SnapshotCell({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums tracking-tight">{value}</p>
      <div className="flex items-center gap-2">
        <p className="text-[11px] text-muted-foreground">{hint}</p>
        {action}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  hint,
  onClick,
}: {
  href?: string;
  icon: typeof Plus;
  title: string;
  hint: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="size-4" />
      </span>
      <span className="flex flex-col">
        <TextSmall className="font-medium">{title}</TextSmall>
        <Muted className="text-[12px]">{hint}</Muted>
      </span>
    </>
  );

  const className =
    "flex items-center gap-3 rounded-(--radius-card) border border-border/60 bg-card px-4 py-3.5 text-left transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-border hover:bg-muted/40 active:scale-[0.99] motion-reduce:active:scale-100";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
