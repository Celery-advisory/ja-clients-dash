"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import {
  ClientAttentionCards,
  ClientUpdateNote,
} from "@/components/clients/client-attention-cards";
import {
  ClientOverviewEmptyHero,
  ClientOverviewHero,
} from "@/components/clients/client-overview-hero";
import {
  ClientLatestReport,
  ClientPrimaryGoal,
} from "@/components/clients/client-primary-goal";
import { LatestReportHero } from "@/components/clients/client-reports-view";
import { PageShell } from "@/components/layout/page-shell";
import { Muted } from "@/components/ui/typography";
import type { ClientOverviewData } from "@/lib/wealth/client-overview";

function AllReportsLink() {
  return (
    <section>
      <p className="mb-2 text-sm font-medium">Reports</p>
      <Link
        href="/clients/dashboard/reports"
        className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-3.5 py-3 hover:bg-muted/40"
      >
        <FileText className="size-4 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-sm">See all your reports</span>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  );
}

export function ClientDashboardHome({
  overview,
  clientName,
}: {
  overview: ClientOverviewData | null;
  clientName: string;
}) {
  const firstName = overview?.clientName?.split(" ")[0] ?? clientName.split(" ")[0] ?? "there";
  const hasPortfolio = overview?.portfolio?.hasData ?? false;
  const latestReport = overview?.latestReport ?? null;
  // A published report with its headline numbers says more than the raw balance, so it leads.
  const reportLeads = latestReport?.summary != null;

  return (
    <PageShell className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium">Welcome back, {firstName}</h1>
        {overview?.portfolioLastUpdated ? (
          <Muted className="text-xs">Portfolio last updated {overview.portfolioLastUpdated}</Muted>
        ) : hasPortfolio ? null : (
          <Muted className="text-xs">
            Nothing loaded yet. Get in touch with us or your wealth manager to get started.
          </Muted>
        )}
      </header>

      {reportLeads && latestReport ? (
        <LatestReportHero report={latestReport} />
      ) : hasPortfolio && overview?.portfolio ? (
        <ClientOverviewHero
          totalUSD={overview.portfolio.totalUSD}
          ytdPct={overview.portfolio.ytdPct}
          periodGainUsd={overview.portfolio.periodGainUsd}
        />
      ) : (
        <ClientOverviewEmptyHero />
      )}

      {overview?.latestUpdate ? (
        <ClientUpdateNote
          title={overview.latestUpdate.title}
          body={overview.latestUpdate.body}
        />
      ) : null}

      <ClientAttentionCards
        nextSession={overview?.nextSession ?? null}
        pendingDocumentRequest={overview?.pendingDocumentRequest ?? null}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ClientPrimaryGoal goal={overview?.primaryGoal ?? null} />
        {reportLeads ? <AllReportsLink /> : <ClientLatestReport report={latestReport} />}
      </div>
    </PageShell>
  );
}
